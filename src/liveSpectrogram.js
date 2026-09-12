/**
 * Sonograma en tiempo real ("waterfall") + espectro en vivo + marcador
 * de frecuencia dominante.
 *
 * Todo corre del mismo AnalyserNode y del mismo bucle requestAnimationFrame
 * para no pedir datos del micrófono dos veces por frame:
 *
 * 1. Cascada: cada frame se pinta una columna nueva a la derecha y todo
 *    lo anterior se desplaza un píxel a la izquierda (así "caen" los
 *    datos viejos solos).
 * 2. Marcador de frecuencia dominante: un punto brillante sobre la
 *    columna nueva, en la altura correspondiente al bin con más energía.
 *    Como se dibuja en cada columna, con el tiempo queda una traza que
 *    muestra cómo evolucionó la frecuencia dominante.
 * 3. Espectro en vivo: barras de energía por frecuencia, redibujadas
 *    completas cada frame (esto sí puede "crecer y decaer" libremente
 *    porque no se desplaza, se reemplaza).
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

function formatFrequency(hz) {
    if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
    return `${Math.round(hz)} Hz`;
}

/**
 * @param {Object} elements
 * @param {HTMLCanvasElement} elements.waterfallCanvas
 * @param {HTMLCanvasElement} [elements.spectrumCanvas]
 * @param {(text: string) => void} [elements.onDominantFrequency] callback ya formateado ("432 Hz")
 */
export async function startLiveSpectrogram(elements, options = {}) {
    const { waterfallCanvas, spectrumCanvas, onDominantFrequency } = elements;

    const {
        fftSize = 2048,
        minDecibels = -100,
        maxDecibels = -30,
        smoothing = 0.35,
        minFrequency = 80 // ignora zumbido/DC muy bajo al buscar la dominante
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
    const binHz = audioContext.sampleRate / fftSize;
    const minBin = Math.max(1, Math.floor(minFrequency / binHz));

    const wctx = waterfallCanvas.getContext("2d");
    const sctx = spectrumCanvas ? spectrumCanvas.getContext("2d") : null;

    let running = true;
    let animationId = null;
    let labelFrameCounter = 0;

    let waterfallSize = { width: 0, height: 0 };
    let spectrumSize = { width: 0, height: 0 };

    function syncSize(canvas, cache) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));

        if (width !== cache.width || height !== cache.height) {
            canvas.width = width;
            canvas.height = height;
            cache.width = width;
            cache.height = height;
            return true;
        }
        return false;
    }

    function findDominantBin() {
        let maxValue = -1;
        let maxBin = minBin;

        for (let i = minBin; i < bufferLength; i++) {
            if (freqData[i] > maxValue) {
                maxValue = freqData[i];
                maxBin = i;
            }
        }

        return { bin: maxBin, value: maxValue };
    }

    function drawWaterfallColumn(dominantBin, dominantValue) {
        const isNewSize = syncSize(waterfallCanvas, waterfallSize);
        if (isNewSize) {
            wctx.fillStyle = "#000004";
            wctx.fillRect(0, 0, waterfallCanvas.width, waterfallCanvas.height);
        }

        const width = waterfallCanvas.width;
        const height = waterfallCanvas.height;

        wctx.drawImage(waterfallCanvas, 1, 0, width - 1, height, 0, 0, width - 1, height);

        const column = wctx.createImageData(1, height);

        for (let y = 0; y < height; y++) {
            const bin = Math.min(bufferLength - 1, Math.floor(((height - 1 - y) / height) * bufferLength));
            const [r, g, b] = infernoRGB(freqData[bin] / 255);
            const i = y * 4;
            column.data[i] = r;
            column.data[i + 1] = g;
            column.data[i + 2] = b;
            column.data[i + 3] = 255;
        }

        wctx.putImageData(column, width - 1, 0);

        // Marcador de frecuencia dominante: solo si hay energía real,
        // para no marcar ruido de fondo como si fuera una señal.
        if (dominantValue > 40) {
            const y = height - 1 - Math.floor((dominantBin / bufferLength) * height);
            wctx.fillStyle = "#8be9fd";
            wctx.fillRect(width - 3, Math.max(0, y - 1), 3, 3);
        }
    }

    function drawSpectrumChart(dominantBin, dominantValue) {
        if (!sctx) return;

        syncSize(spectrumCanvas, spectrumSize);
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;

        sctx.clearRect(0, 0, width, height);
        sctx.fillStyle = "#0b0f0c";
        sctx.fillRect(0, 0, width, height);

        const barWidth = width / bufferLength;

        for (let i = 0; i < bufferLength; i++) {
            const t = freqData[i] / 255;
            const barHeight = t * height;
            const [r, g, b] = infernoRGB(t);
            sctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
            sctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.5), barHeight);
        }

        if (dominantValue > 40) {
            const x = (dominantBin / bufferLength) * width;
            sctx.strokeStyle = "#8be9fd";
            sctx.lineWidth = Math.max(1, barWidth);
            sctx.beginPath();
            sctx.moveTo(x, height);
            sctx.lineTo(x, 0);
            sctx.stroke();
        }
    }

    function loop() {
        if (!running) return;
        animationId = requestAnimationFrame(loop);

        analyser.getByteFrequencyData(freqData);
        const { bin, value } = findDominantBin();

        drawWaterfallColumn(bin, value);
        drawSpectrumChart(bin, value);

        // Actualizar el texto ~10 veces por segundo en vez de 60:
        // números cambiando a 60fps son ilegibles, no aportan nada.
        labelFrameCounter++;
        if (onDominantFrequency && labelFrameCounter % 6 === 0) {
            const text = value > 40 ? formatFrequency(bin * binHz) : "—";
            onDominantFrequency(text);
        }
    }

    loop();

    function stop() {
        running = false;
        if (animationId !== null) cancelAnimationFrame(animationId);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
    }

    return { stop };
}