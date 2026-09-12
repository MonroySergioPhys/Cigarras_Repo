/* ==========================================================
   Configuración común
   ========================================================== */

const plotConfig = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: [
        "lasso2d",
        "select2d"
    ]
};

const commonLayout = {
    font: {
        family: "Public Sans, Arial, sans-serif"
    },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    margin: {
        l: 60,
        r: 20,
        t: 20,
        b: 50
    }
};


/* ==========================================================
   Forma de onda
   ========================================================== */

export function plotWaveform(
    container,
    samples,
    sampleRate
) {

    const maxPoints = 5000;

    let step = Math.ceil(
        samples.length / maxPoints
    );

    const time = [];
    const amplitude = [];

    for (let i = 0; i < samples.length; i += step) {

        time.push(i / sampleRate);
        amplitude.push(samples[i]);
    }

    const trace = {
        x: time,
        y: amplitude,
        type: "scatter",
        mode: "lines",
        line: {
            width: 1
        },
        name: "Amplitud"
    };

    const layout = {
        ...commonLayout,
        xaxis: {
            title: "Tiempo (s)"
        },
        yaxis: {
            title: "Amplitud"
        }
    };

    Plotly.react(
        container,
        [trace],
        layout,
        plotConfig
    );
}


/* ==========================================================
   Espectro
   ========================================================== */

export function plotSpectrum(
    container,
    spectrum
) {

    const trace = {
        x: spectrum.frequencies,
        y: spectrum.amplitudes,
        type: "scatter",
        mode: "lines",
        line: {
            width: 1.5
        },
        name: "Espectro"
    };

    const layout = {
        ...commonLayout,
        xaxis: {
            title: "Frecuencia (Hz)",
            rangemode: "tozero"
        },
        yaxis: {
            title: "Amplitud"
        }
    };

    Plotly.react(
        container,
        [trace],
        layout,
        plotConfig
    );
}


/* ==========================================================
   Sonograma
   ========================================================== */

export function plotSpectrogram(
    container,
    spectrogram
) {

    // Plotly espera:
    // z[y][x]
    //
    // Nuestra matriz está organizada como:
    // frame -> frecuencia
    //
    // Por eso la transponemos.

    const z = spectrogram.frequencies.map(
        (_, frequencyIndex) =>
            spectrogram.times.map(
                (_, timeIndex) =>
                    spectrogram.values[timeIndex][frequencyIndex]
            )
    );

    const trace = {
        x: spectrogram.times,
        y: spectrogram.frequencies,
        z,
        type: "heatmap",
        colorbar: {
            title: "dB"
        }
    };

    const layout = {
        ...commonLayout,
        xaxis: {
            title: "Tiempo (s)"
        },
        yaxis: {
            title: "Frecuencia (Hz)"
        }
    };

    Plotly.react(
        container,
        [trace],
        layout,
        plotConfig
    );
}