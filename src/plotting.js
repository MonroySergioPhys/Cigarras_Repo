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

// Fuerza a Plotly a recalcular sus dimensiones justo después de
// pintar. Evita que el gráfico quede "congelado" con un tamaño
// viejo (por ejemplo si la tipografía web todavía estaba cargando
// o el layout de la página se acomodó después) y termine
// desbordando el recuadro que lo contiene.
function resizeSoon(container) {
    requestAnimationFrame(() => {
        Plotly.Plots.resize(container);
    });
}

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

/**
 * options.enableRangeSlider: agrega la barra de selección de
 * intervalo bajo la forma de onda (nuestra "línea de tiempo").
 * options.initialRange: [inicio, fin] en segundos a mostrar
 * seleccionado inicialmente en esa barra.
 */
export function plotWaveform(
    container,
    samples,
    sampleRate,
    options = {}
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

    const xaxis = {
        title: "Tiempo (s)"
    };

    if (options.enableRangeSlider) {
        xaxis.rangeslider = {
            visible: true,
            thickness: 0.16,
            bgcolor: "#EDEFE9",
            bordercolor: "#A9B7AC",
            borderwidth: 1
        };
    }

    if (options.initialRange) {
        xaxis.range = options.initialRange;
    }

    const layout = {
        ...commonLayout,
        xaxis,
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

    resizeSoon(container);
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

    resizeSoon(container);
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

    resizeSoon(container);
}