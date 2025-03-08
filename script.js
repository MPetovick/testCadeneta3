const stitches = [
    { symbol: "-", name: "Punt pla", description: "Punt pla" },
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
const helpImageContainer = document.querySelector(".help-image-container");
const deleteLastStitchBtn = document.getElementById("deleteLastStitchBtn");
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
const newProjectBtn = document.getElementById("newProjectBtn");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");
const downloadPatternBtn = document.getElementById("downloadPatternBtn");
const savedProjectsList = document.getElementById("savedProjectsList");
const loadSelectedProjectBtn = document.getElementById("loadSelectedProjectBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const addCustomStitch = document.getElementById("addCustomStitch");
const themeToggle = document.querySelector(".theme-toggle");

// Variables de estado
let selectedStitch = null;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;
let patternSequence = [];
let undoStack = [];
let redoStack = [];
let needsRedraw = true;
let cachedPositions = [];

// Generar botones de la paleta de puntadas
function createStitchButtons() {
    stitchPalette.innerHTML = "";
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
    saveState();
    selectedStitch = stitch;
    document.querySelectorAll(".stitch-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    const stitchCount = patternSequence.length + 1;
    patternSequence.push({ ...stitch, position: stitchCount });
    updatePatternLog();
    updatePositions();
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

// Configurar el canvas
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    requestRedraw();
}

function updatePositions() {
    const divisions = parseInt(guideLines.value);
    const spacing = parseInt(ringSpacing.value);
    cachedPositions = patternSequence.map((stitch, index) => {
        const ring = Math.floor(index / divisions) + 1;
        const positionInRing = index % divisions;
        const angle = (positionInRing / divisions) * Math.PI * 2;
        return {
            x: Math.cos(angle) * (ring * spacing),
            y: Math.sin(angle) * (ring * spacing),
            symbol: stitch.symbol
        };
    });
    requestRedraw();
}

function drawPattern() {
    if (!needsRedraw) return;
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

    // Resaltar anillo activo
    const activeRing = Math.max(1, Math.floor(patternSequence.length / divisions));
    ctx.beginPath();
    ctx.arc(centerX, centerY, activeRing * spacing, 0, Math.PI * 2);
    ctx.strokeStyle = "var(--secondary-color)";
    ctx.lineWidth = 2 / zoomLevel;
    ctx.stroke();

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

    // Dibujar puntos desde caché
    cachedPositions.forEach(pos => {
        ctx.font = `${20 / zoomLevel}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2c3e50";
        ctx.fillText(pos.symbol, pos.x, pos.y);
    });

    ctx.restore();
    needsRedraw = false;
}

function requestRedraw() {
    needsRedraw = true;
    requestAnimationFrame(drawPattern);
}

// Interacción con el canvas
canvas.addEventListener("mousedown", startDragging);
canvas.addEventListener("mouseup", stopDragging);
canvas.addEventListener("mouseleave", stopDragging);
canvas.addEventListener("touchstart", startDragging, { passive: false });
canvas.addEventListener("touchend", stopDragging);
canvas.addEventListener("touchcancel", stopDragging);

function startDragging(e) {
    e.preventDefault();
    if (e.type === "touchstart") {
        const touch = e.touches[0];
        startX = touch.clientX - offsetX;
        startY = touch.clientY - offsetY;
    } else {
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
    }
    isDragging = true;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedDrag = debounce((e) => {
    if (!isDragging) return;
    e.preventDefault();
    if (e.type === "touchmove") {
        const touch = e.touches[0];
        offsetX = touch.clientX - startX;
        offsetY = touch.clientY - startY;
    } else {
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
    }
    requestRedraw();
}, 16);

canvas.addEventListener("mousemove", debouncedDrag);
canvas.addEventListener("touchmove", debouncedDrag, { passive: false });

function stopDragging() {
    isDragging = false;
}

// Controles de zoom
zoomIn.addEventListener("click", zoomInHandler);
zoomOut.addEventListener("click", zoomOutHandler);
resetView.addEventListener("click", resetViewHandler);

function zoomInHandler(e) {
    e.preventDefault();
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    requestRedraw();
}

function zoomOutHandler(e) {
    e.preventDefault();
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    requestRedraw();
}

function resetViewHandler(e) {
    e.preventDefault();
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    requestRedraw();
}

// Actualizar valores de configuración
guideLines.addEventListener("input", () => {
    guideLinesValue.textContent = guideLines.value;
    updatePatternLog();
    updatePositions();
});

ringSpacing.addEventListener("input", () => {
    ringSpacingValue.textContent = `${ringSpacing.value}px`;
    updatePositions();
});

// Mostrar/ocultar la imagen de ayuda
stitchHelpBtn.addEventListener("click", () => {
    helpImageContainer.style.display = helpImageContainer.style.display === "none" || !helpImageContainer.style.display ? "block" : "none";
});

window.addEventListener("click", (e) => {
    if (!helpImageContainer.contains(e.target) && e.target !== stitchHelpBtn) {
        helpImageContainer.style.display = "none";
    }
});

// Funciones de edición
function deleteLastStitch() {
    if (patternSequence.length > 0) {
        saveState();
        patternSequence.pop();
        updatePatternLog();
        updatePositions();
    }
}

deleteLastStitchBtn.addEventListener("click", deleteLastStitch);

function saveState() {
    undoStack.push(JSON.stringify(patternSequence));
    redoStack = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(patternSequence));
        patternSequence = JSON.parse(undoStack.pop());
        updatePatternLog();
        updatePositions();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(patternSequence));
        patternSequence = JSON.parse(redoStack.pop());
        updatePatternLog();
        updatePositions();
    }
}

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// Funciones de proyecto
function newProject() {
    saveState();
    patternSequence = [];
    patternLog.value = "";
    updatePositions();
}

function saveProject() {
    const patternText = patternSequence.map(stitch => stitch.symbol).join(" ");
    const fileName = prompt("Ingresa un nombre para el archivo:", "patron_crochet");
    if (fileName) {
        if (localStorage.getItem(fileName)) {
            if (!confirm(`El proyecto "${fileName}" ya existe. ¿Deseas sobrescribirlo?`)) return;
        }
        localStorage.setItem(fileName, patternText);
        alert(`Proyecto "${fileName}" guardado correctamente.`);
        updateSavedProjectsList();
    }
}

function updateSavedProjectsList() {
    savedProjectsList.innerHTML = '<option value="" disabled selected>Selecciona un proyecto</option>';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        savedProjectsList.appendChild(option);
    }
}

function loadSelectedProject() {
    const selectedProject = savedProjectsList.value;
    if (selectedProject) {
        const patternText = localStorage.getItem(selectedProject);
        if (patternText) {
            saveState();
            const symbols = patternText.split(" ");
            patternSequence = symbols.map((symbol, idx) => {
                const stitch = stitches.find(s => s.symbol === symbol) || { symbol, name: "Personalizado", description: "Personalizado" };
                return { ...stitch, position: idx + 1 };
            });
            updatePatternLog();
            updatePositions();
            alert(`Proyecto "${selectedProject}" cargado correctamente.`);
        }
    } else {
        alert("Por favor, selecciona un proyecto de la lista.");
    }
}

function deleteSelectedProject() {
    const selectedProject = savedProjectsList.value;
    if (selectedProject) {
        if (confirm(`¿Estás seguro de que quieres eliminar el proyecto "${selectedProject}"?`)) {
            localStorage.removeItem(selectedProject);
            updateSavedProjectsList();
            alert(`Proyecto "${selectedProject}" eliminado correctamente.`);
        }
    } else {
        alert("Por favor, selecciona un proyecto de la lista.");
    }
}

function downloadPattern() {
    if (patternSequence.length === 0) {
        alert("No hay ningún patrón para descargar.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = canvas.toDataURL("image/png");
    doc.text("Patrón de Crochet - RadialStitch Pro", 10, 10);
    doc.addImage(imgData, "PNG", 10, 20, 180, 100);
    doc.text("Secuencia de puntos:\n" + patternLog.value, 10, 130);
    doc.save("patron_crochet.pdf");
}

newProjectBtn.addEventListener("click", newProject);
saveProjectBtn.addEventListener("click", saveProject);
deleteProjectBtn.addEventListener("click", deleteSelectedProject);
downloadPatternBtn.addEventListener("click", downloadPattern);
loadSelectedProjectBtn.addEventListener("click", loadSelectedProject);

// Puntos personalizados
addCustomStitch.addEventListener("click", () => {
    const symbol = document.getElementById("customSymbol").value;
    const name = document.getElementById("customName").value;
    if (symbol && name) {
        stitches.push({ symbol, name, description: name });
        createStitchButtons();
        document.getElementById("customSymbol").value = "";
        document.getElementById("customName").value = "";
    }
});

// Modo oscuro
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    themeToggle.innerHTML = `<i class="fas fa-${document.body.classList.contains("dark-mode") ? 'sun' : 'moon'}"></i>`;
    requestRedraw();
});

// Inicialización
window.addEventListener("load", () => {
    createStitchButtons();
    resizeCanvas();
    updateSavedProjectsList();
});

window.addEventListener("resize", resizeCanvas);
