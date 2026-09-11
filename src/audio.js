export async function loadAudio(file) {
    const arrayBuffer = await file.arrayBuffer();

    const audioContext = new AudioContext();

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return {
        audioBuffer,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        numberOfSamples: audioBuffer.length
    };
}