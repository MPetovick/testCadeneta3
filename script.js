// Core functionality
class CrochetEditor {
    constructor() {
        this.initCanvas();
        this.initState();
        this.initUI();
        this.initEvents();
    }

    initCanvas() {
        this.canvas = document.getElementById('patternCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    initState() {
        this.state = {
            rings: [{ segments: 8, points: Array(8).fill('chain') }],
            scale: 1,
            offset: { x: 0, y: 0 },
            selectedStitch: 'single',
            ringSpacing: 50,
            history: [],
            currentHistory: -1
        };
    }

    initUI() {
        this.ui = {
            stitches: new Map([
                ['chain', { symbol: '⛓', color: '#e74c3c' }],
                ['single', { symbol: '•', color: '#2ecc71' }],
                ['double', { symbol: '▲', color: '#3498db' }]
            ]),
            tools: [
                { id: 'zoomIn', action: () => this.adjustZoom(0.1) },
                { id: 'zoomOut', action: () => this.adjustZoom(-0.1) },
                { id: 'resetView', action: () => this.resetView() }
            ]
        };
        this.setupTools();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 56;
    }

    setupTools() {
        const container = document.querySelector('.zoom-controls');
        this.ui.tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.id = tool.id;
            btn.innerHTML = document.getElementById(tool.id).innerHTML;
            btn.addEventListener('click', tool.action);
            container.appendChild(btn);
        });
    }

    initEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('click', e => this.handleClick(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - this.state.offset.x;
        const y = e.clientY - rect.top - this.state.offset.y;
        
        const ring = Math.floor(Math.sqrt(x**2 + y**2) / this.state.ringSpacing);
        const angle = Math.atan2(y, x);
        const segment = Math.floor(angle / (Math.PI * 2) * this.state.rings[ring].segments);
        
        this.addStitch(ring, segment);
        this.draw();
    }

    addStitch(ring, segment) {
        if (!this.state.rings[ring]) return;
        this.state.rings[ring].points[segment] = this.state.selectedStitch;
        this.saveState();
    }

    saveState() {
        this.state.history = this.state.history.slice(0, this.state.currentHistory + 1);
        this.state.history.push(JSON.stringify(this.state));
        this.state.currentHistory++;
    }

    adjustZoom(amount) {
        this.state.scale = Math.max(0.3, Math.min(3, this.state.scale + amount));
        this.draw();
    }

    resetView() {
        this.state.scale = 1;
        this.state.offset = { x: 0, y: 0 };
        this.draw();
    }

    handleWheel(e) {
        e.preventDefault();
        this.adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(
            this.canvas.width/2 + this.state.offset.x,
            this.canvas.height/2 + this.state.offset.y
        );
        this.ctx.scale(this.state.scale, this.state.scale);
        
        this.drawRings();
        this.drawStitches();
        this.ctx.restore();
    }

    drawRings() {
        this.ctx.strokeStyle = '#ddd';
        this.state.rings.forEach((_, i) => {
            const radius = (i + 1) * this.state.ringSpacing;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }

    drawStitches() {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.state.rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 0.5) * this.state.ringSpacing;
            const angleStep = (Math.PI * 2) / ring.segments;
            
            ring.points.forEach((stitch, segment) => {
                const angle = segment * angleStep;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                const { symbol, color } = this.ui.stitches.get(stitch);
                this.ctx.fillStyle = color;
                this.ctx.font = `${20 / this.state.scale}px Arial`;
                this.ctx.fillText(symbol, x, y);
            });
        });
    }
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => new CrochetEditor());
