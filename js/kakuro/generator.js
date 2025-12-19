/**
 * Kakuro Generator - The Sculpting Method
 * 
 * Generates high-quality, valid Kakuro puzzles by sculpting a random grid into a valid topology,
 * then filling it with a solution.
 */
class KakuroGenerator {
    constructor() {
        this.TYPE_BLACK = 0; // Wall/Clue
        this.TYPE_WHITE = 1; // Input
        this.TIMEOUT_MS = 2000; // 2s global timeout
    }

    /**
     * Main Generation Method
     * @param {number} width 
     * @param {number} height 
     * @returns {object|null} { width, height, grid }
     */
    generate(width, height) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < this.TIMEOUT_MS) {
            try {
                // Step 1: Sculpt Topology
                // This is the most critical part. We sculpt a random noise into a valid Kakuro board.
                const topology = this.sculptTopology(width, height);
                if (!topology) continue;

                // Step 2: Fill Solution (Backtracking)
                const solution = this.fillSolution(topology, width, height);
                if (!solution) continue;

                // Step 3: Calculate Clues
                const finalGrid = this.calculateClues(solution, width, height);
                
                return {
                    width: width,
                    height: height,
                    grid: finalGrid
                };

            } catch (e) {
                console.warn("Generation retry:", e);
            }
        }
        
        console.error("Generator Timeout");
        return null;
    }

    // ==========================================
    // Phase 1: Topology Sculpting (The Slicer)
    // ==========================================

    sculptTopology(width, height) {
        // 1. Initialize full white grid
        let grid = Array(height).fill(0).map(() => Array(width).fill(this.TYPE_WHITE));

        // 2. Set margins to Black (Kakuro rules: top row and left col are usually clues)
        // Actually, strictly speaking, not ALL top/left cells must be black, but for easier UI/clue placement, 
        // standard Kakuro usually has a "frame" or at least starts with clues.
        // Let's force top row and left col to be black for simplicity and standard look.
        for(let c=0; c<width; c++) grid[0][c] = this.TYPE_BLACK;
        for(let r=0; r<height; r++) grid[r][0] = this.TYPE_BLACK;

        // 3. Random Scattering (Symmetric)
        // Target density ~35-40% black cells
        const density = 0.35; 
        
        for (let r = 1; r < height; r++) {
            for (let c = 1; c < width; c++) {
                if (Math.random() < density) {
                    this.setSymmetricBlack(grid, r, c, width, height);
                }
            }
        }

        // 4. The Slicer Loop (Validation & Fix)
        // We repeatedly fix violations until the board is valid or we give up.
        let isValid = false;
        let iterations = 0;
        const MAX_ITER = 20;

        while (!isValid && iterations < MAX_ITER) {
            iterations++;
            let changed = false;

            // A. Max Run Limit (Cut long segments)
            // 10x10 -> max 5, >10x10 -> max 9
            const maxRun = (width <= 10 && height <= 10) ? 5 : 9;
            
            if (this.fixMaxRuns(grid, width, height, maxRun)) changed = true;

            // B. Anti-2x2 (No 2x2 white blocks)
            if (this.fix2x2(grid, width, height)) changed = true;

            // C. Min Length (No single white cells)
            // A run must be at least 2 cells.
            if (this.fixMinRuns(grid, width, height)) changed = true;

            // D. Connectivity Check (If not connected, we can try to connect or just fail)
            // For simplicity, if disconnected, we'll try to bridge or just fail and retry the whole generation.
            // Let's try to bridge simple disconnects? No, easier to just fail high-level loop if really bad.
            // But here we just check.
            if (!changed) {
                // If structure stabilized, check connectivity
                if (this.checkConnectivity(grid, width, height)) {
                    isValid = true;
                } else {
                    // Not connected. It's hard to "fix" connectivity easily without breaking symmetry/rules.
                    // We return null to trigger a full regeneration (Step 1 retry).
                    return null; 
                }
            }
        }

        return isValid ? grid : null;
    }

    setSymmetricBlack(grid, r, c, w, h) {
        grid[r][c] = this.TYPE_BLACK;
        grid[h - 1 - r][w - 1 - c] = this.TYPE_BLACK;
    }

    fixMaxRuns(grid, w, h, maxRun) {
        let changed = false;
        // Rows
        for(let r=1; r<h; r++) {
            let run = 0;
            for(let c=1; c<w; c++) {
                if(grid[r][c] === this.TYPE_WHITE) {
                    run++;
                    if (run > maxRun) {
                        // Cut in the middle
                        this.setSymmetricBlack(grid, r, c - Math.floor(run/2), w, h);
                        changed = true;
                        run = 0; // Reset run tracking roughly
                    }
                } else run = 0;
            }
        }
        // Cols
        for(let c=1; c<w; c++) {
            let run = 0;
            for(let r=1; r<h; r++) {
                if(grid[r][c] === this.TYPE_WHITE) {
                    run++;
                    if (run > maxRun) {
                        this.setSymmetricBlack(grid, r - Math.floor(run/2), c, w, h);
                        changed = true;
                        run = 0;
                    }
                } else run = 0;
            }
        }
        return changed;
    }

    fix2x2(grid, w, h) {
        let changed = false;
        // Scan for 2x2 white blocks
        for(let r=1; r<h-1; r++) {
            for(let c=1; c<w-1; c++) {
                if (grid[r][c] === this.TYPE_WHITE && 
                    grid[r+1][c] === this.TYPE_WHITE &&
                    grid[r][c+1] === this.TYPE_WHITE &&
                    grid[r+1][c+1] === this.TYPE_WHITE) {
                    
                    // Found 2x2. Fill one cell (and its symmetric partner) to break it.
                    // Prefer top-left or random?
                    this.setSymmetricBlack(grid, r, c, w, h);
                    changed = true;
                }
            }
        }
        return changed;
    }

    fixMinRuns(grid, w, h) {
        let changed = false;
        
        // Strategy: If we find a run of length 1, we must extend it or kill it.
        // Extending is hard (might hit other walls). Killing it (turning to black) is safer.
        
        // Horizontal scan
        for(let r=1; r<h; r++) {
            for(let c=1; c<w; c++) {
                if (grid[r][c] === this.TYPE_WHITE) {
                    // Check horizontal isolation
                    const left = grid[r][c-1];
                    const right = (c+1 < w) ? grid[r][c+1] : this.TYPE_BLACK;
                    
                    if (left === this.TYPE_BLACK && right === this.TYPE_BLACK) {
                        // It's a single horizontal cell. 
                        // It MUST be part of a vertical run >= 2.
                        // Check vertical
                        const up = grid[r-1][c];
                        const down = (r+1 < h) ? grid[r+1][c] : this.TYPE_BLACK;
                        
                        if (up === this.TYPE_BLACK && down === this.TYPE_BLACK) {
                            // Completely isolated 1x1. Kill it.
                            this.setSymmetricBlack(grid, r, c, w, h);
                            changed = true;
                        }
                    }
                }
            }
        }
        
        // Note: The logic above handles "Isolated 1x1". 
        // But Kakuro rule is stricter: "Every run must be length >= 2".
        // A cell can be part of a vertical run of 3, but be a horizontal run of 1? NO.
        // Standard Kakuro: A white cell must belong to a Horizontal Run >= 2 AND a Vertical Run >= 2.
        // Wait, actually, standard Kakuro allows a cell to have ONLY a horizontal run or ONLY a vertical run?
        // NO. Every white cell must have a clue above it (Vertical Run) and a clue to the left (Horizontal Run).
        // So EVERY white cell belongs to two runs.
        // AND each run must have a sum. A run of length 1 cannot have a unique sum? 
        // Actually length 1 is valid mathematically (sum=N), but aesthetically/traditionally forbidden in Kakuro.
        // Let's enforce: No run of length 1.
        
        // Re-scan for Run Length 1
        // Rows
        for(let r=1; r<h; r++) {
            let runStart = -1;
            for(let c=1; c<=w; c++) { // <=w to handle end of row
                const cell = (c < w) ? grid[r][c] : this.TYPE_BLACK;
                if (cell === this.TYPE_WHITE) {
                    if (runStart === -1) runStart = c;
                } else {
                    if (runStart !== -1) {
                        const len = c - runStart;
                        if (len === 1) {
                            // Kill the single cell
                            this.setSymmetricBlack(grid, r, runStart, w, h);
                            changed = true;
                        }
                        runStart = -1;
                    }
                }
            }
        }
        // Cols
        for(let c=1; c<w; c++) {
            let runStart = -1;
            for(let r=1; r<=h; r++) {
                const cell = (r < h) ? grid[r][c] : this.TYPE_BLACK;
                if (cell === this.TYPE_WHITE) {
                    if (runStart === -1) runStart = r;
                } else {
                    if (runStart !== -1) {
                        const len = r - runStart;
                        if (len === 1) {
                            this.setSymmetricBlack(grid, runStart, c, w, h);
                            changed = true;
                        }
                        runStart = -1;
                    }
                }
            }
        }

        return changed;
    }

    checkConnectivity(grid, w, h) {
        let whiteCells = [];
        for(let r=0; r<h; r++) {
            for(let c=0; c<w; c++) {
                if(grid[r][c] === this.TYPE_WHITE) whiteCells.push({r,c});
            }
        }
        
        if (whiteCells.length === 0) return false;

        let visited = new Set();
        let queue = [whiteCells[0]];
        visited.add(`${whiteCells[0].r},${whiteCells[0].c}`);
        let count = 0;

        while(queue.length) {
            const {r, c} = queue.pop();
            count++;
            
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
                const nr = r+dr, nc = c+dc;
                if(nr>=0 && nr<h && nc>=0 && nc<w && 
                   grid[nr][nc] === this.TYPE_WHITE && 
                   !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push({r: nr, c: nc});
                }
            });
        }

        return count === whiteCells.length;
    }

    // ==========================================
    // Phase 2: Solution Filling (The Filler)
    // ==========================================

    fillSolution(topology, width, height) {
        // Prepare grid: 0 = Black, null = White (to be filled)
        let grid = topology.map(row => row.map(cell => cell === this.TYPE_WHITE ? null : 0));
        
        // Identify White Cells
        let whiteCells = [];
        for(let r=0; r<height; r++) {
            for(let c=0; c<width; c++) {
                if (grid[r][c] === null) whiteCells.push({r, c});
            }
        }

        const startTime = Date.now();
        const TIME_LIMIT = 500; // 500ms max for filling

        const backtrack = (index) => {
            if (Date.now() - startTime > TIME_LIMIT) return false; // Timeout
            if (index === whiteCells.length) return true;

            // Simple heuristic: fill in order
            const {r, c} = whiteCells[index];
            
            // Get valid numbers
            const used = new Set();
            
            // Row check
            let cRun = c; 
            while(cRun >= 0 && grid[r][cRun] !== 0) { // Look left
                 if (grid[r][cRun]) used.add(grid[r][cRun]);
                 cRun--;
            }
            cRun = c + 1;
            while(cRun < width && grid[r][cRun] !== 0) { // Look right
                if (grid[r][cRun]) used.add(grid[r][cRun]);
                cRun++;
            }

            // Col check
            let rRun = r;
            while(rRun >= 0 && grid[rRun][c] !== 0) { // Look up
                if (grid[rRun][c]) used.add(grid[rRun][c]);
                rRun--;
            }
            rRun = r + 1;
            while(rRun < height && grid[rRun][c] !== 0) { // Look down
                if (grid[rRun][c]) used.add(grid[rRun][c]);
                rRun++;
            }

            // Randomize 1-9
            const candidates = [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n));
            candidates.sort(() => Math.random() - 0.5);

            for(let num of candidates) {
                grid[r][c] = num;
                if (backtrack(index + 1)) return true;
                grid[r][c] = null;
            }

            return false;
        };

        if (backtrack(0)) return grid;
        return null; // Failed to fill
    }

    // ==========================================
    // Phase 3: Clue Calculation
    // ==========================================

    calculateClues(solution, width, height) {
        // Map to final structure
        // Cell Format: { type: 'clue'|'input', val: null, solution: number, right: 0, down: 0 }
        
        let finalGrid = Array(height).fill(null).map((_, r) => 
            Array(width).fill(null).map((_, c) => {
                if (solution[r][c] > 0) {
                    return {
                        type: 'input',
                        val: null,
                        solution: solution[r][c]
                    };
                } else {
                    return {
                        type: 'clue',
                        right: 0,
                        down: 0
                    };
                }
            })
        );

        // Calculate Sums
        for(let r=0; r<height; r++) {
            for(let c=0; c<width; c++) {
                if (finalGrid[r][c].type === 'clue') {
                    // Right Sum
                    let sumR = 0;
                    for(let i=c+1; i<width; i++) {
                        if (finalGrid[r][i].type === 'input') sumR += finalGrid[r][i].solution;
                        else break;
                    }
                    if (sumR > 0) finalGrid[r][c].right = sumR;

                    // Down Sum
                    let sumD = 0;
                    for(let i=r+1; i<height; i++) {
                        if (finalGrid[i][c].type === 'input') sumD += finalGrid[i][c].solution;
                        else break;
                    }
                    if (sumD > 0) finalGrid[r][c].down = sumD;
                }
            }
        }
        return finalGrid;
    }
}

// Export global instance
window.KakuroGenerator = new KakuroGenerator();
