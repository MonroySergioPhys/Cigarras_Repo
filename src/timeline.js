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
let maxSelectionSeconds = 60;
let draggingSelection = false;
let dragStartX = 0;
let dragStartStart = 0;
let dragStartEnd = 0;

export function initializeTimeline(audioSamples, audioDuration, onSelectionChange, options = {}) {
    samples = audioSamples;
    duration = audioDuration;
    callback = onSelectionChange;
    maxSelectionSeconds = Math.max(1, Math.min(options.maxSelectionSeconds ?? 60, duration));

    const initialSeconds = Math.min(options.initialSelectionSeconds ?? 20, duration);
    startInput.value = 0;
    endInput.value = duration > 0 ? (initialSeconds / duration) * 100 : 100;
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
    const active = document.activeElement === startInput ? "start" : "end";
    const maxGap = duration ? (maxSelectionSeconds / duration) * 100 : 100;
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

    if (end - start > maxGap) {
        if (active === "start") {
            start = end - maxGap;
            startInput.value = Math.max(0, start);
        } else {
            end = start + maxGap;
            endInput.value = Math.min(100, end);
        }
    }

    const startTime = duration * start / 100;
    const endTime = duration * end / 100;

    startLabel.textContent = formatTime(startTime);
    endLabel.textContent = formatTime(endTime);
    selectionTime.textContent = `${formatTime(startTime)} — ${formatTime(endTime)}`;
    selectionOverlay.style.left = `${start}%`;
    selectionOverlay.style.width = `${Math.max(0, end - start)}%`;

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


// Permite arrastrar toda la ventana de selección sin cambiar su duración.
// Los marcadores laterales siguen sirviendo para cambiar el tamaño de la ventana.
selectionOverlay.addEventListener("pointerdown", (event) => {
    if (!duration) return;

    draggingSelection = true;
    dragStartX = event.clientX;
    dragStartStart = Number(startInput.value);
    dragStartEnd = Number(endInput.value);
    selectionOverlay.setPointerCapture?.(event.pointerId);
    selectionOverlay.classList.add("is-dragging");
    event.preventDefault();
});

selectionOverlay.addEventListener("pointermove", (event) => {
    if (!draggingSelection || !duration) return;

    const rect = selectionOverlay.parentElement.getBoundingClientRect();
    if (!rect.width) return;

    const deltaPercent = ((event.clientX - dragStartX) / rect.width) * 100;
    const width = dragStartEnd - dragStartStart;
    let nextStart = dragStartStart + deltaPercent;
    nextStart = Math.max(0, Math.min(100 - width, nextStart));
    const nextEnd = nextStart + width;

    startInput.value = nextStart;
    endInput.value = nextEnd;
    updateSelection();
});

function stopDragging(event) {
    if (!draggingSelection) return;
    draggingSelection = false;
    selectionOverlay.classList.remove("is-dragging");
    if (event?.pointerId != null) {
        try { selectionOverlay.releasePointerCapture?.(event.pointerId); } catch (_) {}
    }
}

selectionOverlay.addEventListener("pointerup", stopDragging);
selectionOverlay.addEventListener("pointercancel", stopDragging);
