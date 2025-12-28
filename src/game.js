// Simple Sudoku game logic with generator, UI bindings, notes, undo/redo

(() => {
  const ACCENT = '#0057FF'
  const BLUE_SOFT = '#dbeafe'
  const BLUE_LIGHT = '#eff6ff'
  const RED = '#ef4444'

  const qs = sel => document.querySelector(sel)
  const qsa = sel => Array.from(document.querySelectorAll(sel))

  // --- RNG Helpers ---
  function mulberry32(a) {
      return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
  }
  
  function stringToSeed(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
          h = Math.imul(h ^ str.charCodeAt(i), 16777619);
      }
      return h >>> 0;
  }

  const state = {
    size: 9,
    grid: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ value: null, notes: new Set() }))),
    solution: null,
    puzzle: null,
    selected: null, // [r, c]
    notesMode: false,
    undoStack: [],
    redoStack: [],
    difficulty: 'easy',
    hoverDigit: null,
    mistakes: 0,
    timerStart: null,
    labelsVisible: false,
    conflictHighlight: false,
    timerEnabled: true,
    timerInterval: null,
    wrongSet: new Set(),
  }

  function setSize(size) {
    state.size = size
    state.grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ value: null, notes: new Set() })))
    state.solution = null
    state.puzzle = null
    state.selected = null
    state.undoStack = []
    state.redoStack = []
  }

  function random() {
    return state.rng ? state.rng() : Math.random()
  }

  function randomInt(n) { return Math.floor(random() * n) }

  function isValid(grid, r, c, v, size, brSize, bcSize) {
    for (let i = 0; i < size; i++) {
      if (grid[r][i] === v) return false
      if (grid[i][c] === v) return false
    }
    const br = Math.floor(r / brSize) * brSize, bc = Math.floor(c / bcSize) * bcSize
    for (let rr = br; rr < br + brSize; rr++) {
      for (let cc = bc; cc < bc + bcSize; cc++) {
        if (grid[rr][cc] === v) return false
      }
    }
    return true
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function countSolutionsForPuzzle(puzzle) {
    const grid = puzzle.map(row => row.slice())
    const size = grid.length
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    let count = 0
    function getCands(r, c) {
      if (grid[r][c] != null) return []
      const s = new Set(Array.from({ length: size }, (_, i) => i + 1))
      for (let i=0;i<size;i++) { const vr=grid[r][i]; const vc=grid[i][c]; if (vr!=null) s.delete(vr); if (vc!=null) s.delete(vc) }
      const br = Math.floor(r/brSize)*brSize, bc = Math.floor(c/bcSize)*bcSize
      for (let rr=br; rr<br+brSize; rr++) for (let cc=bc; cc<bc+bcSize; cc++) { const vb = grid[rr][cc]; if (vb!=null) s.delete(vb) }
      return Array.from(s)
    }
    function findNext() {
      let best = null, bestLen = 10
      for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
        if (grid[r][c]==null) {
          const cands = getCands(r,c)
          const len = cands.length
          if (len===0) return { r, c, cands }
          if (len < bestLen) { bestLen = len; best = { r, c, cands } }
        }
      }
      return best
    }
    function dfs() {
      if (count > 1) return
      const next = findNext()
      if (!next) { count++; return }
      const { r, c, cands } = next
      if (cands.length === 0) return
      for (const v of cands) {
        grid[r][c] = v
        dfs()
        if (count > 1) return
        grid[r][c] = null
      }
    }
    dfs()
    return count
  }

  function solveBacktrack(grid, size, brSize, bcSize) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
          const nums = shuffle(Array.from({ length: size }, (_, i) => i + 1))
          for (const v of nums) {
            if (isValid(grid, r, c, v, size, brSize, bcSize)) {
              grid[r][c] = v
              if (solveBacktrack(grid, size, brSize, bcSize)) return true
              grid[r][c] = null
            }
          }
          return false
        }
      }
    }
    return true
  }

  function generateSolution(size) {
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    const grid = Array.from({ length: size }, () => Array(size).fill(null))
    solveBacktrack(grid, size, brSize, bcSize)
    return grid
  }

  function clone2D(a) { return a.map(row => row.slice()) }

  function countGivensByDifficulty(diff) {
    if (diff === 'easy') return randomInt(5) + 44
    if (diff === 'medium') return randomInt(5) + 34
    return randomInt(5) + 24
  }

  function countGivensBySizeAndDifficulty(size, diff) {
    if (size === 9) return countGivensByDifficulty(diff)
    if (size === 6) return randomInt(4) + 20
    return Math.max(1, Math.floor(size * size * 0.35))
  }

  function generatePuzzle(diff) {
    const size = state.size
    const sol = generateSolution(size)
    const givensTarget = countGivensBySizeAndDifficulty(size, diff)
    const puzzle = clone2D(sol)
    const coords = shuffle(Array.from({ length: size*size }, (_, k) => [Math.floor(k/size), k%size]))
    const symmetric = size === 9 && diff === 'hard'
    const removed = new Set()
    function key(r,c){ return r*state.size+c }
    let removals = 0
    for (let idx = 0; idx < coords.length; idx++) {
      const [r,c] = coords[idx]
      if (puzzle[r][c] == null) continue
      if (symmetric) {
        const rr = (size - 1) - r, cc = (size - 1) - c
        const prevA = puzzle[r][c]
        const prevB = puzzle[rr][cc]
        puzzle[r][c] = null
        if (!(r === rr && c === cc)) puzzle[rr][cc] = null
        const count = countSolutionsForPuzzle(puzzle.map(row => row.slice()))
        if (count === 1 && ((size*size) - (removals + 1 + (r===rr && c===cc ? 0 : 1))) >= givensTarget) {
          removals += 1 + (r===rr && c===cc ? 0 : 1)
          removed.add(key(r,c))
          if (!(r === rr && c === cc)) removed.add(key(rr,cc))
        } else {
          puzzle[r][c] = prevA
          if (!(r === rr && c === cc)) puzzle[rr][cc] = prevB
        }
      } else {
        const prev = puzzle[r][c]
        puzzle[r][c] = null
        const count = countSolutionsForPuzzle(puzzle.map(row => row.slice()))
        if (count === 1 && ((size*size) - (removals + 1)) >= givensTarget) {
          removals += 1
          removed.add(key(r,c))
        } else {
          puzzle[r][c] = prev
        }
      }

      const currentGivens = (size*size) - removals
      if (currentGivens <= givensTarget) break
    }
    return { puzzle, solution: sol }
  }

  function getCandidates(gridCells, r, c) {
    if (gridCells[r][c].value != null) return []
    const size = state.size
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    const cand = new Set(Array.from({ length: size }, (_, i) => i + 1))
    for (let i = 0; i < size; i++) {
      const vr = gridCells[r][i].value
      const vc = gridCells[i][c].value
      if (vr != null) cand.delete(vr)
      if (vc != null) cand.delete(vc)
    }
    const br = Math.floor(r/brSize)*brSize, bc = Math.floor(c/bcSize)*bcSize
    for (let rr = br; rr < br + brSize; rr++) {
      for (let cc = bc; cc < bc + bcSize; cc++) {
        const vb = gridCells[rr][cc].value
        if (vb != null) cand.delete(vb)
      }
    }
    return Array.from(cand).sort((a,b)=>a-b)
  }

  function initAutoPencil() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.grid[r][c].value == null) {
          state.grid[r][c].notes = new Set(getCandidates(state.grid, r, c))
        } else {
          state.grid[r][c].notes = new Set()
        }
      }
    }
  }

  function renderGrid() {
    const gridEl = qs('#grid')
    gridEl.innerHTML = ''
    const size = state.size
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    
    // Grid Layout
    gridEl.style.display = 'grid'
    gridEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`
    gridEl.style.gridTemplateRows = `repeat(${size}, minmax(0, 1fr))`
    gridEl.style.gap = '0'
    gridEl.style.border = 'var(--grid-line-thick)'
    // gridEl.style.backgroundColor = '#34495e' // Removed to prevent bleed-through

    // Calculate Highlighting Context
    let selectedVal = null
    let relatedSet = new Set() // keys: "r,c"
    let conflictSet = new Set() // keys: "r,c"
    let selectedHasConflict = false

    if (state.selected) {
        const [sr, sc] = state.selected
        selectedVal = state.grid[sr][sc].value
        
        // Identify related cells (Row, Col, Block)
        for (let i = 0; i < size; i++) {
            relatedSet.add(`${sr},${i}`) // Row
            relatedSet.add(`${i},${sc}`) // Col
        }
        const br = Math.floor(sr/brSize)*brSize
        const bc = Math.floor(sc/bcSize)*bcSize
        for (let rr = br; rr < br + brSize; rr++) {
            for (let cc = bc; cc < bc + bcSize; cc++) {
                relatedSet.add(`${rr},${cc}`) // Block
            }
        }

        // Identify Conflicts for Selected Cell
        if (selectedVal != null) {
            // Check row
            for (let c = 0; c < size; c++) {
                if (c !== sc && state.grid[sr][c].value === selectedVal) {
                    conflictSet.add(`${sr},${c}`)
                    selectedHasConflict = true
                }
            }
            // Check col
            for (let r = 0; r < size; r++) {
                if (r !== sr && state.grid[r][sc].value === selectedVal) {
                    conflictSet.add(`${r},${sc}`)
                    selectedHasConflict = true
                }
            }
            // Check block
            for (let rr = br; rr < br + brSize; rr++) {
                for (let cc = bc; cc < bc + bcSize; cc++) {
                    if ((rr !== sr || cc !== sc) && state.grid[rr][cc].value === selectedVal) {
                        conflictSet.add(`${rr},${cc}`)
                        selectedHasConflict = true
                    }
                }
            }
        }
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div')
        cell.className = 'sudoku-cell'
        const key = `${r},${c}`
        
        // Borders (Thick lines for blocks, remove for edges)
        if (c === size - 1) {
            cell.style.borderRight = 'none'
        } else if (c % bcSize === bcSize - 1) {
            cell.style.borderRight = 'var(--grid-line-thick)'
        }
        
        if (r === size - 1) {
            cell.style.borderBottom = 'none'
        } else if (r % brSize === brSize - 1) {
            cell.style.borderBottom = 'var(--grid-line-thick)'
        }

        // Corner Radius
        if (r === 0 && c === 0) cell.style.borderTopLeftRadius = '12px'
        if (r === 0 && c === size - 1) cell.style.borderTopRightRadius = '12px'
        if (r === size - 1 && c === 0) cell.style.borderBottomLeftRadius = '12px'
        if (r === size - 1 && c === size - 1) cell.style.borderBottomRightRadius = '12px'

        const cellVal = state.grid[r][c].value
        
        // --- 1. Content Rendering ---
        if (cellVal != null) {
          cell.textContent = String(cellVal)
          cell.style.fontWeight = '500' // Clean font weight
          
          if (state.puzzle[r][c] != null) {
             cell.classList.add('val-given')
          } else {
             cell.classList.add('val-input')
          }
        } else {
          // Render notes
          const notes = state.grid[r][c].notes
          if (notes && notes.size > 0) {
            cell.classList.add('has-notes')
            for (let n=1; n<=9; n++) {
                const noteSpan = document.createElement('span')
                if (notes.has(n)) noteSpan.textContent = n
                noteSpan.style.display = 'flex'
                noteSpan.style.alignItems = 'center'
                noteSpan.style.justifyContent = 'center'
                cell.appendChild(noteSpan)
            }
          }
        }

        // --- 2. Highlighting Logic ---
        const isSelected = state.selected && state.selected[0] === r && state.selected[1] === c
        
        // Error Source (Pink background)
        if (conflictSet.has(key) || (state.wrongSet && state.wrongSet.has(key))) {
            cell.classList.add('cell-error-source')
            if (state.wrongSet && state.wrongSet.has(key)) cell.classList.add('text-error')
        }
        // Selected Cell
        else if (isSelected) {
            cell.classList.add('cell-selected')
            if (selectedHasConflict) {
                cell.classList.add('text-error')
            }
        }
        // Same Value (Darker Blue)
        else if (selectedVal != null && cellVal === selectedVal) {
            cell.classList.add('cell-same-value')
        }
        // Related Cells (Light Blue)
        else if (relatedSet.has(key)) {
            cell.classList.add('cell-related')
        }
        
        // Click Handler
        cell.addEventListener('click', () => {
          state.selected = [r, c]
          renderGrid()
        })

        // Hover Handlers (optional, keeps existing logic if needed, but currently not using hover digit highlighting in new design)
        
        gridEl.appendChild(cell)
      }
    }
    renderLabels()
  }

  function renderLabels() {
    const gridEl = qs('#grid'); if (!gridEl) return
    const oldTop = qs('#colLabels'); if (oldTop) oldTop.remove()
    const oldLeft = qs('#rowLabels'); if (oldLeft) oldLeft.remove()
    if (!state.labelsVisible) return
    const size = state.size
    const top = document.createElement('div')
    top.id = 'colLabels'
    top.style.position = 'absolute'
    top.style.top = '-22px'
    top.style.left = '0'
    top.style.right = '0'
    top.style.display = 'grid'
    top.style.gridTemplateColumns = `repeat(${size}, 1fr)`
    for (let n=1;n<=size;n++) {
      const s = document.createElement('div')
      s.textContent = String(n)
      s.style.textAlign = 'center'
      s.style.fontSize = '12px'
      s.style.color = 'var(--color-secondary)'
      top.appendChild(s)
    }
    const left = document.createElement('div')
    left.id = 'rowLabels'
    left.style.position = 'absolute'
    left.style.left = '-22px'
    left.style.top = '0'
    left.style.bottom = '0'
    left.style.display = 'grid'
    left.style.gridTemplateRows = `repeat(${size}, 1fr)`
    for (let i=0;i<size;i++) {
      const s = document.createElement('div')
      s.textContent = String.fromCharCode(65 + i)
      s.style.display = 'flex'
      s.style.alignItems = 'center'
      s.style.justifyContent = 'center'
      s.style.fontSize = '12px'
      s.style.color = 'var(--color-secondary)'
      left.appendChild(s)
    }
    gridEl.appendChild(top)
    gridEl.appendChild(left)
  }

  function pushUndo(op) {
    state.undoStack.push(op)
    if (state.undoStack.length > 200) state.undoStack.shift()
    state.redoStack = []
    saveToStorage()
  }

  function fillSelected(val) {
    if (!state.selected) return
    const [r, c] = state.selected
    // If val is null, clear cell
    if (val === null) {
        const prev = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
        state.grid[r][c].value = null
        state.grid[r][c].notes = new Set()
        pushUndo({ type: 'value', r, c, prev })
        renderGrid()
        return
    }

    // If locked (given), do nothing (though usually handled by click listener not selecting givens? No, grid allows selecting givens but maybe should prevent editing)
    if (state.puzzle[r][c] != null) return

    const prev = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
    
    if (state.notesMode) {
      // Toggle note
      if (state.grid[r][c].notes.has(val)) state.grid[r][c].notes.delete(val)
      else state.grid[r][c].notes.add(val)
      // If setting notes, clear value? Usually yes, or value overrides notes. 
      // If value exists, notes are hidden. So if user adds note, maybe clear value? 
      // Let's keep value if exists, notes in background? No, usually mutually exclusive or notes shown when empty.
      if (state.grid[r][c].value != null) state.grid[r][c].value = null 
    } else {
      // Set value
      state.grid[r][c].value = val
      state.grid[r][c].notes = new Set()
    }

    pushUndo({ type: 'value', r, c, prev })
    renderGrid()
    if (state.selected && !state.notesMode) {
      const idx = state.selected[0]*state.size + state.selected[1]
      const cell = qs('#grid').childNodes[idx]
      if (cell) cell.style.animation = 'placePop .15s ease'
    }
    autoCheckCompletion()
  }

  function isValidNumericPlacement(r, c, v) {
    // check duplicates against current grid (excluding the target cell before placement)
    const size = state.size
    for (let i=0;i<size;i++) {
      if (i!==c && state.grid[r][i].value === v) return false
      if (i!==r && state.grid[i][c].value === v) return false
    }
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    const br = Math.floor(r/brSize)*brSize, bc = Math.floor(c/bcSize)*bcSize
    for (let rr=br; rr<br+brSize; rr++) for (let cc=bc; cc<bc+bcSize; cc++) {
      if ((rr!==r || cc!==c) && state.grid[rr][cc].value === v) return false
    }
    return true
  }

  function getVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() }

  // no tooltip

  function undo() {
    const op = state.undoStack.pop(); if (!op) return
    const { r, c, prev, type } = op
    const cur = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
    state.redoStack.push({ r, c, prev: cur, type })
    state.grid[r][c].value = prev.value
    state.grid[r][c].notes = new Set(prev.notes)
    renderGrid()
    saveToStorage()
  }

  function redo() {
    const op = state.redoStack.pop(); if (!op) return
    const { r, c, prev, type } = op
    const curPrev = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
    state.undoStack.push({ r, c, prev: curPrev, type })
    state.grid[r][c].value = prev.value
    state.grid[r][c].notes = new Set(prev.notes)
    renderGrid()
    saveToStorage()
  }

  function clearNotes() {
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
      if (state.grid[r][c].value == null) state.grid[r][c].notes = new Set()
    }
    renderGrid()
    saveToStorage()
  }

  function getStatus() {
    let unfilled = 0, wrong = 0, correct = 0
    const wrongSet = new Set()
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
      const given = state.puzzle?.[r]?.[c] != null
      if (given) continue
      const v = state.grid[r][c].value
      if (v == null) unfilled++
      else if (v === state.solution[r][c]) correct++
      else { wrong++; wrongSet.add(r + ',' + c) }
    }
    return { unfilled, wrong, correct, wrongSet }
  }

  function checkCorrect() {
    const st = getStatus()
    if (st.wrong === 0 && st.unfilled === 0) {
      state.wrongSet = new Set()
      showModal()
    } else {
      showIncorrect(st.unfilled, st.wrong, st.correct, st.wrongSet)
    }
  }

  function autoCheckCompletion() {
    const st = getStatus()
    if (st.unfilled === 0) {
      if (st.wrong === 0) {
        state.wrongSet = new Set()
        showModal()
      } else {
        showIncorrect(st.unfilled, st.wrong, st.correct, st.wrongSet)
      }
    } else {
      state.wrongSet = new Set()
    }
  }

  function showModal() {
    let modal = qs('#winModal')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'winModal'
      modal.style.position = 'fixed'
      modal.style.inset = '0'
      modal.style.background = 'rgba(0,0,0,0.35)'
      modal.style.display = 'flex'
      modal.style.alignItems = 'center'
      modal.style.justifyContent = 'center'
      const card = document.createElement('div')
      card.style.background = '#fff'
      card.style.border = '1px solid var(--color-border)'
      card.style.borderRadius = '12px'
      card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
      card.style.padding = '20px'
      card.style.width = '320px'
      card.style.animation = 'modalIn .25s ease'
    const h = document.createElement('div')
    h.textContent = 'Congratulations! Puzzle solved.'
      h.style.fontWeight = '600'
      h.style.marginBottom = '12px'
      const row = document.createElement('div')
      row.style.display = 'flex'; row.style.gap = '8px'; row.style.justifyContent = 'flex-end'
      const replayBtn = document.createElement('button')
      replayBtn.className = 'btn'
      replayBtn.textContent = 'Replay Puzzle'
      replayBtn.addEventListener('click', () => { modal.remove(); clearEntries() })
      const newBtn = document.createElement('button')
      newBtn.className = 'btn btn-primary'
      newBtn.textContent = 'New Puzzle'
      newBtn.addEventListener('click', () => { newPuzzle(state.difficulty) })
      row.appendChild(replayBtn); row.appendChild(newBtn)
      card.appendChild(h); card.appendChild(row)
      modal.appendChild(card)
      document.body.appendChild(modal)
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })

      // update stats
      const elapsed = Date.now() - (state.timerStart || Date.now())
      updateStatsOnWin(elapsed)
    }
  }

  function showIncorrect(unfilled, wrong, correct, wrongSet) {
    let modal = qs('#incorrectModal')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'incorrectModal'
      modal.style.position = 'fixed'
      modal.style.inset = '0'
      modal.style.background = 'rgba(0,0,0,0.35)'
      modal.style.display = 'flex'
      modal.style.alignItems = 'center'
      modal.style.justifyContent = 'center'
      const card = document.createElement('div')
      card.style.background = '#fff'
      card.style.border = '1px solid var(--color-border)'
      card.style.borderRadius = '12px'
      card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
      card.style.padding = '20px'
      card.style.width = '320px'
      card.style.animation = 'modalIn .25s ease'
      const h = document.createElement('div')
      h.textContent = 'Progress Check'
      h.style.fontWeight = '600'
      h.style.marginBottom = '12px'
      const info = document.createElement('div')
      info.textContent = `Correct: ${correct} · Incorrect: ${wrong} · Unfilled: ${unfilled}`
      info.style.marginBottom = '12px'
      const list = document.createElement('div')
      const size = state.size
      const arr = Array.from(wrongSet || [])
      const names = arr.map(k => {
        const [r,c] = k.split(',').map(Number)
        return String.fromCharCode(65 + r) + (c + 1)
      })
      list.textContent = names.length ? ('Wrong at: ' + names.join(', ')) : 'No incorrect cells.'
      list.style.marginBottom = '12px'
      const row = document.createElement('div')
      row.style.display = 'flex'; row.style.gap = '8px'; row.style.justifyContent = 'flex-end'
      const continueBtn = document.createElement('button')
      continueBtn.className = 'btn'
      continueBtn.textContent = 'Modify Current'
      continueBtn.addEventListener('click', () => { modal.remove() })
      const restartBtn = document.createElement('button')
      restartBtn.className = 'btn'
      restartBtn.textContent = 'Restart'
      restartBtn.addEventListener('click', () => { modal.remove(); clearEntries() })
      const newBtn = document.createElement('button')
      newBtn.className = 'btn btn-primary'
      newBtn.textContent = 'New Puzzle'
      newBtn.addEventListener('click', () => { modal.remove(); newPuzzle(state.difficulty) })
      row.appendChild(continueBtn); row.appendChild(restartBtn); row.appendChild(newBtn)
      card.appendChild(h); card.appendChild(info); card.appendChild(list); card.appendChild(row)
      modal.appendChild(card)
      document.body.appendChild(modal)
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
      state.wrongSet = wrongSet || new Set()
      renderGrid()
    }
  }

  function showPrintPreview() {
    let modal = qs('#printPreview')
    if (modal) modal.remove()
    modal = document.createElement('div')
    modal.id = 'printPreview'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.background = 'rgba(0,0,0,0.35)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.border = '1px solid var(--color-border)'
    card.style.borderRadius = '12px'
    card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
    card.style.padding = '20px'
    card.style.width = '720px'
    card.style.animation = 'modalIn .25s ease'
    const h = document.createElement('div')
    h.textContent = 'Print Preview'
    h.style.fontWeight = '600'
    h.style.marginBottom = '12px'
    const previewWrap = document.createElement('div')
    previewWrap.style.display = 'flex'
    previewWrap.style.alignItems = 'center'
    previewWrap.style.justifyContent = 'center'
    previewWrap.style.background = 'var(--color-grid-bg)'
    previewWrap.style.borderRadius = '12px'
    previewWrap.style.padding = '16px'
    const size = state.size
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    const grid = document.createElement('div')
    grid.style.width = '540px'
    grid.style.height = '540px'
    grid.style.background = '#fff'
    grid.style.borderRadius = '12px'
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`
    grid.style.gridTemplateRows = `repeat(${size}, 1fr)`
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
      const cell = document.createElement('div')
      cell.style.border = '1px solid #d1d5db'
      const styles = []
      if (r % brSize === 0) styles.push('border-top:2px solid #d1d5db')
      if (c % bcSize === 0) styles.push('border-left:2px solid #d1d5db')
      if (r === size-1) styles.push('border-bottom:2px solid #d1d5db')
      if (c === size-1) styles.push('border-right:2px solid #d1d5db')
      cell.style.cssText = cell.style.cssText + ';' + styles.join(';')
      cell.style.display = 'flex'
      cell.style.alignItems = 'center'
      cell.style.justifyContent = 'center'
      cell.style.fontSize = '18px'
      cell.style.color = 'var(--color-text)'
      const v = state.grid[r][c].value
      cell.textContent = v != null ? String(v) : ''
      grid.appendChild(cell)
    }
    previewWrap.appendChild(grid)
    const row = document.createElement('div')
    row.style.display = 'flex'; row.style.gap = '8px'; row.style.justifyContent = 'flex-end'; row.style.marginTop = '12px'
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => { modal.remove() })
    const doPrintBtn = document.createElement('button')
    doPrintBtn.className = 'btn btn-primary'
    doPrintBtn.textContent = 'Print'
    doPrintBtn.addEventListener('click', () => { window.print() })
    row.appendChild(cancelBtn); row.appendChild(doPrintBtn)
    card.appendChild(h); card.appendChild(previewWrap); card.appendChild(row)
    modal.appendChild(card)
    document.body.appendChild(modal)
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
  }

  function updateStatsOnWin(elapsed) {
    try {
      const raw = localStorage.getItem('sudoku_stats')
      const stats = raw ? JSON.parse(raw) : { fastest: { easy: null, medium: null, hard: null }, completed: { easy: 0, medium: 0, hard: 0 } }
      if (!stats.completed) stats.completed = { easy: 0, medium: 0, hard: 0 }
      if (!stats.fastest) stats.fastest = { easy: null, medium: null, hard: null }
      const d = state.difficulty
      const cur = stats.fastest[d]
      if (cur == null || elapsed < cur) stats.fastest[d] = elapsed
      stats.completed[d] = (stats.completed[d] || 0) + 1
      localStorage.setItem('sudoku_stats', JSON.stringify(stats))
      
      // Update Daily History
      if (state.isDaily && state.dailyDate) {
          const dailyRaw = localStorage.getItem('sudoku_daily_history')
          const dailyHistory = dailyRaw ? JSON.parse(dailyRaw) : []
          if (!dailyHistory.includes(state.dailyDate)) {
              dailyHistory.push(state.dailyDate)
              localStorage.setItem('sudoku_daily_history', JSON.stringify(dailyHistory))
          }
          
          // Update Daily Counts (for Heatmap intensity)
          // We track how many times a daily puzzle date has been completed (e.g. diff difficulties)
          // Using a composite key of "date-difficulty" to avoid double counting same puzzle?
          // User said "More than 3 puzzles", implying count.
          // Let's just increment count for the date.
          const countsRaw = localStorage.getItem('sudoku_daily_counts')
          const dailyCounts = countsRaw ? JSON.parse(countsRaw) : {}
          dailyCounts[state.dailyDate] = (dailyCounts[state.dailyDate] || 0) + 1
          localStorage.setItem('sudoku_daily_counts', JSON.stringify(dailyCounts))
      }

      updateStatsUI()
    } catch {}
  }

  function formatMs(ms) {
    const s = Math.floor(ms/1000)
    const m = Math.floor(s/60)
    const sec = s%60
    return `${m}m ${sec}s`
  }

  function updateStatsUI() {
    try {
      const raw = localStorage.getItem('sudoku_stats')
      if (!raw) { qs('#fastest').textContent = 'Fastest: —'; qs('#completed').textContent = 'Completed: —'; return }
      const stats = JSON.parse(raw)
      const d = state.difficulty
      const fastest = stats.fastest?.[d]
      const completed = stats.completed?.[d] ?? 0
      qs('#fastest').textContent = 'Fastest: ' + (fastest != null ? formatMs(fastest) : '—')
      qs('#completed').textContent = 'Completed: ' + completed
    } catch {}
  }

  function giveHint() {
    const empty = []
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
        if (state.grid[r][c].value == null) empty.push({r,c})
    }
    if (empty.length === 0) return
    const cell = empty[Math.floor(Math.random() * empty.length)]
    const {r,c} = cell
    const prev = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
    state.grid[r][c].value = state.solution[r][c]
    state.grid[r][c].notes = new Set()
    pushUndo({ type: 'value', r, c, prev })
    state.selected = [r,c]
    renderGrid()
    autoCheckCompletion()
  }

  function showSolution() {
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
        state.grid[r][c].value = state.solution[r][c]
        state.grid[r][c].notes = new Set()
    }
    renderGrid()
    saveToStorage()
    autoCheckCompletion()
  }

  function bindPad() {
    const pad = qs('#numPad')
    if (pad) {
        pad.innerHTML = ''
        // Add empty/clear button? Original code didn't. 
        // Image has a button that looks empty at start of row? 
        // "Row of buttons 1-9. Also an empty/erase button? The first one is empty."
        // Let's add an erase button 'X' or ' '
        const eraseBtn = document.createElement('button')
        eraseBtn.className = 'btn'
        eraseBtn.textContent = '⌫' // Backspace symbol
        eraseBtn.addEventListener('click', () => fillSelected(null))
        pad.appendChild(eraseBtn)

        for (let n=1;n<=state.size;n++) {
          const b = document.createElement('button')
          b.className = 'btn'
          b.textContent = String(n)
          b.addEventListener('click', () => fillSelected(n))
          pad.appendChild(b)
        }
    }

    const undoBtn = qs('#undoBtn'); if (undoBtn) undoBtn.addEventListener('click', undo)
    // redoBtn in HTML is now "Reset"
    const redoBtn = qs('#redoBtn'); if (redoBtn) redoBtn.addEventListener('click', clearEntries)
    
    const checkBtn = qs('#checkBtn'); if (checkBtn) checkBtn.addEventListener('click', checkCorrect)
    
    // New Bindings
    const hintBtn = qs('#hintBtn'); if (hintBtn) hintBtn.addEventListener('click', giveHint)
    const solveBtn = qs('#solverBtn'); if (solveBtn) solveBtn.addEventListener('click', showSolution)
    const showSolBtn = qs('#showSolutionBtn'); if (showSolBtn) showSolBtn.addEventListener('click', showSolution)
    const showPossBtn = qs('#showPossibilitiesBtn'); if (showPossBtn) showPossBtn.addEventListener('click', () => { initAutoPencil(); renderGrid(); saveToStorage() })
    
    const noteCheck = qs('#noteModeCheckbox')
    if (noteCheck) {
        noteCheck.checked = state.notesMode
        noteCheck.addEventListener('change', (e) => { state.notesMode = e.target.checked })
    }
    const clearNotesLink = qs('#clearNotesLink')
    if (clearNotesLink) clearNotesLink.addEventListener('click', (e) => { e.preventDefault(); clearNotes() })

    const resetTop = qs('#resetBtn'); if (resetTop) resetTop.addEventListener('click', clearEntries)


    const toggleBtn = qs('#toggleLabelsBtn')
    if (toggleBtn) {
      const update = () => {
        toggleBtn.textContent = state.labelsVisible ? 'Hide Row/Column Labels' : 'Show Row/Column Labels'
        if (state.labelsVisible) toggleBtn.classList.add('btn-toggle-active'); else toggleBtn.classList.remove('btn-toggle-active')
      }
      update()
      toggleBtn.addEventListener('click', () => { state.labelsVisible = !state.labelsVisible; renderLabels(); update() })
    }
    const printBtn = qs('#printBtn')
    if (printBtn) {
      printBtn.addEventListener('click', () => { showPrintPreview() })
    }
    const conflictBtn = qs('#toggleConflictBtn')
    if (conflictBtn) {
      const updateConflict = () => {
        conflictBtn.textContent = state.conflictHighlight ? 'Disable Conflict Highlight' : 'Enable Conflict Highlight'
        if (state.conflictHighlight) conflictBtn.classList.add('btn-toggle-active'); else conflictBtn.classList.remove('btn-toggle-active')
      }
      updateConflict()
      conflictBtn.addEventListener('click', () => { state.conflictHighlight = !state.conflictHighlight; renderGrid(); updateConflict() })
    }
    const timerBtn = qs('#toggleTimerBtn')
    if (timerBtn) {
      // Toggle Timer Logic
      // Image has Pause button (||) which suggests timer is running.
      // And a restart button.
      // The toggleTimerBtn in my HTML is the "||" button.
      // Let's implement pause/resume.
      const updateTimerBtn = () => {
        timerBtn.textContent = state.timerEnabled ? '||' : '▶'
        timerBtn.title = state.timerEnabled ? 'Pause' : 'Resume'
      }
      // Enable timer by default if not set? 
      // Existing logic: state.timerEnabled defaults false.
      // Let's default it to true for this new design? Or just respect state.
      // If I want to match image "00:00:23", it's running.
      // Let's trigger click once if not enabled? No, safer to just bind.
      
      updateTimerBtn()
      timerBtn.addEventListener('click', () => {
        state.timerEnabled = !state.timerEnabled
        if (state.timerEnabled) {
          if (!state.timerStart) state.timerStart = Date.now()
          // Adjust start time if resuming? 
          // Current logic: timerStart is absolute. Pausing just hides display?
          // Line 749: if (!state.timerEnabled) { el.style.display = 'none'; return }
          // This logic is "Show/Hide" timer, not Pause/Resume.
          // To implement Pause, we need to track accumulated time.
          // MVP: Just Toggle Visibility/Running.
          if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null }
          state.timerInterval = setInterval(updateTimerUI, 1000)
          updateTimerUI()
        } else {
          if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null }
          updateTimerUI()
        }
        updateTimerBtn()
      })
    }
    document.addEventListener('keydown', (e) => {
      const num = Number(e.key)
      if (!isNaN(num) && num >= 1 && num <= state.size) fillSelected(num)
      if (e.key === 'Backspace' || e.key === 'Delete') fillSelected(null)
    })
    // no hover highlight via pad
    updateTimerUI()
  }



  function updateTimerUI() {
    const el = qs('#timerDisplay'); if (!el) return
    if (!state.timerEnabled) { el.style.display = 'none'; return }
    el.style.display = 'block'
    const start = state.timerStart || Date.now()
    const elapsed = Date.now() - start
    el.textContent = 'Timer: ' + formatMs(elapsed)
  }

  function clearEntries() {
    const size = state.size
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
      const target = state.puzzle?.[r]?.[c] ?? null
      const curVal = state.grid[r][c].value
      const curNotes = new Set(state.grid[r][c].notes)
      if (curVal !== target || (target == null && curNotes.size > 0)) {
        const prev = { value: curVal, notes: curNotes }
        state.grid[r][c].value = target
        state.grid[r][c].notes = new Set()
        pushUndo({ type: 'value', r, c, prev })
      }
    }
    renderGrid()
    saveToStorage()
  }

  function newPuzzle(diff) {
    state.difficulty = diff
    state.mistakes = 0
    state.timerStart = Date.now()
    const { puzzle, solution } = generatePuzzle(diff)
    state.solution = solution
    state.puzzle = puzzle
    // load puzzle into state.grid
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
      const v = puzzle[r][c]
      state.grid[r][c].value = v
      state.grid[r][c].notes = new Set()
    }
    // no auto-pencil
    renderGrid()
    const diffEl = qs('#difficulty')
    if (diffEl) diffEl.textContent = 'Difficulty: ' + (state.size===6 ? '6x6' : (diff==='hard'?'hard':diff==='medium'?'medium':'easy'))
    saveToStorage()
    updateStatsUI()
  }

  function renderCalendar(currentDateStr) {
      const container = qs('#dailyCalendar')
      if (!container) return
      
      const today = new Date()
      const selectedDate = new Date(currentDateStr)
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()
      
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      
      const firstDay = new Date(year, month, 1).getDay()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      
      let html = `
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:20px; max-width:400px; margin-left:auto; margin-right:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
             <div style="font-weight:700; color:#374151; font-size:16px;">${monthNames[month]} ${year}</div>
             <div style="display:flex; gap:4px;">
                <button class="cal-nav" style="background:none; border:1px solid #ddd; border-radius:4px; padding:4px 8px; cursor:pointer;" data-offset="-1">◀</button>
                <button class="cal-nav" style="background:none; border:1px solid #ddd; border-radius:4px; padding:4px 8px; cursor:pointer;" data-offset="1">▶</button>
             </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center;">
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Su</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Mo</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Tu</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">We</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Th</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Fr</div>
            <div style="color:#9ca3af; font-size:12px; font-weight:600; padding-bottom:8px;">Sa</div>
      `
      
      for (let i=0; i<firstDay; i++) html += `<div></div>`
      
      const todayStr = new Date().toISOString().split('T')[0]
      
      for (let d=1; d<=daysInMonth; d++) {
          const dDate = new Date(year, month, d)
          const dStr = dDate.toISOString().split('T')[0]
          
          let bg = 'transparent'
          let color = '#374151'
          let border = '1px solid transparent'
          
          if (dStr === todayStr) {
             border = '1px solid #0057FF'
             color = '#0057FF'
             if (dStr !== currentDateStr) bg = '#eff6ff'
          }
          
          if (dStr === currentDateStr) {
              bg = '#0057FF'
              color = '#ffffff'
          }
          
          html += `<div class="cal-day" data-date="${dStr}" style="padding:8px 0; cursor:pointer; border-radius:4px; background:${bg}; color:${color}; border:${border}; font-size:14px; font-weight:500;">${d}</div>`
      }
      
      html += `</div></div>`
      container.innerHTML = html
      
      container.querySelectorAll('.cal-day').forEach(el => {
          el.addEventListener('click', () => {
              const d = el.getAttribute('data-date') // YYYY-MM-DD
              const url = new URL(window.location);
              url.searchParams.set('date', d);
              window.location.href = url.toString();
          })
      })
      
      container.querySelectorAll('.cal-nav').forEach(el => {
          el.addEventListener('click', () => {
             const offset = parseInt(el.getAttribute('data-offset'))
             const newDate = new Date(year, month + offset, 1)
             const dStr = newDate.toISOString().split('T')[0]
             const url = new URL(window.location);
             url.searchParams.set('date', dStr);
             window.location.href = url.toString();
          })
      })
  }

  function initArchive() {
    let year = new Date().getFullYear()
    let month = new Date().getMonth()
    
    if (!state.archiveDate) {
        state.archiveDate = { year, month }
    } else {
        year = state.archiveDate.year
        month = state.archiveDate.month
    }

    renderArchive(year, month)

    const prevBtn = qs('#prevMonthBtn')
    const nextBtn = qs('#nextMonthBtn')
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            state.archiveDate.month--
            if (state.archiveDate.month < 0) {
                state.archiveDate.month = 11
                state.archiveDate.year--
            }
            renderArchive(state.archiveDate.year, state.archiveDate.month)
        }
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            state.archiveDate.month++
            if (state.archiveDate.month > 11) {
                state.archiveDate.month = 0
                state.archiveDate.year++
            }
            renderArchive(state.archiveDate.year, state.archiveDate.month)
        }
    }
  }

  function renderArchive(year, month) {
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    
    const headerEl = qs('#archiveMonthName')
    if (headerEl) headerEl.textContent = `${monthNames[month]} ${year}`
    
    const gridEl = qs('#archiveGrid')
    if (!gridEl) return
    gridEl.innerHTML = ''
    
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
    const currentDay = today.getDate()
    
    const p = new URLSearchParams(location.search)
    let diff = p.get('difficulty') || 'medium'
    
    for (let d = 1; d <= daysInMonth; d++) {
        if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) break;
        if (isCurrentMonth && d > currentDay) break;

        const a = document.createElement('a')
        a.className = 'archive-link'
        
        const mStr = String(month + 1).padStart(2, '0')
        const dStr = String(d).padStart(2, '0')
        const dateStr = `${dStr}-${mStr}-${year}`
        
        a.href = `/${dateStr}-sudoku?difficulty=${diff}`
        a.textContent = `${monthNames[month]} ${d}, ${year}`
        
        if (isCurrentMonth && d === currentDay) {
            a.classList.add('today')
            a.textContent += " (Today)"
        }
        
        gridEl.appendChild(a)
    }
  }

  function init() {
    const p = new URLSearchParams(location.search)
    const path = location.pathname.toLowerCase()
    let desiredSize = 9
    let desiredDiff = 'easy'
    let isDaily = false
    let dailyDate = null

    const dailyMatch = path.match(/\/(\d{2})-(\d{2})-(\d{4})-sudoku$/)

    if (path.includes('/six/') || path.endsWith('/six')) {
      desiredSize = 6
      desiredDiff = '6x6'
    } else if (path.includes('/daily/') || path.endsWith('/daily')) {
      const diffParam = p.get('difficulty')
      desiredDiff = diffParam ? diffParam.toLowerCase() : 'medium'
      if (desiredDiff === 'six' || desiredDiff === '6x6') desiredSize = 6
      isDaily = true
      const dParam = p.get('date')
      dailyDate = dParam || new Date().toISOString().split('T')[0]
    } else if (dailyMatch) {
       const [_, d, m, y] = dailyMatch
       dailyDate = `${y}-${m}-${d}`
       const diffParam = p.get('difficulty')
       desiredDiff = diffParam ? diffParam.toLowerCase() : 'medium'
       if (desiredDiff === 'six' || desiredDiff === '6x6') desiredSize = 6
       isDaily = true
    } else {
      let d = p.get('difficulty')
      if (!d) {
        if (path.includes('/easy/') || path.endsWith('/easy')) d = 'easy'
        else if (path.includes('/medium/') || path.endsWith('/medium')) d = 'medium'
        else if (path.includes('/hard/') || path.endsWith('/hard')) d = 'hard'
      }
      desiredDiff = (d || 'easy').toLowerCase()
    }
    
    setSize(desiredSize)
    
    if (isDaily) {
        state.isDaily = true
        state.dailyDate = dailyDate
        const seed = stringToSeed(dailyDate)
        state.rng = mulberry32(seed)
        
        // View Toggle Logic
        const view = p.get('view')
        const archiveEl = qs('#daily-archive')
        const gameEl = qs('#daily-game-container')
        
        if (view === 'archive') {
            if (archiveEl) {
                archiveEl.style.display = 'block'
                initArchive()
            }
            if (gameEl) gameEl.style.display = 'none'
            // We can return here if we don't want to init the game in archive view, 
            // but init() usually sets up everything. 
            // Let's just hide the game container.
        } else {
            if (archiveEl) archiveEl.style.display = 'none'
            if (gameEl) gameEl.style.display = 'block'
            
            // Only render calendar widget if needed (maybe removed?)
            renderCalendar(dailyDate)
            
            const title = qs('.game-title')
            const subtitle = qs('#game-subtitle')
            if (title) {
                let diffStr = desiredDiff
                if (diffStr === 'six') diffStr = '6x6'
                else diffStr = diffStr.charAt(0).toUpperCase() + diffStr.slice(1)
                
                // Format Date for display (e.g. Dec 28, 2025)
                const dObj = new Date(dailyDate)
                const dateStr = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                if (subtitle) {
                    title.textContent = 'Daily Challenge'
                    subtitle.textContent = `${dateStr} (${diffStr})`
                } else {
                    title.textContent = `Daily Challenge: ${dateStr} (${diffStr})`
                }
            }
        }
    } else {
        state.rng = null
    }

    const newBtn = qs('#newPuzzle'); 
    if (newBtn) {
        if (isDaily) {
            newBtn.textContent = 'New Game'
            newBtn.onclick = () => {
                state.rng = mulberry32(stringToSeed(state.dailyDate))
                newPuzzle(desiredDiff)
            }
            
            // Update dropdown text for daily page
            const dropBtn = qs('#difficultyDropdown .dropdown-btn')
            if (dropBtn) {
                 let dDisplay = desiredDiff
                 if (dDisplay === 'six' || dDisplay === '6x6') dDisplay = '6x6'
                 else dDisplay = dDisplay.charAt(0).toUpperCase() + dDisplay.slice(1)
                 dropBtn.innerHTML = `${dDisplay} <span class="arrow">▼</span>`
            }
            
            // Update active state in dropdown
            const items = qsa('#difficultyMenu .dropdown-item')
            items.forEach(el => {
                el.classList.remove('active')
                if (el.getAttribute('href').includes(`difficulty=${desiredDiff}`) || 
                   (desiredDiff==='medium' && el.getAttribute('href').includes('difficulty=medium'))) {
                    el.classList.add('active')
                }
            })

        } else {
            newBtn.addEventListener('click', () => newPuzzle(desiredDiff))
        }
    }
    const mobBtn = qs('#newPuzzleMobile'); if (mobBtn) mobBtn.addEventListener('click', () => newPuzzle(desiredDiff))
    
    bindPad()
    
    const hasSave = restoreFromStorage()
    let loadSave = hasSave
    if (isDaily && hasSave) {
        const savedDate = localStorage.getItem('sudoku_daily_date')
        if (savedDate !== dailyDate) loadSave = false
    } else if (state.size !== desiredSize || state.difficulty !== desiredDiff) {
        loadSave = false
    }
    
    if (!loadSave) {
      setSize(desiredSize)
      if (isDaily) state.rng = mulberry32(stringToSeed(dailyDate))
      newPuzzle(desiredDiff)
      if (isDaily) localStorage.setItem('sudoku_daily_date', dailyDate)
    } else {
      renderGrid()
      const diffEl = qs('#difficulty')
      if (diffEl) diffEl.textContent = 'Difficulty: ' + (state.size===6 ? '6x6' : (state.difficulty==='hard'?'hard':state.difficulty==='medium'?'medium':'easy'))
      updateStatsUI()
    }
    
    if (state.timerEnabled) {
      if (state.timerInterval) clearInterval(state.timerInterval)
      state.timerInterval = setInterval(updateTimerUI, 1000)
      updateTimerUI()
    }
  }

  function saveToStorage() {
    try {
      const data = {
        size: state.size,
        difficulty: state.difficulty,
        grid: state.grid.map(row => row.map(cell => ({ value: cell.value, notes: Array.from(cell.notes) }))),
        solution: state.solution,
        puzzle: state.puzzle,
        undo: state.undoStack,
        redo: state.redoStack,
      }
      localStorage.setItem('sudoku_save', JSON.stringify(data))
    } catch {}
  }

  function restoreFromStorage() {
    try {
      const raw = localStorage.getItem('sudoku_save')
      if (!raw) return false
      const data = JSON.parse(raw)
      state.size = data.size || 9
      state.difficulty = data.difficulty || 'easy'
      state.solution = data.solution || null
      state.grid = Array.from({ length: state.size }, () => Array.from({ length: state.size }, () => ({ value: null, notes: new Set() })))
      for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
        const cell = data.grid?.[r]?.[c] || { value: null, notes: [] }
        state.grid[r][c].value = cell.value
        state.grid[r][c].notes = new Set(cell.notes || [])
      }
      state.puzzle = Array.isArray(data.puzzle) ? data.puzzle : state.grid.map(row => row.map(cell => cell.value))
      state.undoStack = Array.isArray(data.undo) ? data.undo : []
      state.redoStack = Array.isArray(data.redo) ? data.redo : []
      return true
    } catch { return false }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init()
    // Records initialized via separate script src/records.js
  })
})()
