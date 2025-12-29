
class FutoshikiGame {
  constructor(size, difficulty) {
    this.size = size;
    this.difficulty = difficulty; // 'Easy', 'Hard'
    this.solution = [];
    this.initial = [];
    this.constraints = []; // {idx1, idx2, type}
    this.grid = []; // Array of {value, isError, isInitial}
    this.history = [];
    this.activeCellIndex = null;
    
    this.init();
  }

  init() {
    this.generatePuzzle();
    this.renderGrid();
    this.renderKeypad();
    this.attachEvents();
  }

  // --- Logic & Generation ---

  generatePuzzle() {
    const N = this.size;
    
    // 1. Generate Latin Square
    let base = [];
    for(let r=0; r<N; r++) {
        for(let c=0; c<N; c++) {
            base.push(((r + c) % N) + 1);
        }
    }
    
    // Shuffle
    const rowMap = Array.from({length: N}, (_, i) => i).sort(() => Math.random() - 0.5);
    const colMap = Array.from({length: N}, (_, i) => i).sort(() => Math.random() - 0.5);
    const valMap = Array.from({length: N}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

    const newSolution = new Array(N*N);
    for(let r=0; r<N; r++) {
        for(let c=0; c<N; c++) {
            const originalVal = base[r*N + c];
            const newR = rowMap[r];
            const newC = colMap[c];
            const newVal = valMap[originalVal-1];
            newSolution[newR * N + newC] = newVal;
        }
    }
    this.solution = newSolution;

    // 2. Generate Constraints
    // Easy: More initial numbers, fewer constraints? 
    // Hard: Few initial numbers, relies on constraints.
    // Actually Futoshiki defines difficulty by both.
    // Let's stick to the previous logic but maybe tweak.
    const newConstraints = [];
    const constraintDensity = this.difficulty === 'Easy' ? 0.3 : 0.5; // More constraints can actually make it easier to solve, but harder to generate validly? No, constraints are clues.
    // Wait, usually constraints are the *only* clues in hard puzzles aside from a few numbers.
    // Let's stick to the original density for now: 0.4
    
    // Horizontal
    for(let r=0; r<N; r++) {
        for(let c=0; c<N-1; c++) {
             if(Math.random() < 0.4) {
                 const idx1 = r*N + c;
                 const idx2 = r*N + (c+1);
                 const v1 = newSolution[idx1];
                 const v2 = newSolution[idx2];
                 newConstraints.push({ idx1, idx2, type: v1 > v2 ? '>' : '<' });
             }
        }
    }
    // Vertical
    for(let r=0; r<N-1; r++) {
        for(let c=0; c<N; c++) {
             if(Math.random() < 0.4) {
                 const idx1 = r*N + c;
                 const idx2 = (r+1)*N + c;
                 const v1 = newSolution[idx1];
                 const v2 = newSolution[idx2];
                 newConstraints.push({ idx1, idx2, type: v1 > v2 ? 'v' : '^' }); // using v/^ for vertical visualization logic later
             }
        }
    }
    this.constraints = newConstraints;

    // 3. Initial Numbers
    // Easy: 50%, Hard: 20%
    const clueRate = this.difficulty === 'Easy' ? 0.4 : 0.2;
    this.initial = new Array(N*N).fill(0);
    this.grid = [];
    
    for(let i=0; i<N*N; i++) {
        let val = null;
        let isInit = false;
        if(Math.random() < clueRate) {
            val = this.solution[i];
            isInit = true;
        }
        this.grid.push({
            index: i,
            value: val,
            isInitial: isInit,
            isError: false
        });
    }
  }

  // --- Rendering ---

  renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    gridEl.className = 'grid futoshiki-grid'; // Add specific class
    gridEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    // gridEl.style.maxWidth = `${this.size * 60}px`; // Removed strict limit, handled by CSS
    gridEl.style.width = '100%'; // Ensure it fills container
    
    // Dynamic font sizing
    let fontSize = '2rem';
    if (this.size >= 7) fontSize = '1.5rem';
    else if (this.size >= 6) fontSize = '1.8rem';

    this.grid.forEach(cell => {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        if (cell.isInitial) cellEl.classList.add('initial');
        if (cell.isError) cellEl.classList.add('error');
        if (this.activeCellIndex === cell.index) cellEl.classList.add('active');
        
        // Highlight same number
        if (this.activeCellIndex !== null) {
            const activeVal = this.grid[this.activeCellIndex].value;
            if (activeVal && activeVal === cell.value) {
                cellEl.classList.add('num-highlight');
            }
        }

        cellEl.style.fontSize = fontSize;
        cellEl.textContent = cell.value || '';
        
        cellEl.onclick = (e) => {
            e.stopPropagation();
            this.selectCell(cell.index);
        };
        
        gridEl.appendChild(cellEl);
    });

    // Render Constraints Overlay
    // We need to render them relative to cells. 
    // But since grid uses gap, we can place them in the cells or over the grid.
    // Better to append them to the specific cells that are the "source" (left or top).
    
    this.constraints.forEach(c => {
        const cell1 = gridEl.children[c.idx1];
        if(!cell1) return;
        
        const marker = document.createElement('div');
        marker.className = 'inequality-marker';
        
        // Determine direction
        const diff = c.idx2 - c.idx1;
        if (diff === 1) { // Horizontal Right
            marker.textContent = c.type; // > or <
            marker.classList.add('horizontal');
        } else if (diff === this.size) { // Vertical Down
            marker.textContent = c.type === 'v' ? 'v' : '^'; // v or ^
            marker.classList.add('vertical');
        }
        
        cell1.appendChild(marker);
    });
  }

  renderKeypad() {
    const keypadEl = document.getElementById('keypad');
    if (!keypadEl) return;
    keypadEl.innerHTML = '';
    
    for (let i = 1; i <= this.size; i++) {
      const btn = document.createElement('button');
      btn.className = 'keypad-btn';
      btn.textContent = i;
      btn.onclick = (e) => {
        e.stopPropagation();
        this.handleInput(i);
      };
      keypadEl.appendChild(btn);
    }
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'keypad-btn action';
    clearBtn.textContent = 'X';
    clearBtn.onclick = (e) => {
        e.stopPropagation();
        this.handleInput(null);
    };
    keypadEl.appendChild(clearBtn);
  }

  // --- Interaction ---

  selectCell(index) {
      this.activeCellIndex = index;
      this.renderGrid();
  }

  handleInput(val) {
      if (this.activeCellIndex === null) return;
      const cell = this.grid[this.activeCellIndex];
      if (cell.isInitial) return;

      if (cell.value !== val) {
          this.history.push({
              index: this.activeCellIndex,
              oldVal: cell.value,
              newVal: val
          });
          cell.value = val;
          cell.isError = false;
          
          // Clear global errors to avoid confusion
          this.grid.forEach(c => c.isError = false);
          
          this.renderGrid();
          this.checkGame();
      }
  }
  
  moveSelection(delta) {
    if (this.activeCellIndex === null) {
      this.activeCellIndex = 0;
    } else {
      const newIdx = this.activeCellIndex + delta;
      if (newIdx >= 0 && newIdx < this.size * this.size) {
        this.activeCellIndex = newIdx;
      }
    }
    this.renderGrid();
  }

  attachEvents() {
    // Keyboard
    document.onkeydown = (e) => {
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= this.size) {
        this.handleInput(num);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        this.handleInput(null);
      } else if (e.key === 'ArrowUp') this.moveSelection(-this.size);
      else if (e.key === 'ArrowDown') this.moveSelection(this.size);
      else if (e.key === 'ArrowLeft') this.moveSelection(-1);
      else if (e.key === 'ArrowRight') this.moveSelection(1);
    };

    // Buttons
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if(el) el.onclick = fn;
    };
    
    bind('undoBtn', () => this.undo());
    bind('showAnswerBtn', () => this.showAnswer());
    bind('replayBtn', () => this.replay());
    bind('newGameBtnTop', () => showMenu()); // Actually showMenu or newGame? Calcudoku checks confirm.
    bind('newGameBtnSide', () => showMenu());
    bind('newGameBtnMobile', () => showMenu());
  }

  undo() {
      if (this.history.length === 0) return;
      const action = this.history.pop();
      this.grid[action.index].value = action.oldVal;
      this.grid[action.index].isError = false;
      this.activeCellIndex = action.index;
      this.renderGrid();
  }

  showAnswer() {
      if (!confirm('Show solution? Ends game.')) return;
      this.grid.forEach((c, i) => {
          c.value = this.solution[i];
          c.isError = false;
      });
      this.renderGrid();
  }

  replay() {
      if (!confirm('Restart puzzle?')) return;
      this.grid.forEach(c => {
          if(!c.isInitial) c.value = null;
          c.isError = false;
      });
      this.history = [];
      this.renderGrid();
  }

  checkGame() {
      // 1. Check Row/Col Duplicates
      const N = this.size;
      const getRow = r => Array.from({length: N}, (_, c) => r * N + c);
      const getCol = c => Array.from({length: N}, (_, r) => r * N + c);

      const checkGroup = (indices) => {
          const seen = new Map();
          indices.forEach(idx => {
              const val = this.grid[idx].value;
              if(val !== null) {
                  if(seen.has(val)) {
                      this.grid[idx].isError = true;
                      this.grid[seen.get(val)].isError = true;
                  } else {
                      seen.set(val, idx);
                  }
              }
          });
      };

      for(let i=0; i<N; i++) {
          checkGroup(getRow(i));
          checkGroup(getCol(i));
      }

      // 2. Check Constraints
      this.constraints.forEach(c => {
          const v1 = this.grid[c.idx1].value;
          const v2 = this.grid[c.idx2].value;
          
          if (v1 !== null && v2 !== null) {
              let valid = true;
              if (c.type === '>' || c.type === 'v') valid = v1 > v2;
              else valid = v1 < v2; // < or ^
              
              if (!valid) {
                  this.grid[c.idx1].isError = true;
                  this.grid[c.idx2].isError = true;
              }
          }
      });

      this.renderGrid();
      
      // Success?
      if (this.grid.every(c => c.value !== null && !c.isError)) {
          setTimeout(() => alert("Solved!"), 100);
      }
  }
}

// --- Global Navigation ---

let game;

function startGame(size, difficulty) {
    game = new FutoshikiGame(size, difficulty);
    document.getElementById('difficulty').textContent = `Futoshiki ${size}x${size} (${difficulty})`;
}

function showGame(size, difficulty) {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    startGame(size, difficulty);
}

function showMenu() {
    if (document.getElementById('game-screen').style.display !== 'none') {
        if(!confirm("Return to menu? Progress lost.")) return;
    }
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex'; // flex for centering
}

// --- Menu Generation ---

const menuGrid = document.getElementById('menu-grid');
const levels = [
    { s: 4, d: 'Easy', desc: 'Beginner' },
    { s: 4, d: 'Hard', desc: 'Tricky' },
    { s: 5, d: 'Easy', desc: 'Standard' },
    { s: 5, d: 'Hard', desc: 'Challenging' },
    { s: 6, d: 'Easy', desc: 'Large' },
    { s: 6, d: 'Hard', desc: 'Expert' }
];

levels.forEach(lvl => {
    const item = document.createElement('div');
    item.className = 'menu-item';
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'menu-icon';
    icon.style.gridTemplateColumns = `repeat(${lvl.s}, 1fr)`;
    for(let i=0; i<lvl.s*lvl.s; i++) icon.appendChild(document.createElement('div'));
    
    const label = document.createElement('div');
    label.className = 'menu-item-label';
    label.textContent = `${lvl.s}x${lvl.s} ${lvl.d}`;
    
    const sub = document.createElement('div');
    sub.className = 'menu-item-sublabel';
    sub.textContent = lvl.desc;
    
    item.append(icon, label, sub);
    item.onclick = () => showGame(lvl.s, lvl.d);
    
    menuGrid.appendChild(item);
});

// Bind initial events
document.getElementById('newGameBtnTop').onclick = showMenu;
if(document.getElementById('newGameBtnSide')) document.getElementById('newGameBtnSide').onclick = showMenu;
document.getElementById('newGameBtnMobile').onclick = showMenu;

// Handle URL params for direct linking
const urlParams = new URLSearchParams(window.location.search);
const pSize = parseInt(urlParams.get('size'));
const pDiff = urlParams.get('difficulty');
if(pSize && pDiff) {
    // Validate
    const validSizes = [4,5,6];
    const validDiffs = ['Easy', 'Hard'];
    if(validSizes.includes(pSize) && validDiffs.includes(pDiff)) {
        showGame(pSize, pDiff);
    }
}
