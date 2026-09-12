const plotConfig = {
    responsive: true,
    displaylogo: false,
    displayModeBar: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    scrollZoom: false
};

const colors = {
    ink: "#16241e",
    soft: "#5c6d64",
    grid: "rgba(40,65,53,.10)",
    teal: "#147d6b",
    gold: "#d9a441",
    coral: "#c65d4d",
    purple: "#7057a3",
    blue: "#3d5a80"
};

const commonLayout = {
    autosize: true,
    font: { family: "DM Sans, Arial, sans-serif", color: colors.ink, size: 11 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    margin: { l: 58, r: 20, t: 20, b: 52 },
    hoverlabel: { bgcolor: "#16241e", font: { color: "white" } },
    showlegend: false
};

function resizeSoon(container) {
    requestAnimationFrame(() => {
        if (container?.data) Plotly.Plots.resize(container);
    });
}

function axis(title, extra = {}) {
    return {
        title: { text: title, font: { size: 11 } },
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        fixedrange: false,
        ...extra
    };
}

export function plotWaveform(container, samples, sampleRate, options = {}) {
    const maxPoints = 5000;
    const step = Math.max(1, Math.ceil(samples.length / maxPoints));
    const time = [];
    const upper = [];
    const lower = [];

    for (let start = 0; start < samples.length; start += step) {
        const end = Math.min(samples.length, start + step);
        let min = Infinity, max = -Infinity;
        for (let i = start; i < end; i++) {
            min = Math.min(min, samples[i]);
            max = Math.max(max, samples[i]);
        }
        time.push((start + (end - start) / 2) / sampleRate);
        upper.push(max);
        lower.push(min);
    }

    const envelope = {
        x: [...time, ...time.slice().reverse()],
        y: [...upper, ...lower.slice().reverse()],
        type: "scatter",
        mode: "lines",
        fill: "toself",
        fillcolor: "rgba(20,125,107,.13)",
        line: { color: "rgba(20,125,107,.25)", width: 1 },
        hoverinfo: "skip"
    };

    const center = {
        x: time,
        y: upper.map((v, i) => (v + lower[i]) / 2),
        type: "scatter",
        mode: "lines",
        line: { color: colors.teal, width: 1.25 },
        name: "Señal"
    };

    const absPeakIndex = samples.reduce((best, value, index) =>
        Math.abs(value) > Math.abs(samples[best]) ? index : best, 0);
    const peak = {
        x: [absPeakIndex / sampleRate],
        y: [samples[absPeakIndex]],
        type: "scatter",
        mode: "markers",
        marker: { size: 9, color: colors.gold, line: { color: "white", width: 2 } },
        name: "Máximo"
    };

    const layout = {
        ...commonLayout,
        xaxis: axis("Tiempo (s)", { rangeslider: { visible: false } }),
        yaxis: axis("Amplitud", { zeroline: true }),
        hovermode: "x unified",
        shapes: [{ type: "line", x0: 0, x1: 1, xref: "paper", y0: 0, y1: 0, line: { color: colors.grid, width: 1 } }]
    };

    Plotly.react(container, [envelope, center, peak], layout, plotConfig);
    resizeSoon(container);
}

export function plotSpectrum(container, spectrum) {
    const peakIndex = spectrum.amplitudes.indexOf(spectrum.dominantAmplitude);
    const peakFrequency = spectrum.frequencies[peakIndex];

    const trace = {
        x: spectrum.frequencies,
        y: spectrum.amplitudes,
        type: "scatter",
        mode: "lines",
        line: { color: colors.purple, width: 1.7 },
        fill: "tozeroy",
        fillcolor: "rgba(112,87,163,.08)",
        name: "Espectro"
    };

    const marker = {
        x: [peakFrequency],
        y: [spectrum.dominantAmplitude],
        type: "scatter",
        mode: "markers",
        marker: { size: 10, color: colors.gold, line: { color: "white", width: 2 } },
        text: [`Dominante: ${peakFrequency.toFixed(1)} Hz`],
        hovertemplate: "%{text}<br>Amplitud: %{y:.4f}<extra></extra>"
    };

    const layout = {
        ...commonLayout,
        xaxis: axis("Frecuencia (Hz)", { rangemode: "tozero" }),
        yaxis: axis("Amplitud", { rangemode: "tozero" }),
        hovermode: "x"
    };

    Plotly.react(container, [trace, marker], layout, plotConfig);
    resizeSoon(container);
}

export function plotSpectrogram(container, spectrogram, options = {}) {
    const z = spectrogram.frequencies.map((_, k) =>
        spectrogram.times.map((_, t) => spectrogram.values[t][k])
    );

    const trace = {
        x: spectrogram.times,
        y: spectrogram.frequencies,
        z: z,
        type: "heatmap",

        colorscale: "Inferno",
        zmin: -160,
        zmax: -60,
        zsmooth: false,

        colorbar: {
            title: {
                text: "Magnitud [dB]"
            }
        },

        hovertemplate:
            "Tiempo: %{x:.2f} s<br>" +
            "Frecuencia: %{y:.0f} Hz<br>" +
            "Magnitud: %{z:.1f} dB" +
            "<extra></extra>"
    };

    const layout = {
        title: {
            text: "Sonograma del segmento",
            font: {
                size: 18
            }
        },

        xaxis: {
            title: "Tiempo [s]",
            zeroline: false
        },

        yaxis: {
            title: "Frecuencia [Hz]",
            zeroline: false
        },

        margin: {
            l: 75,
            r: 85,
            t: 55,
            b: 60
        },

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",

        font: {
            color: "#333333"
        },

        uirevision: "spectrogram",
        datarevision: options.revision ?? Date.now()
    };

    Plotly.react(container, [trace], layout, plotConfig);
    resizeSoon(container);
}