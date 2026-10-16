
import './AcademyHub.css'

type AcademyHubProps = {
  onStartLevel1: () => void
  onStartLevel2: () => void
  onStartSeasons: () => void
  onBack: () => void
}

const upcoming = [
  {
    number: '03',
    title: 'FIND THE APEX',
    description: 'Master braking points, racing lines, and corner exits.',
  },
  {
    number: '04',
    title: 'RACECRAFT',
    description: 'Learn overtaking, defending, and wheel-to-wheel racing.',
  },
  {
    number: '05',
    title: 'THE PIT WALL',
    description: 'Explore race strategy, tyres, and pit stops.',
  },
]

export default function AcademyHub({
  onStartLevel1,
  onStartLevel2,
  onStartSeasons,
  onBack,
}: AcademyHubProps) {
  return (
    <main className="academy-hub">
      <header className="academy-hub-header">
        <button
          className="academy-back"
          onClick={onBack}
          type="button"
        >
          ← BACK TO THE GRID
        </button>

        <div className="academy-wordmark">
          APEX <span>ACADEMY</span>
        </div>

        <span className="academy-header-tag">
          DRIVER DEVELOPMENT / 2026
        </span>
      </header>

      <section
        className="academy-hub-content"
        aria-label="Academy levels"
      >
        <div className="academy-hub-heading">
          <p>WELCOME TO THE PADDOCK / YOUR JOURNEY STARTS HERE</p>
          <h1>THE <em>ACADEMY.</em></h1>
          <span>MASTER THE FUNDAMENTALS. ONE LEVEL AT A TIME.</span>
        </div>

        <div className="academy-levels">

          {/* LEVEL 01 */}
          <button
            className="academy-featured-level"
            type="button"
            onClick={onStartLevel1}
          >
            <div
  className="academy-featured-art academy-lights-image"
  aria-hidden="true"
>
  <img
    src="/lightsOut.webp"
    alt=""
    className="academy-card-image"
  />
</div>

            <div className="academy-featured-details">
              <div className="academy-featured-meta">
                <span>LEVEL 01 / THE START</span>
                <strong>● AVAILABLE NOW</strong>
              </div>

              <h2>LIGHTS <em>OUT.</em></h2>

              <p>
                Five red lights. One perfect launch.
                Master your reaction time, clutch release,
                and throttle control against the grid.
              </p>

              <span className="academy-play-link">
                ENTER LEVEL 01 <span aria-hidden="true">↗</span>
              </span>
            </div>
          </button>

          {/* LEVEL 02 */}
          <button
            className="academy-featured-level"
            type="button"
            onClick={onStartLevel2}
          >
            <div
  className="academy-featured-art academy-flying-image"
  aria-hidden="true"
>
  <img
    src="/flyingLap.jpg"
    alt=""
    className="academy-card-image"
  />
</div>

            <div className="academy-featured-details">
              <div className="academy-featured-meta">
                <span>LEVEL 02 / QUALIFYING</span>
                <strong>● AVAILABLE NOW</strong>
              </div>

              <h2>THE FLYING <em>LAP.</em></h2>

              <p>
                One circuit. Three timed laps.
                Master the corners, beat the clock,
                and earn your position on the starting grid.
              </p>

              <span className="academy-play-link">
                ENTER LEVEL 02 <span aria-hidden="true">↗</span>
              </span>
            </div>
          </button>

          {/* FUTURE LEVELS */}
          <div
            className="academy-upcoming"
            aria-label="Upcoming levels"
          >
            {upcoming.map(level => (
              <article
                className="academy-locked-level"
                key={level.number}
              >
                <div className="academy-locked-top">
                  <span>LEVEL {level.number}</span>
                  <span aria-label="Locked">◈</span>
                </div>

                <div>
                  <h3>{level.title}</h3>
                  <p>{level.description}</p>
                </div>

                <span className="academy-coming-soon">
                  COMING SOON
                </span>
              </article>
            ))}
          </div>
        </div>

<section className="academy-seasons">
  <div className="academy-seasons-heading">
    <span>BEYOND THE ACADEMY / SPECIAL CHAMPIONSHIP</span>
    <h2>SEASONS AND THEIR <em>EFFECTS IN F1.</em></h2>
    <p>
      Four seasons. Four unique circuits. Twelve laps.
      Race against 21 AI drivers while adapting to extreme
      weather and changing track conditions.
    </p>
  </div>

  <button
    type="button"
    className="academy-seasons-card"
    onClick={onStartSeasons}
  >
    <div className="academy-seasons-grid">
      <div className="season-tile summer">
        <span>01 / SUMMER</span>
        <strong>EXTREME HEAT</strong>
        <small>MELTING ASPHALT</small>
      </div>

      <div className="season-tile autumn">
        <span>02 / AUTUMN</span>
        <strong>FALLING LEAVES</strong>
        <small>TYRE CONTAMINATION</small>
      </div>

      <div className="season-tile winter">
        <span>03 / WINTER</span>
        <strong>THE STORM</strong>
        <small>WET TRACK & LOW GRIP</small>
      </div>

      <div className="season-tile spring">
        <span>04 / SPRING</span>
        <strong>POLLEN RUSH</strong>
        <small>ENGINE OVERHEATING</small>
      </div>
    </div>

    <div className="academy-seasons-bottom">
      <div>
        <span>4 CIRCUITS / 22 DRIVERS / 12 LAPS</span>
        <strong>ENTER THE FOUR SEASONS CHAMPIONSHIP</strong>
      </div>
      <span className="academy-seasons-arrow">↗</span>
    </div>
  </button>
</section>

        <footer className="academy-hub-footer">
          <span>APEX ACADEMY © 2026</span>
          <span>BUILT FOR THE NEXT GENERATION OF RACERS</span>
        </footer>
      </section>
    </main>
  )
}
