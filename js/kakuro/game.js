/**
 * Kakuro Game Controller
 * Handles UI interactions, game state, and validation.
 */
class KakuroGame {
    constructor() {
        this.board = [];
        this.width = 0;
        this.height = 0;
        this.selected = null; // {r, c}
        
        // DOM Elements
        this.gridEl = document.getElementById('kakuro-grid');
        this.statusEl = document.getElementById('game-status');
        
        this.setupInput();
    }

    init(sizeName) {
        // Size Config
        const configs = {
            'tiny': [6, 6],
            'small': [10, 10],
            'standard': [15, 15],
            'expert': [20, 20]
        };
        const [w, h] = configs[sizeName] || configs['small'];
        
        this.statusEl.textContent = 'Generating puzzle...';
        
        // Async delay to allow UI update
        setTimeout(() => {
            const result = window.KakuroGenerator.generate(w, h);
            if (result) {
                this.width = result.width;
                this.height = result.height;
                this.board = result.grid;
                this.render();
                this.statusEl.textContent = 'Ready!';
            } else {
                this.statusEl.textContent = 'Generation failed. Try again.';
            }
        }, 50);
    }

    render() {
        this.gridEl.innerHTML = '';
        this.gridEl.style.gridTemplateColumns = `repeat(${this.width}, var(--cell-size))`;
        this.gridEl.style.gridTemplateRows = `repeat(${this.height}, var(--cell-size))`;

        this.board.forEach((row, r) => {
            row.forEach((cell, c) => {
                const div = document.createElement('div');
                div.className = 'cell';
                div.dataset.r = r;
                div.dataset.c = c;

                if (cell.type === 'clue') {
                    div.classList.add('clue');
                    // Add clue numbers
                    if (cell.right > 0) {
                        const span = document.createElement('span');
                        span.className = 'clue-val clue-right';
                        span.textContent = cell.right;
                        div.appendChild(span);
                    }
                    if (cell.down > 0) {
                        const span = document.createElement('span');
                        span.className = 'clue-val clue-down';
                        span.textContent = cell.down;
                        div.appendChild(span);
                    }
                } else {
                    div.classList.add('input');
                    div.textContent = cell.val || '';
                    div.addEventListener('click', () => this.selectCell(r, c));
                }
                
                this.gridEl.appendChild(div);
            });
        });
    }

    selectCell(r, c) {
        if (this.selected) {
            const prev = document.querySelector(`.cell[data-r="${this.selected.r}"][data-c="${this.selected.c}"]`);
            if (prev) prev.classList.remove('selected');
        }
        
        this.selected = {r, c};
        const curr = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (curr) curr.classList.add('selected');
    }

    setupInput() {
        // Keyboard Input
        document.addEventListener('keydown', (e) => {
            if (!this.selected) return;
            
            const {r, c} = this.selected;
            const cell = this.board[r][c];

            // Numbers 1-9
            if (e.key >= '1' && e.key <= '9') {
                cell.val = parseInt(e.key);
                this.updateCellUI(r, c);
                this.checkErrors(); // Real-time validation
            }
            // Delete/Backspace
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                cell.val = null;
                this.updateCellUI(r, c);
                this.checkErrors();
            }
            // Arrows
            else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                this.moveSelection(e.key);
            }
        });

        // Virtual Numpad (Optional, if we add one)
    }

    updateCellUI(r, c) {
        const div = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (div) div.textContent = this.board[r][c].val || '';
    }

    setInput(r, c, val) {
        if (!this.board || !this.board[r] || !this.board[r][c]) return;
        const cell = this.board[r][c];
        if (cell.type !== 'input') return;
        
        cell.val = val;
        this.updateCellUI(r, c);
        this.checkErrors();
        this.selectCell(r, c); // Ensure selection stays
    }

    moveSelection(key) {
        let {r, c} = this.selected;
        if (key === 'ArrowUp') r--;
        if (key === 'ArrowDown') r++;
        if (key === 'ArrowLeft') c--;
        if (key === 'ArrowRight') c++;

        // Wrap around or clamp? Clamp for now.
        // Actually we should skip black cells? Standard behavior is just move to neighbor.
        if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
            // Check if input cell? Not strictly necessary for selection, but usually better.
            if (this.board[r][c].type === 'input') {
                this.selectCell(r, c);
            } else {
                // Try skipping black cells? Naive implementation for now.
                // Just let them select black cells? No, meaningless.
                // Let's just update coords and if valid input select it.
                // If black, try one more step?
                // Simplest: just clamp to grid.
                 this.selectCell(r, c); // Allow selecting black cells? No, 'selectCell' logic handles UI.
                 // Ideally we shouldn't select black cells.
                 if (this.board[r][c].type !== 'input') {
                     // Try one more step in same direction
                     if (key === 'ArrowUp') r--;
                     if (key === 'ArrowDown') r++;
                     if (key === 'ArrowLeft') c--;
                     if (key === 'ArrowRight') c++;
                     if (r >= 0 && r < this.height && c >= 0 && c < this.width && this.board[r][c].type === 'input') {
                         this.selectCell(r, c);
                     }
                 }
            }
        }
    }

    checkErrors() {
        // Clear all error styles
        document.querySelectorAll('.cell.error').forEach(el => el.classList.remove('error'));
        
        // Check for duplicates in runs
        // Rows
        for(let r=0; r<this.height; r++) {
            this.checkRun(this.board[r].map((cell, c) => ({...cell, r, c})), 'row');
        }
        // Cols
        for(let c=0; c<this.width; c++) {
            let col = [];
            for(let r=0; r<this.height; r++) col.push({...this.board[r][c], r, c});
            this.checkRun(col, 'col');
        }
        
        // Check Sums (Optional visual feedback)
        // If a run is full and sum is wrong -> Error
    }

    checkRun(line, type) {
        let currentRun = [];
        
        const validate = (run) => {
            if (run.length === 0) return;
            // Check dupes
            const seen = {};
            run.forEach(cell => {
                if (cell.val) {
                    if (seen[cell.val]) {
                        // Duplicate!
                        this.markError(cell.r, cell.c);
                        this.markError(seen[cell.val].r, seen[cell.val].c);
                    }
                    seen[cell.val] = cell;
                }
            });
            
            // Check Sum (only if full)
            const isFull = run.every(c => c.val);
            if (isFull) {
                const sum = run.reduce((a, b) => a + b.val, 0);
                // Find clue... this is tricky without backward ref.
                // Easier: In calculateClues we already know.
                // For now just duplicate check is fine for "Basic Validation".
                // Full logic needs reference to the clue.
            }
        };

        for(let i=0; i<line.length; i++) {
            if (line[i].type === 'input') {
                currentRun.push(line[i]);
            } else {
                validate(currentRun);
                currentRun = [];
            }
        }
        validate(currentRun);
    }

    markError(r, c) {
        const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (el) el.classList.add('error');
    }
}

window.game = new KakuroGame();
