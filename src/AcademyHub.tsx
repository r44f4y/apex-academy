import './AcademyHub.css'

type AcademyHubProps = {
  onStartLevel1: () => void
  onBack: () => void
}

const upcoming = [
  { number: '02', title: 'THE RACING LINE', description: 'Find the apex. Carry speed through every corner.' },
  { number: '03', title: 'RACECRAFT', description: 'Learn overtaking, defending, and wheel-to-wheel racing.' },
  { number: '04', title: 'THE PIT WALL', description: 'Explore race strategy, tyres, and pit stops.' },
]

export default function AcademyHub({ onStartLevel1, onBack }: AcademyHubProps) {
  return (
    <main className="academy-hub">
      <header className="academy-hub-header">
        <button className="academy-back" onClick={onBack} type="button">← BACK TO THE GRID</button>
        <div className="academy-wordmark">APEX <span>ACADEMY</span></div>
        <span className="academy-header-tag">DRIVER DEVELOPMENT / 2026</span>
      </header>

      <section className="academy-hub-content" aria-label="Academy levels">
        <div className="academy-hub-heading">
          <p>WELCOME TO THE PADDOCK / YOUR JOURNEY STARTS HERE</p>
          <h1>THE <em>ACADEMY.</em></h1>
          <span>MASTER THE FUNDAMENTALS. ONE LEVEL AT A TIME.</span>
        </div>

        <div className="academy-levels">
          <button className="academy-featured-level" type="button" onClick={onStartLevel1}>
            <div className="academy-featured-art" aria-hidden="true">
              <div className="academy-start-lights"><i/><i/><i/><i/><i/></div>
              <div className="academy-track-lines" />
              <span className="academy-featured-ghost">01</span>
            </div>
            <div className="academy-featured-details">
              <div className="academy-featured-meta"><span>LEVEL 01 / THE START</span><strong>● AVAILABLE NOW</strong></div>
              <h2>LIGHTS <em>OUT.</em></h2>
              <p>Five red lights. One perfect launch. Master your reaction time, clutch release, and throttle control against the grid.</p>
              <span className="academy-play-link">ENTER LEVEL 01 <span aria-hidden="true">↗</span></span>
            </div>
          </button>

          <div className="academy-upcoming" aria-label="Upcoming levels">
            {upcoming.map(level => (
              <article className="academy-locked-level" key={level.number}>
                <div className="academy-locked-top"><span>LEVEL {level.number}</span><span aria-label="Locked">◈</span></div>
                <div><h3>{level.title}</h3><p>{level.description}</p></div>
                <span className="academy-coming-soon">COMING SOON</span>
              </article>
            ))}
          </div>
        </div>
        <footer className="academy-hub-footer"><span>APEX ACADEMY © 2026</span><span>BUILT FOR THE NEXT GENERATION OF RACERS</span></footer>
      </section>
    </main>
  )
}
