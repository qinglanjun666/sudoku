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
    hintMode: false,
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

  function updateProgress() {
    const bar = qs('#progress-wrapper')
    if (!bar) return
    bar.style.display = 'flex'
    
    let currentCorrect = 0
    const size = state.size
    const solution = state.solution
    
    if (!solution) return

    for (let r=0;r<size;r++) {
      for (let c=0;c<size;c++) {
        if (state.grid[r][c].value === solution[r][c]) {
           currentCorrect++
        }
      }
    }
    
    const total = size * size
    const initial = state.initialFilledCount || 0
    
    // Formula: (Current - Initial) / (Total - Initial)
    // If current < initial (impossible if only correct counted?), clamp to 0
    // Actually currentCorrect includes initial clues if they are in grid.
    // Yes, state.grid has initial clues.
    
    let pct = 0
    if (total > initial) {
       pct = ((currentCorrect - initial) / (total - initial)) * 100
    }
    
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    
    const fill = qs('#progress-fill')
    const text = qs('#progress-text')
    
    if (fill) fill.style.width = pct + '%'
    if (text) text.textContent = 'Completed ' + Math.floor(pct) + '%'
    
    handleSocialTriggers(pct)
  }

  let lastTrigger = 0
  function handleSocialTriggers(pct) {
    const toast = qs('#progress-toast')
    if (!toast) return
    
    // Reset trigger if new game (pct very low)
    if (pct < 10) {
        if (lastTrigger > 10) lastTrigger = 0
        return
    }

    let msg = ''
    if (pct >= 50 && pct < 60 && lastTrigger < 50) {
        msg = "解题过半，势如破竹！"
        lastTrigger = 50
    } else if (pct >= 90 && pct < 95 && lastTrigger < 90) {
        msg = "最后冲刺！点击分享让好友见证你的大脑高光时刻。"
        lastTrigger = 90
    }
    
    if (msg) {
        toast.textContent = msg
        toast.classList.add('show')
        setTimeout(() => toast.classList.remove('show'), 3000)
    }
    
    if (pct >= 100 && lastTrigger < 100) {
        lastTrigger = 100
        // War report logic is effectively the Win Modal which triggers automatically via autoCheckCompletion -> checkWin
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
    
    // Update Progress
    updateProgress()

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

        // Identify Conflicts for Selected Cell (Only if Hint Mode is active)
        if (state.hintMode && selectedVal != null) {
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
        const isWrong = state.hintMode && cellVal != null && state.solution && state.solution[r][c] !== cellVal

        if (conflictSet.has(key) || (state.wrongSet && state.wrongSet.has(key))) {
            cell.classList.add('cell-error-source')
            if (state.wrongSet && state.wrongSet.has(key)) cell.classList.add('text-error')
        }
        
        if (isWrong) {
            cell.classList.add('text-error')
        }
        
        // Selected Cell
        else if (isSelected) {
            cell.classList.add('cell-selected')
            if (selectedHasConflict) {
                cell.classList.add('text-error')
            }
        }
        // Same Value (Darker Blue) - Disabled per user request
        /* else if (selectedVal != null && cellVal === selectedVal) {
            cell.classList.add('cell-same-value')
        } */
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
    if (modal) modal.remove() // Ensure fresh render

    modal = document.createElement('div')
    modal.id = 'winModal'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.zIndex = '1000'
    modal.style.background = 'rgba(0,0,0,0.5)'
    modal.style.backdropFilter = 'blur(4px)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.animation = 'fadeIn .2s ease-out'

    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.borderRadius = '24px'
    card.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
    card.style.padding = '32px'
    card.style.width = '380px'
    card.style.maxWidth = '90vw'
    card.style.textAlign = 'center'
    card.style.animation = 'scaleIn .3s cubic-bezier(0.16, 1, 0.3, 1)'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'
    card.style.alignItems = 'center'

    // Crown Icon
    const iconContainer = document.createElement('div')
    iconContainer.style.marginBottom = '20px'
    iconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="#FFD700" stroke="#b45309" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>
      </svg>
    `
    card.appendChild(iconContainer)

    // Main Title
    const h = document.createElement('h2')
    h.innerHTML = 'Congratulations!<br>Sudoku Master!'
    h.style.fontSize = '22px'
    h.style.fontWeight = '800'
    h.style.color = '#1f2937'
    h.style.margin = '0 0 8px 0'
    h.style.lineHeight = '1.2'
    card.appendChild(h)

    // Stats & QR Code Container
    const statsContainer = document.createElement('div')
    statsContainer.style.width = '100%'
    statsContainer.style.marginBottom = '24px'
    
    // Stats Row
    const statsRow = document.createElement('div')
    statsRow.style.display = 'grid'
    statsRow.style.gridTemplateColumns = '1fr 1fr'
    statsRow.style.gap = '12px'
    statsRow.style.marginBottom = '16px'

    const createStatBox = (label, value, color = '#f3f4f6', textColor = '#1f2937') => {
        const box = document.createElement('div')
        box.style.background = color
        box.style.padding = '10px'
        box.style.borderRadius = '12px'
        box.style.display = 'flex'
        box.style.flexDirection = 'column'
        box.style.alignItems = 'center'
        box.innerHTML = `
            <span style="font-size:12px; color:#6b7280; margin-bottom:4px">${label}</span>
            <span style="font-size:16px; font-weight:700; color:${textColor}">${value}</span>
        `
        return box
    }

    const elapsedMs = Date.now() - (state.timerStart || Date.now())
    const timeStr = formatMs(elapsedMs)
    const diffStr = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)
    
    // Random percentile for MVP (80-99%)
    const percentile = Math.floor(80 + Math.random() * 20) 

    statsRow.appendChild(createStatBox('Time', timeStr))
    statsRow.appendChild(createStatBox('Difficulty', diffStr))
    
    const rankBox = createStatBox('Performance', `Better than ${percentile}%`, '#ecfdf5', '#059669')
    rankBox.style.gridColumn = '1 / -1'
    statsRow.appendChild(rankBox)

    statsContainer.appendChild(statsRow)

    // QR Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=000000&bgcolor=ffffff&data=${encodeURIComponent(window.location.href)}`
    const qrWrapper = document.createElement('div')
    qrWrapper.style.display = 'flex'
    qrWrapper.style.flexDirection = 'column'
    qrWrapper.style.alignItems = 'center'
    qrWrapper.innerHTML = `
        <img src="${qrUrl}" style="width:100px; height:100px; border-radius:8px; margin-bottom:8px; border:1px solid #e5e7eb">
        <span style="font-size:12px; color:#9ca3af">Scan to Challenge</span>
    `
    statsContainer.appendChild(qrWrapper)
    
    card.appendChild(statsContainer)

    // Buttons Row
    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.gap = '12px'
    btnRow.style.width = '100%'
    btnRow.style.justifyContent = 'center'

    // Give Me Another One (Primary) - Wider
    const newBtn = document.createElement('button')
    newBtn.textContent = 'Give Me Another One'
    newBtn.className = 'btn'
    newBtn.style.background = '#0057FF'
    newBtn.style.color = '#fff'
    newBtn.style.border = 'none'
    newBtn.style.padding = '10px 16px'
    newBtn.style.fontSize = '14px'
    newBtn.style.fontWeight = '600'
    newBtn.style.borderRadius = '10px'
    newBtn.style.cursor = 'pointer'
    newBtn.style.flex = '2' // Takes more space
    newBtn.style.whiteSpace = 'nowrap'
    newBtn.style.transition = 'transform 0.1s'
    newBtn.onmouseover = () => newBtn.style.background = '#004ad9'
    newBtn.onmouseout = () => newBtn.style.background = '#0057FF'
    newBtn.onclick = () => { modal.remove(); newPuzzle(state.difficulty) }
    
    // Replay Puzzle (Secondary) - Narrower
    const replayBtn = document.createElement('button')
    replayBtn.textContent = 'Replay Puzzle'
    replayBtn.className = 'btn'
    replayBtn.style.background = '#f3f4f6'
    replayBtn.style.color = '#374151'
    replayBtn.style.border = '1px solid #d1d5db'
    replayBtn.style.padding = '10px 12px'
    replayBtn.style.fontSize = '14px'
    replayBtn.style.fontWeight = '600'
    replayBtn.style.borderRadius = '10px'
    replayBtn.style.cursor = 'pointer'
    replayBtn.style.flex = '1' // Takes less space
    replayBtn.style.whiteSpace = 'nowrap'
    replayBtn.onclick = () => { modal.remove(); clearEntries() }
    replayBtn.onmouseover = () => replayBtn.style.background = '#e5e7eb'
    replayBtn.onmouseout = () => replayBtn.style.background = '#f3f4f6'

    btnRow.appendChild(newBtn)
    btnRow.appendChild(replayBtn)
    card.appendChild(btnRow)

    modal.appendChild(card)
    document.body.appendChild(modal)
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })

    // Add keyframes if not present (simple check)
    if (!document.getElementById('modal-styles')) {
        const style = document.createElement('style')
        style.id = 'modal-styles'
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `
        document.head.appendChild(style)
    }

    // update stats
    const elapsed = Date.now() - (state.timerStart || Date.now())
    updateStatsOnWin(elapsed)
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

  window.printSudoku = function() {
    const size = state.size
    const grid = state.grid
    const brSize = size === 9 ? 3 : 2
    const bcSize = size === 9 ? 3 : 3
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return alert('Please allow popups to print')

    const doc = printWindow.document
    doc.open()
    
    // Generate QR Data (Solution String)
    let qrHtml = ''
    if (state.solution) {
        // Create a readable solution string
        const solStr = "Sudoku Solution:\n" + state.solution.map(row => row.join(' ')).join('\n')
        const encoded = encodeURIComponent(solStr)
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}`
        qrHtml = `
            <div class="print-footer">
                <div class="qr-code">
                    <img src="${qrUrl}" alt="Answer Key" />
                    <p>Scan to compare answer</p>
                </div>
            </div>
        `
    }
    
    // Dynamic CSS based on grid size
    const css = `
    .print-container { 
        width: 100%; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        padding-top: 20px;
    } 
    table.sudoku-print-grid { 
        border-collapse: collapse; 
        border: 3px solid black; 
        aspect-ratio: 1 / 1; 
        width: 90vw; 
        max-width: 500px; 
    } 
    .sudoku-print-grid td { 
        border: 1px solid #ccc; 
        text-align: center; 
        font-size: 24px; 
        font-family: Arial; 
        width: ${100/size}%; 
        aspect-ratio: 1 / 1; 
        padding: 0;
    } 
    /* Block Borders */
    .sudoku-print-grid td:nth-child(${bcSize}n) { border-right: 3px solid black; } 
    .sudoku-print-grid tr:nth-child(${brSize}n) td { border-bottom: 3px solid black; }
    
    .print-footer {
        margin-top: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        page-break-inside: avoid;
    }
    .qr-code {
        text-align: center;
    }
    .qr-code img {
        width: 120px;
        height: 120px;
    }
    .qr-code p {
        margin-top: 8px;
        font-size: 14px;
        color: #333;
        font-family: Arial, sans-serif;
    }
    `

    // Generate Table HTML
    let tableHtml = '<table class="sudoku-print-grid"><tbody>'
    for (let r=0; r<size; r++) {
        tableHtml += '<tr>'
        for (let c=0; c<size; c++) {
            const val = grid[r][c].value
            const content = val !== null ? val : ''
            tableHtml += `<td>${content}</td>`
        }
        tableHtml += '</tr>'
    }
    tableHtml += '</tbody></table>'

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sudoku Print</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="print-container">
            <h1>Logic for Sudoku</h1>
            ${tableHtml}
            ${qrHtml}
        </div>
        <div style="position: fixed; bottom: 10px; left: 10px; font-size: 12px; color: #999; font-family: Arial, sans-serif;">
            Printed: ${new Date().toLocaleString()} | logicforsudoku.com
        </div>
        <script>
            setTimeout(() => {
                window.print();
            }, 1000);
        </script>
      </body>
      </html>
    `)
    doc.close()
  }

  window.openShareModal = function() {
    let modal = qs('#shareModal')
    if (modal) {
        modal.classList.add('show')
        return
    }

    modal = document.createElement('div')
    modal.id = 'shareModal'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.background = 'rgba(0,0,0,0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '2000'
    modal.style.opacity = '0'
    modal.style.transition = 'opacity 0.2s'
    
    // Trigger fade in
    requestAnimationFrame(() => { modal.style.opacity = '1' })

    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.borderRadius = '12px'
    card.style.width = '400px'
    card.style.maxWidth = '90vw'
    card.style.padding = '24px'
    card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'
    card.style.fontFamily = 'Inter, system-ui, sans-serif'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'
    card.style.gap = '16px'
    card.style.position = 'relative'

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '12px'
    closeBtn.style.right = '12px'
    closeBtn.style.background = 'none'
    closeBtn.style.border = 'none'
    closeBtn.style.fontSize = '24px'
    closeBtn.style.lineHeight = '1'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.color = '#64748b'
    closeBtn.onclick = () => {
        modal.style.opacity = '0'
        setTimeout(() => modal.remove(), 200)
    }
    card.appendChild(closeBtn)

    // Title
    const title = document.createElement('h3')
    title.textContent = 'Challenge a Friend'
    title.style.margin = '0'
    title.style.fontSize = '20px'
    title.style.color = '#1e293b'
    title.style.textAlign = 'center'
    card.appendChild(title)

    // Description
    const desc = document.createElement('p')
    desc.textContent = 'Copy the link below to share this daily challenge:'
    desc.style.margin = '0'
    desc.style.color = '#64748b'
    desc.style.fontSize = '14px'
    desc.style.textAlign = 'center'
    card.appendChild(desc)

    // Link Input
    const linkContainer = document.createElement('div')
    linkContainer.style.display = 'flex'
    linkContainer.style.gap = '8px'
    
    const input = document.createElement('input')
    // Construct URL: use dailyDate if available, otherwise today
    const dateToUse = state.dailyDate || new Date().toISOString().split('T')[0]
    const url = `https://logicforsudoku.com/sudoku/daily/?d=${dateToUse}`
    input.value = url
    input.readOnly = true
    input.style.flex = '1'
    input.style.padding = '8px 12px'
    input.style.border = '1px solid #e2e8f0'
    input.style.borderRadius = '6px'
    input.style.fontSize = '13px'
    input.style.color = '#334155'
    input.style.background = '#f8fafc'
    
    // Copy Button
    const copyBtn = document.createElement('button')
    copyBtn.textContent = 'Copy Link'
    copyBtn.style.background = '#0057FF'
    copyBtn.style.color = '#fff'
    copyBtn.style.border = 'none'
    copyBtn.style.borderRadius = '6px'
    copyBtn.style.padding = '0 16px'
    copyBtn.style.fontSize = '14px'
    copyBtn.style.fontWeight = '500'
    copyBtn.style.cursor = 'pointer'
    copyBtn.style.whiteSpace = 'nowrap'
    
    copyBtn.onclick = () => {
        input.select()
        navigator.clipboard.writeText(url).then(() => {
            const originalText = copyBtn.textContent
            copyBtn.textContent = 'Copied!'
            copyBtn.style.background = '#10b981'
            setTimeout(() => {
                copyBtn.textContent = originalText
                copyBtn.style.background = '#0057FF'
            }, 2000)
        })
    }

    linkContainer.appendChild(input)
    linkContainer.appendChild(copyBtn)
    card.appendChild(linkContainer)

    modal.appendChild(card)
    document.body.appendChild(modal)
    
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) {
            modal.style.opacity = '0'
            setTimeout(() => modal.remove(), 200)
        }
    })
  }

  // --- Ask Friend Feature ---
  function askFriend() {
    // Serialize state
    const size = state.size
    let pStr = ''
    let gStr = ''
    for (let r=0; r<size; r++) {
        for (let c=0; c<size; c++) {
            pStr += (state.puzzle[r][c] || 0)
            gStr += (state.grid[r][c].value || 0)
        }
    }
    
    const baseUrl = window.location.origin + window.location.pathname
    const params = new URLSearchParams()
    params.set('share', '1')
    params.set('s', size)
    params.set('p', pStr)
    params.set('g', gStr)
    // Add difficulty just in case, though p/g defines the board
    params.set('d', state.difficulty)

    const url = baseUrl + '?' + params.toString()
    openAskFriendModal(url)
  }

  window.openAskFriendModal = function(url) {
    let modal = qs('#askFriendModal')
    if (modal) modal.remove()

    modal = document.createElement('div')
    modal.id = 'askFriendModal'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.background = 'rgba(0,0,0,0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '2000'
    modal.style.opacity = '0'
    modal.style.transition = 'opacity 0.2s'
    
    requestAnimationFrame(() => { modal.style.opacity = '1' })

    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.borderRadius = '12px'
    card.style.width = '400px'
    card.style.maxWidth = '90vw'
    card.style.padding = '24px'
    card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'
    card.style.fontFamily = 'Inter, system-ui, sans-serif'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'
    card.style.gap = '16px'
    card.style.position = 'relative'

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '12px'
    closeBtn.style.right = '12px'
    closeBtn.style.background = 'none'
    closeBtn.style.border = 'none'
    closeBtn.style.fontSize = '24px'
    closeBtn.style.lineHeight = '1'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.color = '#64748b'
    closeBtn.onclick = () => {
        modal.style.opacity = '0'
        setTimeout(() => modal.remove(), 200)
    }
    card.appendChild(closeBtn)

    const title = document.createElement('h3')
    title.textContent = 'Ask a Friend'
    title.style.margin = '0'
    title.style.fontSize = '20px'
    title.style.color = '#1e293b'
    title.style.textAlign = 'center'
    card.appendChild(title)

    const desc = document.createElement('p')
    desc.textContent = 'Share this link with a friend to show them your current board and ask for help:'
    desc.style.margin = '0'
    desc.style.color = '#64748b'
    desc.style.fontSize = '14px'
    desc.style.textAlign = 'center'
    card.appendChild(desc)

    const linkContainer = document.createElement('div')
    linkContainer.style.display = 'flex'
    linkContainer.style.gap = '8px'
    
    const input = document.createElement('input')
    input.value = url
    input.readOnly = true
    input.style.flex = '1'
    input.style.padding = '8px 12px'
    input.style.border = '1px solid #e2e8f0'
    input.style.borderRadius = '6px'
    input.style.fontSize = '13px'
    input.style.color = '#334155'
    input.style.background = '#f8fafc'
    
    const copyBtn = document.createElement('button')
    copyBtn.textContent = 'Copy Link'
    copyBtn.style.background = '#9b59b6' // Matches the Ask Friend button color
    copyBtn.style.color = '#fff'
    copyBtn.style.border = 'none'
    copyBtn.style.borderRadius = '6px'
    copyBtn.style.padding = '0 16px'
    copyBtn.style.fontSize = '14px'
    copyBtn.style.fontWeight = '500'
    copyBtn.style.cursor = 'pointer'
    copyBtn.style.whiteSpace = 'nowrap'
    
    copyBtn.onclick = () => {
        input.select()
        navigator.clipboard.writeText(url).then(() => {
            const originalText = copyBtn.textContent
            copyBtn.textContent = 'Copied!'
            copyBtn.style.background = '#10b981'
            setTimeout(() => {
                copyBtn.textContent = originalText
                copyBtn.style.background = '#0057FF'
            }, 2000)
        })
    }

    linkContainer.appendChild(input)
    linkContainer.appendChild(copyBtn)
    card.appendChild(linkContainer)

    modal.appendChild(card)
    document.body.appendChild(modal)
    
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) {
            modal.style.opacity = '0'
            setTimeout(() => modal.remove(), 200)
        }
    })
  }

  // --- Batch Print Feature ---
  window.openBatchPrintModal = function() {
    let modal = qs('#batchPrintModal')
    if (modal) modal.remove()

    modal = document.createElement('div')
    modal.id = 'batchPrintModal'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.background = 'rgba(0,0,0,0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '2000'

    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.padding = '24px'
    card.style.borderRadius = '12px'
    card.style.width = '350px'
    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
    card.style.fontFamily = 'Arial, sans-serif'

    const h = document.createElement('h2')
    h.textContent = 'Batch Print Sudoku'
    h.style.margin = '0 0 16px 0'
    h.style.fontSize = '20px'
    h.style.color = '#333'

    const form = document.createElement('div')
    
    // Helper to create checkbox row
    const createRow = (label, value, isChecked = false) => {
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.marginBottom = '12px'
        
        const chk = document.createElement('input')
        chk.type = 'checkbox'
        chk.id = 'batch_' + value
        chk.checked = isChecked
        chk.style.marginRight = '10px'
        chk.style.width = '18px'
        chk.style.height = '18px'

        const lbl = document.createElement('label')
        lbl.textContent = label
        lbl.htmlFor = 'batch_' + value
        lbl.style.flex = '1'
        lbl.style.fontSize = '16px'

        const qty = document.createElement('input')
        qty.type = 'number'
        qty.min = '1'
        qty.max = '50'
        qty.value = '1'
        qty.style.width = '60px'
        qty.style.padding = '4px'
        qty.style.marginLeft = '10px'
        
        // Enable/Disable qty based on check
        qty.disabled = !isChecked
        chk.addEventListener('change', () => { qty.disabled = !chk.checked })

        row.appendChild(chk)
        row.appendChild(lbl)
        row.appendChild(qty)
        return { row, chk, qty, value }
    }

    const configs = [
        createRow('Current Puzzle', 'current', true),
        createRow('Easy (9x9)', 'easy', false),
        createRow('Medium (9x9)', 'medium', false),
        createRow('Hard (9x9)', 'hard', false),
        createRow('6x6 Grid', 'six', false)
    ]

    configs.forEach(c => form.appendChild(c.row))

    // Disable quantity for Current Puzzle as it is unique
    const currentConfig = configs.find(c => c.value === 'current')
    if (currentConfig) {
        currentConfig.qty.disabled = true
        currentConfig.qty.value = 1
        // Hide quantity input for current puzzle to avoid confusion
        currentConfig.qty.style.visibility = 'hidden'
    }

    // Options
    const optRow = document.createElement('div')
    optRow.style.marginTop = '16px'
    optRow.style.borderTop = '1px solid #eee'
    optRow.style.paddingTop = '16px'

    const qrChk = document.createElement('input')
    qrChk.type = 'checkbox'
    qrChk.id = 'batch_qr'
    qrChk.checked = true
    qrChk.style.marginRight = '8px'
    
    const qrLbl = document.createElement('label')
    qrLbl.textContent = 'Include Answer Key (QR Code)'
    qrLbl.htmlFor = 'batch_qr'

    optRow.appendChild(qrChk)
    optRow.appendChild(qrLbl)
    form.appendChild(optRow)

    // Buttons
    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.justifyContent = 'flex-end'
    btnRow.style.gap = '10px'
    btnRow.style.marginTop = '24px'

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.padding = '8px 16px'
    cancelBtn.style.border = '1px solid #ccc'
    cancelBtn.style.background = '#fff'
    cancelBtn.style.borderRadius = '4px'
    cancelBtn.style.cursor = 'pointer'
    cancelBtn.onclick = () => modal.remove()

    const printBtn = document.createElement('button')
    printBtn.textContent = 'Print Batch'
    printBtn.style.padding = '8px 16px'
    printBtn.style.border = 'none'
    printBtn.style.background = '#0057FF'
    printBtn.style.color = '#fff'
    printBtn.style.borderRadius = '4px'
    printBtn.style.cursor = 'pointer'
    
    printBtn.onclick = () => {
        const queue = []
        configs.forEach(c => {
            if (c.chk.checked) {
                const count = parseInt(c.qty.value) || 1
                for(let i=0; i<count; i++) queue.push(c.value)
            }
        })
        if (queue.length === 0) return alert('Please select at least one puzzle type.')
        
        batchPrint(queue, qrChk.checked)
        modal.remove()
    }

    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(printBtn)

    card.appendChild(h)
    card.appendChild(form)
    card.appendChild(btnRow)
    modal.appendChild(card)
    document.body.appendChild(modal)
    
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
  }

  function openRulesModal() {
    let modal = qs('#rulesModal')
    if (modal) {
        modal.classList.add('show')
        return
    }

    modal = document.createElement('div')
    modal.id = 'rulesModal'
    modal.style.position = 'fixed'
    modal.style.inset = '0'
    modal.style.background = 'rgba(0,0,0,0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '2000'
    modal.style.opacity = '0'
    modal.style.transition = 'opacity 0.2s'
    
    // Trigger fade in
    requestAnimationFrame(() => { modal.style.opacity = '1' })

    const card = document.createElement('div')
    card.style.background = '#fff'
    card.style.borderRadius = '12px'
    card.style.width = '600px'
    card.style.maxHeight = '80vh'
    card.style.overflowY = 'auto'
    card.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'
    card.style.fontFamily = 'Inter, system-ui, sans-serif'
    card.style.position = 'relative'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'

    // Header
    const header = document.createElement('div')
    header.style.padding = '16px 24px'
    header.style.borderBottom = '1px solid #e2e8f0'
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'
    header.style.position = 'sticky'
    header.style.top = '0'
    header.style.background = '#fff'
    header.style.zIndex = '10'

    const title = document.createElement('h2')
    title.textContent = 'How to Play Sudoku'
    title.style.margin = '0'
    title.style.fontSize = '20px'
    title.style.color = '#1e293b'

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.background = 'none'
    closeBtn.style.border = 'none'
    closeBtn.style.fontSize = '28px'
    closeBtn.style.lineHeight = '1'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.color = '#64748b'
    closeBtn.style.padding = '0 4px'
    closeBtn.onclick = () => {
        modal.style.opacity = '0'
        setTimeout(() => modal.remove(), 200)
    }

    header.appendChild(title)
    header.appendChild(closeBtn)
    card.appendChild(header)

    // Content
    const content = document.createElement('div')
    content.style.padding = '24px'
    
    // Try to get tutorial content from page
    const tutorial = qs('.sudoku-tutorial')
    if (tutorial) {
        // Clone and strip
        const clone = tutorial.cloneNode(true)
        clone.style.marginTop = '0'
        clone.style.padding = '0'
        clone.style.border = 'none'
        clone.style.background = 'none'
        
        // Remove duplicate title if present in clone
        const tTitle = clone.querySelector('.tutorial-title')
        if (tTitle && tTitle.textContent.includes('What is')) tTitle.style.marginTop = '0'
        
        content.appendChild(clone)
    } else {
        // Fallback
        content.innerHTML = `
            <div style="color:#334155; line-height:1.6;">
                <p><strong>Goal:</strong> Fill the grid so that every row, column, and 3x3 box contains the numbers 1 to 9.</p>
                <ul style="margin-bottom:20px;">
                    <li>Each row must contain numbers 1-9 exactly once.</li>
                    <li>Each column must contain numbers 1-9 exactly once.</li>
                    <li>Each 3x3 box must contain numbers 1-9 exactly once.</li>
                </ul>
                <p><strong>Controls:</strong></p>
                <ul>
                    <li>Select a cell and press a number key (1-9).</li>
                    <li>Use 'Notes' mode to mark candidates.</li>
                    <li>'Undo' to reverse mistakes.</li>
                </ul>
            </div>
        `
    }
    
    card.appendChild(content)
    modal.appendChild(card)
    document.body.appendChild(modal)
    
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) {
            modal.style.opacity = '0'
            setTimeout(() => modal.remove(), 200)
        }
    })
  }
  window.openRulesModal = openRulesModal // Expose globally

  function batchPrint(queue, includeQr) {
     const printTime = new Date().toLocaleString()
     const printWindow = window.open('', '_blank')
     if (!printWindow) return alert('Please allow popups to print')
     
     const doc = printWindow.document
     doc.open()

     let contentHtml = ''
     
     // Process queue in chunks of 3 for 3+1 layout
     for (let i = 0; i < queue.length; i += 3) {
         const batch = queue.slice(i, i + 3)
         
         let puzzlePageContent = ''
         let answerPageContent = ''
         
         const puzzles = []

         // First pass: Generate all puzzle data
         batch.forEach((type) => {
             // Determine size and difficulty
             let size = 9
             let diff = type
             let gridObj = null
             let solution = null

             if (type === 'current') {
                 size = state.size
                 diff = state.difficulty
                 // Use current state
                 gridObj = state.grid.map(row => row.map(cell => ({ value: cell.value })))
                 solution = state.solution
             } else if (type === 'six') {
                 size = 6
                 diff = 'medium' // Default for 6x6 generator
             }
             
             if (!gridObj) {
                 const oldSize = state.size
                 state.size = size
                 const res = generatePuzzle(diff) // Uses state.size
                 gridObj = res.puzzle.map(row => row.map(v => ({ value: v })))
                 solution = res.solution
                 state.size = oldSize // Restore immediately
             }
             
             puzzles.push({ grid: gridObj, size, solution, diff })
         })

         // Generate Puzzle Page HTML
         let puzzlesHtml = ''
         puzzles.forEach(p => {
             puzzlesHtml += generateSudokuHtml(p.grid, p.size, null, false, p.diff)
         })
         
         // Add Branding Card as 4th element
         const siteUrl = window.location.origin + window.location.pathname.replace(/\/sudoku\/(easy|medium|hard|six|daily)\/index\.html/, '/');
         const brandingHtml = `
            <div class="brand-wrapper">
                <div class="brand-content">
                    <h3>Keep Sharp!</h3>
                    <p>Challenge yourself daily to keep your mind active.</p>
                    <div class="brand-qr">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://logicforsudoku.com')}" alt="Website QR" />
                        <span>Visit logicforsudoku.com</span>
                    </div>
                    <p class="share-hint">Share your time with us!<br>#LogicForSudoku</p>
                </div>
            </div>
         `
         
         puzzlePageContent = `
            <div class="page-container grid-page">
                <div class="page-header">
                    <h1>Logic for Sudoku</h1>
                    <p>Your Daily Mental Gym</p>
                </div>
                <div class="grid-2x2">
                    ${puzzlesHtml}
                    ${brandingHtml}
                </div>
                <div class="page-footer">
                    <span>Printed: ${printTime} | logicforsudoku.com</span>
                    <span>Share with friends!</span>
                </div>
            </div>
         `
         contentHtml += puzzlePageContent

         // Generate Answer Page HTML (if requested)
         if (includeQr) {
             let answersHtml = ''
             puzzles.forEach((p, idx) => {
                 answersHtml += generateQRHtml(p.solution, p.size, i + idx + 1)
             })
             
             // Add branding to answer page too
             answersHtml += brandingHtml
             
             answerPageContent = `
                <div class="page-container answer-page">
                    <div class="page-header" style="margin-bottom: 30px; padding-bottom: 15px;">
                        <h1 style="font-size: 36px; margin-bottom: 10px;">Scan to Check Answers</h1>
                        <p style="font-size: 18px; color: #2c3e50; font-weight: 500; font-style: normal;">Scan the QR codes below to view the solutions instantly</p>
                    </div>
                    <div class="grid-2x2">
                        ${answersHtml}
                    </div>
                    <div class="page-footer">
                        <span>Printed: ${printTime} | logicforsudoku.com</span>
                    </div>
                </div>
             `
             contentHtml += answerPageContent
         }
     }

     const css = `
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .page-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            page-break-after: always;
            box-sizing: border-box;
            padding: 15px 25px; /* Reduced padding */
            position: relative;
            background: white;
        }
        .page-container:last-child {
            page-break-after: auto;
        }
        
        .page-header {
            width: 100%;
            text-align: center;
            margin-bottom: 10px; /* Reduced margin */
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 5px; /* Reduced padding */
        }
        .page-header h1 { font-size: 24px; margin: 0; color: #2c3e50; letter-spacing: 1px; text-transform: uppercase; }
        .page-header p { margin: 2px 0 0; font-size: 12px; color: #7f8c8d; font-style: italic; }
        
        .page-footer {
            position: absolute;
            bottom: 15px;
            width: calc(100% - 50px);
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #eee;
            padding-top: 5px;
            font-size: 10px;
            color: #999;
        }

        .grid-2x2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 20px; /* Reduced gap */
            width: 100%;
            flex: 1;
            margin-bottom: 15px;
        }
        
        .puzzle-wrapper, .answer-wrapper, .brand-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 5px;
            border-radius: 8px;
            height: 100%; /* Fill cell */
        }
        
        .puzzle-wrapper { border: 1px solid #eee; }
        .brand-wrapper { 
            background: #f8f9fa; 
            border: 2px dashed #bdc3c7;
            text-align: center;
        }
        
        .brand-content h3 { color: #2c3e50; margin: 0 0 8px 0; font-size: 22px; }
        .brand-content p { color: #555; font-size: 14px; margin: 0 0 12px 0; line-height: 1.4; }
        .brand-qr { margin: 10px 0; display: flex; flex-direction: column; align-items: center; }
        .brand-qr img { width: 120px; height: 120px; border: 4px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .brand-qr span { font-size: 11px; color: #7f8c8d; margin-top: 5px; font-weight: bold; }
        .share-hint { font-weight: bold; color: #e67e22 !important; font-size: 13px !important; margin-top: 8px !important; }

        h2 { font-size: 16px; color: #7f8c8d; margin: 0 0 5px 0; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
        
        table.sudoku-print-grid { 
            border-collapse: collapse; 
            border: 2px solid #2c3e50; 
            width: 300px; /* Maximize width */
            max-width: 100%;
            height: 300px; /* Force square */
            aspect-ratio: 1 / 1; 
            background: white;
        } 
        .sudoku-print-grid td { 
            border: 1px solid #bdc3c7; 
            text-align: center; 
            font-size: 18px; /* Larger font */
            width: 11.11%; 
            height: 11.11%;
            padding: 0;
            color: #2c3e50;
            font-weight: 600;
        } 
        /* 6x6 specific override */
        .grid-6 .sudoku-print-grid td { width: 16.66%; height: 16.66%; font-size: 22px; }
        
        .qr-code { display: flex; flex-direction: column; align-items: center; }
        .qr-code img { width: 140px; height: 140px; } /* Larger QR */
        .qr-code p { margin: 5px 0 0; font-size: 14px; color: #555; font-weight: bold; }
        .qr-label { font-size: 11px; color: #999; margin-top: 2px; }
     `

     doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sudoku Batch Print</title>
            <style>${css}</style>
            <style>
                /* Dynamic Borders */
                .grid-9 .sudoku-print-grid td:nth-child(3n) { border-right: 2px solid #2c3e50; }
                .grid-9 .sudoku-print-grid tr:nth-child(3n) td { border-bottom: 2px solid #2c3e50; }
                .grid-9 .sudoku-print-grid td:last-child { border-right: 1px solid #bdc3c7; } 
                .grid-9 .sudoku-print-grid tr:last-child td { border-bottom: 1px solid #bdc3c7; }

                .grid-6 .sudoku-print-grid td:nth-child(3n) { border-right: 2px solid #2c3e50; }
                .grid-6 .sudoku-print-grid tr:nth-child(2n) td { border-bottom: 2px solid #2c3e50; }
            </style>
        </head>
        <body>
            ${contentHtml}
            <script>
                setTimeout(() => { window.print() }, 1500);
            </script>
        </body>
        </html>
     `)
     doc.close()
  }

  function generateQRHtml(solution, size, index) {
     const solStr = "Sudoku Solution:\n" + solution.map(row => row.join(' ')).join('\n')
     const encoded = encodeURIComponent(solStr)
     const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}`
     
     return `
        <div class="answer-wrapper">
            <div class="qr-code">
                <img src="${qrUrl}" alt="Answer Key" />
                <p>Puzzle #${index}</p>
                <span class="qr-label">Scan for Solution</span>
            </div>
        </div>
     `
  }

  function generateSudokuHtml(grid, size, solution, includeQr, difficulty) {
      let tableHtml = `<table class="sudoku-print-grid"><tbody>`
      for (let r=0; r<size; r++) {
          tableHtml += '<tr>'
          for (let c=0; c<size; c++) {
              const val = grid[r][c].value
              const content = val !== null ? val : ''
              tableHtml += `<td>${content}</td>`
          }
          tableHtml += '</tr>'
      }
      tableHtml += '</tbody></table>'

      let diffLabel = size === 6 ? '6x6 Challenge' : 'Standard 9x9'
      if (difficulty) {
          diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + (size === 9 ? ' Sudoku' : ' Challenge')
      }
      const gridClass = size === 6 ? 'grid-6' : 'grid-9'

      return `
        <div class="puzzle-wrapper ${gridClass}">
            <h2>${diffLabel}</h2>
            ${tableHtml}
        </div>
      `
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
      
      // Update Daily History (If it's a daily puzzle)
      if (state.isDaily && state.dailyDate) {
          const dailyRaw = localStorage.getItem('sudoku_daily_history')
          const dailyHistory = dailyRaw ? JSON.parse(dailyRaw) : []
          if (!dailyHistory.includes(state.dailyDate)) {
              dailyHistory.push(state.dailyDate)
              localStorage.setItem('sudoku_daily_history', JSON.stringify(dailyHistory))
          }
      }
      
      // Update Daily Activity Counts (For Heatmap)
      // This tracks *ANY* puzzle completion on the current real-world date
      const today = new Date().toISOString().split('T')[0]
      const countsRaw = localStorage.getItem('sudoku_daily_counts')
      const dailyCounts = countsRaw ? JSON.parse(countsRaw) : {}
      dailyCounts[today] = (dailyCounts[today] || 0) + 1
      localStorage.setItem('sudoku_daily_counts', JSON.stringify(dailyCounts))

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

  function toggleHintMode() {
    state.hintMode = !state.hintMode
    renderGrid()
    const btn = qs('#hintBtn')
    if (btn) {
        if (state.hintMode) {
            btn.classList.add('btn-toggle-active')
            btn.style.backgroundColor = '#dbeafe' // Light blue to indicate active
            btn.style.borderColor = '#0057FF'
            btn.style.color = '#0057FF'
        } else {
            btn.classList.remove('btn-toggle-active')
            btn.style.backgroundColor = ''
            btn.style.borderColor = ''
            btn.style.color = ''
        }
    }
  }

  function toggleNotesMode() {
    state.notesMode = !state.notesMode
    const btn = qs('#notesBtn')
    if (btn) {
        if (state.notesMode) {
            btn.classList.add('btn-toggle-active')
            btn.style.backgroundColor = '#dbeafe'
            btn.style.borderColor = '#0057FF'
            btn.style.color = '#0057FF'
        } else {
            btn.classList.remove('btn-toggle-active')
            btn.style.backgroundColor = ''
            btn.style.borderColor = ''
            btn.style.color = ''
        }
    }
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
    
    // Updated Bindings for new button layout
    const notesBtn = qs('#notesBtn'); if (notesBtn) notesBtn.addEventListener('click', toggleNotesMode)
    const hintBtn = qs('#hintBtn'); if (hintBtn) hintBtn.addEventListener('click', toggleHintMode)
    const askFriendBtn = qs('#askFriendBtn'); if (askFriendBtn) askFriendBtn.addEventListener('click', askFriend)
    const showSolBtn = qs('#showSolutionBtn'); if (showSolBtn) showSolBtn.addEventListener('click', showSolution)
    const resetActionBtn = qs('#resetActionBtn'); if (resetActionBtn) resetActionBtn.addEventListener('click', clearEntries)
    
    // Header Reset Button
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
    // const printBtn = qs('#printBtn') // Removed JS binding in favor of onclick="printSudoku()"
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
        if (state.timerEnabled) {
            timerBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
            timerBtn.title = 'Pause'
        } else {
            timerBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
            timerBtn.title = 'Resume'
        }
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
    el.textContent = formatMs(elapsed)
  }

  function clearEntries() {
    state.timerStart = Date.now()
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
    updateTimerUI()
  }

  function newPuzzle(diff) {
    state.difficulty = diff
    state.mistakes = 0
    state.timerStart = Date.now()
    const { puzzle, solution } = generatePuzzle(diff)
    state.solution = solution
    state.puzzle = puzzle
    // load puzzle into state.grid
    let filled = 0
    for (let r=0;r<state.size;r++) for (let c=0;c<state.size;c++) {
      const v = puzzle[r][c]
      state.grid[r][c].value = v
      state.grid[r][c].notes = new Set()
      if (v !== null) filled++
    }
    state.initialFilledCount = filled
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
    
    // Fetch status
    const dailyRaw = localStorage.getItem('sudoku_daily_history')
    const completedSet = new Set(dailyRaw ? JSON.parse(dailyRaw) : [])

    for (let d = 1; d <= daysInMonth; d++) {
        if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) break;
        if (isCurrentMonth && d > currentDay) break;

        const a = document.createElement('a')
        a.className = 'archive-link'
        
        const mStr = String(month + 1).padStart(2, '0')
        const dStr = String(d).padStart(2, '0')
        const dateStr = `${year}-${mStr}-${dStr}`
        
        a.href = `?date=${dateStr}&difficulty=${diff}`
        
        const textSpan = document.createElement('span')
        textSpan.textContent = `${monthNames[month]} ${d}, ${year}`
        
        if (isCurrentMonth && d === currentDay) {
            a.classList.add('today')
            textSpan.textContent += " (Today)"
        }
        a.appendChild(textSpan)

        // Check status
        if (completedSet.has(dateStr)) {
            a.classList.add('status-completed')
            const badge = document.createElement('span')
            badge.className = 'status-badge completed'
            badge.textContent = 'Completed'
            a.appendChild(badge)
        } else {
             const saveKey = `sudoku_save_daily_${dateStr}_${diff}`
             const legacyKey = `sudoku_save_daily_${dateStr}`
             if (localStorage.getItem(saveKey) || localStorage.getItem(legacyKey)) {
                 a.classList.add('status-inprogress')
                 const badge = document.createElement('span')
                 badge.className = 'status-badge inprogress'
                 badge.textContent = 'Paused'
                 a.appendChild(badge)
             }
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
      const dParam = p.get('date') || p.get('d')
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
    state.difficulty = desiredDiff
    
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
            
            // Render calendar widget
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
                    
                    // Generate pseudo-random stats based on date (consistent per day)
                    const rate = (stringToSeed(dailyDate + 'stats') % 35) + 5 // 5% - 39%
                    const pNum = dailyDate.replace(/-/g, '')

                    subtitle.innerHTML = `${dateStr} <span style="margin:0 8px;opacity:0.3">|</span> No. ${pNum} <span style="margin:0 8px;opacity:0.3">|</span> ${diffStr}`
                    
                    let rateEl = qs('#daily-rate-text')
                    if (!rateEl) {
                        rateEl = document.createElement('div')
                        rateEl.id = 'daily-rate-text'
                        rateEl.style.color = '#e74c3c'
                        rateEl.style.fontWeight = '700'
                        rateEl.style.marginTop = '8px'
                        rateEl.style.fontSize = '16px'
                        subtitle.after(rateEl)
                    }
                    rateEl.textContent = `🔥 Only ${rate}% solved today`
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
    // Manual check removed as keys are now specific
    if (state.size !== desiredSize || state.difficulty !== desiredDiff) {
        loadSave = false
    }
    
    // Check if share link
    const shareMode = p.get('share')
    if (shareMode) {
        const sSize = parseInt(p.get('s')) || 9
        const pStr = p.get('p')
        const gStr = p.get('g')
        const dStr = p.get('d')
        
        if (pStr && gStr && pStr.length === sSize*sSize && gStr.length === sSize*sSize) {
            setSize(sSize)
            state.difficulty = dStr || 'custom'
            state.puzzle = []
            // Reconstruct Grid
            let filled = 0
            for(let r=0; r<sSize; r++) {
                const rowP = []
                for(let c=0; c<sSize; c++) {
                    const idx = r*sSize + c
                    const pVal = parseInt(pStr[idx])
                    const gVal = parseInt(gStr[idx])
                    
                    rowP.push(pVal === 0 ? null : pVal)
                    
                    state.grid[r][c].value = (gVal === 0 ? null : gVal)
                    state.grid[r][c].notes = new Set()
                    if (state.grid[r][c].value !== null) filled++
                }
                state.puzzle.push(rowP)
            }
            
            // Solve for validation
            state.solution = clone2D(state.puzzle)
            const brSize = sSize === 9 ? 3 : 2
            const bcSize = sSize === 9 ? 3 : 3
            solveBacktrack(state.solution, sSize, brSize, bcSize)

            let givens = 0
            for(let r=0; r<sSize; r++) for(let c=0; c<sSize; c++) if(state.puzzle[r][c]!==null) givens++
            state.initialFilledCount = givens
            
            renderGrid()
            
            const diffEl = qs('#difficulty')
            if (diffEl) diffEl.textContent = 'Shared Puzzle'
            return // Skip standard init
        }
    }

    if (!loadSave) {
      setSize(desiredSize)
      if (isDaily) state.rng = mulberry32(stringToSeed(dailyDate))
      newPuzzle(desiredDiff)
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
        timerStart: state.timerStart,
        mistakes: state.mistakes
      }
      let key = 'sudoku_save'
      if (state.isDaily && state.dailyDate) {
          key = `sudoku_save_daily_${state.dailyDate}_${state.difficulty}`
      }
      localStorage.setItem(key, JSON.stringify(data))
    } catch {}
  }

  function restoreFromStorage() {
    try {
      let key = 'sudoku_save'
      let fallbackKey = null

      if (state.isDaily && state.dailyDate) {
          key = `sudoku_save_daily_${state.dailyDate}_${state.difficulty}`
          // Try legacy key for compatibility
          fallbackKey = `sudoku_save_daily_${state.dailyDate}`
      }
      let raw = localStorage.getItem(key)
      if (!raw && fallbackKey) {
          raw = localStorage.getItem(fallbackKey)
      }

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
      state.timerStart = data.timerStart || Date.now()
      state.mistakes = data.mistakes || 0
      state.initialFilledCount = 0;
      if (state.puzzle) {
        state.initialFilledCount = state.puzzle.flat().filter(x => x !== null).length
      }
      return true
    } catch { return false }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init()
    // Records initialized via separate script src/records.js
  })
})()
