// Simple Sudoku game logic with generator, UI bindings, notes, undo/redo

(() => {
  const ACCENT = '#0057FF'
  const BLUE_SOFT = '#dbeafe'
  const BLUE_LIGHT = '#eff6ff'
  const RED = '#ef4444'

  const qs = sel => document.querySelector(sel)
  const qsa = sel => Array.from(document.querySelectorAll(sel))

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
    timerEnabled: false,
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

  function randomInt(n) { return Math.floor(Math.random() * n) }

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
      const j = Math.floor(Math.random() * (i + 1))
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
    gridEl.style.display = 'grid'
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`
    gridEl.style.gridTemplateRows = `repeat(${size}, 1fr)`
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div')
        cell.className = 'sudoku-cell'
        const styles = []
        if (r % brSize === 0) styles.push('border-top:2px solid #d1d5db')
        if (c % bcSize === 0) styles.push('border-left:2px solid #d1d5db')
        if (r === size-1) styles.push('border-bottom:2px solid #d1d5db')
        if (c === size-1) styles.push('border-right:2px solid #d1d5db')
        cell.style.cssText = styles.join(';')

        const val = state.grid[r][c].value
        if (val != null) {
          cell.textContent = String(val)
          cell.style.fontWeight = '600'
          cell.style.color = '#111'
        } else {
          // no notes rendering
        }

        if (state.selected && state.selected[0] === r && state.selected[1] === c) {
          cell.style.background = BLUE_SOFT
          cell.style.animation = 'selectPulse .2s ease'
        } else if (state.selected) {
          const [sr, sc] = state.selected
          const sameRow = sr === r
          const sameCol = sc === c
          const sameBox = Math.floor(sr/brSize) === Math.floor(r/brSize) && Math.floor(sc/bcSize) === Math.floor(c/bcSize)
          if (sameRow || sameCol || sameBox) {
            cell.style.background = BLUE_LIGHT
          }
        }

        if (state.conflictHighlight) {
          const v2 = state.grid[r][c].value
          if (v2 != null) {
            let conflict = false
            for (let i=0;i<size;i++) { if (i!==c && state.grid[r][i].value === v2) { conflict = true; break } }
            if (!conflict) for (let i=0;i<size;i++) { if (i!==r && state.grid[i][c].value === v2) { conflict = true; break } }
            if (!conflict) {
              const br = Math.floor(r/brSize)*brSize, bc = Math.floor(c/bcSize)*bcSize
              for (let rr=br; rr<br+brSize; rr++) for (let cc=bc; cc<bc+bcSize; cc++) { if ((rr!==r || cc!==c) && state.grid[rr][cc].value === v2) { conflict = true; break } }
            }
            if (conflict) { cell.style.background = 'var(--color-conflict-bg)'; cell.style.color = 'var(--color-conflict)' }
          }
        }

    // no hover digit highlighting

        const key = r + ',' + c
        if (state.wrongSet && state.wrongSet.has(key)) { cell.style.background = 'var(--color-conflict-bg)'; cell.style.color = 'var(--color-conflict)' }

        cell.addEventListener('click', () => {
          state.selected = [r, c]
          renderGrid()
        })

        if (val != null) {
          cell.addEventListener('mouseenter', () => { state.hoverDigit = val; renderGrid() })
          cell.addEventListener('mouseleave', () => { state.hoverDigit = null; renderGrid() })
        }
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
    const prev = { value: state.grid[r][c].value, notes: new Set(state.grid[r][c].notes) }
    // always place value, no notes mode
    state.grid[r][c].value = val
    state.grid[r][c].notes = new Set()
    pushUndo({ type: 'value', r, c, prev })
    renderGrid()
    if (state.selected) {
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
      const d = state.difficulty
      const cur = stats.fastest[d]
      if (cur == null || elapsed < cur) stats.fastest[d] = elapsed
      stats.completed[d] = (stats.completed[d] || 0) + 1
      localStorage.setItem('sudoku_stats', JSON.stringify(stats))
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

  function bindPad() {
    const pad = qs('#numPad')
    pad.innerHTML = ''
    for (let n=1;n<=state.size;n++) {
      const b = document.createElement('button')
      b.className = 'btn'
      b.textContent = String(n)
      b.addEventListener('click', () => fillSelected(n))
      pad.appendChild(b)
    }
    qs('#undoBtn').addEventListener('click', undo)
    const redoBtn = qs('#redoBtn')
    if (redoBtn) redoBtn.addEventListener('click', clearEntries)
    qs('#checkBtn').addEventListener('click', checkCorrect)
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
      const updateTimerBtn = () => {
        timerBtn.textContent = state.timerEnabled ? 'Hide Timer' : 'Show Timer'
        if (state.timerEnabled) timerBtn.classList.add('btn-toggle-active'); else timerBtn.classList.remove('btn-toggle-active')
        timerBtn.setAttribute('aria-pressed', state.timerEnabled ? 'true' : 'false')
      }
      updateTimerBtn()
      timerBtn.addEventListener('click', () => {
        state.timerEnabled = !state.timerEnabled
        if (state.timerEnabled) {
          if (!state.timerStart) state.timerStart = Date.now()
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

  function init() {
    const p = new URLSearchParams(location.search)
    const path = location.pathname.toLowerCase()
    let desiredSize = 9
    let desiredDiff = 'easy'
    if (path.endsWith('/six') || path.endsWith('/six/')) {
      desiredSize = 6
      desiredDiff = '6x6'
    } else {
      let d = p.get('difficulty')
      if (!d) {
        if (path.endsWith('/easy') || path.endsWith('/easy/')) d = 'easy'
        else if (path.endsWith('/medium') || path.endsWith('/medium/')) d = 'medium'
        else if (path.endsWith('/hard') || path.endsWith('/hard/')) d = 'hard'
      }
      desiredDiff = (d || 'easy').toLowerCase()
    }
    setSize(desiredSize)
    const newBtn = qs('#newPuzzle'); if (newBtn) newBtn.addEventListener('click', () => newPuzzle(desiredDiff))
    const mobBtn = qs('#newPuzzleMobile'); if (mobBtn) mobBtn.addEventListener('click', () => newPuzzle(desiredDiff))
    bindPad()
    const hasSave = restoreFromStorage()
    if (!hasSave || state.size !== desiredSize || state.difficulty !== desiredDiff) {
      // 若存档与页面不一致，重置尺寸后生成新题
      setSize(desiredSize)
      newPuzzle(desiredDiff)
    } else {
      renderGrid()
      const diffEl = qs('#difficulty')
      if (diffEl) diffEl.textContent = 'Difficulty: ' + (state.size===6 ? '6x6' : (state.difficulty==='hard'?'hard':state.difficulty==='medium'?'medium':'easy'))
      updateStatsUI()
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

  document.addEventListener('DOMContentLoaded', init)
})()
