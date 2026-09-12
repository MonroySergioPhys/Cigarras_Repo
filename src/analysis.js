/**
 * Herramientas de análisis espectral para señales de audio.
 *
 * Incluye:
 * - Conversión a mono
 * - FFT
 * - Espectro de amplitud
 * - STFT para sonogramas
 */


/* ==========================================================
   Conversión a mono
   ========================================================== */

export function toMono(audio) {
    const channels = audio.numberOfChannels;

    if (channels === 1) {
        return audio.getSamples(0);
    }

    const left = audio.getSamples(0);
    const right = audio.getSamples(1);

    const mono = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) / 2;
    }

    return mono;
}


/* ==========================================================
   FFT
   ========================================================== */

export function fft(signal) {
    const N = signal.length;

    if ((N & (N - 1)) !== 0) {
        throw new Error("El tamaño de la FFT debe ser una potencia de 2.");
    }

    const real = new Float64Array(signal);
    const imag = new Float64Array(N);

    // Bit reversal
    let j = 0;

    for (let i = 1; i < N; i++) {
        let bit = N >> 1;

        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }

        j ^= bit;

        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
        }
    }

    // Danielson-Lanczos
    for (let size = 2; size <= N; size *= 2) {

        const halfSize = size / 2;
        const angle = -2 * Math.PI / size;

        const phaseReal = Math.cos(angle);
        const phaseImag = Math.sin(angle);

        let currentReal = 1;
        let currentImag = 0;

        for (let i = 0; i < halfSize; i++) {

            for (let j = i; j < N; j += size) {

                const k = j + halfSize;

                const tempReal =
                    currentReal * real[k] -
                    currentImag * imag[k];

                const tempImag =
                    currentReal * imag[k] +
                    currentImag * real[k];

                real[k] = real[j] - tempReal;
                imag[k] = imag[j] - tempImag;

                real[j] += tempReal;
                imag[j] += tempImag;
            }

            const nextReal =
                currentReal * phaseReal -
                currentImag * phaseImag;

            currentImag =
                currentReal * phaseImag +
                currentImag * phaseReal;

            currentReal = nextReal;
        }
    }

    return { real, imag };
}


/* ==========================================================
   Ventana de Hann
   ========================================================== */

function hannWindow(N) {
    const window = new Float64Array(N);

    for (let n = 0; n < N; n++) {
        window[n] =
            0.5 *
            (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    }

    return window;
}


/* ==========================================================
   Resolución automática (evita congelar la pestaña)
   ========================================================== */

// Si el intervalo elegido es muy largo (o es el audio completo),
// calcular un FFT/STFT por cada ventana posible puede significar
// millones de cuadros y congelar el navegador. Estas funciones
// van agrandando el salto entre ventanas ("hop") hasta que el
// número de cuadros quede acotado. Mientras más corto el intervalo
// que el usuario selecciona, más cerca se queda del hop ideal
// (mejor resolución) — y por eso analizar un tramo pequeño se
// siente instantáneo, mientras que uno enorme sigue siendo rápido
// aunque con menos detalle.
const MAX_SPECTRUM_FRAMES = 3000;
const MAX_SPECTROGRAM_FRAMES = 1200;

function previousPowerOfTwo(n) {
    let p = 1;
    while (p * 2 <= n) {
        p *= 2;
    }
    return p;
}

export function chooseSpectrogramParams(
    numSamples,
    idealFftSize = 1024,
    idealHopSize = 256
) {
    const fftSize = Math.min(idealFftSize, previousPowerOfTwo(numSamples));

    let hopSize = Math.min(idealHopSize, fftSize);
    let frames = Math.floor((numSamples - fftSize) / hopSize) + 1;

    while (frames > MAX_SPECTROGRAM_FRAMES) {
        hopSize *= 2;
        frames = Math.floor((numSamples - fftSize) / hopSize) + 1;
    }

    return { fftSize, hopSize };
}


/* ==========================================================
   Espectro
   ========================================================== */

/**
 * Calcula el espectro de amplitud promediando ventanas de Hann
 * superpuestas a lo largo de TODO el tramo recibido (método de
 * Welch), en lugar de mirar solo el primer fragmento. Así el
 * resultado refleja el contenido de frecuencia del intervalo
 * completo que se está analizando, no solo sus primeros ~0.1 s.
 */
export function computeSpectrum(samples, sampleRate, fftSize = 4096) {

    const size = Math.max(1, Math.min(fftSize, previousPowerOfTwo(samples.length)));
    const window = hannWindow(size);
    const bins = Math.floor(size / 2) + 1;

    let hop = Math.max(1, Math.floor(size / 2));
    let frameCount = Math.floor((samples.length - size) / hop) + 1;

    while (frameCount > MAX_SPECTRUM_FRAMES) {
        hop *= 2;
        frameCount = Math.floor((samples.length - size) / hop) + 1;
    }

    const sum = new Float64Array(bins);
    let framesUsed = 0;

    const accumulateFrame = (start) => {
        const segment = new Float64Array(size);

        for (let i = 0; i < size; i++) {
            segment[i] = (samples[start + i] ?? 0) * window[i];
        }

        const { real, imag } = fft(segment);

        for (let k = 0; k < bins; k++) {
            let magnitude = Math.sqrt(real[k] ** 2 + imag[k] ** 2) / size;

            if (k !== 0 && k !== size / 2) {
                magnitude *= 2;
            }

            sum[k] += magnitude;
        }

        framesUsed++;
    };

    for (let start = 0; start + size <= samples.length; start += hop) {
        accumulateFrame(start);
    }

    // Intervalo más corto que una sola ventana: igual calculamos
    // una FFT del tramo disponible, rellenando con ceros.
    if (framesUsed === 0) {
        accumulateFrame(0);
    }

    const frequencies = new Array(bins);
    const amplitudes = new Array(bins);

    for (let k = 0; k < bins; k++) {
        frequencies[k] = (k * sampleRate) / size;
        amplitudes[k] = sum[k] / framesUsed;
    }

    return {
        frequencies,
        amplitudes
    };
}


/* ==========================================================
   STFT
   ========================================================== */

export function computeSpectrogram(
    samples,
    sampleRate,
    fftSize = 1024,
    hopSize = 256
) {

    const window = hannWindow(fftSize);

    const frames = Math.floor(
        (samples.length - fftSize) / hopSize
    ) + 1;

    const frequencies = new Array(fftSize / 2 + 1);

    for (let k = 0; k <= fftSize / 2; k++) {
        frequencies[k] =
            (k * sampleRate) / fftSize;
    }

    const times = new Array(frames);
    const spectrogram = new Array(frames);

    for (let frame = 0; frame < frames; frame++) {

        const start = frame * hopSize;

        const segment = new Float64Array(fftSize);

        for (let n = 0; n < fftSize; n++) {
            segment[n] =
                samples[start + n] * window[n];
        }

        const { real, imag } = fft(segment);

        const magnitudes = new Array(fftSize / 2 + 1);

        for (let k = 0; k <= fftSize / 2; k++) {

            const magnitude =
                Math.sqrt(
                    real[k] ** 2 +
                    imag[k] ** 2
                ) / fftSize;

            // Pasamos a decibelios.
            magnitudes[k] =
                20 * Math.log10(
                    Math.max(magnitude, 1e-10)
                );
        }

        times[frame] =
            (start + fftSize / 2) / sampleRate;

        spectrogram[frame] = magnitudes;
    }

    return {
        times,
        frequencies,
        values: spectrogram
    };
}