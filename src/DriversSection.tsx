import { useEffect, useRef, useState } from 'react'
import './DriversSection.css'

type Driver = { name: string; number: string; image: string }
type Team = { name: string; color: string; ink: string; logo: string; drivers: [Driver, Driver] }

// Driver images are placeholders until you add the corresponding files in public/drivers/.
// Change any logo extension here if yours is .png instead of .svg.
const teams: Team[] = [
  { name: 'Alpine', color: '#F3A6CB', ink: '#191919', logo: '/teams/alpine-logo.svg', drivers: [{ name: 'Pierre Gasly', number: '10', image: '/drivers/pierre-gasly.png' }, { name: 'Franco Colapinto', number: '43', image: '/drivers/franco-colapinto.png' }] },
  { name: 'Aston Martin', color: '#00665E', ink: '#FFFFFF', logo: '/teams/aston-martin-logo.svg', drivers: [{ name: 'Fernando Alonso', number: '14', image: '/drivers/fernando-alonso.png' }, { name: 'Lance Stroll', number: '18', image: '/drivers/lance-stroll.png' }] },
  { name: 'Audi', color: '#B9182A', ink: '#FFFFFF', logo: '/teams/audi-logo.svg', drivers: [{ name: 'Nico Hülkenberg', number: '27', image: '/drivers/nico-hulkenberg.png' }, { name: 'Gabriel Bortoleto', number: '5', image: '/drivers/gabriel-bortoleto.png' }] },
  { name: 'Cadillac', color: '#24272B', ink: '#FFFFFF', logo: '/teams/cadillac-logo.svg', drivers: [{ name: 'Sergio Pérez', number: '11', image: '/drivers/sergio-perez.png' }, { name: 'Valtteri Bottas', number: '77', image: '/drivers/valtteri-bottas.png' }] },
  { name: 'Ferrari', color: '#D71920', ink: '#FFFFFF', logo: '/teams/ferrari-logo.svg', drivers: [{ name: 'Charles Leclerc', number: '16', image: '/drivers/charles-leclerc.png' }, { name: 'Lewis Hamilton', number: '44', image: '/drivers/lewis-hamilton.png' }] },
  { name: 'Haas', color: '#DADDE0', ink: '#181818', logo: '/teams/haas-logo.svg', drivers: [{ name: 'Esteban Ocon', number: '31', image: '/drivers/esteban-ocon.png' }, { name: 'Oliver Bearman', number: '87', image: '/drivers/oliver-bearman.png' }] },
  { name: 'McLaren', color: '#FF8700', ink: '#171717', logo: '/teams/mclaren-logo.svg', drivers: [{ name: 'Lando Norris', number: '1', image: '/drivers/lando-norris.png' }, { name: 'Oscar Piastri', number: '81', image: '/drivers/oscar-piastri.png' }] },
  { name: 'Mercedes', color: '#00AFA0', ink: '#10201D', logo: '/teams/mercedes-logo.svg', drivers: [{ name: 'George Russell', number: '63', image: '/drivers/george-russell.png' }, { name: 'Kimi Antonelli', number: '12', image: '/drivers/kimi-antonelli.png' }] },
  { name: 'Racing Bulls', color: '#254A9B', ink: '#FFFFFF', logo: '/teams/racing-bulls-logo.svg', drivers: [{ name: 'Liam Lawson', number: '30', image: '/drivers/liam-lawson.png' }, { name: 'Arvid Lindblad', number: '41', image: '/drivers/arvid-lindblad.png' }] },
  { name: 'Red Bull Racing', color: '#102D60', ink: '#FFFFFF', logo: '/teams/red-bull-racing-logo.svg', drivers: [{ name: 'Max Verstappen', number: '3', image: '/drivers/max-verstappen.png' }, { name: 'Isack Hadjar', number: '6', image: '/drivers/isack-hadjar.png' }] },
  { name: 'Williams', color: '#0876CE', ink: '#FFFFFF', logo: '/teams/williams-logo.svg', drivers: [{ name: 'Carlos Sainz', number: '55', image: '/drivers/carlos-sainz.png' }, { name: 'Alexander Albon', number: '23', image: '/drivers/alexander-albon.png' }] },
]

function DriverPortrait({ driver, side }: { driver: Driver; side: 'left' | 'right' }) {
  const [missing, setMissing] = useState(false)
  useEffect(() => setMissing(false), [driver.image])
  return <div className={`driver-edge-photo driver-edge-${side}`}>
    {!missing ? <img src={driver.image} alt={driver.name} onError={() => setMissing(true)} /> : <div className="driver-edge-placeholder">ADD PHOTO<br/>{driver.name}</div>}
  </div>
}
function DriverName({ driver }: { driver: Driver }) {
  const parts = driver.name.split(' ')
  return <div className="driver-inner-name">
    <span className="driver-inner-number">#{driver.number}</span>
    <h3><span>{parts[0]}</span><strong>{parts.slice(1).join(' ')}</strong></h3>
  </div>
}
function Logo({ team }: { team: Team }) {
  const [missing, setMissing] = useState(false)
  useEffect(() => setMissing(false), [team.logo])
  return missing ? <strong className="driver-logo-text">{team.name}</strong> : <img className="driver-team-logo" src={team.logo} alt={`${team.name} logo`} onError={() => setMissing(true)} />
}
function Slide({ team, index, opacity, shift }: { team: Team; index: number; opacity: number; shift: number }) {
  return <div className="driver-slide" style={{ opacity, color: team.ink, transform: `translateY(${shift}px)` }}>
    <div className="driver-center-logo"><Logo team={team} /></div>
    <div className="driver-four-columns">
      <DriverPortrait driver={team.drivers[0]} side="left" />
      <DriverName driver={team.drivers[0]} />
      <DriverName driver={team.drivers[1]} />
      <DriverPortrait driver={team.drivers[1]} side="right" />
    </div>
    <div className="driver-slide-bottom">{String(index + 1).padStart(2, '0')} / 11</div>
  </div>
}

export default function DriversSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(0)
  useEffect(() => {
    const update = () => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const scrollable = Math.max(1, rect.height - window.innerHeight)
      setPosition(Math.max(0, Math.min(teams.length - 1, -rect.top / scrollable * (teams.length - 1))))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  const index = Math.min(teams.length - 1, Math.floor(position))
  const nextIndex = Math.min(teams.length - 1, index + 1)
  const fraction = position - index
  const blend = nextIndex === index ? 0 : Math.max(0, Math.min(1, (fraction - 0.25) / 0.5))
  const current = teams[index]
  const next = teams[nextIndex]
  return <>
    <section className="drivers-intro">
  <h2>22 DRIVERS<span>.</span></h2>

  <p>THE PEOPLE BEHIND THE MACHINES</p>
</section>
    <div ref={trackRef} className="drivers-scroll-track" style={{ height: `${teams.length * 85}vh` }}>
      <section className="drivers-sticky" style={{ background: current.color }}>
        <div className="drivers-next-bg" style={{ background: next.color, opacity: blend }} />
        <div className="drivers-topline" style={{ color: blend >= 0.5 ? next.ink : current.ink }}><span>THE 2026 DRIVERS</span><span>{String(Math.round(position) + 1).padStart(2, '0')} / 11</span></div>
        {/* CURRENT TEAM — gradually fades out */}
<Slide
  key={`current-${index}`}
  team={current}
  index={index}
  opacity={1 - blend}
  shift={-blend * 24}
/>

{/* NEXT TEAM — gradually fades in */}
{nextIndex !== index && (
  <Slide
    key={`next-${nextIndex}`}
    team={next}
    index={nextIndex}
    opacity={blend}
    shift={(1 - blend) * 24}
  />
)}
        <div className="drivers-progress" style={{ color: blend >= 0.5 ? next.ink : current.ink }}><div style={{ width: `${position / (teams.length - 1) * 100}%` }} /></div>
      </section>
    </div>
  </>
}
