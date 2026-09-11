import { loadAudio } from "./audio.js";

const audioFile = document.getElementById("audioFile");
const recordButton = document.getElementById("recordButton");
const audioInfo = document.getElementById("audioInfo");

audioFile.addEventListener("change", handleAudioFile);

async function handleAudioFile(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    try {
        console.log("Archivo seleccionado:", file.name);

        const audio = await loadAudio(file);

        console.log("AudioBuffer:", audio.audioBuffer);
        console.log("Duración:", audio.duration);
        console.log("Frecuencia de muestreo:", audio.sampleRate);
        console.log("Canales:", audio.numberOfChannels);
        console.log("Muestras:", audio.numberOfSamples);

        displayAudioInfo(file, audio);

    } catch (error) {
        console.error("Error al cargar el audio:", error);

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

recordButton.addEventListener("click", () => {
    console.log("Función de grabación próximamente...");
});