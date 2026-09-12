/**
 * Procesamiento de señales para el laboratorio Cicadas.
 *
 * Incluye conversión a mono, FFT radix-2, espectro tipo Welch y STFT.
 * Los límites de cuadros mantienen la visualización manejable incluso
 * cuando el audio original dura decenas de minutos.
 */

export function toMono(audio) {
    if (audio.numberOfChannels === 1) return audio.getSamples(0);

    const left = audio.getSamples(0);
    const right = audio.getSamples(1);
    const mono = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i] + right[i]) / 2;
    }
    return mono;
}

export function fft(signal) {
    const N = signal.length;
    if ((N & (N - 1)) !== 0) {
        throw new Error("El tamaño de la FFT debe ser una potencia de 2.");
    }

    const real = new Float64Array(signal);
    const imag = new Float64Array(N);

    let j = 0;
    for (let i = 1; i < N; i++) {
        let bit = N >> 1;
        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if (i < j) [real[i], real[j]] = [real[j], real[i]];
    }

    for (let size = 2; size <= N; size *= 2) {
        const half = size / 2;
        const angle = -2 * Math.PI / size;
        const phaseReal = Math.cos(angle);
        const phaseImag = Math.sin(angle);
        let currentReal = 1;
        let currentImag = 0;

        for (let i = 0; i < half; i++) {
            for (let j = i; j < N; j += size) {
                const k = j + half;
                const tempReal = currentReal * real[k] - currentImag * imag[k];
                const tempImag = currentReal * imag[k] + currentImag * real[k];
                real[k] = real[j] - tempReal;
                imag[k] = imag[j] - tempImag;
                real[j] += tempReal;
                imag[j] += tempImag;
            }
            const nextReal = currentReal * phaseReal - currentImag * phaseImag;
            currentImag = currentReal * phaseImag + currentImag * phaseReal;
            currentReal = nextReal;
        }
    }

    return { real, imag };
}

function hannWindow(N) {
    const window = new Float64Array(N);
    if (N === 1) { window[0] = 1; return window; }
    for (let n = 0; n < N; n++) {
        window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    }
    return window;
}

function previousPowerOfTwo(n) {
    let p = 1;
    while (p * 2 <= n) p *= 2;
    return p;
}

const MAX_SPECTRUM_FRAMES = 96;
const MAX_SPECTROGRAM_FRAMES = 1000;

export function chooseSpectrogramParams(numSamples, idealFftSize = 2048, idealHopSize = 512) {
    const fftSize = Math.min(idealFftSize, previousPowerOfTwo(Math.max(1, numSamples)));
    let hopSize = Math.min(idealHopSize, fftSize);
    let frames = Math.max(1, Math.floor((numSamples - fftSize) / hopSize) + 1);

    while (frames > MAX_SPECTROGRAM_FRAMES) {
        hopSize *= 2;
        frames = Math.max(1, Math.floor((numSamples - fftSize) / hopSize) + 1);
    }
    return { fftSize, hopSize };
}

export function computeSignalMetrics(samples, sampleRate) {
    let sumSquares = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let previous = samples[0] || 0;

    for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        sumSquares += value * value;
        peak = Math.max(peak, Math.abs(value));
        if (i > 0 && ((value >= 0 && previous < 0) || (value < 0 && previous >= 0))) zeroCrossings++;
        previous = value;
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const crestFactor = rms > 0 ? peak / rms : 0;
    const zcr = samples.length > 1 ? zeroCrossings / (samples.length - 1) : 0;

    return {
        duration: samples.length / sampleRate,
        rms,
        peak,
        crestFactor,
        zeroCrossingRate: zcr
    };
}

/** Espectro medio tipo Welch, limitado a 96 FFT para que la interfaz siga fluida. */
export function computeSpectrum(samples, sampleRate, fftSize = 4096) {
    const size = Math.max(2, Math.min(fftSize, previousPowerOfTwo(samples.length)));
    const window = hannWindow(size);
    const bins = size / 2 + 1;
    const hop = Math.max(1, Math.floor(size / 2));
    const possibleFrames = Math.max(1, Math.floor((samples.length - size) / hop) + 1);
    const framesToUse = Math.min(MAX_SPECTRUM_FRAMES, possibleFrames);
    const sum = new Float64Array(bins);

    let framesUsed = 0;
    for (let frameIndex = 0; frameIndex < framesToUse; frameIndex++) {
        const logicalIndex = framesToUse === 1 ? 0 : Math.round(frameIndex * (possibleFrames - 1) / (framesToUse - 1));
        const start = logicalIndex * hop;
        const segment = new Float64Array(size);

        for (let i = 0; i < size; i++) segment[i] = (samples[start + i] ?? 0) * window[i];

        const { real, imag } = fft(segment);
        for (let k = 0; k < bins; k++) {
            let magnitude = Math.sqrt(real[k] ** 2 + imag[k] ** 2) / size;
            if (k !== 0 && k !== size / 2) magnitude *= 2;
            sum[k] += magnitude;
        }
        framesUsed++;
    }

    const frequencies = new Array(bins);
    const amplitudes = new Array(bins);
    let maxIndex = 1;
    let maxAmplitude = 0;
    let weightedFrequency = 0;
    let totalAmplitude = 0;

    for (let k = 0; k < bins; k++) {
        frequencies[k] = k * sampleRate / size;
        amplitudes[k] = sum[k] / Math.max(1, framesUsed);
        totalAmplitude += amplitudes[k];
        weightedFrequency += frequencies[k] * amplitudes[k];
        if (k > 0 && amplitudes[k] > maxAmplitude) {
            maxAmplitude = amplitudes[k];
            maxIndex = k;
        }
    }

    const dominantFrequency = frequencies[maxIndex];
    const centroid = totalAmplitude > 0 ? weightedFrequency / totalAmplitude : 0;

    return {
        frequencies,
        amplitudes,
        dominantFrequency,
        dominantAmplitude: maxAmplitude,
        spectralCentroid: centroid,
        fftSize: size,
        framesUsed
    };
}

export function computeSpectrogram(samples, sampleRate, fftSize = 2048, hopSize = 512) {
    const size = Math.max(2, Math.min(fftSize, previousPowerOfTwo(samples.length)));
    const hop = Math.max(1, Math.min(hopSize, size));
    const window = hannWindow(size);
    const frames = Math.max(1, Math.floor((samples.length - size) / hop) + 1);
    const bins = size / 2 + 1;

    const frequencies = new Array(bins);
    for (let k = 0; k < bins; k++) frequencies[k] = k * sampleRate / size;

    const times = new Array(frames);
    const values = new Array(frames);
    const minDb = -90;

    for (let frame = 0; frame < frames; frame++) {
        const start = frame * hop;
        const segment = new Float64Array(size);
        for (let n = 0; n < size; n++) segment[n] = (samples[start + n] ?? 0) * window[n];

        const { real, imag } = fft(segment);
        const row = new Array(bins);

        for (let k = 0; k < bins; k++) {
            const magnitude = Math.sqrt(real[k] ** 2 + imag[k] ** 2) / size;
            row[k] = Math.max(minDb, 20 * Math.log10(Math.max(magnitude, 1e-10)));
        }

        times[frame] = (start + size / 2) / sampleRate;
        values[frame] = row;
    }

    return { times, frequencies, values, fftSize: size, hopSize: hop, minDb, maxDb: 0 };
}
