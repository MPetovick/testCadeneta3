class CrochetEditor {
    constructor() {
        this.stitchTypes = new Map([
            ['chain', { symbol: '⛓', color: '#e74c3c' }],
            ['single', { symbol: '•', color: '#2ecc71' }],
            ['double', { symbol: '▲', color: '#3498db' }]
        ]);

        this.initCanvas();
        this.initState();
        this.initUI();
        this.initEvents();
        this.draw();
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
            selectedStitch: 'chain',
            ringSpacing: 50,
            guideLines: 8
        };
    }

    initUI() {
        // Stitch palette
        const palette = document.getElementById('stitchPalette');
        this.stitchTypes.forEach((value, key) => {
            const btn = document.createElement('button');
            btn.className = 'stitch-btn';
            btn.style.color = value.color;
            btn.textContent = value.symbol;
            btn.title = key;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.stitch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.selectedStitch = key;
            });
            palette.appendChild(btn);
        });
        palette.firstChild.classList.add('active');

        // Ring spacing control
        const ringSpacing = document.getElementById('ringSpacing');
        const ringSpacingValue = document.getElementById('ringSpacingValue');
        ringSpacing.addEventListener('input', (e) => {
            this.state.ringSpacing = parseInt(e.target.value);
            ringSpacingValue.textContent = `${e.target.value}px`;
            this.draw();
        });
    }

    initEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Canvas interactions
        this.canvas.addEventListener('click', e => this.handleClick(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.1));
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - document.querySelector('.navbar').clientHeight;
        this.draw();
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - this.state.offset.x - this.canvas.width/2;
        const y = e.clientY - rect.top - this.state.offset.y - this.canvas.height/2;
        
        const distance = Math.sqrt(x**2 + y**2);
        const ring = Math.floor(distance / this.state.ringSpacing);
        
        if (ring < 0 || ring >= this.state.rings.length) return;
        
        const angle = Math.atan2(y, x) + Math.PI;
        const segment = Math.floor(angle / (Math.PI * 2) * this.state.rings[ring].segments);
        
        this.state.rings[ring].points[segment] = this.state.selectedStitch;
        this.draw();
    }

    handleWheel(e) {
        e.preventDefault();
        this.adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
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

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply transformations
        this.ctx.save();
        this.ctx.translate(
            this.canvas.width/2 + this.state.offset.x,
            this.canvas.height/2 + this.state.offset.y
        );
        this.ctx.scale(this.state.scale, this.state.scale);
        
        this.drawGrid();
        this.drawStitches();
        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        
        // Guide lines
        const angleStep = (Math.PI * 2) / this.state.guideLines;
        for (let i = 0; i < this.state.guideLines; i++) {
            const angle = i * angleStep;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(
                Math.cos(angle) * this.state.ringSpacing * this.state.rings.length,
                Math.sin(angle) * this.state.ringSpacing * this.state.rings.length
            );
            this.ctx.stroke();
        }
        
        // Rings
        this.state.rings.forEach((_, index) => {
            const radius = (index + 1) * this.state.ringSpacing;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }

    drawStitches() {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '20px Arial';
        
        this.state.rings.forEach((ring, ringIndex) => {
            const radius = (ringIndex + 0.5) * this.state.ringSpacing;
            const angleStep = (Math.PI * 2) / ring.segments;
            
            ring.points.forEach((stitch, segmentIndex) => {
                const angle = segmentIndex * angleStep;
                const { symbol, color } = this.stitchTypes.get(stitch);
                
                this.ctx.fillStyle = color;
                this.ctx.fillText(
                    symbol,
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                );
            });
        });
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => new CrochetEditor());
