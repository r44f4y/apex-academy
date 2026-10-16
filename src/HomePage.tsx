import { useEffect, useRef, useState } from 'react'
import './HomePage.css'
import DriversSection from './DriversSection'

type Team = { name: string; short: string; color: string; ink: string; drivers: string; car: string; logo: string }
const teams: Team[] = [
  { name:'Alpine',short:'BWT ALPINE',color:'#F3A6CB',ink:'#191919',drivers:'Pierre Gasly / Franco Colapinto',car:'/teams/alpine-car.png',logo:'/teams/alpine-logo.svg' },
  { name:'Aston Martin',short:'ASTON MARTIN',color:'#00665E',ink:'#FFFFFF',drivers:'Fernando Alonso / Lance Stroll',car:'/teams/aston-martin-car.png',logo:'/teams/aston-martin-logo.svg' },
  { name:'Audi',short:'AUDI',color:'#B9182A',ink:'#FFFFFF',drivers:'Nico Hülkenberg / Gabriel Bortoleto',car:'/teams/audi-car.png',logo:'/teams/audi-logo.svg' },
  { name:'Cadillac',short:'CADILLAC',color:'#24272B',ink:'#FFFFFF',drivers:'Sergio Pérez / Valtteri Bottas',car:'/teams/cadillac-car.png',logo:'/teams/cadillac-logo.svg' },
  { name:'Ferrari',short:'SCUDERIA FERRARI',color:'#D71920',ink:'#FFFFFF',drivers:'Charles Leclerc / Lewis Hamilton',car:'/teams/ferrari-car.png',logo:'/teams/ferrari-logo.svg' },
  { name:'Haas',short:'HAAS F1 TEAM',color:'#DADDE0',ink:'#181818',drivers:'Esteban Ocon / Oliver Bearman',car:'/teams/haas-car.png',logo:'/teams/haas-logo.svg' },
  { name:'McLaren',short:'McLAREN',color:'#FF8700',ink:'#171717',drivers:'Lando Norris / Oscar Piastri',car:'/teams/mclaren-car.png',logo:'/teams/mclaren-logo.svg' },
  { name:'Mercedes',short:'MERCEDES-AMG',color:'#00AFA0',ink:'#10201D',drivers:'George Russell / Kimi Antonelli',car:'/teams/mercedes-car.png',logo:'/teams/mercedes-logo.svg' },
  { name:'Racing Bulls',short:'RACING BULLS',color:'#254A9B',ink:'#FFFFFF',drivers:'Liam Lawson / Arvid Lindblad',car:'/teams/racing-bulls-car.png',logo:'/teams/racing-bulls-logo.svg' },
  { name:'Red Bull Racing',short:'RED BULL RACING',color:'#102D60',ink:'#FFFFFF',drivers:'Max Verstappen / Isack Hadjar',car:'/teams/red-bull-racing-car.png',logo:'/teams/red-bull-racing-logo.svg' },
  { name:'Williams',short:'WILLIAMS',color:'#0876CE',ink:'#FFFFFF',drivers:'Carlos Sainz / Alexander Albon',car:'/teams/williams-car.png',logo:'/teams/williams-logo.svg' },
]

function CarArtwork({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!failed) return <img className="apex-car-image" src={src} alt={`${name} 2026 Formula 1 car, side profile`} decoding="async" onError={() => setFailed(true)} />
  return <svg className="apex-car-fallback" viewBox="0 0 1100 350" role="img" aria-label={`Illustrative side-profile car placeholder for ${name}`}>
    <defs><linearGradient id="bodyGradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fff" offset="0"/><stop stopColor="#a8a8a8" offset="1"/></linearGradient></defs>
    <ellipse cx="560" cy="295" rx="475" ry="24" fill="#000" opacity=".18"/>
    <path d="M60 233 L182 217 L260 187 L414 183 L481 131 L587 124 L649 181 L826 188 L938 209 L1020 209 L1040 234 L960 251 L160 251 Z" fill="url(#bodyGradient)" stroke="#1a1a1a" strokeWidth="5"/>
    <path d="M447 180 L494 143 L576 141 L611 182 Z" fill="#161616"/>
    <path d="M509 142 L541 109 L559 109 L572 143" fill="none" stroke="#1a1a1a" strokeWidth="15"/>
    <path d="M92 209 L190 208 L182 191 L65 191 Z M885 200 L1030 200 L1030 175 L898 176 Z" fill="#171717"/>
    <path d="M105 246 L1030 246" stroke="#181818" strokeWidth="15"/>
    <path d="M285 196 L426 190 L440 212 L264 221 Z" fill="#c8102e"/>
    <circle cx="287" cy="249" r="77" fill="#111" stroke="#2d2d2d" strokeWidth="12"/><circle cx="287" cy="249" r="34" fill="#a9a9a9" stroke="#eee" strokeWidth="5"/>
    <circle cx="851" cy="249" r="77" fill="#111" stroke="#2d2d2d" strokeWidth="12"/><circle cx="851" cy="249" r="34" fill="#a9a9a9" stroke="#eee" strokeWidth="5"/>
    <path d="M656 191 L788 192 L809 212 L660 211 Z" fill="#c8102e"/>
  </svg>
}
function TeamLogo({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return failed ? <span className="apex-team-wordmark">{name}</span> : <img className="apex-team-logo" src={src} alt={`${name} logo`} decoding="async" onError={() => setFailed(true)} />
}

// A low-overhead brush: paint an irregular mask onto an offscreen canvas,
// then composite the red background and car into the visible canvas.
function PaintReveal() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    const mask = document.createElement('canvas')
    const brush = mask.getContext('2d')
    if (!ctx || !brush) return
    const car = new Image()
    car.decoding = 'async'
    car.src = '/cars.jpg'
    let carReady = false
    let width = 1, height = 1, dpr = 1
    let raf = 0, last: { x: number; y: number } | null = null
    let seed = 1234567
    const TRAIL_MS = 1000
    const marks: { x: number; y: number; time: number }[] = []
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    const stamp = (x: number, y: number, opacity: number) => {
      const radius = Math.max(65, Math.min(width, height) * .143)
      brush.fillStyle = '#fff'
      brush.globalAlpha = opacity
      brush.beginPath()
      for (let i = 0; i <= 22; i++) {
        const a = i / 22 * Math.PI * 2
        const r = radius * (.68 + random() * .55)
        const px = x + Math.cos(a) * r * 1.3
        const py = y + Math.sin(a) * r * .7
        if (i === 0) brush.moveTo(px, py)
        else brush.lineTo(px, py)
      }
      brush.closePath()
      brush.fill()
      for (let i = 0; i < 9; i++) {
        const a = random() * Math.PI * 2
        const r = radius * (.6 + random() * .65)
        brush.beginPath()
        brush.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * .7, radius * (.035 + random() * .12), radius * (.02 + random() * .055), a, 0, Math.PI * 2)
        brush.fill()
      }
      brush.globalAlpha = 1
    }
    const render = () => {
      raf = 0
      ctx.clearRect(0, 0, width, height)
      const now = performance.now()
      while (marks.length && now - marks[0].time > TRAIL_MS) marks.shift()
      if (!marks.length) return
      brush.clearRect(0, 0, width, height)
      for (const mark of marks) {
        const age = (now - mark.time) / TRAIL_MS
        stamp(mark.x, mark.y, Math.pow(Math.max(0, 1 - age), 1.8))
      }
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      if (carReady) {
        const scale = Math.max(
  width / car.naturalWidth,
  height / car.naturalHeight
)

const dw = car.naturalWidth * scale
const dh = car.naturalHeight * scale

ctx.drawImage(
  car,
  (width - dw) / 2,
  (height - dh) / 2,
  dw,
  dh
)
      }
      ctx.save()
      ctx.font = '800 11px Inter, Arial, sans-serif'
      ctx.fillStyle = '#fff'
      ctx.fillText('PRECISION / PERFORMANCE / PASSION', 30, height - 25)
      ctx.restore()
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      // Mask and visible canvas both use physical pixels. Draw with identity transform.
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(mask, 0, 0)
      ctx.restore()
      if (marks.length) raf = requestAnimationFrame(render)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(render) }
    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = Math.max(1, rect.width); height = Math.max(1, rect.height)
      // Cap pixel density to avoid massive canvas redraws on Retina displays.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = mask.width = Math.round(width * dpr)
      canvas.height = mask.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      brush.setTransform(dpr, 0, 0, dpr, 0, 0)
      marks.length = 0
      last = null
      schedule()
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && event.buttons === 0) return
      const rect = host.getBoundingClientRect()
      const p = { x: (event.clientX - rect.left) * (width / rect.width), y: (event.clientY - rect.top) * (height / rect.height) }
      if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) { last = null; return }
      const step = Math.max(5, Math.min(width, height) * .017)
      if (last) {
        const dx = p.x - last.x, dy = p.y - last.y
        const count = Math.min(100, Math.ceil(Math.hypot(dx, dy) / step))
        for (let i = 1; i <= count; i++) marks.push({ x: last.x + dx * i / count, y: last.y + dy * i / count, time: performance.now() })
      } else marks.push({ ...p, time: performance.now() })
      if (marks.length > 220) marks.splice(0, marks.length - 220)
      last = p; schedule()
    }
    const leave = () => { last = null }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    car.onload = () => { carReady = true; schedule() }
    car.onerror = () => { carReady = false; schedule() }
    host.addEventListener('pointermove', move, { passive: true })
    host.addEventListener('pointerleave', leave)
    resize()
    return () => {
      observer.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
      if (raf) cancelAnimationFrame(raf)
      car.onload = null; car.onerror = null
    }
  }, [])
  return <div className="apex-reveal" ref={hostRef}>
    <div className="apex-reveal-title"><span>APEX</span><span>ACADEMY</span></div>
    <canvas ref={canvasRef} className="apex-reveal-paint" aria-label="Move your cursor to paint and reveal the Formula racing car" />
  </div>
}

function TeamShowcase() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(0)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const distance = Math.max(1, rect.height - window.innerHeight)
      setPosition(Math.max(0, Math.min(teams.length - 1, -rect.top / distance * (teams.length - 1))))
    }
    const request = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  const index = Math.min(teams.length - 1, Math.floor(position))
  const nextIndex = Math.min(teams.length - 1, index + 1)
  const mix = position - index
  const current = teams[index]
  const next = teams[nextIndex]
  const fade = nextIndex === index ? 0 : Math.min(1, Math.max(0, (mix - .25) / .5))
  const displayedTeam = fade >= .5 ? next : current
  return <div className="apex-team-track" ref={trackRef} style={{ height: `${teams.length * 85}vh` }}>
    <section className="apex-team-sticky" aria-label="2026 Formula One teams" style={{ background: current.color, color: displayedTeam.ink }}>
      <div className="apex-team-next-bg" style={{ background: next.color, opacity: fade }}/>
      <div className="apex-team-content">
        <div className="apex-team-top"><span>THE 2026 GRID</span><span>{String(Math.round(position) + 1).padStart(2, '0')} / 11</span></div>
        <div className="apex-team-swap" key={index} style={{ opacity: 1 - fade, transform: `translateY(${-fade * 24}px)` }}>
          <div className="apex-team-logo-holder"><TeamLogo src={current.logo} name={current.short}/></div>
          <h2>{current.name.toUpperCase()}</h2>
          <CarArtwork src={current.car} name={current.name}/>
          <div className="apex-team-meta"><span>2026 CONSTRUCTORS</span><span>{current.drivers}</span></div>
        </div>
        {nextIndex !== index && <div className="apex-team-swap apex-team-overlay" style={{ opacity: fade, transform: `translateY(${(1 - fade) * 24}px)` }}>
          <div className="apex-team-logo-holder"><TeamLogo src={next.logo} name={next.short}/></div>
          <h2>{next.name.toUpperCase()}</h2>
          <CarArtwork src={next.car} name={next.name}/>
          <div className="apex-team-meta"><span>2026 CONSTRUCTORS</span><span>{next.drivers}</span></div>
        </div>}
        <div className="apex-team-progress"><div style={{ width: `${position / (teams.length - 1) * 100}%` }}/></div>
        <div className="apex-team-hint">SCROLL TO CHANGE TEAMS ↓</div>
      </div>
    </section>
  </div>
}
export default function Homepage({ onEnter }: { onEnter: () => void }) {
  return <div className="apex-home">
    <nav className="apex-nav"><a href="#top" className="apex-nav-brand">APEX<span>ACADEMY</span></a><span className="apex-nav-tag">LEARN THE LIMITS.</span><button onClick={onEnter}>ENTER ACADEMY ↗</button></nav>
    <section className="apex-hero" id="top">
      <div className="apex-hero-eyebrow">THE WORLD OF FORMULA RACING / 2026</div>
      <PaintReveal />
      <div className="apex-hero-bottom"><span>PAINT TO REVEAL THE GRID</span><a href="#grid-intro">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a></div>
    </section>
    <section className="apex-intro" id="grid-intro">
  <h1>11 TEAMS<span>.</span></h1>

  <p>
    Eleven identities. Eleven machines. One pursuit of speed.
    <br />
    Scroll to discover the teams defining the 2026 season.
  </p>
</section>
    <TeamShowcase />
    <DriversSection />
    <section className="apex-outro"><div className="apex-section-kicker">THE GRID IS ONLY THE BEGINNING</div><h2>DON'T JUST WATCH<br/>THE RACE.<br/><em>UNDERSTAND IT.</em></h2><p>Master the physics, decisions and split-second reactions behind racing.</p><button onClick={onEnter}>ENTER ACADEMY <span>↗</span></button><div className="apex-outro-footer">APEX ACADEMY © 2026 <span>AN INDEPENDENT EDUCATIONAL EXPERIENCE</span></div></section>
  </div>
}
