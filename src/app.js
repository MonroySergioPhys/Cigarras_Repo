import { loadAudio } from "./audio.js";
import { createRecorder, describeMicError } from "./recorder.js";
import {
    toMono,
    computeSpectrum,
    computeSpectrogram,
    computeSignalMetrics,
    chooseSpectrogramParams
} from "./analysis.js";
import { plotWaveform, plotSpectrum, plotSpectrogram } from "./plotting.js";
import { initializeTimeline } from "./timeline.js";
import { startLiveSpectrogram } from "./liveSpectrogram.js";

const audioFile = document.getElementById("audioFile");
const recordButton = document.getElementById("recordButton");
const recordButtonText = document.getElementById("recordButtonText");
const recordStatus = document.getElementById("recordStatus");
const liveSpectrum = document.getElementById("liveSpectrum");
const liveModeButton = document.getElementById("liveModeButton");
const liveModeButtonText = document.getElementById("liveModeButtonText");
const liveModeStatus = document.getElementById("liveModeStatus");
const liveSpectrogramSection = document.getElementById("liveSpectrogramSection");
const liveSpectrogramCanvas = document.getElementById("liveSpectrogramCanvas");
const audioInfo = document.getElementById("audioInfo");
const audioBadge = document.getElementById("audioBadge");
const audioPlayback = document.getElementById("audioPlayback");
const audioPlayer = document.getElementById("audioPlayer");
const downloadLink = document.getElementById("downloadLink");

const timelineSection = document.getElementById("timelineSection");
const waveform = document.getElementById("waveform");
const spectrum = document.getElementById("spectrum");
const spectrogram = document.getElementById("spectrogram");
const waveformStats = document.getElementById("waveformStats");
const spectrumStats = document.getElementById("spectrumStats");
const insights = document.getElementById("insights");

const loading = document.getElementById("loading");
const loadingIdle = document.getElementById("loadingIdle");
const loadingBar = document.getElementById("loadingBar");
const loadingProgress = document.getElementById("loadingProgress");
const loadingPercent = document.getElementById("loadingPercent");
const loadingText = document.getElementById("loadingText");
const loadingStage = document.getElementById("loadingStage");

let currentObjectUrl = null;
let currentSamples = null;
let currentSampleRate = 0;
let currentDuration = 0;
let currentFile = null;
let analysisTimer = null;
let analysisToken = 0;
let spectrogramRevision = 0;
let isRecording = false;
let activeRecorder = null;
let vizAnimationId = null;
let liveSession = null;
let isLiveMode = false;

const DEFAULT_WINDOW_SECONDS = 20;
const MIN_SELECTION_SECONDS = 1;
const MAX_AUTO_ANALYSIS_SECONDS = 60;

// ------------------------------------------------------------
// Carga
// ------------------------------------------------------------

audioFile.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file) await processAudioFile(file);
});
recordButton.addEventListener("click", handleRecordClick);
liveModeButton.addEventListener("click", handleLiveModeClick);
window.addEventListener("resize", () => {
    [waveform, spectrum, spectrogram].forEach((el) => {
        if (el?.data) Plotly.Plots.resize(el);
    });
});

async function processAudioFile(file, callbacks = {}) {
    loadingText.textContent = "Procesando audio...";
    showLoading("Decodificando la grabación…");
    analysisToken++;

    try {
        const audio = await loadAudio(file);
        const samples = toMono(audio);

        currentFile = file;
        currentSamples = samples;
        currentSampleRate = audio.sampleRate;
        currentDuration = audio.duration;

        const initialEnd = Math.min(currentDuration, DEFAULT_WINDOW_SECONDS);

        displayAudioInfo(file, audio);
        setupPlayback(file);
        audioBadge.textContent = currentDuration > 300 ? "Audio largo" : "Listo para analizar";
        audioBadge.className = `badge ${currentDuration > 300 ? "neutral" : "ready"}`;

        setProgress(28, "Construyendo navegación temporal…");
        await nextFrame();
        timelineSection.classList.remove("hidden");
        initializeTimeline(samples, currentDuration, scheduleRangeAnalysis, {
            initialSelectionSeconds: DEFAULT_WINDOW_SECONDS,
            maxSelectionSeconds: MAX_AUTO_ANALYSIS_SECONDS
        });

        setProgress(45, "Preparando forma de onda…");
        await nextFrame();
        plotWaveform(waveform, samples, currentSampleRate);

        // Para un archivo corto se analiza completo; para uno largo se usa
        // una ventana inicial pequeña y el usuario decide qué estudiar.
        clearTimeout(analysisTimer);
        const end = currentDuration <= DEFAULT_WINDOW_SECONDS ? currentDuration : initialEnd;
        await analyzeRange(0, end, { showProgress: true });

        setProgress(100, "Análisis listo");
        setTimeout(hideLoading, 350);
        callbacks.onSuccess?.(audio);
    } catch (error) {
        console.error(error);
        setLoadingError(error.message || "Formato no soportado o archivo dañado.");
        audioInfo.innerHTML = `<p class="empty-state">No fue posible cargar el archivo.</p>`;
        audioPlayback.classList.add("hidden");
        callbacks.onError?.(error);
    }
}

function displayAudioInfo(file, audio) {
    audioInfo.innerHTML = `
        <div class="audio-meta-grid">
            <div class="meta-card"><span>Archivo</span><strong title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</strong></div>
            <div class="meta-card"><span>Duración</span><strong>${formatTime(audio.duration)}</strong></div>
            <div class="meta-card"><span>Muestreo</span><strong>${audio.sampleRate.toLocaleString()} Hz</strong></div>
            <div class="meta-card"><span>Canales</span><strong>${audio.numberOfChannels}</strong></div>
        </div>`;
}

function setupPlayback(file) {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(file);
    audioPlayer.src = currentObjectUrl;
    downloadLink.href = currentObjectUrl;
    downloadLink.download = file.name;
    audioPlayback.classList.remove("hidden");
}

// ------------------------------------------------------------
// Selección y análisis
// ------------------------------------------------------------

function scheduleRangeAnalysis(start, end) {
    clearTimeout(analysisTimer);
    analysisToken++; // invalida cualquier análisis pendiente/anterior
    analysisTimer = setTimeout(() => {
        analyzeRange(start, end, { showProgress: true });
    }, 220);
}

async function analyzeRange(startTime, endTime, { showProgress = false } = {}) {
    if (!currentSamples || !currentSampleRate) return;

    const min = Math.min(MIN_SELECTION_SECONDS, currentDuration);
    let start = Math.max(0, Math.min(startTime, currentDuration));
    let end = Math.max(0, Math.min(endTime, currentDuration));
    if (end < start) [start, end] = [end, start];
    if (end - start < min) end = Math.min(currentDuration, start + min);

    // Protección explícita: nunca lanzamos una STFT gigantesca por accidente.
    if (end - start > MAX_AUTO_ANALYSIS_SECONDS) {
        end = start + MAX_AUTO_ANALYSIS_SECONDS;
        if (end > currentDuration) {
            end = currentDuration;
            start = Math.max(0, end - MAX_AUTO_ANALYSIS_SECONDS);
        }
    }

    const token = ++analysisToken;
    const revision = ++spectrogramRevision;
    const startIdx = Math.floor(start * currentSampleRate);
    const endIdx = Math.min(currentSamples.length, Math.ceil(end * currentSampleRate));
    const segment = currentSamples.subarray(startIdx, endIdx);

    if (showProgress) showLoading("Analizando intervalo…");
    if (showProgress) setProgress(18, `Intervalo ${formatTime(start)} — ${formatTime(end)}`);

    await nextFrame();
    if (token !== analysisToken) return;
    plotWaveform(waveform, segment, currentSampleRate, { initialRange: [0, end - start] });

    const metrics = computeSignalMetrics(segment, currentSampleRate);
    renderWaveformStats(metrics);
    if (showProgress) setProgress(48, "Calculando espectro FFT…");

    await nextFrame();
    if (token !== analysisToken) return;
    const spectrumData = computeSpectrum(segment, currentSampleRate);
    plotSpectrum(spectrum, spectrumData);
    renderSpectrumStats(spectrumData);

    if (showProgress) setProgress(72, "Calculando sonograma STFT…");
    await nextFrame();
    if (token !== analysisToken) return;

    const { fftSize, hopSize } = chooseSpectrogramParams(segment.length);
    const spectrogramData = computeSpectrogram(segment, currentSampleRate, fftSize, hopSize);
    plotSpectrogram(spectrogram, spectrogramData, { revision });

    renderInsights(metrics, spectrumData, spectrogramData, start, end);
    if (showProgress) setProgress(96, "Actualizando indicadores…");
}

function renderWaveformStats(metrics) {
    waveformStats.innerHTML = `
        ${stat("RMS", formatNumber(metrics.rms, 4))}
        ${stat("Pico |x|", formatNumber(metrics.peak, 4))}
        ${stat("Crest factor", formatNumber(metrics.crestFactor, 2))}`;
}

function renderSpectrumStats(data) {
    spectrumStats.innerHTML = `
        ${stat("Frecuencia dominante", `${formatNumber(data.dominantFrequency, 1)} Hz`)}
        ${stat("Centroide", `${formatNumber(data.spectralCentroid, 1)} Hz`)}
        ${stat("NFFT", data.fftSize.toLocaleString())}`;
}

function renderInsights(metrics, spectrumData, stft, start, end) {
    insights.innerHTML = `
        ${insight("◌", "Duración analizada", formatTime(end - start), "Región seleccionada")}
        ${insight("⌁", "Frecuencia dominante", `${formatNumber(spectrumData.dominantFrequency, 1)} Hz`, "Máximo espectral")}
        ${insight("∿", "Nivel RMS", formatNumber(metrics.rms, 4), "Energía media de la señal")}
        ${insight("≈", "Resolución STFT", `${formatNumber(currentSampleRate / stft.fftSize, 1)} Hz`, `${stft.fftSize} puntos por ventana`)}`;
}

function stat(label, value) {
    return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}
function insight(icon, label, value, description) {
    return `<div class="insight"><div class="icon">${icon}</div><span>${label}</span><strong>${value}</strong><p>${description}</p></div>`;
}

// ------------------------------------------------------------
// Grabación
// ------------------------------------------------------------

async function handleRecordClick() {
    if (isRecording) await stopRecording();
    else await startRecording();
}

async function startRecording() {
    if (isLiveMode) {
        recordStatus.textContent = "Detén el sonograma en vivo antes de grabar.";
        return;
    }

    recordButton.disabled = true;
    recordStatus.textContent = "Solicitando acceso al micrófono…";
    try {
        activeRecorder = await createRecorder();
    } catch (error) {
        recordStatus.textContent = describeMicError(error);
        recordButton.disabled = false;
        return;
    }

    isRecording = true;
    recordButton.disabled = false;
    recordButton.setAttribute("aria-pressed", "true");
    recordButtonText.textContent = "Detener grabación";
    recordStatus.textContent = "Grabando en tiempo real…";
    liveSpectrum.classList.remove("hidden");
    startLiveVisualization(activeRecorder.analyser);
    activeRecorder.start();
}

async function stopRecording() {
    if (!activeRecorder) return;
    isRecording = false;
    recordButton.disabled = true;
    recordButton.setAttribute("aria-pressed", "false");
    recordButtonText.textContent = "Grabar con micrófono";
    recordStatus.textContent = "Preparando grabación…";
    stopLiveVisualization();
    liveSpectrum.classList.add("hidden");

    try {
        const blob = await activeRecorder.stop();
        activeRecorder = null;
        const extension = blob.type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `grabacion-${Date.now()}.${extension}`, { type: blob.type });
        await processAudioFile(file, {
            onSuccess: () => recordStatus.textContent = "Grabación lista para explorar."
        });
    } catch (error) {
        recordStatus.textContent = "No fue posible completar la grabación.";
    } finally {
        recordButton.disabled = false;
    }
}

function startLiveVisualization(analyser) {
    const ctx = liveSpectrum.getContext("2d");
    const data = new Uint8Array(analyser.frequencyBinCount);
    const { width, height } = liveSpectrum;

    function draw() {
        vizAnimationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        ctx.clearRect(0, 0, width, height);
        const barWidth = width / data.length;
        for (let i = 0; i < data.length; i++) {
            const h = data[i] / 255 * height;
            const hue = 145 - data[i] / 255 * 105;
            ctx.fillStyle = `hsl(${hue}, 55%, 55%)`;
            ctx.fillRect(i * barWidth, height - h, Math.max(1, barWidth - 1), h);
        }
    }
    draw();
}
function stopLiveVisualization() {
    if (vizAnimationId !== null) cancelAnimationFrame(vizAnimationId);
    vizAnimationId = null;
}

// ------------------------------------------------------------
// Sonograma en tiempo real (modo en vivo)
// ------------------------------------------------------------

async function handleLiveModeClick() {
    if (isLiveMode) await stopLiveMode();
    else await startLiveMode();
}

async function startLiveMode() {
    if (isRecording) {
        liveModeStatus.textContent = "Detén la grabación antes de entrar al modo en vivo.";
        return;
    }

    liveModeButton.disabled = true;
    liveModeStatus.textContent = "Solicitando acceso al micrófono…";
    liveSpectrogramSection.classList.remove("hidden");

    try {
        liveSession = await startLiveSpectrogram(liveSpectrogramCanvas);
    } catch (error) {
        liveModeStatus.textContent = describeMicError(error);
        liveSpectrogramSection.classList.add("hidden");
        liveModeButton.disabled = false;
        return;
    }

    isLiveMode = true;
    liveModeButton.disabled = false;
    liveModeButton.setAttribute("aria-pressed", "true");
    liveModeButtonText.textContent = "Detener sonograma en vivo";
    liveModeStatus.textContent = "Transmitiendo en vivo…";
    recordButton.disabled = true;
}

async function stopLiveMode() {
    if (!liveSession) return;

    liveSession.stop();
    liveSession = null;
    isLiveMode = false;

    liveModeButton.setAttribute("aria-pressed", "false");
    liveModeButtonText.textContent = "Iniciar sonograma en vivo";
    liveModeStatus.textContent = "";
    liveSpectrogramSection.classList.add("hidden");
    recordButton.disabled = false;
}

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------

function showLoading(stage = "Iniciando…") {
    loading.classList.remove("hidden", "error");
    loadingIdle.classList.add("hidden");
    loadingText.textContent = "Procesando audio…";
    setIndeterminate(stage);
}
function hideLoading() {
    loading.classList.add("hidden");
    loadingIdle.classList.remove("hidden");
}
function setProgress(percent, stage) {
    const value = Math.max(0, Math.min(100, percent));
    loadingProgress.classList.remove("indeterminate");
    loadingProgress.style.width = `${value}%`;
    loadingBar.setAttribute("aria-valuenow", String(Math.round(value)));
    loadingPercent.textContent = `${Math.round(value)}%`;
    if (stage) loadingStage.textContent = stage;
}
function setIndeterminate(stage) {
    loadingProgress.classList.add("indeterminate");
    loadingPercent.textContent = "…";
    loadingBar.removeAttribute("aria-valuenow");
    loadingStage.textContent = stage;
}
function setLoadingError(message) {
    loading.classList.add("error");
    loadingText.textContent = "No se pudo procesar";
    loadingStage.textContent = message;
    loadingPercent.textContent = "";
}
function nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }
function formatTime(seconds) {
    const total = Math.max(0, seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
}
function formatNumber(value, digits) {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}