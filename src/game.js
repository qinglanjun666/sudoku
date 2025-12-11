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
    selected: null, // [r, c]
    notesMode: false,
    undoStack: [],
    redoStack: [],
    difficulty: 'easy',
    hoverDigit: null,
    mistakes: 0,
    timerStart: null,
  }

  function randomInt(n) { return Math.floor(Math.random() * n) }

  function isValid(grid, r, c, v) {
    for (let i = 0; i < 9; i++) {
      if (grid[r][i] === v) return false
      if (grid[i][c] === v) return false
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
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
    let count = 0
    function getCands(r, c) {
      if (grid[r][c] != null) return []
      const s = new Set([1,2,3,4,5,6,7,8,9])
      for (let i=0;i<9;i++) { const vr=grid[r][i]; const vc=grid[i][c]; if (vr!=null) s.delete(vr); if (vc!=null) s.delete(vc) }
      const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3
      for (let rr=br; rr<br+3; rr++) for (let cc=bc; cc<bc+3; cc++) { const vb = grid[rr][cc]; if (vb!=null) s.delete(vb) }
      return Array.from(s)
    }
    function findNext() {
      let best = null, bestLen = 10
      for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
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

  function solveBacktrack(grid) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === null) {
          const nums = shuffle([1,2,3,4,5,6,7,8,9])
          for (const v of nums) {
            if (isValid(grid, r, c, v)) {
              grid[r][c] = v
              if (solveBacktrack(grid)) return true
              grid[r][c] = null
            }
          }
          return false
        }
      }
    }
    return true
  }

  function generateSolution() {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(null))
    solveBacktrack(grid)
    return grid
  }

  function clone2D(a) { return a.map(row => row.slice()) }

  function countGivensByDifficulty(diff) {
    if (diff === 'easy') return randomInt(5) + 44
    if (diff === 'medium') return randomInt(5) + 34
    return randomInt(5) + 24
  }

  function generatePuzzle(diff) {
    const sol = generateSolution()
    const givensTarget = countGivensByDifficulty(diff)
    const puzzle = clone2D(sol)
    const coords = shuffle(Array.from({ length: 81 }, (_, k) => [Math.floor(k/9), k%9]))
    const symmetric = diff === 'hard'
    const removed = new Set()
    function key(r,c){ return r*9+c }
    let removals = 0
    for (let idx = 0; idx < coords.length; idx++) {
      const [r,c] = coords[idx]
      if (puzzle[r][c] == null) continue
      if (symmetric) {
        const rr = 8 - r, cc = 8 - c
        // 同步考虑对称点
        const prevA = puzzle[r][c]
        const prevB = puzzle[rr][cc]
        puzzle[r][c] = null
        if (!(r === rr && c === cc)) puzzle[rr][cc] = null
        const count = countSolutionsForPuzzle(puzzle.map(row => row.slice()))
        if (count === 1 && (81 - (removals + 1 + (r===rr && c===cc ? 0 : 1))) >= givensTarget) {
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
        if (count === 1 && (81 - (removals + 1)) >= givensTarget) {
          removals += 1
          removed.add(key(r,c))
        } else {
          puzzle[r][c] = prev
        }
      }
      
      const currentGivens = 81 - removals
      if (currentGivens <= givensTarget) break
    }
    return { puzzle, solution: sol }
  }

  function getCandidates(gridCells, r, c) {
    if (gridCells[r][c].value != null) return []
    const cand = new Set([1,2,3,4,5,6,7,8,9])
    for (let i = 0; i < 9; i++) {
      const vr = gridCells[r][i].value
      const vc = gridCells[i][c].value
      if (vr != null) cand.delete(vr)
      if (vc != null) cand.delete(vc)
    }
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
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
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div')
        cell.className = 'sudoku-cell'
        // thicker borders for blocks
        const styles = []
        if (r % 3 === 0) styles.push('border-top:2px solid #d1d5db')
        if (c % 3 === 0) styles.push('border-left:2px solid #d1d5db')
        if (r === 8) styles.push('border-bottom:2px solid #d1d5db')
        if (c === 8) styles.push('border-right:2px solid #d1d5db')
        cell.style.cssText = styles.join(';')

        const val = state.grid[r][c].value
        if (val != null) {
          cell.textContent = String(val)
          cell.style.fontWeight = '600'
          cell.style.color = '#111'
        } else {
          // no notes rendering
        }

        // selection/highlights
        if (state.selected && state.selected[0] === r && state.selected[1] === c) {
          cell.style.background = BLUE_SOFT
          cell.style.animation = 'selectPulse .2s ease'
        } else if (state.selected) {
          const [sr, sc] = state.selected
          const sameRow = sr === r
          const sameCol = sc === c
          const sameBox = Math.floor(sr/3) === Math.floor(r/3) && Math.floor(sc/3) === Math.floor(c/3)
          if (sameRow || sameCol || sameBox) {
            cell.style.background = BLUE_LIGHT
          }
        }

        // no conflict highlighting

        // no hover digit highlighting

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
    // placement animation on selected cell
    if (state.selected) {
      const idx = state.selected[0]*9 + state.selected[1]
      const cell = qs('#grid').childNodes[idx]
      if (cell) cell.style.animation = 'placePop .15s ease'
    }
  }

  function isValidNumericPlacement(r, c, v) {
    // check duplicates against current grid (excluding the target cell before placement)
    for (let i=0;i<9;i++) {
      if (i!==c && state.grid[r][i].value === v) return false
      if (i!==r && state.grid[i][c].value === v) return false
    }
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3
    for (let rr=br; rr<br+3; rr++) for (let cc=bc; cc<bc+3; cc++) {
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
    for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
      if (state.grid[r][c].value == null) state.grid[r][c].notes = new Set()
    }
    renderGrid()
    saveToStorage()
  }

  function checkCorrect() {
    let allCorrect = true
    for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
      const v = state.grid[r][c].value
      if (v == null || v !== state.solution[r][c]) allCorrect = false
    }
    if (allCorrect) {
      showModal()
    } else {
      // no hints for incorrect cells
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
      const newBtn = document.createElement('button')
      newBtn.className = 'btn btn-primary'
      newBtn.textContent = 'New Puzzle'
      newBtn.addEventListener('click', () => { newPuzzle(state.difficulty) })
      const backBtn = document.createElement('a')
      backBtn.className = 'btn'
      backBtn.textContent = 'Back to Home'
      backBtn.href = '/index.html'
      const shareRow = document.createElement('div')
      shareRow.style.display = 'flex'; shareRow.style.gap = '8px'; shareRow.style.justifyContent = 'flex-start'; shareRow.style.marginTop = '12px'
      const shareText = encodeURIComponent('I just solved a Sudoku puzzle on Logic for Sudoku! Try it yourself: ')
      const url = location.origin + '/' + (state.difficulty === 'hard' ? 'hard/' : state.difficulty === 'medium' ? 'medium/' : 'easy/')
      const shareUrl = encodeURIComponent(url)
      const tw = document.createElement('a'); tw.className = 'btn'; tw.textContent = 'Twitter'; tw.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`; tw.target = '_blank'
      const fb = document.createElement('a'); fb.className = 'btn'; fb.textContent = 'Facebook'; fb.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`; fb.target = '_blank'
      const wa = document.createElement('a'); wa.className = 'btn'; wa.textContent = 'WhatsApp'; wa.href = `https://wa.me/?text=${shareText}${shareUrl}`; wa.target = '_blank'
      shareRow.appendChild(tw); shareRow.appendChild(fb); shareRow.appendChild(wa)
      row.appendChild(backBtn); row.appendChild(newBtn)
      card.appendChild(h); card.appendChild(row)
      card.appendChild(shareRow)
      modal.appendChild(card)
      document.body.appendChild(modal)
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })

      // update stats
      const elapsed = Date.now() - (state.timerStart || Date.now())
      updateStatsOnWin(elapsed)
    }
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
    for (let n=1;n<=9;n++) {
      const b = document.createElement('button')
      b.className = 'btn'
      b.textContent = String(n)
      b.addEventListener('click', () => fillSelected(n))
      pad.appendChild(b)
    }
    qs('#undoBtn').addEventListener('click', undo)
    qs('#redoBtn').addEventListener('click', redo)
    qs('#checkBtn').addEventListener('click', checkCorrect)
    document.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '9') fillSelected(Number(e.key))
      if (e.key === 'Backspace' || e.key === 'Delete') fillSelected(null)
    })
    // no hover highlight via pad
  }

  function newPuzzle(diff) {
    state.difficulty = diff
    state.mistakes = 0
    state.timerStart = Date.now()
    const { puzzle, solution } = generatePuzzle(diff)
    state.solution = solution
    // load puzzle into state.grid
    for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
      const v = puzzle[r][c]
      state.grid[r][c].value = v
      state.grid[r][c].notes = new Set()
    }
    // no auto-pencil
    renderGrid()
    const diffEl = qs('#difficulty')
    if (diffEl) diffEl.textContent = 'Difficulty: ' + (diff==='hard'?'hard':diff==='medium'?'medium':'easy')
    saveToStorage()
    updateStatsUI()
  }

  function init() {
    const p = new URLSearchParams(location.search)
    let desired = p.get('difficulty')
    if (!desired) {
      const path = location.pathname.toLowerCase()
      if (path.endsWith('/easy') || path.endsWith('/easy/')) desired = 'easy'
      else if (path.endsWith('/medium') || path.endsWith('/medium/')) desired = 'medium'
      else if (path.endsWith('/hard') || path.endsWith('/hard/')) desired = 'hard'
    }
    desired = (desired || 'easy').toLowerCase()
    const newBtn = qs('#newPuzzle'); if (newBtn) newBtn.addEventListener('click', () => newPuzzle(desired))
    const mobBtn = qs('#newPuzzleMobile'); if (mobBtn) mobBtn.addEventListener('click', () => newPuzzle(desired))
    bindPad()
    const hasSave = restoreFromStorage()
    if (!hasSave || state.difficulty !== desired) {
      // 若存档难度与页面路由不一致，忽略存档并生成当前路由难度的新题
      newPuzzle(desired)
    } else {
      renderGrid()
      const diffEl = qs('#difficulty')
      if (diffEl) diffEl.textContent = 'Difficulty: ' + (state.difficulty==='hard'?'hard':state.difficulty==='medium'?'medium':'easy')
      updateStatsUI()
    }
  }

  function saveToStorage() {
    try {
      const data = {
        difficulty: state.difficulty,
        grid: state.grid.map(row => row.map(cell => ({ value: cell.value, notes: Array.from(cell.notes) }))),
        solution: state.solution,
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
      state.difficulty = data.difficulty || 'easy'
      state.solution = data.solution || null
      for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
        const cell = data.grid?.[r]?.[c] || { value: null, notes: [] }
        state.grid[r][c].value = cell.value
        state.grid[r][c].notes = new Set(cell.notes || [])
      }
      state.undoStack = Array.isArray(data.undo) ? data.undo : []
      state.redoStack = Array.isArray(data.redo) ? data.redo : []
      return true
    } catch { return false }
  }

  document.addEventListener('DOMContentLoaded', init)
})()
