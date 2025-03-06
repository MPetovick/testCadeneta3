// Definir los símbolos de crochet y sus descripciones
const stitches = [
    { symbol: "○", name: "Cadeneta (ch)", description: "Punto de cadena" },
    { symbol: "●", name: "Punto deslizado (sl st)", description: "Punto deslizado" },
    { symbol: "✚", name: "Punto bajo (sc)", description: "Punto bajo o medio punto" },
    { symbol: "𝖙", name: "Punto alto (dc)", description: "Punto alto o vareta" },
    { symbol: "𝖳", name: "Punto alto doble (tr)", description: "Punto alto doble" },
    { symbol: "V", name: "Aumento (inc)", description: "2 puntos en el mismo espacio" },
    { symbol: "Λ", name: "Disminución (dec)", description: "2 puntos juntos" }
];

// Elementos del DOM
const stitchPalette = document.getElementById("stitchPalette");
const stitchHelpBtn = document.getElementById("stitchHelpBtn");
const stitchTooltip = document.getElementById("stitchTooltip");
const canvas = document.getElementById("patternCanvas");
const ctx = canvas.getContext("2d");
const guideLines = document.getElementById("guideLines");
const guideLinesValue = document.getElementById("guideLinesValue");
const ringSpacing = document.getElementById("ringSpacing");
const ringSpacingValue = document.getElementById("ringSpacingValue");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const resetView = document.getElementById("resetView");
const patternLog = document.getElementById("patternLog");

// Variables de estado
let selectedStitch = null;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let patternSequence = [];
let initialPinchDistance = null;

// Generar botones de la paleta de puntadas
function createStitchButtons() {
    stitches.forEach(stitch => {
        const button = document.createElement("button");
        button.className = "stitch-btn";
        button.textContent = stitch.symbol;
        button.dataset.name = stitch.name;
        button.dataset.description = stitch.description;
        button.addEventListener("click", () => selectStitch(stitch, button));
        stitchPalette.appendChild(button);
    });
}

// Seleccionar un punto y añadirlo a la secuencia
function selectStitch(stitch, button) {
    selectedStitch = stitch;
    document.querySelectorAll(".stitch-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    const stitchCount = patternSequence.length + 1;
    patternSequence.push({ ...stitch, position: stitchCount });
    updatePatternLog();
    drawPattern();
}

// Actualizar el log de la secuencia por anillos
function updatePatternLog() {
    const divisions = parseInt(guideLines.value);
    const rings = Math.ceil(patternSequence.length / divisions);
    let logText = "";

    for (let ring = 0; ring < rings; ring++) {
        const startIdx = ring * divisions;
        const endIdx = Math.min(startIdx + divisions, patternSequence.length);
        const ringStitches = patternSequence.slice(startIdx, endIdx);
        const ringText = ringStitches.map(s => `${s.symbol}`).join(" ");
        logText += `Anillo ${ring + 1}: ${ringText || "Vacío"}\n`;
    }

    patternLog.value = logText.trim();
    patternLog.scrollTop = patternLog.scrollHeight;
}

// Mostrar tooltip al pasar el mouse o tocar
stitchPalette.addEventListener("mouseover", (e) => {
    if (e.target.classList.contains("stitch-btn")) {
        showTooltip(e.target, e);
    }
});

stitchPalette.addEventListener("mouseout", hideTooltip);

stitchPalette.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const target = e.target.closest(".stitch-btn");
    if (target) {
        const stitch = stitches.find(s => s.symbol === target.textContent);
        if (stitch) selectStitch(stitch, target);
        showTooltip(target, e.touches[0]);
    }
}, { passive: false });

// Mostrar tooltip al hacer clic en el botón de ayuda
stitchHelpBtn.addEventListener("click", () => {
    const helpText = stitches.map(s => `${s.symbol}: ${s.name} - ${s.description}`).join("\n");
    stitchTooltip.textContent = helpText;
    stitchTooltip.style.left = "50%";
    stitchTooltip.style.top = "50%";
    stitchTooltip.style.transform = "translate(-50%, -50%)";
    stitchTooltip.classList.remove("hidden");
    setTimeout(hideTooltip, 5000);
});

// Funciones de tooltip
function showTooltip(element, event) {
    stitchTooltip.textContent = `${element.dataset.name}: ${element.dataset.description}`;
    stitchTooltip.style.left = `${event.pageX + 10}px`;
    stitchTooltip.style.top = `${event.pageY + 10}px`;
    stitchTooltip.classList.remove("hidden");
}

function hideTooltip() {
    stitchTooltip.classList.add("hidden");
}

// Configurar el canvas
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawPattern();
}

function drawPattern() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX + canvas.width / 2, offsetY + canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);

    const centerX = 0;
    const centerY = 0;
    const divisions = parseInt(guideLines.value);
    const spacing = parseInt(ringSpacing.value);
    const totalRings = Math.max(1, Math.ceil(patternSequence.length / divisions));

    // Dibujar anillos
    for (let r = 1; r <= totalRings; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * spacing, 0, Math.PI * 2);
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 1 / zoomLevel;
        ctx.stroke();
    }

    // Dibujar líneas guía
    for (let i = 0; i < divisions; i++) {
        const angle = (i / divisions) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * spacing * totalRings, centerY + Math.sin(angle) * spacing * totalRings);
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1 / zoomLevel;
        ctx.stroke();
    }

    // Dibujar puntos
    patternSequence.forEach((stitch, index) => {
        const ring = Math.floor(index / divisions) + 1;
        const positionInRing = index % divisions;
        const angle = (positionInRing / divisions) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * (ring * spacing);
        const y = centerY + Math.sin(angle) * (ring * spacing);

        ctx.font = `${20 / zoomLevel}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2c3e50";
        ctx.fillText(stitch.symbol, x, y);
    });

    ctx.restore();
}

// Manejo de interacciones táctiles
canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        startDragging(e.touches[0]);
    } else if (e.touches.length === 2) {
        handlePinchStart(e);
    }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
        drag(e.touches[0]);
    } else if (e.touches.length === 2) {
        handlePinchMove(e);
    }
}, { passive: false });

function handlePinchStart(e) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    initialPinchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
    );
}

function handlePinchMove(e) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
    );
    
    const scaleFactor = currentDistance / initialPinchDistance;
    zoomLevel = Math.min(Math.max(zoomLevel * scaleFactor, 0.5), 3);
    initialPinchDistance = currentDistance;
    drawPattern();
}

// Manejo de arrastre
function startDragging(e) {
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    isDragging = true;
}

function drag(e) {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    drawPattern();
}

function stopDragging() {
    isDragging = false;
}

// Eventos de ratón
canvas.addEventListener("mousedown", (e) => startDragging(e));
canvas.addEventListener("mousemove", (e) => drag(e));
canvas.addEventListener("mouseup", stopDragging);
canvas.addEventListener("mouseleave", stopDragging);

// Controles de zoom
zoomIn.addEventListener("click", (e) => {
    e.preventDefault();
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    drawPattern();
});

zoomOut.addEventListener("click", (e) => {
    e.preventDefault();
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    drawPattern();
});

resetView.addEventListener("click", (e) => {
    e.preventDefault();
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    drawPattern();
});

// Actualizar valores de configuración
guideLines.addEventListener("input", () => {
    guideLinesValue.textContent = guideLines.value;
    updatePatternLog();
    drawPattern();
});

ringSpacing.addEventListener("input", () => {
    ringSpacingValue.textContent = `${ringSpacing.value}px`;
    drawPattern();
});

// Inicialización
window.addEventListener("load", () => {
    createStitchButtons();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
});