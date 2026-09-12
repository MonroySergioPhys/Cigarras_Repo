import { loadAudio } from "./audio.js";
import { createRecorder, describeMicError } from "./recorder.js";

const audioFile = document.getElementById("audioFile");
const recordButton = document.getElementById("recordButton");
const recordButtonText = document.getElementById("recordButtonText");
const recordStatus = document.getElementById("recordStatus");
const liveSpectrum = document.getElementById("liveSpectrum");
const audioInfo = document.getElementById("audioInfo");

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

let currentObjectUrl = null;

let isRecording = false;
let activeRecorder = null;
let vizAnimationId = null;

audioFile.addEventListener("change", handleAudioFile);
recordButton.addEventListener("click", handleRecordClick);


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

        console.log("AudioBuffer:", audio.audioBuffer);
        console.log("Duración:", audio.duration);
        console.log("Frecuencia de muestreo:", audio.sampleRate);
        console.log("Canales:", audio.numberOfChannels);
        console.log("Muestras:", audio.numberOfSamples);

        setProgress(100, "Listo");
        displayAudioInfo(file, audio);
        setupPlayback(file);

        // Pequeña pausa para que se note el 100% antes de ocultar la barra
        setTimeout(hideLoading, 400);

        callbacks.onSuccess?.(audio);

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