import { loadAudio } from "./audio.js";

const audioFile = document.getElementById("audioFile");
const recordButton = document.getElementById("recordButton");
const recordButtonText = document.getElementById("recordButtonText");
const recordStatus = document.getElementById("recordStatus");
const audioInfo = document.getElementById("audioInfo");

const loading = document.getElementById("loading");
const loadingBar = document.getElementById("loadingBar");
const loadingProgress = document.getElementById("loadingProgress");
const loadingPercent = document.getElementById("loadingPercent");
const loadingText = document.getElementById("loadingText");
const loadingStage = document.getElementById("loadingStage");

let isRecording = false;

audioFile.addEventListener("change", handleAudioFile);
recordButton.addEventListener("click", handleRecordClick);


/* ==========================================================
   Barra de carga
   ========================================================== */

function showLoading(initialStage = "Iniciando…") {
    loading.classList.remove("hidden", "error");
    setIndeterminate(initialStage);
}

function hideLoading() {
    loading.classList.add("hidden");
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

        // Pequeña pausa para que se note el 100% antes de ocultar la barra
        setTimeout(hideLoading, 400);

    } catch (error) {
        console.error("Error al cargar el audio:", error);

        setLoadingError(error.message || "Formato no soportado o archivo dañado.");

        audioInfo.innerHTML = `
            <p>No fue posible cargar el archivo.</p>
        `;
    }
}

function displayAudioInfo(file, audio) {
    audioInfo.innerHTML = `
        <p><strong>Archivo:</strong> ${file.name}</p>
        <p><strong>Formato:</strong> ${file.type || "Desconocido"}</p>
        <p><strong>Duración:</strong> ${audio.duration.toFixed(2)} s</p>
        <p><strong>Frecuencia de muestreo:</strong> ${audio.sampleRate} Hz</p>
        <p><strong>Canales:</strong> ${audio.numberOfChannels}</p>
        <p><strong>Muestras:</strong> ${audio.numberOfSamples}</p>
    `;
}


/* ==========================================================
   Grabación (placeholder funcional)
   ========================================================== */

function handleRecordClick() {
    isRecording = !isRecording;

    recordButton.setAttribute("aria-pressed", String(isRecording));
    recordButtonText.textContent = isRecording ? "Detener" : "Grabar";
    recordStatus.textContent = isRecording
        ? "Grabando…"
        : "";

    if (isRecording) {
        console.log("Función de grabación próximamente...");
        // Aquí se conectará getUserMedia() + MediaRecorder cuando esté lista.
    }
}