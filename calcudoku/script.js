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

  renderKeypad() {
    const keypadEl = document.getElementById('keypad');
    keypadEl.innerHTML = '';
    
    // Numbers 1 to Size
    for (let i = 1; i <= this.size; i++) {
      const btn = document.createElement('button');
      btn.className = 'keypad-btn';
      btn.textContent = i;
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click
        this.handleInput(i);
      });
      keypadEl.appendChild(btn);
    }
    
    // Eraser
    const eraser = document.createElement('button');
    eraser.className = 'keypad-btn action';
    eraser.textContent = '⌫';
    eraser.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleInput(null);
    });
    keypadEl.appendChild(eraser);

    // Hint
    const hint = document.createElement('button');
    hint.className = 'keypad-btn action';
    hint.textContent = '💡';
    hint.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleHint();
    });
    keypadEl.appendChild(hint);

    // Check
    const check = document.createElement('button');
    check.className = 'keypad-btn action';
    check.textContent = '✓';
    check.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCheck();
    });
    keypadEl.appendChild(check);
  }

  attachEvents() {
    // Keyboard support
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

  selectCell(index) {
    this.activeCellIndex = index;
    this.renderGrid();
  }

  handleInput(val) {
    if (this.activeCellIndex === null) return;

    // Save history
    const prev = this.grid[this.activeCellIndex].value;
    if (prev !== val) {
        this.history.push({
            index: this.activeCellIndex,
            oldVal: prev,
            newVal: val
        });
        
        this.grid[this.activeCellIndex].value = val;
        this.grid[this.activeCellIndex].isError = false; // Clear error on edit
        this.grid[this.activeCellIndex].isHint = false;
        this.renderGrid();
        
        // Auto check if full? No, let user check or check implicitly
        // Let's do implicit cage check (visual feedback only if full?)
        // Actually, let's just clear errors globally when input changes to reduce noise
        this.grid.forEach(c => c.isError = false);
        this.renderGrid();
    }
  }

  handleCheck() {
    // 1. Check Cages
    this.cages.forEach(cage => {
      const cells = cage.cells.map(idx => this.grid[idx]);
      const values = cells.map(c => c.value);
      if (values.every(v => v !== null)) {
         if (!this.checkCageMath(values, cage.target, cage.op)) {
             cells.forEach(c => c.isError = true);
         }
      }
    });

    // 2. Check Rows
    for (let r = 0; r < this.size; r++) {
        this.checkGroup(this.getRow(r));
    }

    // 3. Check Columns
    for (let c = 0; c < this.size; c++) {
        this.checkGroup(this.getCol(c));
    }
    
    this.renderGrid();

    // 4. Success Check
    const isFull = this.grid.every(c => c.value !== null);
    const hasError = this.grid.some(c => c.isError);
    if (isFull && !hasError) {
        setTimeout(() => alert('Congratulations! You solved it!'), 100);
    }
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

  getBorderClasses(index) {
      const classes = [];
      const r = Math.floor(index / this.size);
      const c = index % this.size;
      const cageId = this.grid[index].cageId;

      // Check Top
      if (r === 0 || this.grid[index - this.size].cageId !== cageId) classes.push('b-top');
      // Check Bottom
      if (r === this.size - 1 || this.grid[index + this.size].cageId !== cageId) classes.push('b-bottom');
      // Check Left
      if (c === 0 || this.grid[index - 1].cageId !== cageId) classes.push('b-left');
      // Check Right
      if (c === this.size - 1 || this.grid[index + 1].cageId !== cageId) classes.push('b-right');

      return classes;
  }

  handleHint() {
      if (this.hintUsed) return; // One hint per session
      
      const emptyCells = this.grid.filter(c => c.value === null);
      if (emptyCells.length === 0) return;

      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      randomCell.value = this.solution[randomCell.index];
      randomCell.isHint = true;
      this.hintUsed = true;
      this.renderGrid();
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

// Check URL Params
(function() {
  const params = new URLSearchParams(window.location.search);
  const size = params.get('size');
  if (size) {
    const s = parseInt(size);
    if (!isNaN(s) && s >= 3 && s <= 9) {
      showGame(s);
    }
  }
})();
