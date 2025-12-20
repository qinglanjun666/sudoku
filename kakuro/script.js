document.addEventListener('DOMContentLoaded', () => {
    const game = new KakuroGame();
    
    // UI Elements
    const difficultyScreen = document.getElementById('difficulty-screen');
    const menuGrid = document.getElementById('menu-grid');
    const gameInterface = document.getElementById('game-interface');
    const backBtn = document.getElementById('back-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const replayBtn = document.getElementById('replay-btn');
    const difficultySelect = document.getElementById('difficulty-select');
    const answerBtn = document.getElementById('show-answer-btn');

    // Difficulty Configuration
    const difficulties = [
        { id: 'beginner', label: 'Beginner', size: 6, desc: '6x6 Grid' },
        { id: 'easy',     label: 'Easy',     size: 8, desc: '8x8 Grid' },
        { id: 'medium',   label: 'Medium',   size: 10, desc: '10x10 Grid' },
        { id: 'hard',     label: 'Hard',     size: 12, desc: '12x12 Grid' },
        { id: 'expert',   label: 'Expert',   size: 15, desc: '15x15 Grid' }
    ];

    function updateBreadcrumb(difficultyId) {
        const breadcrumb = document.getElementById('kakuro-breadcrumb');
        if (!breadcrumb) return;

        let html = '<a href="/index.html">Home</a><span>></span>';
        
        if (difficultyId) {
            html += '<a href="/kakuro/">Kakuro</a><span>></span>';
            const diff = difficulties.find(d => d.id === difficultyId);
            const label = diff ? diff.label : difficultyId;
            html += `<span class="crumb-middle">${label}</span>`;
        } else {
            html += '<span class="crumb-middle">Kakuro</span>';
        }
        
        breadcrumb.innerHTML = html;
    }

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
        // Hide menu, show game
        difficultyScreen.style.display = 'none';
        gameInterface.style.display = 'flex';
        
        // Sync dropdown
        if (difficultySelect) difficultySelect.value = difficulty;

        // Update Breadcrumb
        updateBreadcrumb(difficulty);
        
        // Generate
        game.generateLevel(difficulty);
    }

    // 2. Back Button Logic
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            gameInterface.style.display = 'none';
            difficultyScreen.style.display = 'flex'; // Use flex to center content
            updateBreadcrumb(null);
        });
    }

    // 3. In-Game Controls
    if(newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            const difficulty = difficultySelect ? difficultySelect.value : 'medium';
            game.generateLevel(difficulty);
        });
    }

    // Check URL Params
    const params = new URLSearchParams(window.location.search);
    const diffParam = params.get('difficulty');
    if (diffParam && difficulties.some(d => d.id === diffParam)) {
        startGame(diffParam);
    }

    if(replayBtn) {
        replayBtn.addEventListener('click', () => game.resetBoard());
    }

    if(answerBtn) {
        answerBtn.addEventListener('click', () => game.showSolution());
    }
});

class KakuroGame {
    constructor() {
        // 修正选择器，必须匹配 index.html 中的 id="kakuro-board"
        this.gridElement = document.getElementById('kakuro-board'); 
        this.grid = [];
        this.wallProb = 0.35; 
        // Initial generation is now handled by the UI selection
    }

    async generateLevel(difficulty = 'medium') {
        // 难度配置
        const config = {
            'beginner': { size: 6,  wallProb: 0.45 },
            'easy':     { size: 8,  wallProb: 0.40 },
            'medium':   { size: 10, wallProb: 0.35 },
            'hard':     { size: 12, wallProb: 0.30 },
            'expert':   { size: 15, wallProb: 0.30 } // Adjusted to 0.30 to prevent freezing
        };

        const settings = config[difficulty] || config['medium'];
        this.size = settings.size;
        this.wallProb = settings.wallProb;

        console.log(`Generating level: ${difficulty} (${this.size}x${this.size}, wallProb: ${this.wallProb})`);
        
        // Show loading state
        const btn = document.getElementById('new-game-btn');
        const originalText = btn ? btn.innerText : 'New Game';
        if(btn) {
            btn.innerText = 'Generating...';
            btn.disabled = true;
        }

        let success = false;
        // 尝试生成 100 次
        for(let i = 0; i < 100; i++) {
            // 让出主线程，避免页面卡死
            await new Promise(resolve => setTimeout(resolve, 0));

            this.initGrid();     // 1. 初始化
            this.placeWalls();   // 2. 布墙
            
            // 【优化】限制最大连续空格长度为 9
            this.fixLongSegments();

            // 确保连通性
            if (!this.isConnected()) continue;

            // 3. 核心：先填数
            this.solverSteps = 0; // 重置计数器
            if (this.solve(0, 0)) {
                this.calculateClues();      // 4. 计算线索
                this.cleanUpInvalidClues(); // 5. 清理错误线索
                this.render();              // 6. 渲染
                success = true;
                break;
            }
        }

        if(btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }

        if (!success) {
            console.warn("Generation failed after max attempts.");
            alert("生成失败 (过于复杂)，请重试！");
        }
    }

    // 初始化网格
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

    // 布置墙壁 (边缘强制为墙)
    placeWalls() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (r === 0 || c === 0) {
                    this.grid[r][c].type = 'void';
                } else {
                    // 使用动态概率
                    if (Math.random() < this.wallProb) this.grid[r][c].type = 'void';
                }
            }
        }
        this.grid[0][0].type = 'void';
    }

    // 限制连续空白格长度不能超过 9
    fixLongSegments() {
        // 水平方向扫描
        for (let r = 0; r < this.size; r++) {
            let count = 0;
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c].type === 'empty') {
                    count++;
                    if (count > 9) {
                        // 强制将第 10 个变成墙
                        this.grid[r][c].type = 'void';
                        count = 0;
                    }
                } else {
                    count = 0;
                }
            }
        }
        
        // 垂直方向扫描
        for (let c = 0; c < this.size; c++) {
            let count = 0;
            for (let r = 0; r < this.size; r++) {
                if (this.grid[r][c].type === 'empty') {
                    count++;
                    if (count > 9) {
                        // 强制将第 10 个变成墙
                        this.grid[r][c].type = 'void';
                        count = 0;
                    }
                } else {
                    count = 0;
                }
            }
        }
    }

    // 检查连通性 (Flood Fill)
    isConnected() {
        let startR = -1, startC = -1;
        let emptyCount = 0;
        // 找到第一个 empty 格子
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c].type === 'empty') {
                    if (startR === -1) { startR = r; startC = c; }
                    emptyCount++;
                }
            }
        }
        if (emptyCount === 0) return false;

        // BFS 遍历
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

   // 回溯求解 (确保只填 1-9 且不重复)
   solve(r, c) {
       // 防止计算量过大导致卡死
       this.solverSteps++;
       if (this.solverSteps > 200000) return false;

       if (r >= this.size) return true;
       
       let nextC = c + 1;
       let nextR = r;
       if (nextC >= this.size) { nextC = 0; nextR = r + 1; }

       // 遇墙跳过
       if (this.grid[r][c].type !== 'empty') return this.solve(nextR, nextC);

       // 随机尝试 1-9
       let nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
       for (let num of nums) {
           if (this.isValid(r, c, num)) {
               this.grid[r][c].solution = num;
               if (this.solve(nextR, nextC)) return true;
               this.grid[r][c].solution = null; // 回溯
           }
       }
       return false;
   }

   // 验证合法性
   isValid(r, c, num) {
       // 查左
       for (let i = c - 1; i >= 0; i--) {
           if (this.grid[r][i].type !== 'empty') break;
           if (this.grid[r][i].solution === num) return false;
       }
       // 查上
       for (let i = r - 1; i >= 0; i--) {
           if (this.grid[i][c].type !== 'empty') break;
           if (this.grid[i][c].solution === num) return false;
       }
       return true;
   }

    // 计算线索 (遇墙即停)
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
                    } else break; // 遇墙 Break
                }
                if (countR > 0) cell.right = sumR;

                // Down
                let sumD = 0, countD = 0;
                for (let k = r + 1; k < this.size; k++) {
                    if (this.grid[k][c].type === 'empty') {
                        sumD += this.grid[k][c].solution;
                        countD++;
                    } else break; // 遇墙 Break
                }
                if (countD > 0) cell.down = sumD;

                if (cell.right || cell.down) cell.type = 'clue';
            }
        }
    }

    // 清理无效线索
    cleanUpInvalidClues() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cell = this.grid[r][c];
                if (cell.type !== 'clue') continue;

                // 检查右侧：如果越界或非空 -> 删除线索
                if (cell.right && (c + 1 >= this.size || this.grid[r][c+1].type !== 'empty')) {
                    cell.right = null;
                }
                // 检查下方：如果越界或非空 -> 删除线索
                if (cell.down && (r + 1 >= this.size || this.grid[r+1][c].type !== 'empty')) {
                    cell.down = null;
                }
                
                // 降级为普通墙
                if (!cell.right && !cell.down) cell.type = 'void';
            }
        }
    }

    // 【修复 2】添加键盘输入监听
    setupInput() {
        if (this.hasInputListener) return;
        this.hasInputListener = true;
        document.addEventListener('keydown', e => {
            let selected = document.querySelector('.cell.selected');
            if (!selected) return;
            let key = e.key;
            // 支持 1-9 输入
            if (['1','2','3','4','5','6','7','8','9'].includes(key)) {
                selected.innerText = key;
                selected.classList.add('user-filled');
            } 
            // 支持删除
            else if (key === 'Backspace' || key === 'Delete') {
                selected.innerText = '';
                selected.classList.remove('user-filled');
            }
        });
    }

    render() {
        this.setupInput(); // 确保输入监听器已绑定
        
        // 确保 gridElement 存在，否则报错
        if (!this.gridElement) {
            console.error("Kakuro board element not found!");
            return;
        }

        this.gridElement.innerHTML = '';
        this.gridElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cell = this.grid[r][c];
                let div = document.createElement('div');
                div.className = 'cell';
                // 保存坐标以便查找
                div.dataset.r = r;
                div.dataset.c = c;
                
                if (cell.type === 'clue') {
                    div.classList.add('clue');
                    if (cell.down) {
                        let s = document.createElement('span');
                        s.className = 'clue-number clue-down';
                        s.innerText = cell.down;
                        div.appendChild(s);
                    }
                    if (cell.right) {
                        let s = document.createElement('span');
                        s.className = 'clue-number clue-right';
                        s.innerText = cell.right;
                        div.appendChild(s);
                    }
                } else if (cell.type === 'void') {
                    div.classList.add('void');
                    div.style.backgroundColor = '#dcdcdc';
                } else {
                    div.classList.add('empty');
                    div.onclick = (e) => {
                        document.querySelectorAll('.cell').forEach(el=>el.classList.remove('selected'));
                        div.classList.add('selected');
                    };
                }
                this.gridElement.appendChild(div);
            }
        }
    }

    // 显示答案
    showSolution() {
        if (!this.grid || this.grid.length === 0) return;
        
        // 获取所有格子 DOM
        const cells = this.gridElement.children;
        
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                let cellData = this.grid[r][c];
                if (cellData.type === 'empty' && cellData.solution) {
                    // 找到对应的 DOM 元素 (按顺序)
                    let index = r * this.size + c;
                    let cellDiv = cells[index];
                    
                    if (cellDiv) {
                        cellDiv.innerText = cellData.solution;
                        cellDiv.classList.add('revealed'); // 可选：添加样式以示区分
                        cellDiv.style.color = 'blue'; // 简单样式：答案显示为蓝色
                    }
                }
            }
        }
    }

    // 重玩本局
    resetBoard() {
        if (!this.gridElement) return;
        const cells = this.gridElement.querySelectorAll('.cell.empty');
        cells.forEach(cell => {
            cell.innerText = '';
            cell.classList.remove('user-filled', 'revealed');
            cell.style.color = ''; // Reset color
        });
    }
}