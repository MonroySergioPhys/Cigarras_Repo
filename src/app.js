import { loadAudio } from "./audio.js";
import { createRecorder, describeMicError } from "./recorder.js";

import {
    toMono,
    computeSpectrum,
    computeSpectrogram,
    chooseSpectrogramParams
} from "./analysis.js";

import {
    plotWaveform,
    plotSpectrum,
    plotSpectrogram
} from "./plotting.js";

const audioFile = document.getElementById("audioFile");
const recordButton = document.getElementById("recordButton");
const recordButtonText = document.getElementById("recordButtonText");
const recordStatus = document.getElementById("recordStatus");
const liveSpectrum = document.getElementById("liveSpectrum");
const audioInfo = document.getElementById("audioInfo");
const waveform = document.getElementById("waveform");
const spectrum = document.getElementById("spectrum");
const spectrogram = document.getElementById("spectrogram");

const loading = document.getElementById("loading");
const loadingIdle = document.getElementById("loadingIdle");
const loadingBar = document.getElementById("loadingBar");
const loadingProgress = document.getElementById("loadingProgress");
const loadingPercent = document.getElementById("loadingPercent");
const loadingText = document.getElementById("loadingText");
const loadingStage = document.getElementById("loadingStage");

const audioPlayback = document.getElementById("audioPlayback");
const audioPlayer = document.getElementById("audioPlayer");
const downloadLink = document.getElementById("downloadLink");

const selectionInfo = document.getElementById("selectionInfo");

let currentObjectUrl = null;

let isRecording = false;
let activeRecorder = null;
let vizAnimationId = null;

// Estado del audio cargado actualmente. Guardamos las muestras
// completas en mono una sola vez; cada cambio de intervalo en la
// línea de tiempo vuelve a analizar solo el pedazo seleccionado
// (ver "Selección de intervalo" más abajo), en vez de repetir el
// trabajo sobre el audio entero.
let currentSamples = null;
let currentSampleRate = null;
let currentDuration = null;
let selection = { start: 0, end: 0 };

// Ventana analizada por defecto al cargar un audio largo. Para
// audios más cortos que esto simplemente se usa el audio completo.
const DEFAULT_WINDOW_SECONDS = 20;
const MIN_SELECTION_SECONDS = 1;
const RELAYOUT_DEBOUNCE_MS = 350;

let relayoutTimer = null;
let waveformListenerAttached = false;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

audioFile.addEventListener("change", handleAudioFile);
recordButton.addEventListener("click", handleRecordClick);

// Si las gráficas quedan con un tamaño desactualizado (por ejemplo
// tras redimensionar la ventana), forzamos a Plotly a recalcularlas
// para que no se salgan de su recuadro.
window.addEventListener("resize", () => {
    [waveform, spectrum, spectrogram].forEach((el) => {
        if (el && el.data) {
            Plotly.Plots.resize(el);
        }
    });
});


/* ==========================================================
   Barra de carga
   ========================================================== */

function showLoading(initialStage = "Iniciando…") {
    loading.classList.remove("hidden", "error");
    loadingIdle.classList.add("hidden");
    setIndeterminate(initialStage);
}

function hideLoading() {
    loading.classList.add("hidden");
    loadingIdle.classList.remove("hidden");
}

function setProgress(percent, stageText) {
    const clamped = Math.max(0, Math.min(100, percent));

    loadingProgress.classList.remove("indeterminate");
    loadingProgress.style.width = `${clamped}%`;

    loadingBar.setAttribute("aria-valuenow", String(Math.round(clamped)));
    loadingPercent.textContent = `${Math.round(clamped)}%`;

    if (stageText) {
        loadingStage.textContent = stageText;
    }
}

function setIndeterminate(stageText) {
    loadingProgress.classList.add("indeterminate");
    loadingPercent.textContent = "…";
    loadingBar.removeAttribute("aria-valuenow");

    if (stageText) {
        loadingStage.textContent = stageText;
    }
}

function setLoadingError(message) {
    loading.classList.add("error");
    loadingText.textContent = "Error al procesar el audio";
    loadingStage.textContent = message;
    loadingPercent.textContent = "";
}


/* ==========================================================
   Carga de archivo de audio
   ========================================================== */

async function handleAudioFile(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    await processAudioFile(file);
}

/**
 * Procesa un archivo de audio (venga de <input type="file"> o de una
 * grabación recién terminada) mostrando la barra de carga y la
 * información resultante. callbacks.onSuccess/onError son opcionales,
 * por si el llamador necesita actualizar algo extra (como recordStatus).
 */
async function processAudioFile(file, callbacks = {}) {
    loadingText.textContent = "Procesando audio...";
    showLoading("Leyendo archivo…");

    try {
        console.log("Archivo seleccionado:", file.name);

        setIndeterminate("Decodificando audio…");
        const audio = await loadAudio(file);

        console.log("Duración:", audio.duration);
        console.log("Frecuencia de muestreo:", audio.sampleRate);
        console.log("Canales:", audio.numberOfChannels);
        console.log("Muestras:", audio.numberOfSamples);

        setProgress(20, "Preparando señal…");
        await nextFrame();
        const samples = toMono(audio);

        // Guardamos solo los metadatos como valores sueltos. El
        // objeto "audio" retiene por clausura el AudioBuffer original
        // (con los canales sin mezclar, el doble de pesado que
        // "samples" para un archivo estéreo); al dejar de usarlo aquí,
        // el motor de JS puede liberarlo antes de que empiece el resto
        // del análisis. Para una grabación de 30 minutos eso puede ser
        // varios cientos de MB que ya no hace falta tener en memoria.
        const audioMeta = {
            duration: audio.duration,
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
            numberOfSamples: audio.numberOfSamples
        };

        currentSamples = samples;
        currentSampleRate = audioMeta.sampleRate;
        currentDuration = audioMeta.duration;

        const initialEnd = Math.min(currentDuration, DEFAULT_WINDOW_SECONDS);

        setProgress(35, "Calculando forma de onda…");
        await nextFrame();
        plotWaveform(
            waveform,
            samples,
            audioMeta.sampleRate,
            {
                enableRangeSlider: true,
                initialRange: [0, initialEnd]
            }
        );
        attachRangeSelectorOnce();

        await computeAndPlotForRange(0, initialEnd, { reportProgress: setProgress });

        setProgress(100, "Listo");
        displayAudioInfo(file, audioMeta);
        setupPlayback(file);

        // Pequeña pausa para que se note el 100% antes de ocultar la barra
        setTimeout(hideLoading, 400);

        callbacks.onSuccess?.(audioMeta);

    } catch (error) {
        console.error("Error al cargar el audio:", error);

        setLoadingError(error.message || "Formato no soportado o archivo dañado.");

        audioInfo.innerHTML = `
            <p>No fue posible cargar el archivo.</p>
        `;
        audioPlayback.classList.add("hidden");

        callbacks.onError?.(error);
    }
}

function displayAudioInfo(file, audio) {
    audioInfo.innerHTML = `
        <p><strong>Archivo:</strong> ${file.name}</p>
        <p><strong>Formato:</strong> <span class="data-value">${file.type || "Desconocido"}</span></p>
        <p><strong>Duración:</strong> <span class="data-value">${audio.duration.toFixed(2)} s</span></p>
        <p><strong>Frecuencia de muestreo:</strong> <span class="data-value">${audio.sampleRate} Hz</span></p>
        <p><strong>Canales:</strong> <span class="data-value">${audio.numberOfChannels}</span></p>
        <p><strong>Muestras:</strong> <span class="data-value">${audio.numberOfSamples}</span></p>
    `;
}

/**
 * Prepara el reproductor y el enlace de descarga para el archivo
 * cargado o recién grabado. Revoca la URL anterior antes de crear
 * una nueva para no acumular objetos en memoria.
 */
function setupPlayback(file) {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
    }

    currentObjectUrl = URL.createObjectURL(file);

    audioPlayer.src = currentObjectUrl;
    downloadLink.href = currentObjectUrl;
    downloadLink.download = file.name;

    audioPlayback.classList.remove("hidden");
}


/* ==========================================================
   Selección de intervalo (línea de tiempo)
   ========================================================== */

/**
 * Calcula el espectro y el sonograma solo para el tramo
 * [startTime, endTime] del audio (en segundos) y actualiza esas
 * dos gráficas. reportProgress es opcional y sirve para reusar la
 * misma barra de "Progreso" tanto en la carga inicial como cuando
 * el usuario mueve la línea de tiempo después.
 */
async function computeAndPlotForRange(startTime, endTime, { reportProgress } = {}) {
    const startIdx = Math.floor(startTime * currentSampleRate);
    const endIdx = Math.min(
        currentSamples.length,
        Math.ceil(endTime * currentSampleRate)
    );
    const segment = currentSamples.subarray(startIdx, endIdx);

    reportProgress?.(55, "Calculando espectro…");
    await nextFrame();
    const spectrumData = computeSpectrum(segment, currentSampleRate);
    plotSpectrum(spectrum, spectrumData);

    reportProgress?.(85, "Calculando sonograma…");
    await nextFrame();
    // El hop/tamaño de FFT se adapta a la duración del tramo: un
    // intervalo pequeño mantiene la resolución fina de siempre, uno
    // muy grande (o el audio completo) engrosa el salto entre
    // ventanas para no calcular millones de cuadros y trabar la página.
    const { fftSize, hopSize } = chooseSpectrogramParams(segment.length);
    const spectrogramData = computeSpectrogram(
        segment,
        currentSampleRate,
        fftSize,
        hopSize
    );
    plotSpectrogram(spectrogram, spectrogramData);

    selection = { start: startTime, end: endTime };
    updateSelectionInfo();
}

function clampSelection(start, end) {
    const minSelection = Math.min(MIN_SELECTION_SECONDS, currentDuration);

    let s = Math.max(0, Math.min(start, currentDuration));
    let e = Math.max(0, Math.min(end, currentDuration));

    if (e < s) {
        [s, e] = [e, s];
    }

    if (e - s < minSelection) {
        e = Math.min(currentDuration, s + minSelection);
        s = Math.max(0, e - minSelection);
    }

    return { start: s, end: e };
}

function updateSelectionInfo() {
    if (!selectionInfo || !currentDuration) {
        return;
    }

    const { start, end } = selection;
    const isFullFile = start <= 0.001 && end >= currentDuration - 0.001;

    selectionInfo.textContent = isFullFile
        ? `Mostrando el audio completo (${formatTime(currentDuration)}).`
        : `Analizando ${formatTime(start)}–${formatTime(end)} de ${formatTime(currentDuration)} en total.`;
}

function formatTime(seconds) {
    const totalSeconds = Math.max(0, seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, "0")}`;
}

/**
 * Registra, una sola vez, el listener que escucha cuando el usuario
 * arrastra la línea de tiempo (el rangeslider bajo la forma de
 * onda) para elegir un nuevo intervalo a analizar.
 */
function attachRangeSelectorOnce() {
    if (waveformListenerAttached) {
        return;
    }

    waveformListenerAttached = true;
    waveform.on("plotly_relayout", handleWaveformRelayout);
}

function handleWaveformRelayout(eventData) {
    if (!currentSamples) {
        return;
    }

    let newStart;
    let newEnd;

    if (
        eventData["xaxis.range[0]"] !== undefined &&
        eventData["xaxis.range[1]"] !== undefined
    ) {
        newStart = eventData["xaxis.range[0]"];
        newEnd = eventData["xaxis.range[1]"];
    } else if (Array.isArray(eventData["xaxis.range"])) {
        [newStart, newEnd] = eventData["xaxis.range"];
    } else if (eventData["xaxis.autorange"]) {
        // El usuario restableció el zoom (doble clic): vuelve a
        // mostrar todo el audio.
        newStart = 0;
        newEnd = currentDuration;
    } else {
        // Otro tipo de evento de relayout (leyenda, etc.), lo ignoramos.
        return;
    }

    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(() => {
        runSelectionAnalysis(newStart, newEnd);
    }, RELAYOUT_DEBOUNCE_MS);
}

async function runSelectionAnalysis(rawStart, rawEnd) {
    const { start, end } = clampSelection(rawStart, rawEnd);

    // Si el intervalo prácticamente no cambió, no recalculamos nada.
    if (
        Math.abs(start - selection.start) < 0.05 &&
        Math.abs(end - selection.end) < 0.05
    ) {
        return;
    }

    loadingText.textContent = "Analizando intervalo seleccionado...";
    showLoading("Extrayendo intervalo…");

    try {
        await computeAndPlotForRange(start, end, { reportProgress: setProgress });
        setProgress(100, "Listo");
        setTimeout(hideLoading, 300);
    } catch (error) {
        console.error("Error al analizar el intervalo:", error);
        setLoadingError("No fue posible analizar ese intervalo.");
    }
}


/* ==========================================================
   Grabación
   ========================================================== */

async function handleRecordClick() {
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
}

async function startRecording() {
    recordButton.disabled = true;
    recordStatus.textContent = "Solicitando acceso al micrófono…";

    try {
        activeRecorder = await createRecorder();
    } catch (error) {
        console.error("Error al acceder al micrófono:", error);
        recordStatus.textContent = describeMicError(error);
        recordButton.disabled = false;
        return;
    }

    isRecording = true;
    recordButton.disabled = false;
    recordButton.setAttribute("aria-pressed", "true");
    recordButtonText.textContent = "Detener";
    recordStatus.textContent = "Grabando…";

    liveSpectrum.classList.remove("hidden");
    startLiveVisualization(activeRecorder.analyser);

    activeRecorder.start();
}

async function stopRecording() {
    if (!activeRecorder) {
        return;
    }

    isRecording = false;
    recordButton.disabled = true;
    recordButton.setAttribute("aria-pressed", "false");
    recordButtonText.textContent = "Grabar";
    recordStatus.textContent = "Procesando grabación…";

    stopLiveVisualization();
    liveSpectrum.classList.add("hidden");

    const blob = await activeRecorder.stop();
    activeRecorder = null;
    recordButton.disabled = false;

    const extension = blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `grabacion-${Date.now()}.${extension}`, {
        type: blob.type
    });

    await processAudioFile(file, {
        onSuccess: () => {
            recordStatus.textContent = "Grabación lista.";
        },
        onError: () => {
            recordStatus.textContent = "Error al procesar la grabación.";
        }
    });
}

function startLiveVisualization(analyser) {
    const ctx = liveSpectrum.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const { width, height } = liveSpectrum;

    function draw() {
        vizAnimationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * height;
            ctx.fillStyle = `hsl(${38 + (dataArray[i] / 255) * 25}, 75%, ${50 + (dataArray[i] / 255) * 15}%)`;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    draw();
}

function stopLiveVisualization() {
    if (vizAnimationId !== null) {
        cancelAnimationFrame(vizAnimationId);
        vizAnimationId = null;
    }
}