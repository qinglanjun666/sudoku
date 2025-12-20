// --- Game Logic ---

class CalcudokuGame {
  constructor(size, cages, solution) {
    this.size = size;
    this.cages = cages; // Array of { id, target, op, cells: [indices] }
    this.solution = solution;
    this.grid = Array(size * size).fill(null).map((_, i) => ({
      index: i,
      value: null,
      cageId: this.getCageId(i),
      isError: false,
      isHint: false
    }));
    this.history = [];
    this.activeCellIndex = null;
    this.hintUsed = false;

    this.init();
  }

  getCageId(cellIndex) {
    const cage = this.cages.find(c => c.cells.includes(cellIndex));
    return cage ? cage.id : null;
  }

  init() {
    this.renderGrid();
    this.renderKeypad();
    this.attachEvents();
  }

  // --- Rendering ---

  renderGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    gridEl.innerHTML = '';
    
    // Dynamic font sizing
    let fontSize = '2.5rem';
    if (this.size >= 8) fontSize = '1.2rem';
    else if (this.size >= 6) fontSize = '1.8rem';
    else if (this.size >= 5) fontSize = '2.2rem';

    this.grid.forEach(cell => {
      const cellEl = document.createElement('div');
      cellEl.className = 'cell';
      cellEl.style.fontSize = fontSize;
      cellEl.dataset.index = cell.index;

      // Smart Borders
      const borders = this.getBorderClasses(cell.index);
      if (borders.length) cellEl.classList.add(...borders);

      // Active State
      if (this.activeCellIndex === cell.index) {
        cellEl.classList.add('active');
      } else if (this.activeCellIndex !== null) {
         // Cage Highlight
         const activeCell = this.grid[this.activeCellIndex];
         if (activeCell.cageId === cell.cageId) {
           cellEl.classList.add('cage-active');
         }
         // Number Highlight
         if (activeCell.value && activeCell.value === cell.value) {
           cellEl.classList.add('num-highlight');
         }
      }

      // Error State
      if (cell.isError) cellEl.classList.add('error');
      
      // Hint State
      if (cell.isHint) cellEl.classList.add('hinted');

      // Cage Target Label (Top-Left of first cell in cage)
      const cage = this.cages.find(c => c.id === cell.cageId);
      if (cage && cage.cells[0] === cell.index) {
        const label = document.createElement('div');
        label.className = 'target-label';
        label.textContent = `${cage.target}${cage.op}`;
        cellEl.appendChild(label);
      }

      // Value
      if (cell.value) {
        const valSpan = document.createElement('span');
        valSpan.className = 'cell-value';
        valSpan.textContent = cell.value;
        cellEl.appendChild(valSpan);
      }

      // Event
      cellEl.addEventListener('click', () => this.selectCell(cell.index));

      gridEl.appendChild(cellEl);
    });
  }

  getBorderClasses(index) {
    const classes = [];
    const r = Math.floor(index / this.size);
    const c = index % this.size;
    const myCage = this.grid[index].cageId;

    // Top
    if (r === 0 || this.grid[index - this.size].cageId !== myCage) classes.push('b-top');
    // Bottom
    if (r === this.size - 1 || this.grid[index + this.size].cageId !== myCage) classes.push('b-bottom');
    // Left
    if (c === 0 || this.grid[index - 1].cageId !== myCage) classes.push('b-left');
    // Right
    if (c === this.size - 1 || this.grid[index + 1].cageId !== myCage) classes.push('b-right');

    return classes;
  }

  renderKeypad() {
    const keypad = document.getElementById('keypad');
    keypad.innerHTML = '';

    // Numbers Row
    const nums = Array.from({length: this.size}, (_, i) => i + 1);
    const numRow = document.createElement('div');
    numRow.className = 'keypad-row';
    nums.forEach(n => {
      numRow.appendChild(this.createBtn(n, 'key-btn', () => this.inputValue(n)));
    });
    keypad.appendChild(numRow);

    // Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'keypad-row';
    
    const undoBtn = this.createBtn('Undo', 'key-btn action-btn', () => this.undo());
    const restartBtn = this.createBtn('Restart', 'key-btn action-btn', () => this.restart());
    
    const hintBtn = this.createBtn('Hint', 'key-btn action-btn', () => this.hint());
    if (this.hintUsed) hintBtn.disabled = true;

    // Use a different approach for New Game to integrate with menu
    const newGameBtn = this.createBtn('New Game', 'key-btn action-btn primary', () => {
        if (confirm('Start a new game with current settings?')) {
            const n = parseInt(document.getElementById('size-selector').value);
            startGame(n);
        }
    });

    actionsRow.append(undoBtn, restartBtn, hintBtn, newGameBtn);
    keypad.appendChild(actionsRow);
  }

  createBtn(text, className, onClick) {
    const btn = document.createElement('button');
    btn.className = className; // passed full class string
    btn.textContent = text;
    // Prevent focus stealing
    btn.addEventListener('pointerdown', (e) => {
       e.preventDefault();
       onClick();
    });
    return btn;
  }

  attachEvents() {
      // Keyboard support for desktop
      // Remove previous listener to avoid duplicates if any (though class instance is new)
      // Ideally we should handle cleanup.
      
      const keyHandler = (e) => {
          if (this.activeCellIndex === null) return;
          const key = e.key;
          if (key >= '1' && key <= String(this.size)) {
              this.inputValue(parseInt(key));
          } else if (key === 'Backspace' || key === 'Delete') {
              this.inputValue(null);
          } else if (key === 'z' && (e.ctrlKey || e.metaKey)) {
              this.undo();
          } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
              e.preventDefault();
              this.moveSelection(key);
          }
      };
      
      // Store handler to remove later if needed, but for now simple approach
      document.onkeydown = keyHandler; 
  }

  // --- Interaction ---

  selectCell(index) {
    this.activeCellIndex = index;
    this.renderGrid();
  }

  moveSelection(key) {
      if (this.activeCellIndex === null) return;
      let r = Math.floor(this.activeCellIndex / this.size);
      let c = this.activeCellIndex % this.size;
      
      if (key === 'ArrowUp' && r > 0) r--;
      if (key === 'ArrowDown' && r < this.size - 1) r++;
      if (key === 'ArrowLeft' && c > 0) c--;
      if (key === 'ArrowRight' && c < this.size - 1) c++;

      this.selectCell(r * this.size + c);
  }

  inputValue(val) {
    if (this.activeCellIndex === null) return;
    const cell = this.grid[this.activeCellIndex];
    if (cell.isHint) return; // Cannot edit hints

    // Save state for undo
    this.saveState();

    // Toggle if same value
    if (val === cell.value) {
      cell.value = null;
    } else {
      cell.value = val;
    }

    this.validate();
    this.renderGrid();
  }

  saveState() {
      const snapshot = this.grid.map(c => ({
          value: c.value
      }));
      this.history.push(snapshot);
      if (this.history.length > 20) this.history.shift();
  }

  undo() {
      if (this.history.length === 0) return;
      const snapshot = this.history.pop();
      this.grid.forEach((c, i) => {
          if (!c.isHint) { // Don't undo hints
              c.value = snapshot[i].value;
          }
      });
      this.validate();
      this.renderGrid();
  }

  restart() {
      if (!confirm('Restart this game?')) return;
      this.history = [];
      this.hintUsed = false;
      this.grid.forEach(c => {
          c.value = null;
          c.isError = false;
          c.isHint = false;
      });
      this.renderGrid();
      this.renderKeypad();
  }

  hint() {
      if (this.hintUsed) return;
      
      // Find a cell to hint (prioritize errors, then empty)
      let candidates = this.grid.filter(c => !c.isHint && (c.value === null || c.value !== this.solution[c.index]));
      
      if (candidates.length === 0) {
          alert('Puzzle is already solved or correct!');
          return;
      }

      // Pick random candidate
      const cell = candidates[Math.floor(Math.random() * candidates.length)];
      
      // Apply hint
      cell.value = this.solution[cell.index];
      cell.isHint = true;
      cell.isError = false;
      this.hintUsed = true;
      
      this.validate();
      this.renderGrid();
      this.renderKeypad(); // Disable hint button
  }

  // --- Validation ---

  validate() {
    // Reset errors
    this.grid.forEach(c => c.isError = false);

    // 1. Row/Col Uniqueness
    for (let i = 0; i < this.size; i++) {
      this.checkGroup(this.getRow(i));
      this.checkGroup(this.getCol(i));
    }

    // 2. Cage Arithmetic (only if cage is fully filled)
    this.cages.forEach(cage => {
      const cells = cage.cells.map(idx => this.grid[idx]);
      const values = cells.map(c => c.value);
      if (values.every(v => v !== null)) {
         if (!this.checkCageMath(values, cage.target, cage.op)) {
             cells.forEach(c => c.isError = true);
         }
      }
    });
  }

  checkGroup(indices) {
    const seen = new Map();
    indices.forEach(idx => {
      const val = this.grid[idx].value;
      if (val !== null) {
        if (seen.has(val)) {
          this.grid[idx].isError = true;
          this.grid[seen.get(val)].isError = true;
        } else {
          seen.set(val, idx);
        }
      }
    });
  }

  checkCageMath(values, target, op) {
     // Sort for easier math
     const nums = [...values].sort((a,b) => b - a); // Descending
     
     if (op === '+') return nums.reduce((a,b) => a+b, 0) === target;
     if (op === 'x' || op === '*') return nums.reduce((a,b) => a*b, 1) === target;
     
     if (op === '-') {
       if (values.length === 2) {
           return (nums[0] - nums[1]) === target;
       }
       return false;
     }

     if (op === '/' || op === '÷') {
         if (values.length === 2) {
             return (nums[0] / nums[1]) === target;
         }
         return false;
     }
     
     // No op (single cell cage)
     if (!op || op === '') return values[0] === target;

     return false;
  }

  getRow(r) {
      return Array.from({length: this.size}, (_, c) => r * this.size + c);
  }
  
  getCol(c) {
      return Array.from({length: this.size}, (_, r) => r * this.size + c);
  }

}

// --- Puzzle Generator ---

class PuzzleGenerator {
  static generate(size) {
    // 1. Generate Base Latin Square
    let grid = this.createLatinSquare(size);
    
    // 2. Shuffle (Rows, Cols, Numbers)
    grid = this.shuffleGrid(grid, size);

    // 3. Get Cage Layout (Shapes)
    const layout = this.getCageLayout(size);

    // 4. Calculate Targets
    const cages = layout.map((cageIndices, i) => {
      const values = cageIndices.map(idx => grid[idx]);
      const { target, op } = this.calculateCageTarget(values);
      return {
        id: `c${i}`,
        cells: cageIndices,
        target,
        op
      };
    });

    return { size, cages, solution: grid };
  }

  static createLatinSquare(size) {
    // Simple cyclic Latin Square
    const grid = new Array(size * size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        grid[r * size + c] = (r + c) % size + 1;
      }
    }
    return grid;
  }

  static shuffleGrid(grid, size) {
    let newGrid = [...grid];
    const idx = (r, c) => r * size + c;

    // 1. Shuffle Rows
    for (let i = 0; i < size; i++) {
      const r1 = Math.floor(Math.random() * size);
      const r2 = Math.floor(Math.random() * size);
      for (let c = 0; c < size; c++) {
        [newGrid[idx(r1, c)], newGrid[idx(r2, c)]] = [newGrid[idx(r2, c)], newGrid[idx(r1, c)]];
      }
    }

    // 2. Shuffle Cols
    for (let i = 0; i < size; i++) {
      const c1 = Math.floor(Math.random() * size);
      const c2 = Math.floor(Math.random() * size);
      for (let r = 0; r < size; r++) {
        [newGrid[idx(r, c1)], newGrid[idx(r, c2)]] = [newGrid[idx(r, c2)], newGrid[idx(r, c1)]];
      }
    }

    // 3. Shuffle Numbers
    const map = Array.from({length: size}, (_, i) => i + 1);
    for (let i = map.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [map[i], map[j]] = [map[j], map[i]];
    }
    newGrid = newGrid.map(v => map[v - 1]);

    return newGrid;
  }

  static getCageLayout(size) {
    const cages = [];
    const visited = new Set();
    
    for (let i = 0; i < size * size; i++) {
      if (visited.has(i)) continue;
      
      const cage = [i];
      visited.add(i);
      
      // Random cage size: 1 to 4 cells (weighted)
      // 3x3 grids prefer smaller cages (max 3)
      let maxCageSize = size === 3 ? 3 : 4;
      let targetSize = 1;
      const r = Math.random();
      if (r > 0.15) targetSize = 2;
      if (r > 0.55) targetSize = 3;
      if (r > 0.85 && maxCageSize >= 4) targetSize = 4;
      
      while (cage.length < targetSize) {
        // Find all valid unvisited neighbors of current cage
        const neighbors = [];
        for (const cellIndex of cage) {
          const r = Math.floor(cellIndex / size);
          const c = cellIndex % size;
          
          const candidates = [
            {r: r-1, c: c}, {r: r+1, c: c},
            {r: r, c: c-1}, {r: r, c: c+1}
          ];
          
          for (const cand of candidates) {
            if (cand.r >= 0 && cand.r < size && cand.c >= 0 && cand.c < size) {
              const idx = cand.r * size + cand.c;
              if (!visited.has(idx) && !neighbors.includes(idx)) {
                neighbors.push(idx);
              }
            }
          }
        }
        
        if (neighbors.length === 0) break; // No room to grow
        
        // Pick random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        cage.push(next);
        visited.add(next);
      }
      
      cages.push(cage);
    }
    return cages;
  }

  static calculateCageTarget(values) {
    if (values.length === 1) {
      return { target: values[0], op: '' };
    }

    const sorted = [...values].sort((a, b) => b - a);
    const ops = [];
    
    // Addition
    ops.push({ op: '+', target: sorted.reduce((a, b) => a + b, 0) });
    
    // Multiplication (prefer < 1000)
    const product = sorted.reduce((a, b) => a * b, 1);
    if (product < 1000) ops.push({ op: 'x', target: product });

    // Subtraction (2 cells)
    if (values.length === 2) {
       ops.push({ op: '-', target: sorted[0] - sorted[1] });
    }

    // Division (2 cells)
    if (values.length === 2 && sorted[0] % sorted[1] === 0) {
       ops.push({ op: '÷', target: sorted[0] / sorted[1] });
    }

    // Random pick
    return ops[Math.floor(Math.random() * ops.length)];
  }
}

let game;

function startGame(n) {
    const data = PuzzleGenerator.generate(n);
    game = new CalcudokuGame(data.size, data.cages, data.solution);
}

document.getElementById('size-selector').addEventListener('change', (e) => {
    startGame(parseInt(e.target.value));
});

// --- Menu Logic ---
const menuGrid = document.getElementById('menu-grid');
const sizes = [
  { s: 3, label: '3×3 (Easy)', desc: 'For Beginners' },
  { s: 4, label: '4×4', desc: 'Standard' },
  { s: 5, label: '5×5', desc: 'Intermediate' },
  { s: 6, label: '6×6', desc: 'Challenging' },
  { s: 7, label: '7×7 (Hard)', desc: 'Advanced' },
  { s: 8, label: '8×8 (Expert)', desc: 'Very Hard' },
  { s: 9, label: '9×9 (Master)', desc: 'Insane' }
];

sizes.forEach(({s, label, desc}) => {
  const item = document.createElement('div');
  item.className = 'menu-item';
  
  // Create mini grid icon
  const icon = document.createElement('div');
  icon.className = 'menu-icon';
  // Limit icon visual complexity
  const iconSize = Math.min(s, 6); 
  icon.style.gridTemplateColumns = `repeat(${s}, 1fr)`;
  // If size is large, we might want to scale the icon cells or limit grid lines
  // But Kakuro just uses the gap. Let's try matching exact size first.
  
  for(let i=0; i<s*s; i++) {
      const cell = document.createElement('div');
      // No border, just gap
      icon.appendChild(cell);
  }

  const lbl = document.createElement('div');
  lbl.className = 'menu-item-label';
  lbl.textContent = label;

  const sub = document.createElement('div');
  sub.className = 'menu-item-sublabel';
  sub.textContent = desc;

  item.appendChild(icon);
  item.appendChild(lbl);
  item.appendChild(sub);
  
  item.addEventListener('click', () => {
    showGame(s);
  });

  menuGrid.appendChild(item);
});

function showGame(size) {
  document.getElementById('menu-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  
  const selector = document.getElementById('size-selector');
  selector.value = size;
  
  startGame(size);
}

function showMenu() {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('menu-screen').style.display = 'flex';
  // Stop current game logic if needed (e.g. timers) - none here currently
}

document.getElementById('back-btn').addEventListener('click', showMenu);
