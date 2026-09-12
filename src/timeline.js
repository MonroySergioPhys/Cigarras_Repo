const canvas = document.getElementById("timelineCanvas");
const ctx = canvas.getContext("2d");
const startInput = document.getElementById("timelineStart");
const endInput = document.getElementById("timelineEnd");
const selectionOverlay = document.getElementById("timelineSelection");
const startLabel = document.getElementById("timelineStartLabel");
const endLabel = document.getElementById("timelineEndLabel");
const selectionTime = document.getElementById("selectionTime");

let duration = 0;
let samples = null;
let callback = null;
let resizeObserver = null;

export function initializeTimeline(audioSamples, audioDuration, onSelectionChange) {
    samples = audioSamples;
    duration = audioDuration;
    callback = onSelectionChange;

    startInput.value = 0;
    endInput.value = 100;
    drawOverview();
    updateSelection();

    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => drawOverview());
        resizeObserver.observe(canvas.parentElement);
    }
}

function drawOverview() {
    if (!samples?.length) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const center = height * .53;
    const scale = height * .38;
    const columns = Math.max(120, Math.floor(width));
    const perColumn = samples.length / columns;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#e9eee9";
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    for (let x = 0; x < columns; x++) {
        const start = Math.floor(x * perColumn);
        const end = Math.min(samples.length, Math.max(start + 1, Math.floor((x + 1) * perColumn)));
        let min = 1, max = -1;
        for (let i = start; i < end; i++) {
            const v = samples[i];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        ctx.moveTo(x * width / columns, center - max * scale);
        ctx.lineTo(x * width / columns, center - min * scale);
    }
    ctx.strokeStyle = "#4f7164";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(width, center);
    ctx.strokeStyle = "rgba(22,36,30,.14)";
    ctx.stroke();

    const { start, end } = getSelectionPercent();
    selectionOverlay.style.left = `${start}%`;
    selectionOverlay.style.width = `${Math.max(0, end - start)}%`;
}

function getSelectionPercent() {
    return { start: Number(startInput.value), end: Number(endInput.value) };
}

function updateSelection() {
    let start = Number(startInput.value);
    let end = Number(endInput.value);
    const minGap = duration ? Math.min(1 / duration * 100, 100) : 0.1;

    if (end - start < minGap) {
        if (document.activeElement === startInput) {
            start = Math.max(0, end - minGap);
            startInput.value = start;
        } else {
            end = Math.min(100, start + minGap);
            endInput.value = end;
        }
    }

    const startTime = duration * start / 100;
    const endTime = duration * end / 100;

    startLabel.textContent = formatTime(startTime);
    endLabel.textContent = formatTime(endTime);
    selectionTime.textContent = `${formatTime(startTime)} — ${formatTime(endTime)}`;
    selectionOverlay.style.left = `${start}%`;
    selectionOverlay.style.width = `${end - start}%`;

    callback?.(startTime, endTime);
}

startInput.addEventListener("input", updateSelection);
endInput.addEventListener("input", updateSelection);

function formatTime(seconds) {
    const total = Math.max(0, seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
}
