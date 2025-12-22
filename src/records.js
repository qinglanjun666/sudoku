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
          e.stopPropagation() // Prevent bubbling
          
          if (display.style.display === 'block') {
            display.style.display = 'none'
            return
          }
          
          try {
            const raw = localStorage.getItem('sudoku_stats')
            const stats = raw ? JSON.parse(raw) : {}
            const completed = stats.completed || {}
            
            let html = '<div style="font-weight:600; margin-bottom:12px; color:#111; font-size:16px; border-bottom:1px solid #eee; padding-bottom:8px;">Games Completed</div>'
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#4b5563;"><span>Easy:</span> <span style="font-weight:600; color:#111">${completed.easy || 0}</span></div>`
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#4b5563;"><span>Medium:</span> <span style="font-weight:600; color:#111">${completed.medium || 0}</span></div>`
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#4b5563;"><span>Hard:</span> <span style="font-weight:600; color:#111">${completed.hard || 0}</span></div>`
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:0; color:#4b5563;"><span>Mini 6x6:</span> <span style="font-weight:600; color:#111">${completed['6x6'] || 0}</span></div>`
            
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
            
          } catch {
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

  // Try to init immediately, and also on DOMContentLoaded just in case
  initRecords()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecords)
  }
})()
