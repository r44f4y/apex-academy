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

// Display a recognizable car-shaped vector until you add real, transparent 2026 car PNGs.
function CarArtwork({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!failed) return <img className="apex-car-image" src={src} alt={`${name} 2026 Formula 1 car, side profile`} onError={() => setFailed(true)} />
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
  return failed ? <span className="apex-team-wordmark">{name}</span> : <img className="apex-team-logo" src={src} alt={`${name} logo`} onError={() => setFailed(true)} />
}
export default function Homepage({ onEnter }: { onEnter: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(0)
  const [pointer, setPointer] = useState({x:50,y:50,active:false})
  useEffect(() => {
    const update = () => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const distance = Math.max(1, rect.height - window.innerHeight)
      setPosition(Math.max(0,Math.min(teams.length-1, -rect.top/distance*(teams.length-1))))
    }
    update()
    window.addEventListener('scroll', update, {passive:true})
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll',update);window.removeEventListener('resize',update) }
  }, [])
  const index = Math.min(teams.length-1, Math.floor(position))
  const nextIndex = Math.min(teams.length-1,index+1)
  const mix = position-index
  const current = teams[index]
  const next = teams[nextIndex]
  const fade = nextIndex===index?0:Math.min(1,Math.max(0,(mix-.25)/.5))
  const displayedTeam = fade >= 0.5 ? next : current
  return <div className="apex-home">
    <nav className="apex-nav"><a href="#top" className="apex-nav-brand">APEX<span>ACADEMY</span></a><span className="apex-nav-tag">LEARN THE LIMITS.</span><button onClick={onEnter}>ENTER ACADEMY ↗</button></nav>
    <section className="apex-hero" id="top">
      <div className="apex-hero-eyebrow">THE WORLD OF FORMULA RACING / 2026</div>
      <div className="apex-reveal" onPointerMove={e=>{
        const r=e.currentTarget.getBoundingClientRect()
        setPointer({x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100,active:true})
      }} onPointerLeave={()=>setPointer(p=>({...p,active:false}))}>
        <div className="apex-reveal-title"><span>APEX</span><span>ACADEMY</span></div>
        <div className="apex-reveal-car" style={{clipPath:pointer.active?`circle(24% at ${pointer.x}% ${pointer.y}%)`:'circle(0% at 50% 50%)'}}>
          <div className="apex-reveal-backdrop"/>
          <CarArtwork src="/teams/hero-car.png" name="APEX Academy" />
          <div className="apex-reveal-car-label">PRECISION / PERFORMANCE / PASSION</div>
        </div>
      </div>
      <div className="apex-hero-bottom"><span>HOVER TO REVEAL THE MACHINE</span><a href="#grid-intro">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a></div>
    </section>
    <section className="apex-intro" id="grid-intro"><span className="apex-section-kicker">MEET THE 2026 GRID</span><h1>11 TEAMS<span>.</span><br/>22 DRIVERS<span>.</span><br/>ONE GRID<span>.</span></h1><p>Eleven identities. Eleven machines. One pursuit of speed.<br/>Scroll to discover the teams defining the 2026 season.</p><span className="apex-intro-arrow">↓</span></section>
    <div className="apex-team-track" ref={trackRef} style={{height:`${teams.length*85}vh`}}>
      <section
        className="apex-team-sticky"
        aria-label="2026 Formula One teams"
        style={{
        background: current.color,
        color: displayedTeam.ink
        }}
>
        <div className="apex-team-next-bg" style={{background:next.color,opacity:fade}}/>
        <div className="apex-team-content">
          <div className="apex-team-top"><span>THE 2026 GRID</span><span>{String(Math.round(position)+1).padStart(2,'0')} / 11</span></div>
          <div className="apex-team-swap" key={index} style={{opacity:1-fade,transform:`translateY(${-fade*24}px)`}}>
            <div className="apex-team-logo-holder"><TeamLogo src={current.logo} name={current.short}/></div>
            <h2>{current.name.toUpperCase()}</h2>
            <CarArtwork src={current.car} name={current.name}/>
            <div className="apex-team-meta"><span>2026 CONSTRUCTORS</span><span>{current.drivers}</span></div>
          </div>
          {nextIndex!==index&&<div className="apex-team-swap apex-team-overlay" style={{opacity:fade,transform:`translateY(${(1-fade)*24}px)`}}>
            <div className="apex-team-logo-holder"><TeamLogo src={next.logo} name={next.short}/></div>
            <h2>{next.name.toUpperCase()}</h2>
            <CarArtwork src={next.car} name={next.name}/>
            <div className="apex-team-meta"><span>2026 CONSTRUCTORS</span><span>{next.drivers}</span></div>
          </div>}
          <div className="apex-team-progress"><div style={{width:`${(position/(teams.length-1))*100}%`}}/></div>
          <div className="apex-team-hint">SCROLL TO CHANGE TEAMS ↓</div>
        </div>
      </section>
    </div>
    <DriversSection />
    <section className="apex-outro"><div className="apex-section-kicker">THE GRID IS ONLY THE BEGINNING</div><h2>DON'T JUST WATCH<br/>THE RACE.<br/><em>UNDERSTAND IT.</em></h2><p>Master the physics, decisions and split-second reactions behind racing.</p><button onClick={onEnter}>START LEVEL 01 — LIGHTS OUT <span>↗</span></button><div className="apex-outro-footer">APEX ACADEMY © 2026 <span>AN INDEPENDENT EDUCATIONAL EXPERIENCE</span></div></section>
  </div>
}
