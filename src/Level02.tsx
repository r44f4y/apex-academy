import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Level02Track3D, { TRACK, distanceToTrackCenter, type CarPose } from './Level02Track3D'
import { QualifyingEngineAudio } from './QualifyingEngineAudio.ts'
import './Level02.css'

type Props = { onBack: () => void }
type Session = 1 | 2 | 3
type Result = { name: string; time: number; player?: boolean }
type Game = CarPose & {
  lap: number; lapStart: number; best: number; last: number
  valid: boolean; nextGate: number; finished: boolean
  times: number[]; running: boolean
}
type Hud = { speed: number; lap: number; clock: number; best: number; valid: boolean; finished: boolean; times: number[] }
const names = [
  'Max Verstappen','Lando Norris','Charles Leclerc','George Russell','Oscar Piastri',
  'Lewis Hamilton','Kimi Antonelli','Isack Hadjar','Carlos Sainz','Fernando Alonso',
  'Alex Albon','Pierre Gasly','Liam Lawson','Oliver Bearman','Nico Hülkenberg',
  'Gabriel Bortoleto','Esteban Ocon','Franco Colapinto','Lance Stroll',
  'Valtteri Bottas','Sergio Pérez'
]
const format = (s: number) => Number.isFinite(s)
  ? `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}` : '--:--.---'
const init = (): Game => ({
  x: 205, y: 480, heading: -Math.PI / 2, speed: 0, steer: 0,
  lap: 1, lapStart: 0, best: Infinity, last: Infinity,
  valid: true, nextGate: 1, finished: false, times: [], running: false
})
const emptyHud = (): Hud => ({ speed: 0, lap: 1, clock: 0, best: Infinity, valid: true, finished: false, times: [] })
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x,a.y-b.y)
function generateTimes(participants: string[], session: Session): Result[] {
  // Balanced against a typical player lap around 9 seconds.
  // These are gameplay targets, not real-world F1 lap times.
  const ranges: Record<Session, [number, number]> = {
    1: [9.15, 10.85],
    2: [8.95, 10.00],
    3: [8.75, 9.55],
  }
  const [fastest, slowest] = ranges[session]
  return participants.map(name => {
    const rank = names.indexOf(name) / Math.max(1, names.length - 1)
    const variation = (Math.random() - 0.5) * 0.20
    const time = Math.max(fastest, Math.min(slowest, fastest + rank * (slowest - fastest) + variation))
    return { name, time: Math.round(time * 1000) / 1000 }
  })
}
function standings(ai: Result[], best: number): Result[] {
  return [...ai, {name: 'YOU', time: best, player: true}].sort((a,b) => a.time - b.time)
}

export default function Level02({ onBack }: Props) {
  const [session, setSession] = useState<Session>(1)
  const [participants, setParticipants] = useState<string[]>(names)
  const [ai, setAi] = useState<Result[]>(() => generateTimes(names, 1))
  const [showIntro, setShowIntro] = useState(true)
  const [muted, setMuted] = useState(false)
  const [hud, setHud] = useState<Hud>(emptyHud)
  const game = useRef<Game>(init())
  const pose = useRef<CarPose>({x:205,y:480,heading:-Math.PI/2,speed:0,steer:0})
  const keys = useRef(new Set<string>())
  const steering = useRef(0)
  const engine = useRef<QualifyingEngineAudio | null>(null)
  const ghostClock = useRef(0)

  const resetCar = useCallback(() => {
    game.current = init()
    pose.current = {x:205,y:480,heading:-Math.PI/2,speed:0,steer:0}
    steering.current = 0
    ghostClock.current = 0
    keys.current.clear()
    setHud(emptyHud())
  }, [])
  const begin = useCallback(() => {
    resetCar()
    setShowIntro(false)
    if (!muted) {
      if (!engine.current) engine.current = new QualifyingEngineAudio()
      void engine.current.start()
    }
  }, [resetCar, muted])
  const retry = useCallback(() => {
    engine.current?.stop()
    engine.current = null
    setSession(1)
    setParticipants(names)
    setAi(generateTimes(names, 1))
    ghostClock.current = 0
    resetCar()
    setShowIntro(true)
  }, [resetCar])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault()
        keys.current.add(e.code)
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown',down)
    window.addEventListener('keyup',up)
    window.addEventListener('blur',blur)
    return () => {
      window.removeEventListener('keydown',down)
      window.removeEventListener('keyup',up)
      window.removeEventListener('blur',blur)
    }
  }, [])
  useEffect(() => () => { engine.current?.stop(); engine.current = null }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastHud = 0
    function frame(now: number) {
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now
      const g = game.current
      const k = keys.current
      const accel = k.has('KeyW') || k.has('ArrowUp')
      const brake = k.has('KeyS') || k.has('ArrowDown')
      if (!showIntro && !g.finished) {
        if (!g.running && (accel || brake)) {
          g.running = true
          g.lapStart = now / 1000
        }
        if (g.running) {
          g.speed = Math.max(0, Math.min(235, g.speed + (accel ? 105 : brake ? -190 : -58) * dt))
          const steer = Number(k.has('KeyD') || k.has('ArrowRight')) -
            Number(k.has('KeyA') || k.has('ArrowLeft'))
          // More responsive steering with smoother centering
const response = 1 - Math.exp(-(steer === 0 ? 9.0 : 6.0) * dt)

steering.current += (steer - steering.current) * response

// Easier turning at low and high speeds
const speedFactor = Math.min(1, g.speed / 35)

const turnRate =
  (1.55 - 0.65 * Math.min(1, g.speed / 235)) * speedFactor

g.heading += steering.current * turnRate * dt
          g.x += Math.cos(g.heading) * g.speed * dt * 0.86
          g.y += Math.sin(g.heading) * g.speed * dt * 0.86
          if (distanceToTrackCenter(g.x,g.y) > 6.95) {
            g.valid = false
            g.speed = Math.min(g.speed, 75)
          }
          if (distance(g, TRACK[g.nextGate]) < 72) {
            if (g.nextGate === 0) {
              const lapTime = now / 1000 - g.lapStart
              if (lapTime > 5) {
                g.times.push(g.valid ? lapTime : Infinity)
                g.last = lapTime
                if (g.valid) {
                  g.best = Math.min(g.best,lapTime)

                }
                g.lap++
                g.lapStart = now / 1000
                g.valid = true
                if (g.lap > 3) g.finished = true
              }
              g.nextGate = 1
            } else {
              g.nextGate = (g.nextGate + 1) % TRACK.length
            }
          }
        }
      }
      ghostClock.current = g.running && !g.finished ? Math.max(0, now / 1000 - g.lapStart) : 0
      engine.current?.update(g.speed, !showIntro && !g.finished && accel,
        !showIntro && !g.finished && brake, dt)
      if (g.finished) engine.current?.setMuted(true)
      pose.current.x = g.x
      pose.current.y = g.y
      pose.current.heading = g.heading
      pose.current.speed = g.speed
      pose.current.steer = steering.current
      if (now - lastHud > 75) {
        lastHud = now
        setHud({
          speed: g.speed, lap: g.lap,
          clock: g.running ? (g.finished ? g.last : now / 1000 - g.lapStart) : 0,
          best: g.best, valid: g.valid, finished: g.finished, times: [...g.times]
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [showIntro, participants, session])

  const board = useMemo(() => standings(ai, hud.best), [ai, hud.best])
  const pole = ai.reduce<Result | null>((best, r) => !best || r.time < best.time ? r : best, null)
  const place = board.findIndex(row => row.player) + 1
  const cutoff = session === 1 ? 16 : session === 2 ? 10 : 1
  const advanced = Number.isFinite(hud.best) && place <= cutoff
  const nextSession = () => {
    if (session === 3 || !advanced) return
    const survivors = board.slice(0, cutoff).map(row => row.name).filter(name => name !== 'YOU')
    const next = (session + 1) as Session
    setParticipants(survivors)
    setAi(generateTimes(survivors, next))
    setSession(next)
    resetCar()
    engine.current?.setMuted(false)
    if (muted) engine.current?.setMuted(true)
  }
  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    if (!next && !showIntro && !hud.finished) {
      if (!engine.current) engine.current = new QualifyingEngineAudio()
      void engine.current.start()
    }
    engine.current?.setMuted(next)
  }

  return <main className="fl-page">
    <header className="fl-header">
      <button onClick={onBack}>← ACADEMY HUB</button>
      <strong>APEX <em>ACADEMY</em></strong>
      <span>LEVEL 02 / THE FLYING LAP / Q{session}</span>
    </header>
    <section className="fl-layout">
      <div className="fl-game">
        <div className="fl-hud">
          <div><small>SESSION</small><b>Q{session}</b></div>
          <div><small>LAP</small><b>{Math.min(hud.lap,3)} / 3</b></div>
          <div><small>CURRENT</small><b>{format(hud.clock)}</b></div>
          <div><small>BEST VALID</small><b>{format(hud.best)}</b></div>
          <div><small>GHOST P1</small><b>{format(pole?.time ?? Infinity)}</b></div>
          <div><small>SPEED</small><b>{Math.round(hud.speed)} <small>KM/H</small></b></div>
        </div>
        <div className="fl-3d-viewport">
          <Level02Track3D pose={pose} ghostClock={ghostClock} ghostLapTime={pole?.time ?? 0} />
          {!showIntro && !hud.finished && pole && <div className="fl-ghost-gap">
            <span>◈ P1 GHOST · {pole.name}</span>
            <strong>{hud.clock > 0 ? `${Math.max(0, pole.time - hud.clock).toFixed(3)}s LEFT` : 'CHASE THE GHOST'}</strong>
            <small>Time remaining to beat P1; ghost shows track position</small>
          </div>}
          {!hud.valid && !hud.finished && <div className="fl-track-warning">LAP INVALID — TRACK LIMITS</div>}
        </div>
        <div className="fl-controls">
          <span>W ACCELERATE · S BRAKE · A / D STEER</span>
          <button type="button" onClick={toggleSound}>{muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}</button>
          <span>{hud.valid ? 'TRACK LIMITS OK' : 'LAP INVALID'}</span>
        </div>
      </div>
      <aside className="fl-board">
        <p>QUALIFYING CLASSIFICATION / Q{session}</p>
        <h2>LIVE TIMING</h2>
        <p>{participants.length + 1} DRIVERS · {session === 3 ? 'P1 TAKES POLE' : `TOP ${cutoff} ADVANCE`}</p>
        {pole && <p>GHOST TARGET: {pole.name} · {format(pole.time)}</p>}
        <div className="fl-board-rows">
          {board.map((r,i) => <div key={r.name} className={r.player ? 'fl-you' : ''}>
            <span>{String(i+1).padStart(2,'0')}</span>
            <strong>{r.name}</strong><span>{format(r.time)}</span>
          </div>)}
        </div>
        <small>AI TIMES ARE SIMULATED FOR THIS TRAINING SESSION.</small>
      </aside>
    </section>
    {showIntro && (
  <div className="fl-modal">
    <div className="qualifying-intro">

      <div className="qualifying-kicker">
        APEX ACADEMY / LEVEL 02
      </div>

      <h1>THE FLYING LAP<span>.</span></h1>

      <p className="qualifying-subtitle">
        Three sessions. Three laps each.
        <strong> One goal: pole position.</strong>
      </p>

      <div className="qualifying-stages">
        <div>
          <span>SESSION 01</span>
          <h2>Q1</h2>
          <strong>22 → 16</strong>
          <p>Survive the first cut.</p>
        </div>

        <div>
          <span>SESSION 02</span>
          <h2>Q2</h2>
          <strong>16 → 10</strong>
          <p>Make it into the top 10.</p>
        </div>

        <div>
          <span>SESSION 03</span>
          <h2>Q3</h2>
          <strong>POLE</strong>
          <p>Fight for P1.</p>
        </div>
      </div>

      <div className="qualifying-controls">
        <strong>DRIVING CONTROLS</strong>

        <div>
          <span><b>W</b> Throttle</span>
          <span><b>S</b> Brake</span>
          <span><b>A / D</b> Steering</span>
        </div>
      </div>

      <p className="qualifying-note">
        Your fastest valid lap counts in each session.
      </p>

      <button
        className="qualifying-start-button"
        onClick={begin}
      >
        START Q1 →
      </button>

    </div>
  </div>
)}
    {hud.finished && <div className="fl-modal"><div>
      <span>Q{session} / SESSION COMPLETE</span>
      <h1>{session === 3 ? (place === 1 ? 'POLE POSITION!' : `QUALIFIED P${place}`) : advanced ? `THROUGH TO Q${session+1}!` : 'ELIMINATED.'}</h1>
      <p>Position: <b>P{place} / {board.length}</b> · Best valid lap: <b>{format(hud.best)}</b></p>
      <p>{hud.times.map((t,i) => `LAP ${i+1}: ${format(t)}`).join(' · ')}</p>
      {session < 3 && advanced && <button onClick={nextSession}>START Q{session+1} →</button>}
      <button onClick={retry}>{session === 3 ? 'RESTART QUALIFYING ↻' : 'RETRY FROM Q1 ↻'}</button>
      <button className="fl-secondary" onClick={onBack}>BACK TO ACADEMY</button>
    </div></div>}
  </main>
}
