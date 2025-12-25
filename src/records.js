(function() {
  function initRecords() {
    const checkBtn = () => {
      const btn = document.getElementById('navRecordsBtn')
      const display = document.getElementById('navRecordsDisplay')
      
      if (btn && display) {
        if (btn.dataset.recordsInitialized) return
        btn.dataset.recordsInitialized = 'true'
        
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          
          if (display.style.display === 'block') {
            display.style.display = 'none'
            return
          }
          
          try {
            // Read Stats
            const sStats = JSON.parse(localStorage.getItem('sudoku_stats') || '{}').completed || {}
            const kStats = JSON.parse(localStorage.getItem('kakuro_stats') || '{}').completed || {}
            const fStats = JSON.parse(localStorage.getItem('futoshiki_stats') || '{}').completed || {}
            const tfStats = JSON.parse(localStorage.getItem('24game_stats') || '{}')
            const tfWins = tfStats.completed || 0

            // Helper to render row
            const row = (label, val) => `<div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#4b5563; font-size:13px;"><span>${label}:</span> <span style="font-weight:600; color:#111">${val||0}</span></div>`
            const header = (title) => `<div style="font-weight:600; margin:12px 0 6px; color:#111; font-size:14px; border-bottom:1px solid #eee; padding-bottom:4px;">${title}</div>`

            let html = '<div style="max-height:400px; overflow-y:auto; padding-right:4px;">'
            html += '<div style="font-weight:700; font-size:16px; margin-bottom:8px; color:#111">My Records</div>'
            
            // Sudoku
            html += header('Sudoku')
            html += row('Easy', sStats.easy)
            html += row('Medium', sStats.medium)
            html += row('Hard', sStats.hard)
            html += row('Mini 6x6', sStats['6x6'])

            // 24 Game
            html += header('24 Game')
            html += row('Wins', tfWins)

            // Kakuro
            html += header('Kakuro')
            html += row('Beginner', kStats.beginner)
            html += row('Easy', kStats.easy)
            html += row('Medium', kStats.medium)
            html += row('Hard', kStats.hard)

            // Futoshiki
            html += header('Futoshiki')
            html += row('4x4', (fStats['4-Easy']||0) + (fStats['4-Hard']||0))
            html += row('5x5', (fStats['5-Easy']||0) + (fStats['5-Hard']||0))
            html += row('6x6', (fStats['6-Easy']||0) + (fStats['6-Hard']||0))

            // Quests
            html += '<div style="font-weight:600; margin:16px 0 8px; color:#111; font-size:15px; border-top:2px solid #eee; padding-top:12px;">Daily Quests</div>'
            
            // Quest Logic
            const quests = [
                { title: 'Sudoku Apprentice', desc: 'Win 30 Easy Sudoku games', completed: (sStats.easy || 0) >= 30 },
                { title: 'Math Whiz', desc: 'Win 10 24-Games', completed: tfWins >= 10 },
                { title: 'Kakuro Starter', desc: 'Win 5 Kakuro puzzles', completed: (Object.values(kStats).reduce((a,b)=>a+b,0)) >= 5 },
                { title: 'Futoshiki Novice', desc: 'Win 5 Futoshiki puzzles', completed: (Object.values(fStats).reduce((a,b)=>a+b,0)) >= 5 }
            ]

            quests.forEach(q => {
                const color = q.completed ? '#F59E0B' : '#9CA3AF' // Gold vs Gray
                const fill = q.completed ? '#F59E0B' : 'none'
                const icon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`
                
                html += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; opacity:${q.completed?1:0.8}; background:${q.completed?'#fffbeb':'#f9fafb'}; padding:8px; border-radius:6px; border:1px solid ${q.completed?'#fcd34d':'#e5e7eb'}">
                    <div style="flex-shrink:0">${icon}</div>
                    <div>
                        <div style="font-weight:600; font-size:13px; color:${q.completed?'#92400e':'#374151'}">${q.title}</div>
                        <div style="font-size:11px; color:${q.completed?'#b45309':'#6b7280'}">${q.desc}</div>
                    </div>
                </div>`
            })

            html += '</div>' // Close container
                    
                    // Add More Button
                    html += `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #eee; text-align:center;">
                        <a href="/achievements/index.html" style="display:inline-block; padding:8px 16px; background:#f3f4f6; color:#374151; text-decoration:none; border-radius:6px; font-weight:600; font-size:13px; transition:background 0.2s;">View All Achievements & Trophies</a>
                    </div>`

                    display.innerHTML = html
            display.style.display = 'block'
            
            // Close when clicking outside
            const closeHandler = (ev) => {
              if (!display.contains(ev.target) && ev.target !== btn) {
                display.style.display = 'none'
                document.removeEventListener('click', closeHandler)
              }
            }
            setTimeout(() => document.addEventListener('click', closeHandler), 0)
            
          } catch(e) {
            console.error(e)
            display.innerHTML = '<div style="color:red">Error loading stats</div>'
            display.style.display = 'block'
          }
        })
      } else {
        setTimeout(checkBtn, 100)
      }
    }
    checkBtn()
  }

  initRecords()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecords)
  }
})()
