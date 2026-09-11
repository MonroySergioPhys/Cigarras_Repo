/**
 * Crea un grabador de audio a partir del micrófono del usuario.
 *
 * Expone un AnalyserNode (para visualización en vivo mientras se graba)
 * y los métodos start()/stop(). stop() devuelve un Blob con el audio
 * grabado, listo para pasar por el mismo pipeline que un archivo subido.
 *
 * A diferencia de audio.js (análisis offline sobre un AudioBuffer ya
 * decodificado), aquí el AnalyserNode sí es la herramienta correcta:
 * necesitamos una vista en tiempo real de lo que está entrando por
 * el micrófono, no un análisis completo posterior.
 */
export async function createRecorder() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const mimeType = pickSupportedMimeType();
    const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
    );

    const chunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
        }
    });

    function start() {
        chunks.length = 0;
        mediaRecorder.start();
    }

    function stop() {
        return new Promise((resolve, reject) => {
            mediaRecorder.addEventListener(
                "stop",
                async () => {
                    const blob = new Blob(chunks, {
                        type: mediaRecorder.mimeType || "audio/webm"
                    });

                    await cleanup();
                    resolve(blob);
                },
                { once: true }
            );

            mediaRecorder.addEventListener(
                "error",
                async (event) => {
                    await cleanup();
                    reject(event.error);
                },
                { once: true }
            );

            mediaRecorder.stop();
        });
    }

    async function cleanup() {
        stream.getTracks().forEach((track) => track.stop());
        await audioContext.close();
    }

    return { analyser, start, stop };
}

function pickSupportedMimeType() {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus"
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/**
 * Traduce errores comunes de getUserMedia/MediaRecorder a mensajes
 * legibles para el usuario.
 */
export function describeMicError(error) {
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
        return "La grabación requiere una conexión segura (HTTPS) o localhost.";
    }

    switch (error.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "Permiso de micrófono denegado. Revisa los permisos del navegador.";
        case "NotFoundError":
            return "No se encontró ningún micrófono conectado.";
        case "NotReadableError":
            return "El micrófono está siendo usado por otra aplicación.";
        default:
            return "No fue posible acceder al micrófono.";
    }
}