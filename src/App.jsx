import { useState } from 'react'

export default function App() {
  const [route, setRoute] = useState('home')
  const [difficulty, setDifficulty] = useState(null)

  const startGame = (level) => {
    setDifficulty(level)
    setRoute('game')
  }

  return (
    <div>
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="logo">Logic for Sudoku</div>
          <div className="nav-right" />
        </div>
      </nav>
      <main className="main-wrap">
        <div className="container">
          {route === 'home' && (
            <>
              <section className="hero">
                <h1 className="title">Sharpen Your Logic. Solve Your Sudoku.</h1>
                <p className="subtitle secondary">Pick a difficulty and start playing instantly.</p>
              </section>
              <section className="grid-section">
                <div className="cards">
                  <div className="card" onClick={() => startGame('easy')}>
                    <h3 className="card-title">Easy</h3>
                    <p className="card-desc">A gentle start for new players.</p>
                  </div>
                  <div className="card" onClick={() => startGame('medium')}>
                    <h3 className="card-title">Medium</h3>
                    <p className="card-desc">A balanced challenge for growing skills.</p>
                  </div>
                  <div className="card" onClick={() => startGame('hard')}>
                    <h3 className="card-title">Hard</h3>
                    <p className="card-desc">For experienced solvers seeking deeper logic.</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {route === 'game' && (
            <>
              <section className="hero">
                <h1 className="title">Sudoku</h1>
                <p className="subtitle secondary">Difficulty: {difficulty}</p>
              </section>
              <section className="grid-section grid-bg">
                <div className="placeholder">Game grid will appear here</div>
                <div style={{ marginTop: 16 }}>
                  <button className="cta" onClick={() => setRoute('home')}>← Back</button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
