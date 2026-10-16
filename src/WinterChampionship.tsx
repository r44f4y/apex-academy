import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import './SeasonsChampionship.css'
import type { RaceResult } from './ChampionshipStandings'
import { RaceAudio } from './RaceAudio'

type Props = { onBack: () => void; onNextSeason?: () => void; onRaceComplete?: (results: RaceResult[]) => void }
type Phase = 'intro' | 'lights' | 'racing' | 'results'
type Driver = { name: string; color: string; pace: number; offset: number }
type AIState = Driver & { progress: number; lateral: number; speed: number; finishTime: number | null; hitCooldown: number }
type State = { progress: number; speed: number; lateral: number; lap: number; elapsed: number; heat: number; hazard: boolean; finished: boolean; offroad: boolean; heading: number; worldX: number; worldZ: number }

const WAYPOINTS: [number, number][] = [
  [-52,-13],[-42,-39],[-15,-46],[7,-32],[29,-47],[52,-26],[46,1],[59,21],[34,42],[7,35],[-15,52],[-43,31],[-57,8]
]
const TRACK_CURVE = new THREE.CatmullRomCurve3(WAYPOINTS.map(([x,z]) => new THREE.Vector3(x,0,z)), true, 'catmullrom', 0.28)
const TRACK_LENGTH = TRACK_CURVE.getLength()
const ROAD_WIDTH = 14
const TOTAL_DRIVERS = 15
const MAX_SPEED = 22.8
const LAPS = 5
const AI_NAMES = [
  'Max Verstappen','Lando Norris','Charles Leclerc','George Russell','Oscar Piastri',
  'Lewis Hamilton','Kimi Antonelli','Carlos Sainz','Fernando Alonso','Alex Albon',
  'Pierre Gasly','Isack Hadjar','Liam Lawson','Oliver Bearman'

]
const AI_COLORS = ['#2b4dce','#ff8b23','#ef414a','#23a5b9','#f6ae2d','#e33b54','#2f7ed8','#e7e7e7']
const DRIVERS: Driver[] = AI_NAMES.map((name, i) => ({
  name, color: AI_COLORS[i % AI_COLORS.length],
  pace: 17.8 + (14 - i) * 0.12, offset: ((i % 3) - 1) * 2.3
}))
const GRID_SPACING = 5.8
const randomGridPosition = () => Math.floor(Math.random() * TOTAL_DRIVERS) + 1
const freshAI = (playerGrid: number): AIState[] => DRIVERS.map((d,i) => {
  const gridSlot = i + 1 >= playerGrid ? i + 2 : i + 1
  return {...d, progress: (TOTAL_DRIVERS-gridSlot)*GRID_SPACING, lateral: d.offset, speed: 0, finishTime: null, hitCooldown: 0}
})
const fresh = (playerGrid = 8): State => {
  const progress = (TOTAL_DRIVERS-playerGrid)*GRID_SPACING
  const {p,tangent} = pointAt(progress)
  return {progress, speed:0, lateral:0, lap:1, elapsed:0, heat:0, hazard:false, finished:false, offroad:false,
    heading:Math.atan2(tangent.x,tangent.z), worldX:p.x, worldZ:p.z}
}
const timeString = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`
const pointAt = (progress: number, offset = 0) => {
  const t = ((progress / TRACK_LENGTH) % 1 + 1) % 1
  const p = TRACK_CURVE.getPointAt(t)
  const tangent = TRACK_CURVE.getTangentAt(t).normalize()
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
  return { p: p.addScaledVector(normal, offset), tangent }
}

// Project the freely driven car onto the circuit for lap timing, hazards and AI contact.
function projectToTrack(x:number,z:number, previousProgress:number) {
  let bestD=Infinity, bestT=0, bestLateral=0
  for(let i=0;i<480;i++) {
    const t=i/480, center=TRACK_CURVE.getPointAt(t)
    const dx=x-center.x, dz=z-center.z, d=dx*dx+dz*dz
    if(d<bestD) {
      bestD=d; bestT=t
      const tangent=TRACK_CURVE.getTangentAt(t).normalize()
      bestLateral=dx*(-tangent.z)+dz*tangent.x
    }
  }
  const previousLap=Math.floor(previousProgress/TRACK_LENGTH)
  const candidate=bestT*TRACK_LENGTH
  const options=[previousLap-1,previousLap,previousLap+1].map(l=>candidate+l*TRACK_LENGTH)
  const progress=options.reduce((a,b)=>Math.abs(b-previousProgress)<Math.abs(a-previousProgress)?b:a)
  return {progress,lateral:bestLateral,distance:Math.sqrt(bestD),center:TRACK_CURVE.getPointAt(bestT),tangent:TRACK_CURVE.getTangentAt(bestT).normalize()}
}
function TrackRibbon({ offsetA, offsetB, color, height = 0.02 }: { offsetA: number; offsetB: number; color: string; height?: number }) {
  const geometry = useMemo(() => {
    const vertices: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= 400; i++) {
      const t = i / 400
      const center = TRACK_CURVE.getPointAt(t)
      const tangent = TRACK_CURVE.getTangentAt(t).normalize()
      const normal = new THREE.Vector3(-tangent.z,0,tangent.x)
      for (const offset of [offsetA,offsetB]) {
        const v = center.clone().addScaledVector(normal,offset)
        vertices.push(v.x,height,v.z)
      }
      if (i < 400) { const k = i*2; indices.push(k,k+1,k+2,k+1,k+3,k+2) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  },[offsetA,offsetB,height])
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.95}/></mesh>
}
function TrackGuardrail({ offset }: { offset:number }) {
  const geometry=useMemo(()=>{
    const vertices:number[]=[]
    const indices:number[]=[]
    for(let i=0;i<=400;i++){
      const t=i/400
      const center=TRACK_CURVE.getPointAt(t)
      const tangent=TRACK_CURVE.getTangentAt(t).normalize()
      const normal=new THREE.Vector3(-tangent.z,0,tangent.x)
      const p=center.addScaledVector(normal,offset)
      vertices.push(p.x,0.12,p.z,p.x,1.05,p.z)
      if(i<400){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
    }
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  },[offset])
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color="#d9dce0" metalness={0.6} roughness={0.4} side={THREE.DoubleSide}/>
  </mesh>
}
// Only the player uses the imported Formula car asset.
function PlayerModel({ contaminated }: { contaminated: boolean }) {
  const { scene } = useGLTF('/models/formula-car/formula-car/scene.gltf')
  const model = useMemo(() => {
    const root = scene.clone(true)
    root.rotation.y = 0 // Previously PI, causing the car to appear reversed.
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
    root.scale.setScalar(4.5 / Math.max(size.x, size.z, 0.001))
    const bounds = new THREE.Box3().setFromObject(root)
    const center = bounds.getCenter(new THREE.Vector3())
    root.position.set(-center.x, -bounds.min.y + 0.07, -center.z)
    return root
  }, [scene])
  return <group><primitive object={model}/>{contaminated && [-0.85,0.85].map(x=><mesh key={x} rotation={[-Math.PI/2,0,0]} position={[x,0.9,1.1]}>
    <circleGeometry args={[0.32,16]}/><meshBasicMaterial color="#bd6421" depthTest={false}/>
  </mesh>)}<pointLight color="#f23c50" intensity={2} distance={6} position={[0,1.8,0]}/></group>
}

// Lightweight, boxy AI cars: no GLTF loading for the 14 opponents.
function BoxyAIModel({ color }: { color: string }) {
  return <group>
    <mesh position={[0,0.42,0]} castShadow>
      <boxGeometry args={[1.45,0.38,3.65]}/>
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.5}/>
    </mesh>
    <mesh position={[0,0.72,-0.1]} castShadow>
      <boxGeometry args={[0.88,0.43,1.15]}/>
      <meshStandardMaterial color="#181b23" roughness={0.6}/>
    </mesh>
    {[-0.9,0.9].map(x=>[-1.15,1.15].map(z=><mesh key={`${x}-${z}`} position={[x,0.32,z]}>
      <boxGeometry args={[0.42,0.57,0.72]}/>
      <meshStandardMaterial color="#111115" roughness={0.95}/>
    </mesh>))}
    <mesh position={[0,0.73,-1.52]} castShadow>
      <boxGeometry args={[2.05,0.14,0.35]}/>
      <meshStandardMaterial color={color}/>
    </mesh>
    <mesh position={[0,0.42,1.65]} castShadow>
      <boxGeometry args={[1.8,0.12,0.32]}/>
      <meshStandardMaterial color={color}/>
    </mesh>
  </group>
}
function MovingCar({ driver, player = false, game, contaminated = false }: { driver?: AIState; player?: boolean; game?: React.RefObject<State>; contaminated?: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const progress = player ? game!.current.progress : driver!.progress
    const lateral = player ? game!.current.lateral : driver!.lateral
    const {p,tangent} = pointAt(progress,lateral)
    group.current.position.set(player ? game!.current.worldX : p.x,0.13,player ? game!.current.worldZ : p.z)
    group.current.rotation.y = player ? game!.current.heading : Math.atan2(tangent.x,tangent.z)
  })
  return <group ref={group}>{player ? <Suspense fallback={null}><PlayerModel contaminated={contaminated}/></Suspense> : <BoxyAIModel color={driver?.color ?? '#ed1737'}/> }</group>
}
function CameraRig({ game }: { game: React.RefObject<State> }) {
  const { camera } = useThree()
  useFrame((_,dt) => {
    const g=game.current
    const forward=new THREE.Vector3(Math.sin(g.heading),0,Math.cos(g.heading))
    const p=new THREE.Vector3(g.worldX,0,g.worldZ)
    const target=p.clone().addScaledVector(forward,-8.8).add(new THREE.Vector3(0,3.7,0))
    camera.position.lerp(target,1-Math.exp(-6*dt))
    camera.lookAt(p.clone().addScaledVector(forward,12).add(new THREE.Vector3(0,1.1,0)))
  })
  return null
}
function FallingRain({particles}: {particles: {x:number;z:number;y:number;phase:number;speed:number}[]}) {
  const group = useRef<THREE.Group>(null)
  useFrame(({clock}) => {
    if (!group.current) return
    const t=clock.getElapsedTime()
    group.current.children.forEach((leaf,i)=>{
      const p=particles[i]
      leaf.position.set(p.x+Math.sin(t*1.3+p.phase)*0.7, 0.4+((p.y-t*(p.speed*22))%12+12)%12, p.z+Math.cos(t*1.5+p.phase)*0.7)
      leaf.rotation.set(0,0,-0.15)
    })
  })
  return <group ref={group}>{particles.map((p,i)=><mesh key={i} position={[p.x,p.y,p.z]}>
    <planeGeometry args={[0.035,0.75]}/><meshBasicMaterial color={'#b8dff9'} transparent opacity={0.68} side={THREE.DoubleSide}/>
  </mesh>)}</group>
}
function WinterWorld({ game, ai, rain }: { game: React.RefObject<State>; ai: React.RefObject<AIState[]>; rain: boolean }) {
  const trees = useMemo(() => Array.from({length:185},(_,i) => {
    const x = ((i*31.77+13)%240)-120, z = ((i*49.33+17)%220)-110
    const near = Array.from({length:180},(_,j)=>TRACK_CURVE.getPointAt(j/180)).some(p=>Math.hypot(p.x-x,p.z-z)<12)
    return {x,z,near,s:0.8+(i%5)*0.21, shade:i%4}
  }).filter(r=>!r.near),[])
  const leafParticles = useMemo(() => Array.from({length:320},(_,i)=>({
    x:((i*17.37)%145)-72, z:((i*29.91)%145)-72, y:2+(i%11)*0.6,
    phase:i*1.73, speed:0.3+(i%5)*0.11
  })),[])
  return <>
    <color attach="background" args={['#7c8b9c']}/>
    <fog attach="fog" args={['#7c8b9c',90,240]}/>
    <ambientLight intensity={1.3}/>
    <hemisphereLight args={['#c6dcf3','#546474',1.25]}/>
    <directionalLight position={[40,75,-20]} intensity={1.8} castShadow shadow-mapSize={[1024,1024]}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.12,0]} receiveShadow><planeGeometry args={[700,700]}/><meshStandardMaterial color="#586642" roughness={1}/></mesh>
    <TrackRibbon offsetA={-ROAD_WIDTH/2-1.8} offsetB={ROAD_WIDTH/2+1.8} color="#82765c"/>
    <TrackRibbon offsetA={-ROAD_WIDTH/2} offsetB={ROAD_WIDTH/2} color={rain ? "#526e80" : "#35393b"} height={0.04}/>
    <TrackRibbon offsetA={-ROAD_WIDTH/2} offsetB={-ROAD_WIDTH/2+0.25} color="#f4ece3" height={0.055}/>
    <TrackRibbon offsetA={ROAD_WIDTH/2-0.25} offsetB={ROAD_WIDTH/2} color="#f4ece3" height={0.055}/>
    <TrackGuardrail offset={-ROAD_WIDTH/2}/>
    <TrackGuardrail offset={ROAD_WIDTH/2}/>
    {/* High-contrast start/finish stripe across the road at progress zero. */}
    {(() => {
      const {p,tangent}=pointAt(0)
      return <group position={[p.x,0.085,p.z]} rotation={[0,Math.atan2(tangent.x,tangent.z),0]}>
        <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
          <planeGeometry args={[ROAD_WIDTH-0.6,1.4]}/>
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide}/>
        </mesh>
        {Array.from({length:14},(_,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[-ROAD_WIDTH/2+0.7+i*0.96,0.012,0]}>
          <planeGeometry args={[0.48,0.7]}/>
          <meshBasicMaterial color="#1a1a1d" side={THREE.DoubleSide}/>
        </mesh>)}
      </group>
    })()}
    {trees.map((r,i)=><group key={i} position={[r.x,0,r.z]} scale={r.s}>
      <mesh position={[0,1.6,0]} castShadow><cylinderGeometry args={[0.23,0.36,3.2,6]}/><meshStandardMaterial color="#4b3021"/></mesh>
      <mesh position={[0,4.1,0]} castShadow><coneGeometry args={[1.65,4.5,7]}/><meshStandardMaterial color={['#b9cbd1','#b1c6d4','#d5e3e7','#93aebd'][r.shade]}/></mesh>
      <mesh position={[0,5.65,0]} castShadow><coneGeometry args={[1.1,2.8,7]}/><meshStandardMaterial color={['#dbe6ea','#b3d0dd','#eff4f7','#a4bfcf'][r.shade]}/></mesh>
    </group>)}
    {rain && <FallingRain particles={leafParticles}/>}
    {ai.current.map(driver=><MovingCar key={driver.name} driver={driver}/>)}
    <MovingCar game={game} player/>
    <CameraRig game={game}/>
  </>
}

export default function WinterChampionship({onBack,onNextSeason,onRaceComplete}: Props) {
  const [phase,setPhase] = useState<Phase>('intro')
  const [lights,setLights] = useState(0)
  const [gridPosition,setGridPosition] = useState(12)
  const [hud,setHud] = useState(() => fresh(12))
  const game = useRef<State>(fresh(12))
  const ai = useRef<AIState[]>(freshAI(12))
  const keys = useRef(new Set<string>())
  const audio = useRef<RaceAudio | null>(null)
  const lastAudioHazard = useRef(false)
  const lastAudioWall = useRef(false)
  const lastAudioRain = useRef(false)
  useEffect(() => () => { audio.current?.stop(); audio.current = null }, [])

  const sideContactTimers = useRef(new WeakMap<object, number>())
  const sideContactCooldowns = useRef(new Map<string, number>())
  const [rain,setRain] = useState(false)
  const rainRef = useRef(false)
  // Angular momentum builds up on the wet surface; braking restores control.
  const yawVelocity = useRef(0)
  const rainStart = useRef(0)
  const [violations,setViolations] = useState(0)
  const violationRef = useRef(0)
  const [finishTime,setFinishTime] = useState(0)
  const [finalBoard,setFinalBoard] = useState<{name:string;time:number}[]>([])
  const start = useCallback(() => {
    if (!audio.current) audio.current = new RaceAudio('winter')
    audio.current.start()
    audio.current.resetStart()
    lastAudioHazard.current=false
    lastAudioWall.current=false
    lastAudioRain.current=false
    const nextGrid = randomGridPosition()
    setGridPosition(nextGrid)
    game.current=fresh(nextGrid);ai.current=freshAI(nextGrid);keys.current.clear();sideContactTimers.current=new WeakMap();sideContactCooldowns.current.clear()
    rainRef.current=false;setRain(false);yawVelocity.current=0
    rainStart.current=0.20+Math.random()*0.35
    violationRef.current=0;setViolations(0)
    setHud(fresh(nextGrid));setFinishTime(0);setFinalBoard([]);setLights(0);setPhase('lights')
  },[])
  useEffect(()=>{
    if(phase!=='lights')return
    const begun=performance.now()
    let raf=0
    const tick=(now:number)=>{
      const elapsed=(now-begun)/1000
      const n=Math.min(5,Math.floor(elapsed/0.7)+1)
      audio.current?.light(n)
      setLights(previous=>previous===n?previous:n)
      if(elapsed>=4.25){audio.current?.lightsOut();setLights(0);setPhase('racing')}
      else raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
  },[phase])
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.current.add(e.code)}}
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code)
    const blur=()=>keys.current.clear()
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur)
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}
  },[])
  useEffect(()=>{
    if(phase!=='racing')return
    let raf=0,last=performance.now(),lastHud=0
    const frame=(now:number)=>{
      const dt=Math.min((now-last)/1000,0.04);last=now
      const g=game.current,k=keys.current
      g.elapsed+=dt
      const accel=k.has('KeyW')||k.has('ArrowUp')
      const brake=k.has('KeyS')||k.has('ArrowDown')
      const steer=Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft'))
      audio.current?.engineSpeed(g.speed, accel)
      const previous=g.progress
      // Rain begins at a randomized point in the race and stays active.
      if(!rainRef.current && g.progress >= TRACK_LENGTH*LAPS*rainStart.current) {
        rainRef.current=true
        audio.current?.setRain(true)
        setRain(true)
      }
      // Rain never changes engine speed, acceleration, or braking power.
      const target=accel?MAX_SPEED:brake?0:Math.max(0,g.speed-7*dt)
      const acceleration=accel?10.8:brake?22:7
      g.speed+=Math.sign(target-g.speed)*Math.min(Math.abs(target-g.speed),acceleration*dt)
      // Dry: immediate, predictable response. Wet: high-speed steering builds
      // angular momentum and continues rotating briefly after releasing A/D.
      // Slowing before corners dramatically reduces the amount of oversteer.
      const dryTurnRate=0.48+Math.min(g.speed,24)*0.037
      if (rainRef.current) {
        const speedRatio=Math.min(1,g.speed/MAX_SPEED)
        const oversteerGain=0.85+2.35*speedRatio*speedRatio
        const desiredYaw=-steer*dryTurnRate*oversteerGain
        const gripRecovery=2.2+9.5*(1-speedRatio)*(1-speedRatio)
        yawVelocity.current+=(desiredYaw-yawVelocity.current)*(1-Math.exp(-gripRecovery*dt))
        if (brake) yawVelocity.current*=Math.exp(-3.0*dt)
        g.heading+=yawVelocity.current*dt
      } else {
        yawVelocity.current=0
        g.heading-=steer*dryTurnRate*dt
      }
      const move=g.speed*dt
      g.worldX += Math.sin(g.heading)*move
      g.worldZ += Math.cos(g.heading)*move
      const projected=projectToTrack(g.worldX,g.worldZ,g.progress)
      // Solid track boundary: constrain the PLAYER CAR CENTER inside the guardrails.
      // Apply the 25% impact penalty once on contact, not on every animation frame.
      const safeHalfWidth=ROAD_WIDTH/2-1.05
      const hitWall=Math.abs(projected.lateral)>safeHalfWidth
      if(hitWall) {
        const normalX=-projected.tangent.z
        const normalZ=projected.tangent.x
        const limited=THREE.MathUtils.clamp(projected.lateral,-safeHalfWidth,safeHalfWidth)
        g.worldX=projected.center.x+normalX*limited
        g.worldZ=projected.center.z+normalZ*limited
        if(!g.offroad) {
          g.speed*=0.75
          violationRef.current++
          setViolations(violationRef.current)
        }
      }
      g.progress=projected.progress
      g.lateral=THREE.MathUtils.clamp(projected.lateral,-safeHalfWidth,safeHalfWidth)
      g.offroad=hitWall
      if (hitWall && !lastAudioWall.current) audio.current?.impact()
      lastAudioWall.current=hitWall
      if (rainRef.current && Math.abs(steer)>0 && g.speed>11) {
        audio.current?.slip(Math.abs(steer)*g.speed/22)
      }
      g.hazard=rainRef.current
      g.heat=0
      // AI steering: avoid leaf piles, nearby cars, and the player.
      for(let i=0;i<ai.current.length;i++){
        const bot=ai.current[i]
        if(bot.finishTime!==null)continue
        let desired=bot.offset
        const nearby=[...ai.current.slice(0,i),...ai.current.slice(i+1)]
        for(const other of nearby){
          const gap=other.progress-bot.progress
          if(gap>0 && gap<9 && Math.abs(other.lateral-desired)<2.8){
            desired=other.lateral<=0?3.5:-3.5
            break
          }
        }
        const playerGap=g.progress-bot.progress
        if(playerGap>0 && playerGap<9 && Math.abs(g.lateral-desired)<2.8){
          desired=g.lateral<=0?3.6:-3.6
        }
        bot.lateral+=Math.max(-dt*3.7,Math.min(dt*3.7,desired-bot.lateral))
        const botOffroad=Math.abs(bot.lateral)>ROAD_WIDTH/2-0.5
        const targetSpeed=Math.max(9,bot.pace-(botOffroad?5:0))
        bot.speed+=Math.sign(targetSpeed-bot.speed)*Math.min(Math.abs(targetSpeed-bot.speed),dt*9)
        bot.progress+=bot.speed*dt
        if(bot.progress>=LAPS*TRACK_LENGTH){
          bot.finishTime=g.elapsed-(bot.progress-LAPS*TRACK_LENGTH)/Math.max(bot.speed,1)
        }
      }
      // Resolve vehicle contact after movement. Side-swipes separate laterally
      // immediately and apply a brief ONE-SECOND slowdown, without repeated
      // collision penalties that make adjacent cars stick together.
      type ContactCar = { progress: number; lateral: number; speed: number; finishTime?: number | null }
      const vehicles: ContactCar[] = [g, ...ai.current.filter(bot => bot.finishTime === null)]
      const CAR_LENGTH = 4.6
      const CAR_WIDTH = 2.0
      const EDGE = ROAD_WIDTH / 2 - 1.05
      const contactTimers = sideContactTimers.current
      const contactCooldowns = sideContactCooldowns.current
      for (const car of vehicles) {
        const remaining = Math.max(0, (contactTimers.get(car) ?? 0) - dt)
        contactTimers.set(car, remaining)
        if (remaining > 0) car.speed = Math.min(car.speed, car === g ? MAX_SPEED * 0.78 : 16)
      }
      for (const [pair, time] of contactCooldowns) {
        if (time <= dt) contactCooldowns.delete(pair)
        else contactCooldowns.set(pair, time - dt)
      }
      const contact = (a: ContactCar, b: ContactCar, i: number, j: number) => {
        const longitudinal = a.progress - b.progress
        const sideways = a.lateral - b.lateral
        if (Math.abs(longitudinal) >= CAR_LENGTH || Math.abs(sideways) >= CAR_WIDTH) return
        const sidewaysOverlap = CAR_WIDTH - Math.abs(sideways)
        const forwardOverlap = CAR_LENGTH - Math.abs(longitudinal)
        const pair = `${i}:${j}`
        const sideBySide = Math.abs(longitudinal) < CAR_LENGTH * 0.75 &&
          sidewaysOverlap < forwardOverlap * 1.5

        if (sideBySide) {
          // Push apart in the lane direction. At a wall, give the available
          // space to the other car rather than repeatedly clamping both.
          const sign = sideways > 0 ? 1 : sideways < 0 ? -1 : (i % 2 ? -1 : 1)
          const separation = sidewaysOverlap + 0.20
          const aRoom = sign > 0 ? EDGE - a.lateral : a.lateral + EDGE
          const bRoom = sign > 0 ? b.lateral + EDGE : EDGE - b.lateral
          const aShift = Math.min(Math.max(0, aRoom), separation / 2)
          const bShift = Math.min(Math.max(0, bRoom), separation - aShift)
          const extra = Math.min(Math.max(0, aRoom - aShift), separation - aShift - bShift)
          a.lateral = THREE.MathUtils.clamp(a.lateral + sign * (aShift + extra), -EDGE, EDGE)
          b.lateral = THREE.MathUtils.clamp(b.lateral - sign * bShift, -EDGE, EDGE)

          // A small longitudinal nudge breaks ties when there is no room
          // sideways, preventing a multi-second wheel-to-wheel lock.
          if (aShift + bShift + extra < separation - 0.02) {
            if (longitudinal >= 0) a.progress += 0.12
            else b.progress += 0.12
          }
          if (!contactCooldowns.has(pair)) {
            if (a === g || b === g) audio.current?.impact()
            a.speed *= 0.86
            b.speed *= 0.86
            contactTimers.set(a, 1)
            contactTimers.set(b, 1)
            contactCooldowns.set(pair, 1.25)
          }
          return
        }
        // Rear-end contact remains blocking, but no lateral glue.
        if ((a === g || b === g) && !contactCooldowns.has(pair)) {
          audio.current?.impact()
          contactCooldowns.set(pair, 0.65)
        }
        const leader = longitudinal >= 0 ? a : b
        const follower = longitudinal >= 0 ? b : a
        follower.progress = Math.min(follower.progress, leader.progress - CAR_LENGTH - 0.05)
        follower.speed = Math.min(follower.speed * 0.94, Math.max(3, leader.speed * 0.90))
        leader.speed = Math.max(3, leader.speed * 0.99)
      }
      // A single pass avoids overcorrecting side contacts on the same frame.
      for (let i = 0; i < vehicles.length; i++) {
        for (let j = i + 1; j < vehicles.length; j++) contact(vehicles[i], vehicles[j], i, j)
      }
      // Collision solver corrects track coordinates; reflect those corrections in 3D.
      const collisionCorrection=pointAt(g.progress,g.lateral).p
      if(Math.hypot(collisionCorrection.x-g.worldX,collisionCorrection.z-g.worldZ)>1.2){
        g.worldX=collisionCorrection.x;g.worldZ=collisionCorrection.z
      }
      if(Math.floor(previous/TRACK_LENGTH)<Math.floor(g.progress/TRACK_LENGTH)){
        g.lap++
        if(g.lap>LAPS){
          g.finished=true;setFinishTime(g.elapsed)
          const projected=ai.current.map(bot=>({
            name:bot.name,
            time:bot.finishTime??g.elapsed+Math.max(0,LAPS*TRACK_LENGTH-bot.progress)/Math.max(bot.speed,9)
          }))
          const ranked=[...projected,{name:'YOU',time:g.elapsed}].sort((a,b)=>a.time-b.time)
          // Each track-limits violation moves the player down one position,
          // without altering the other drivers' recorded race times.
          const original=ranked.findIndex(d=>d.name==='YOU')
          const [player]=ranked.splice(original,1)
          ranked.splice(Math.min(ranked.length,original+violationRef.current),0,player)
          setFinalBoard(ranked)
          audio.current?.silenceEngine()
          audio.current?.setRain(false)
          setPhase('results')
        }
      }
      if(now-lastHud>70){lastHud=now;setHud({...g});}
      if(!g.finished)raf=requestAnimationFrame(frame)
    }
    raf=requestAnimationFrame(frame)
    return ()=>cancelAnimationFrame(raf)
  },[phase])
  // Report a completed classification, including Winter's grid penalties.
  // The parent replaces the previous result if this race is retried.
  const reportedResult = useRef<{board: typeof finalBoard; callback: Props['onRaceComplete']} | null>(null)
  useEffect(() => {
    if (phase !== 'results' || finalBoard.length !== TOTAL_DRIVERS || !onRaceComplete) return
    if (reportedResult.current?.board === finalBoard && reportedResult.current.callback === onRaceComplete) return
    reportedResult.current = {board: finalBoard, callback: onRaceComplete}
    onRaceComplete(finalBoard.map((driver, index) => ({
      name: driver.name,
      position: index + 1,
      time: driver.time
    })))
  }, [phase, finalBoard, onRaceComplete])
  const position=finishTime?finalBoard.findIndex(d=>d.name==='YOU')+1:0
  const currentPosition=1+ai.current.filter(d=>d.progress>hud.progress).length
  return <main className="sc-page">
    <header className="sc-header"><button onClick={onBack}>← ACADEMY HUB</button><strong>APEX <em>ACADEMY</em></strong><span>SEASONS OF SPEED / ROUND 03</span></header>
    <div className="sc-title"><span>WINTER GRAND PRIX / STORM CIRCUIT</span><h1>THE <em>STORM.</em></h1><p>FREEZING RAIN · SLIPPERY CORNERS · 15 DRIVERS</p></div>
    <div className="sc-layout">
      <section className="sc-race">
        <div className="sc-hud"><div><small>LAP</small><strong>{Math.min(hud.lap,LAPS)} / {LAPS}</strong></div><div><small>POSITION</small><strong>P{phase==='results'?position:currentPosition} / {TOTAL_DRIVERS}</strong></div><div><small>SPEED</small><strong>{Math.round(hud.speed*3.6)} <small>KM/H</small></strong></div><div><small>TIME</small><strong>{timeString(hud.elapsed)}</strong></div></div>
        <div className="sc-viewport"><Canvas shadows camera={{position:[-20,14,0],fov:68,near:0.1,far:300}} dpr={[1,1.6]}><WinterWorld game={game} ai={ai} rain={rain}/></Canvas>
          {phase==='racing' && rain && <div className="sc-warning">🌧 ICY ROAD — HIGH-SPEED OVERSTEER! BRAKE BEFORE CORNERS!</div>}
          {phase==='racing' && hud.offroad && <div className="sc-warning">⚠ TRACK LIMITS — +1 POSITION PENALTY!</div>}
          {phase==='racing' && !rain && <div className="sc-hint">STORM WARNING — RAIN MAY BEGIN AT ANY MOMENT</div>}
          {phase==='lights' && <div className="sc-start-overlay"><div className="sc-light-rack">{[1,2,3,4,5].map(n=><span key={n} className={n<=lights?'lit':''}/>)}</div><strong>WAIT FOR LIGHTS OUT</strong></div>}
        </div>
        <div className="sc-controls"><span>W ACCELERATE · S BRAKE · A / D STEER</span><span>TRACK LIMITS <b>{violations} PENALTIES</b></span><span>CHASE CAMERA · 5-LIGHT START</span></div>
      </section>
      <aside className="sc-sidebar"><span>ROUND 03 / FOUR SEASONS</span><h2>RACE CONTROL</h2><div className="sc-weather">🌧 <strong>{rain ? "HEAVY RAIN" : "COLD & DRY"}</strong><small>STORM CIRCUIT · LOW GRIP</small></div><h3>YOUR OBJECTIVE</h3><p>Start from P{gridPosition} and race five laps. Heavy rain begins at a random point. Speed and acceleration stay the same, but steering oversteers at high speed. Brake before corners to stay off the walls. Every time you hit the track border, you receive a one-place penalty in the final classification. Current penalties: {violations}.</p><h3>RACE POSITION</h3><div className="sc-bigposition">P{phase==='results'?position:currentPosition}<small> / {TOTAL_DRIVERS}</small></div><div className="sc-progress"><div style={{width:`${Math.min(100,(hud.progress/(TRACK_LENGTH*LAPS))*100)}%`}}/></div><small>RACE DISTANCE COMPLETED</small><p className="sc-next">NEXT ROUND: SPRING — POLLEN RUSH</p></aside>
    </div>
    {phase==='intro' && <div className="sc-modal"><div className="sc-dialog"><span>SEASONS OF SPEED / ROUND 03</span><h2>WINTER <em>STORM.</em></h2><p>Race 14 competitive AI drivers over five laps. The rain begins at a random moment and stays for the remainder of the race. Wet roads turn blue and cause severe high-speed oversteer. Slow down before turning; engine speed and braking remain unchanged. Each wall contact costs one finishing position.</p><div className="sc-steps"><div><b>W</b> ACCELERATE</div><div><b>S</b> BRAKE</div><div><b>A / D</b> STEER</div></div><p className="sc-note">The five starting lights will illuminate before lights out. All cars remain stationary until the race begins.</p><button className="sc-primary" onClick={start}>GO TO STARTING GRID →</button><button className="sc-textbutton" onClick={onBack}>← RETURN TO ACADEMY</button></div></div>}
    {phase==='results' && <div className="sc-modal"><div className="sc-dialog sc-results"><span>ROUND 03 / CHEQUERED FLAG</span><h2>RACE <em>COMPLETE.</em></h2><p>You've completed the Winter Grand Prix.</p><div className="sc-results-grid"><div><small>FINISHING POSITION</small><strong>P{position}<small> / {TOTAL_DRIVERS}</small></strong></div><div><small>TRACK-LIMITS PENALTIES</small><strong>{violations}</strong></div><div><small>TOTAL RACE TIME</small><strong>{timeString(finishTime)}</strong></div></div><div className="sc-classification"><h3>FINAL CLASSIFICATION</h3>{finalBoard.map((r,i)=><div key={r.name} className={r.name==='YOU'?'sc-you':''}><span>P{i+1}</span><b>{r.name}</b><span>{timeString(r.time)}</span></div>)}</div><button className="sc-primary" onClick={start}>RETRY WINTER ↻</button><button className="sc-textbutton" onClick={onBack}>BACK TO ACADEMY</button>{onNextSeason ? <button className="sc-primary" onClick={onNextSeason}>CONTINUE TO SPRING →</button> : <p className="sc-note">Spring race is coming next.</p>}</div></div>}
  </main>
}

useGLTF.preload('/models/formula-car/formula-car/scene.gltf')
