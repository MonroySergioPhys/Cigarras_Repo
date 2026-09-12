/**
 * Decodifica un archivo de audio y devuelve tanto los metadatos
 * como acceso directo a las muestras (para análisis offline: FFT, STFT).
 *
 * El AudioContext se usa únicamente para decodificar y se cierra
 * inmediatamente después, ya que el análisis posterior (espectro,
 * sonograma) se hace sobre los arrays de muestras, no sobre nodos
 * de Web Audio.
 */
export async function loadAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        return {
            audioBuffer,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            numberOfSamples: audioBuffer.length,

            // Muestras del primer canal (mono o canal izquierdo si es estéreo).
            // Es lo que alimentará la FFT/STFT más adelante.
            getSamples(channel = 0) {
                return audioBuffer.getChannelData(channel);
            }
        };

    } finally {
        await audioContext.close();
    }
}
 