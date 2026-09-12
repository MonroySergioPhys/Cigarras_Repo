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
   Espectro
   ========================================================== */

export function computeSpectrum(samples, sampleRate, fftSize = 4096) {

    const N = Math.min(fftSize, samples.length);

    const window = hannWindow(N);
    const segment = new Float64Array(N);

    // Tomamos el comienzo de la señal para el primer espectro.
    for (let i = 0; i < N; i++) {
        segment[i] = samples[i] * window[i];
    }

    const { real, imag } = fft(segment);

    const frequencies = [];
    const amplitudes = [];

    for (let k = 0; k <= N / 2; k++) {

        const frequency = (k * sampleRate) / N;

        let magnitude =
            Math.sqrt(
                real[k] ** 2 +
                imag[k] ** 2
            ) / N;

        // Espectro unilateral
        if (k !== 0 && k !== N / 2) {
            magnitude *= 2;
        }

        frequencies.push(frequency);
        amplitudes.push(magnitude);
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