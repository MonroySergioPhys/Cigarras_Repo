/**
 * Sonograma en tiempo real ("waterfall").
 *
 * A diferencia del sonograma offline (STFT completa con Plotly),
 * aquí usamos un AnalyserNode + canvas puro: cada frame se pinta una
 * columna nueva a la derecha con los colores de energía por banda de
 * frecuencia, y el resto de la imagen se desplaza un píxel a la
 * izquierda. Así los datos viejos "se caen" del borde solos — no hay
 * que borrar nada a mano ni recalcular una matriz gigante cada vez.
 *
 * Reutiliza la misma paleta que el sonograma offline (colorscale
 * "inferno") para que ambas vistas se sientan parte de la misma app.
 */

const INFERNO_STOPS = [
    [0.00, [0, 0, 4]],
    [0.15, [27, 12, 65]],
    [0.30, [74, 12, 107]],
    [0.45, [120, 28, 109]],
    [0.60, [165, 44, 96]],
    [0.72, [207, 68, 70]],
    [0.82, [237, 105, 37]],
    [0.92, [252, 165, 10]],
    [1.00, [252, 255, 164]]
];

function infernoRGB(t) {
    const clamped = Math.min(1, Math.max(0, t));

    for (let i = 1; i < INFERNO_STOPS.length; i++) {
        const [t0, c0] = INFERNO_STOPS[i - 1];
        const [t1, c1] = INFERNO_STOPS[i];

        if (clamped <= t1) {
            const localT = (clamped - t0) / (t1 - t0);
            return [
                c0[0] + (c1[0] - c0[0]) * localT,
                c0[1] + (c1[1] - c0[1]) * localT,
                c0[2] + (c1[2] - c0[2]) * localT
            ];
        }
    }

    return INFERNO_STOPS[INFERNO_STOPS.length - 1][1];
}

/**
 * Inicia la captura del micrófono y arranca el dibujo de la cascada
 * sobre el canvas dado. Devuelve { stop } para cortar todo (mic,
 * AudioContext, animación) cuando el usuario salga del modo en vivo.
 */
export async function startLiveSpectrogram(canvas, options = {}) {
    const {
        fftSize = 2048,
        minDecibels = -100,
        maxDecibels = -30,
        smoothing = 0.35
    } = options;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.minDecibels = minDecibels;
    analyser.maxDecibels = maxDecibels;
    analyser.smoothingTimeConstant = smoothing;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);

    const ctx = canvas.getContext("2d");
    let animationId = null;
    let running = true;
    let lastWidth = 0;
    let lastHeight = 0;

    function syncCanvasSize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));

        if (width !== lastWidth || height !== lastHeight) {
            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = "#000004";
            ctx.fillRect(0, 0, width, height);
            lastWidth = width;
            lastHeight = height;
        }
    }

    function drawColumn() {
        const width = canvas.width;
        const height = canvas.height;

        // Desplaza todo el contenido un píxel a la izquierda:
        // esto es lo que "elimina" los datos más viejos.
        ctx.drawImage(canvas, 1, 0, width - 1, height, 0, 0, width - 1, height);

        analyser.getByteFrequencyData(freqData);

        const column = ctx.createImageData(1, height);

        for (let y = 0; y < height; y++) {
            // Graves abajo, agudos arriba.
            const bin = Math.min(
                bufferLength - 1,
                Math.floor(((height - 1 - y) / height) * bufferLength)
            );
            const [r, g, b] = infernoRGB(freqData[bin] / 255);

            const i = y * 4;
            column.data[i] = r;
            column.data[i + 1] = g;
            column.data[i + 2] = b;
            column.data[i + 3] = 255;
        }

        ctx.putImageData(column, width - 1, 0);
    }

    function loop() {
        if (!running) return;
        animationId = requestAnimationFrame(loop);
        syncCanvasSize();
        drawColumn();
    }

    syncCanvasSize();
    loop();

    function stop() {
        running = false;
        if (animationId !== null) cancelAnimationFrame(animationId);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
    }

    return { stop };
}