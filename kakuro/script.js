document.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new KakuroGame();
        
        // UI Elements
        const menuScreen = document.getElementById('menu-screen');
        const menuGrid = document.getElementById('menu-grid');
        const gameScreen = document.getElementById('game-screen');
        
        // New Buttons
        const newGameBtnTop = document.getElementById('newGameBtnTop');
        const newGameBtnMobile = document.getElementById('newGameBtnMobile');
        const newGameBtnSide = document.getElementById('newGameBtnSide');
        
        const undoBtn = document.getElementById('undoBtn');
        const showAnswerBtn = document.getElementById('showAnswerBtn');
        const replayBtn = document.getElementById('replayBtn');
        
        const difficultyLabel = document.getElementById('difficulty-label');

        // Difficulty Configuration
        const difficulties = [
            { id: 'beginner', label: 'Beginner', size: 6, desc: '6x6 Grid' },
            { id: 'easy',     label: 'Easy',     size: 8, desc: '8x8 Grid' },
            { id: 'medium',   label: 'Medium',   size: 10, desc: '10x10 Grid' },
            { id: 'hard',     label: 'Hard',     size: 12, desc: '12x12 Grid' },
            { id: 'expert',   label: 'Expert',   size: 15, desc: '15x15 Grid' }
        ];


        // 1. Generate Menu Grid
        if (menuGrid) {
            menuGrid.innerHTML = ''; // Clear existing content
            difficulties.forEach(diff => {
                const item = document.createElement('div');
                item.className = 'menu-item';
                
                // Icon
                const icon = document.createElement('div');
                icon.className = 'menu-icon';
                // Use simplified grid for icon (max 6x6 visual) to avoid clutter
                const iconSize = Math.min(diff.size, 8); 
                icon.style.gridTemplateColumns = `repeat(${iconSize}, 1fr)`;
                
                // Generate pseudo-random pattern based on size to keep it consistent
                let seed = diff.size;
                const random = () => {
                    var x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };

                for(let i=0; i < iconSize * iconSize; i++) {
                    const cell = document.createElement('div');
                    const r = Math.floor(i / iconSize);
                    const c = i % iconSize;
                    
                    // Simulate walls (top row, left col, and randoms)
                    if (r === 0 || c === 0 || random() < 0.3) {
                        cell.style.backgroundColor = '#ccc';
                    }
                    icon.appendChild(cell);
                }

                const lbl = document.createElement('div');
                lbl.className = 'menu-item-label';
                lbl.textContent = diff.label;

                const sub = document.createElement('div');
                sub.className = 'menu-item-sublabel';
                sub.textContent = diff.desc;

                item.appendChild(icon);
                item.appendChild(lbl);
                item.appendChild(sub);
                
                item.addEventListener('click', () => {
                    startGame(diff.id);
                });

                menuGrid.appendChild(item);
            });
        }

        function startGame(difficulty) {
            currentDifficulty = difficulty;
            // Hide menu, show game
            menuScreen.style.display = 'none';
            gameScreen.style.display = 'block'; // Block for normal layout
            
            // Update Label
            const diff = difficulties.find(d => d.id === difficulty);
            if (difficultyLabel && diff) difficultyLabel.textContent = `Kakuro: ${diff.label}`;


            // Generate
            game.generateLevel(difficulty);
        }

        function showMenu() {
            gameScreen.style.display = 'none';
            menuScreen.style.display = 'flex'; // Flex for centering

        }

        // 2. Button Listeners
        const handleNewGame = () => {
            if(confirm('Start a new game? Current progress will be lost.')) {
                startGame(currentDifficulty);
            }
        };

        [newGameBtnTop, newGameBtnMobile, newGameBtnSide].forEach(btn => {
            if(btn) btn.addEventListener('click', handleNewGame);
        });

        if(undoBtn) undoBtn.addEventListener('click', () => game.undo());
        if(replayBtn) replayBtn.addEventListener('click', () => game.resetBoard());
        if(showAnswerBtn) showAnswerBtn.addEventListener('click', () => game.showSolution());

        // Check URL Params
        const params = new URLSearchParams(window.location.search);
        const diffParam = params.get('difficulty');
        if (diffParam && difficulties.some(d => d.id === diffParam)) {
            startGame(diffParam);
        }
    } catch (e) {
        console.error("Kakuro script error:", e);
        alert("Kakuro game failed to load: " + e.message);
    }
});

class KakuroGame {
    constructor() {
        this.gridElement = document.getElementById('kakuro-board'); 
        this.grid = [];
        this.wallProb = 0.35; 
        this.history = [];
        this.activeCell = null; // {r, c}
    }

    async generateLevel(difficulty = 'medium') {
        this.difficulty = difficulty;
        const config = {
            'beginner': { size: 6,  wallProb: 0.45 },
            'easy':     { size: 8,  wallProb: 0.40 },
            'medium':   { size: 10, wallProb: 0.35 },
            'hard':     { size: 12, wallProb: 0.30 },
            'expert':   { size: 15, wallProb: 0.30 } 
        };

        const settings = config[difficulty] || config['medium'];
        this.size = settings.size;
        this.wallProb = settings.wallProb;
        
        // Show loading state if needed (optional)
        
        let success = false;
        // Try up to 100 times
        for(let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 0));

            this.initGrid();     
            this.placeWalls();   
            this.fixLongSegments();

            if (!this.isConnected()) continue;

            this.solverSteps = 0; 
            if (this.solve(0, 0)) {
                this.calculateClues();      
                this.cleanUpInvalidClues(); 
                this.render();  
                this.renderKeypad(); // Render keypad after grid is ready
                success = true;
                break;
            }
        }

        if (!success) {
            console.warn("Generation failed after max attempts.");
            alert("Generation failed, please try again.");
        }
        
        this.history = []; // Clear history on new game
    }

    // Init Grid
    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.size; r++) {
            let row = [];
            for (let c = 0; c < this.size; c++) {
                row.push({ type: 'empty', val: null, solution: null, down: null, right: null });
            }
            this.grid.push(row);
        }
    }

    // Place Walls
    placeWalls() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (r === 0 || c === 0) {
                    this.grid[r][c].type = 'void';
                } else {
                    if (Math.random() < this.wallProb) this.grid[r][c].type = 'void';
                }
            }
        }
        this.grid[0][0].type = 'void';
    }

    // Fix Long Segments
    fixLongSegments() {
        // Horizontal
        for (let r = 0; r < this.size; r++) {
            let count = 0;
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c].type === 'empty') {
                    count++;
                    if (count > 9) {
                        this.grid[r][c].type = 'void';
                        count = 0;
                    }
                } else {
                    count = 0;
                }
            }
        }
        
        // Vertical
        for (let c = 0; c < this.size; c++) {
            let count = 0;
            for (let r = 0; r < this.size; r++) {
                if (this.grid[r][c].type === 'empty') {
                    count++;
                    if (count > 9) {
                        this.grid[r][c].type = 'void';
                        count = 0;
                    }
                } else {
                    count = 0;
                }
            }
        }
    }

    // Connectivity
    isConnected() {
        let startR = -1, startC = -1;
        let emptyCount = 0;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c].type === 'empty') {
                    if (startR === -1) { startR = r; startC = c; }
                    emptyCount++;
                }
            }
        }
        if (emptyCount === 0) return false;

        let visited = new Set();
        let queue = [[startR, startC]];
        visited.add(`${startR},${startC}`);
        let count = 0;

        while (queue.length > 0) {
            let [r, c] = queue.shift();
            count++;
            let dirs = [[0,1], [0,-1], [1,0], [-1,0]];
            for (let [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && 
                    this.grid[nr][nc].type === 'empty' && !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push([nr, nc]);
                }
            }
        }
        return count === emptyCount;
    }

   // Solver
   solve(r, c) {
       this.solverSteps++;
       if (this.solverSteps > 200000) return false;

       if (r >= this.size) return true;
       
       let nextC = c + 1;
       let nextR = r;
       if (nextC >= this.size) { nextC = 0; nextR = r + 1; }

       if (this.grid[r][c].type !== 'empty') return this.solve(nextR, nextC);

       let nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
       for (let num of nums) {
           if (this.isValid(r, c, num)) {
               this.grid[r][c].solution = num;
               if (this.solve(nextR, nextC)) return true;
               this.grid[r][c].solution = null; 
           }
       }
       return false;
   }

   isValid(r, c, num) {
       for (let i = c - 1; i >= 0; i--) {
           if (this.grid[r][i].type !== 'empty') break;
           if (this.grid[r][i].solution === num) return false;
       }
       for (let i = r - 1; i >= 0; i--) {
           if (this.grid[i][c].type !== 'empty') break;
           if (this.grid[i][c].solution === num) return false;
       }
       return true;
   }

    // Clues
    calculateClues() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cell = this.grid[r][c];
                if (cell.type === 'empty') continue;

                // Right
                let sumR = 0, countR = 0;
                for (let k = c + 1; k < this.size; k++) {
                    if (this.grid[r][k].type === 'empty') {
                        sumR += this.grid[r][k].solution;
                        countR++;
                    } else break;
                }
                if (countR > 0) cell.right = sumR;

                // Down
                let sumD = 0, countD = 0;
                for (let k = r + 1; k < this.size; k++) {
                    if (this.grid[k][c].type === 'empty') {
                        sumD += this.grid[k][c].solution;
                        countD++;
                    } else break;
                }
                if (countD > 0) cell.down = sumD;

                if (cell.right || cell.down) cell.type = 'clue';
            }
        }
    }

    cleanUpInvalidClues() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cell = this.grid[r][c];
                if (cell.type !== 'clue') continue;

                if (cell.right && (c + 1 >= this.size || this.grid[r][c+1].type !== 'empty')) {
                    cell.right = null;
                }
                if (cell.down && (r + 1 >= this.size || this.grid[r+1][c].type !== 'empty')) {
                    cell.down = null;
                }
                
                if (!cell.right && !cell.down) cell.type = 'void';
            }
        }
    }

    // Keyboard & Interaction
    setupInput() {
        if (this.hasInputListener) return;
        this.hasInputListener = true;
        document.addEventListener('keydown', e => {
            if (!this.activeCell) return;
            
            let key = e.key;
            if (['1','2','3','4','5','6','7','8','9'].includes(key)) {
                this.handleInput(parseInt(key));
            } 
            else if (key === 'Backspace' || key === 'Delete') {
                this.handleInput('');
            }
            // Navigation
            else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
                e.preventDefault();
                this.moveSelection(key);
            }
        });
    }
    
    moveSelection(key) {
        if (!this.activeCell) return;
        let {r, c} = this.activeCell;
        
        if (key === 'ArrowUp') r--;
        else if (key === 'ArrowDown') r++;
        else if (key === 'ArrowLeft') c--;
        else if (key === 'ArrowRight') c++;
        
        // Find next selectable cell in that direction (skip voids/clues?)
        // Simple move: just clamp
        if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
            // Allow selecting walls? Usually no.
            // If wall, try skipping? For now just allow selecting anything, 
            // but check valid on click. Or scan for next empty.
            // Let's just try to select (r,c) if it's empty.
            if (this.grid[r][c].type === 'empty') {
                this.selectCell(r, c);
            }
        }
    }

    selectCell(r, c) {
        // Remove old selection
        const oldSel = this.gridElement.querySelector('.selected');
        if (oldSel) oldSel.classList.remove('selected');
        
        // Find new cell DOM
        // We need a reliable way to get DOM from r,c. 
        // We stored dataset.r and dataset.c in render.
        const newSel = this.gridElement.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (newSel && newSel.classList.contains('empty')) {
            newSel.classList.add('selected');
            this.activeCell = {r, c};
        }
    }

    handleInput(val) {
        if (!this.activeCell) return;
        const {r, c} = this.activeCell;
        const cell = this.grid[r][c];
        
        // Don't change if same
        const currentVal = cell.val;
        if (currentVal === val) return;
        
        // Save history
        this.history.push({r, c, oldVal: currentVal, newVal: val});
        
        // Update Model
        cell.val = val;
        
        // Update View
        const dom = this.gridElement.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (dom) {
            dom.innerText = val;
            if (val) dom.classList.add('user-filled');
            else dom.classList.remove('user-filled');
            dom.style.color = ''; // Reset color if it was revealed
        }

        this.checkWin();
    }

    checkWin() {
        let complete = true;
        for(let r=0; r<this.size; r++) {
            for(let c=0; c<this.size; c++) {
                if(this.grid[r][c].type === 'empty') {
                    if(this.grid[r][c].val !== this.grid[r][c].solution) {
                        complete = false;
                        break;
                    }
                }
            }
            if(!complete) break;
        }

        if(complete) {
            try {
                const raw = localStorage.getItem('kakuro_stats') || '{}';
                const stats = JSON.parse(raw);
                if (!stats.completed) stats.completed = {};
                const diff = this.difficulty || 'medium'; 
                stats.completed[diff] = (stats.completed[diff] || 0) + 1;
                localStorage.setItem('kakuro_stats', JSON.stringify(stats));
            } catch(e) { console.error(e) }
            setTimeout(() => alert('Congratulations! Puzzle Solved!'), 200);
        }
    }

    undo() {
        if (this.history.length === 0) return;
        const last = this.history.pop();
        const {r, c, oldVal} = last;
        
        // Restore Model
        this.grid[r][c].val = oldVal;
        
        // Restore View
        const dom = this.gridElement.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (dom) {
            dom.innerText = oldVal || '';
            if (oldVal) dom.classList.add('user-filled');
            else dom.classList.remove('user-filled');
            dom.style.color = ''; 
            
            // Restore selection
            this.selectCell(r, c);
        }
    }

    renderKeypad() {
        const keypadEl = document.getElementById('keypad');
        if (!keypadEl) return;
        keypadEl.innerHTML = '';
        
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'keypad-btn';
            btn.textContent = i;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleInput(i);
            });
            keypadEl.appendChild(btn);
        }
        
        // Clear Button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'keypad-btn action';
        clearBtn.textContent = 'Clear';
        clearBtn.style.fontSize = '1rem';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleInput('');
        });
        keypadEl.appendChild(clearBtn);
    }

    render() {
        this.setupInput(); 
        
        if (!this.gridElement) {
            console.error("Kakuro board element not found!");
            return;
        }

        this.gridElement.innerHTML = '';
        // this.gridElement.style.gridTemplateColumns = `repeat(${this.size}, var(--cell-size))`; // Old fixed size
        this.gridElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`; // Responsive

        // Dynamic font sizing
        let fontSize = '1.4rem';
        let clueSize = '0.75rem';
        if (this.size >= 12) {
             fontSize = '1.1rem';
             clueSize = '0.65rem';
        }
        if (this.size >= 15) {
             fontSize = '0.9rem';
             clueSize = '0.55rem';
        }
        
        // Reset active cell
        this.activeCell = null;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cell = this.grid[r][c];
                let div = document.createElement('div');
                div.className = 'cell';
                div.dataset.r = r;
                div.dataset.c = c;
                
                if (cell.type === 'clue') {
                    div.classList.add('clue');
                    if (cell.down) {
                        let s = document.createElement('span');
                        s.className = 'clue-number clue-down';
                        s.innerText = cell.down;
                        s.style.fontSize = clueSize; // Dynamic clue size
                        div.appendChild(s);
                    }
                    if (cell.right) {
                        let s = document.createElement('span');
                        s.className = 'clue-number clue-right';
                        s.innerText = cell.right;
                        s.style.fontSize = clueSize; // Dynamic clue size
                        div.appendChild(s);
                    }
                } else if (cell.type === 'void') {
                    div.classList.add('void');
                    div.style.backgroundColor = '#dcdcdc';
                } else {
                    div.classList.add('empty');
                    div.style.fontSize = fontSize; // Apply dynamic font size
                    
                    // Restore value if exists (e.g. from state logic if we had persistent state)
                    // Currently we clear state on generate, but if we had it:
                    if (cell.val) {
                        div.innerText = cell.val;
                        div.classList.add('user-filled');
                    }
                    
                    div.onclick = (e) => {
                        this.selectCell(r, c);
                    };
                }
                this.gridElement.appendChild(div);
            }
        }
    }

    showSolution() {
        if (!this.grid || this.grid.length === 0) return;
        
        if(!confirm('Show answer? This will end the current game.')) return;

        const cells = this.gridElement.children;
        
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cellData = this.grid[r][c];
                if (cellData.type === 'empty' && cellData.solution) {
                    let index = r * this.size + c;
                    let cellDiv = cells[index];
                    
                    if (cellDiv) {
                        cellDiv.innerText = cellData.solution;
                        cellDiv.classList.add('revealed'); 
                        cellDiv.style.color = 'blue'; 
                        // Update model to match view so typing doesn't weird out?
                        // Actually show solution usually ends game interactions or just fills it.
                        // Let's update val to avoid inconsistency
                        cellData.val = cellData.solution;
                    }
                }
            }
        }
        // Clear history to prevent undoing solution nicely (optional)
        this.history = [];
    }

    resetBoard() {
        if (!this.gridElement) return;
        if(!confirm('Restart this puzzle?')) return;
        
        const cells = this.gridElement.querySelectorAll('.cell.empty');
        cells.forEach(cell => {
            cell.innerText = '';
            cell.classList.remove('user-filled', 'revealed');
            cell.style.color = ''; 
        });
        
        // Reset model values
        for(let row of this.grid) {
            for(let cell of row) {
                if(cell.type === 'empty') cell.val = null;
            }
        }
        this.history = [];
        this.activeCell = null;
        this.gridElement.querySelector('.selected')?.classList.remove('selected');
    }
}
