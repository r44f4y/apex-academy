import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'

type Phase = 'ready' | 'lights' | 'armed' | 'racing' | 'finished'
type CarState = { x: number; z: number; v: number; rpm: number; clutch: number; slip: number; distance: number; reaction: number | null; launchAt: number; throttle: number; wheelspin: number; finished: boolean; lateralSpeed: number; split100: number | null }
type Hud = { phase: Phase; lights: number; position: number; speed: number; rpm: number; distance: number; reaction: number | null; wheelspin: number; clutch: number; result: string; elapsed: number; split100: number | null; steering: number }
const N = 10
const MASS = 800 // kg, illustrative mass; not a verified 2026 car mass
const RADIUS = 0.34 // m effective tire radius, assumption
const GEAR = 13.0 // effective first-gear * final-drive ratio, assumption
const MU = 1.85 // illustrative launch friction coefficient
const WHEEL_LOAD = 0.58 // rear static load fraction
const DT = 0.01
const FINISH = 200
const HALF_CAR_WIDTH = 1.08
const HALF_CAR_LENGTH = 2.25
const CONTACT_MARGIN = 0.12
const MAX_STEER_SPEED = 5.5 // m/s lateral, arcade-assisted steering
const TRACK_LIMIT = 9.5
// Individual AI launch setups are sampled anew for every race. Bounded variation
// keeps grid order meaningful while allowing clean passes and poor starts.
type DriverAI = {
  reaction: number; throttle: number; clutchRate: number; grip: number
  pace: number; preferredX: number; targetX: number; steerSpeed: number
  decisionTimer: number; patience: number
}
const randomBetween = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const newDrivers = (): DriverAI[] => Array.from({ length: N }, (_, i) => {
  const x = grid(i).x
  return {
    reaction: randomBetween(0.16, 0.36),
    throttle: randomBetween(0.81, 0.97),
    clutchRate: randomBetween(1.45, 2.5),
    grip: randomBetween(0.95, 1.045),
    pace: randomBetween(0.965, 1.035),
    preferredX: x, targetX: x,
    steerSpeed: randomBetween(3.0, 4.8),
    decisionTimer: randomBetween(0.15, 0.5),
    patience: randomBetween(0.05, 0.6),
  }
})
const grid = (i: number) => ({ x: i % 2 === 0 ? -3.6 : 3.6, z: -110 + Math.floor(i / 2) * 8 + (i % 2 ? 2 : 0) })
const newCars = (): CarState[] => Array.from({ length: N }, (_, i) => {
  const p = grid(i)
  return { ...p, v: 0, rpm: 5000, clutch: 0, slip: 0, distance: 0, reaction: null, launchAt: 0, throttle: 0, wheelspin: 0, finished: false, lateralSpeed: 0, split100: null }
})
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
// Demonstration model: all curves and vehicle parameters below are estimates, not FIA/team telemetry.
function stepCar(c: CarState, dt: number, throttle: number, clutch: number, grip = 1, pace = 1) {
  const rpmTarget = 4500 + throttle * 10500
  const coupledRpm = c.v / RADIUS * GEAR * 60 / (2 * Math.PI)
  const freeRpm = c.rpm + (rpmTarget - c.rpm) * clamp(dt * (clutch < 0.2 ? 4 : 1.6), 0, 1)
  const load = clamp(clutch, 0, 1)
  // Off-throttle: let engine RPM fall toward idle rather than being driven upward by wheel speed.
  c.rpm = clamp(throttle <= 0 ? freeRpm : freeRpm * (1 - 0.30 * load) + Math.max(3500, coupledRpm) * (0.30 * load), 3500, 15000)
  const peak = Math.max(0.25, 1 - Math.pow((c.rpm - 10500) / 9500, 2))
  const iceTorque = 260 * peak * throttle * pace // approximate ICE torque; not a team torque map
  // Illustrative low-speed electrical assistance. Not a regulatory-accurate MGU-K deployment map.
  const motorTorque = c.v > 1 ? Math.min(100, 55000 / Math.max(1, c.v / RADIUS * GEAR)) * throttle : 0
  const torqueAtWheel = (iceTorque + motorTorque) * GEAR * 0.88 * load
  const requestedForce = torqueAtWheel / RADIUS
  const traction = MU * MASS * 9.81 * WHEEL_LOAD * grip
  const force = Math.min(requestedForce, traction)
  c.wheelspin = requestedForce > traction ? clamp((requestedForce / traction - 1) * 100, 0, 100) : 0
  const aeroDrag = 0.5 * 1.225 * 1.05 * c.v * c.v
  const rolling = 0.017 * MASS * 9.81
  c.v = Math.max(0, c.v + (force - aeroDrag - rolling) / MASS * dt)
  c.distance += c.v * dt
  c.z -= c.v * dt
  c.clutch = load
  c.throttle = throttle
  c.slip = Math.abs(c.rpm - coupledRpm)
}
function ModelCar({ car }: { car: CarState; player: boolean }) {
  const { scene } = useGLTF('/models/formula-car/formula-car/scene.gltf')
  const model = useMemo(() => {
    const root = scene.clone(true)
    root.rotation.y = Math.PI
    const wrap = new THREE.Group()
    wrap.add(root)
    wrap.scale.setScalar(0.45)
    wrap.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(wrap)
    const center = bounds.getCenter(new THREE.Vector3())
    wrap.position.set(-center.x, -bounds.min.y + 0.08, -center.z)
    return wrap
  }, [scene])
  const ref = useRef<THREE.Group>(null)
  useFrame(() => { if (ref.current) ref.current.position.set(car.x, 0, car.z) })
  return <group ref={ref} position={[car.x, 0, car.z]}><primitive object={model} /></group>
}
function Placeholder({ car, color }: { car: CarState; color: string }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => { if (ref.current) ref.current.position.set(car.x, 0, car.z) })
  return <group ref={ref} position={[car.x, 0, car.z]}>
    <mesh position={[0, .35, 0]}><boxGeometry args={[1, .3, 3.8]}/><meshStandardMaterial color={color} metalness={.4}/></mesh>
    <mesh position={[0, .34, -2.05]}><boxGeometry args={[2.1, .13, .35]}/><meshStandardMaterial color="#151515"/></mesh>
    <mesh position={[0, .65, .25]}><boxGeometry args={[.65, .45, .9]}/><meshStandardMaterial color="#12151c"/></mesh>
    {[-1,1].flatMap(x=>[-1,1].map(z=><mesh key={`${x}-${z}`} position={[x*.85,.4,z*1.1]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.43,.43,.32,16]}/><meshStandardMaterial color="#090909"/></mesh>))}
  </group>
}
function Circuit() {
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[500,900]}/><meshStandardMaterial color="#345b38"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.018,-200]} receiveShadow><planeGeometry args={[23,700]}/><meshStandardMaterial color="#303239" roughness={.92}/></mesh>
    {[-11,11].map(x=><mesh key={x} rotation={[-Math.PI/2,0,0]} position={[x,.04,-200]}><planeGeometry args={[.3,700]}/><meshBasicMaterial color="#eee"/></mesh>)}
    {Array.from({length:5},(_,r)=>[-1,1].map((side,i)=><mesh key={`${r}-${i}`} rotation={[-Math.PI/2,0,0]} position={[side*3.6,.045,-110+r*8+(side>0?2:0)]}><planeGeometry args={[4,.18]}/><meshBasicMaterial color="#ddd"/></mesh>))}
    {[-13,13].map(x=><mesh key={x} position={[x,.8,-200]}><boxGeometry args={[.4,1.6,700]}/><meshStandardMaterial color="#ddd"/></mesh>)}
  </>
}
function Gantry({ lights, phase }: { lights: number; phase: Phase }) {
  return <group position={[0,7,-136]}>
    <mesh><boxGeometry args={[12,1.8,.6]}/><meshStandardMaterial color="#151515"/></mesh>
    {Array.from({length:5},(_,i)=><mesh key={i} position={[(i-2)*2.2,0,.45]}><sphereGeometry args={[.58,24,24]}/><meshStandardMaterial color={phase==='lights' && i<lights?'#ff2020':'#360707'} emissive={phase==='lights' && i<lights?'#f00':'#000'} emissiveIntensity={3}/></mesh>)}
  </group>
}
function CameraRig({ player }: { player: CarState }) {
  useFrame(({ camera }, dt) => {
    // Close third-person chase camera, just behind the rear wing.
    const desired = new THREE.Vector3(player.x, 2.35, player.z + 5.4)
    camera.position.lerp(desired, 1 - Math.exp(-9 * dt))
    camera.lookAt(player.x, 1.05, player.z - 16)
  })
  return null
}

function PhysicsLoop({ tick }: { tick: (dt: number) => void }) {
  const accumulator = useRef(0)
  useFrame((_, delta) => {
    accumulator.current = Math.min(accumulator.current + Math.min(delta, .05), .1)
    while (accumulator.current >= DT) {
      tick(DT)
      accumulator.current -= DT
    }
  })
  return null
}
function World({ cars, phase, lights, tick }: { cars: CarState[]; phase: Phase; lights: number; tick: (dt: number)=>void }) {
  const colors=['#ff8700','#e8002d','#3671c6','#00d2be','#e8002d','#ff8700','#3671c6','#00d2be','#ddd','#aa44ff']
  return <Canvas camera={{position:[0,5,18],fov:63}} shadows>
    <color attach="background" args={['#9cbad0']}/><fog attach="fog" args={['#9cbad0',140,320]}/>
    <ambientLight intensity={1.7}/><directionalLight position={[15,25,10]} intensity={2.4} castShadow/>
    <PhysicsLoop tick={tick}/><Circuit/><Gantry lights={lights} phase={phase}/>
    <Suspense fallback={null}>{cars.map((c,i)=>i===4?<ModelCar key={i} car={c} player/>:<Placeholder key={i} car={c} color={colors[i]}/>)}</Suspense>
    <CameraRig player={cars[4]}/>
  </Canvas>
}
const initialHud: Hud = {phase:'ready',lights:0,position:5,speed:0,rpm:5000,distance:0,reaction:null,wheelspin:0,clutch:0,result:'',elapsed:0,split100:null,steering:0}
type LevelOneProps = {
  onLevelSelect?: () => void
  onQualifying?: () => void
}

export default function App({
  onLevelSelect,
  onQualifying
}: LevelOneProps) {
  const [showIntro, setShowIntro] = useState(true)
  const carsRef=useRef<CarState[]>(newCars())
  const [raceId,setRaceId]=useState(0)
  const [hud,setHud]=useState<Hud>(initialHud)
  const phaseRef=useRef<Phase>('ready')
  const keys=useRef({space:false,w:false,shift:false,a:false,d:false})
  const lightsOut=useRef<number|null>(null)
  const elapsed=useRef(0)
  const updateCounter=useRef(0)
  const timers=useRef<number[]>([])
  const launchStarted=useRef(false)
  const driversRef=useRef<DriverAI[]>(newDrivers())
  // Web Audio engine: generated on the first keyboard interaction (browser policy).
  const audioRef = useRef<{
    context: AudioContext
    low: OscillatorNode
    high: OscillatorNode
    filter: BiquadFilterNode
    gain: GainNode
  } | null>(null)
  useEffect(() => {
    const startAudio = () => {
      if (audioRef.current) {
        if (audioRef.current.context.state === 'suspended') void audioRef.current.context.resume()
        return
      }
      const context = new AudioContext()
      const low = context.createOscillator()
      const high = context.createOscillator()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      low.type = 'sawtooth'
      high.type = 'triangle'
      filter.type = 'lowpass'
      filter.frequency.value = 850
      filter.Q.value = 0.8
      gain.gain.value = 0.0001
      const lowLevel = context.createGain()
      const highLevel = context.createGain()
      lowLevel.gain.value = 0.24
      highLevel.gain.value = 0.13
      low.connect(lowLevel)
      high.connect(highLevel)
      lowLevel.connect(filter)
      highLevel.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      low.start()
      high.start()
      audioRef.current = { context, low, high, filter, gain }
      void context.resume()
    }
    window.addEventListener('keydown', startAudio)
    return () => {
      window.removeEventListener('keydown', startAudio)
      const audio = audioRef.current
      audioRef.current = null
      if (audio) void audio.context.close()
    }
  }, [])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const { context, low, high, filter, gain } = audio
    const t = context.currentTime
    // Audio frequency follows the actual player RPM; no changes to physics.
    const rpm = Math.max(3500, Math.min(15000, hud.rpm))
    const rpmFactor = (rpm - 3500) / 11500
    const baseHz = rpm / 60 * 1.55
    low.frequency.setTargetAtTime(baseHz, t, 0.045)
    high.frequency.setTargetAtTime(baseHz * 2.02, t, 0.045)
    filter.frequency.setTargetAtTime(480 + rpmFactor * 1750, t, 0.07)
    const volume = hud.phase === 'finished' ? 0 : 0.055 + rpmFactor * 0.075
    gain.gain.setTargetAtTime(volume, t, 0.075)
  }, [hud.rpm, hud.phase])

  // Short synthesized start-light cue. Uses the existing engine AudioContext.
  // No new audio files, timers, or dependencies are needed.
  const playLightBeep = (lightNumber: number) => {
    const audio = audioRef.current
    if (!audio || audio.context.state === 'closed') return
    const context = audio.context
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const tone = context.createOscillator()
    const toneGain = context.createGain()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(205 + lightNumber * 9, now)
    toneGain.gain.setValueAtTime(0.0001, now)
    toneGain.gain.exponentialRampToValueAtTime(0.18, now + 0.018)
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
    tone.connect(toneGain)
    toneGain.connect(context.destination)
    tone.start(now)
    tone.stop(now + 0.25)
    tone.onended = () => { tone.disconnect(); toneGain.disconnect() }
  }

  const cancelTimers=()=>{timers.current.forEach(clearTimeout);timers.current=[]}
  const setPhase=(p:Phase)=>{phaseRef.current=p;setHud(h=>({...h,phase:p}))}
  const reset=useCallback(()=>{
    cancelTimers();carsRef.current=newCars();keys.current={space:false,w:false,shift:false,a:false,d:false};lightsOut.current=null;elapsed.current=0;updateCounter.current=0;launchStarted.current=false;driversRef.current=newDrivers()
    setShowIntro(true)
    phaseRef.current='ready';setHud(initialHud);setRaceId(n=>n+1)
  },[])
  const begin=useCallback(()=>{
    if(phaseRef.current!=='ready')return
    setPhase('lights');setHud(h=>({...h,lights:0}))
    for(let i=1;i<=5;i++)timers.current.push(window.setTimeout(()=>{
      setHud(h=>({...h,lights:i}))
      playLightBeep(i)
    },i*750))
    const delay=5*750+1000+Math.random()*1800
    timers.current.push(window.setTimeout(()=>{
      lightsOut.current=performance.now()
      setPhase('armed');setHud(h=>({...h,lights:0}))
    },delay))
  },[])
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(['Space','KeyW','ShiftLeft','ShiftRight','KeyA','KeyD','ArrowLeft','ArrowRight','KeyR'].includes(e.code))e.preventDefault()
      if(e.code==='KeyR'){if(!e.repeat)reset();return}
      if(e.code==='Space'){
        if(!showIntro && !keys.current.space && phaseRef.current==='ready')begin()
        keys.current.space=true
      }
      if(e.code==='KeyW')keys.current.w=true
       if(e.code==='KeyA'||e.code==='ArrowLeft')keys.current.a=true
       if(e.code==='KeyD'||e.code==='ArrowRight')keys.current.d=true
      if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.current.shift=true
    }
    const up=(e:KeyboardEvent)=>{
      if(e.code==='Space'){
        e.preventDefault();const wasHeld=keys.current.space;keys.current.space=false
        if(wasHeld && (phaseRef.current==='armed'||phaseRef.current==='lights')){
          const now=performance.now();const reaction=lightsOut.current===null? -1 : (now-lightsOut.current)/1000
          carsRef.current[4].reaction=reaction
          launchStarted.current=true
          if(reaction<0){setPhase('finished');setHud(h=>({...h,phase:'finished',reaction,result:'Jump start — released clutch before lights out.'}));cancelTimers()}
          else setPhase('racing')
        }
      }
      if(e.code==='KeyW')keys.current.w=false
       if(e.code==='KeyA'||e.code==='ArrowLeft')keys.current.a=false
       if(e.code==='KeyD'||e.code==='ArrowRight')keys.current.d=false
      if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.current.shift=false
    }
    const blur=()=>{keys.current.w=false;keys.current.shift=false;keys.current.a=false;keys.current.d=false}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur)
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);cancelTimers()}
},[begin,reset,showIntro])
  const tick=useCallback((dt:number)=>{
    const phase=phaseRef.current
    const cars=carsRef.current
    const player=cars[4]
    if(phase==='ready'||phase==='lights'||phase==='armed'){
      // Rev while holding clutch, but no wheel force before clutch release.
      const target=4500+(keys.current.w?10500:0)
      player.rpm+= (target-player.rpm)*Math.min(1,dt*4)
    }
    if(phase==='armed'||phase==='racing'){
      elapsed.current+=dt
      for(let i=0;i<N;i++){
        const c=cars[i]
        if(i===4){
          if(!launchStarted.current)continue
          // Shift allows progressive engagement; without Shift, clutch snaps to bite.
          const desired=keys.current.shift?Math.min(1,c.clutch+dt*.75):Math.min(1,c.clutch+dt*3.2)
          stepCar(c,dt,keys.current.w?1:0,desired)
        }else{
          const ai = driversRef.current[i]
          if (elapsed.current < ai.reaction) continue
          // Each opponent uses its own freshly sampled clutch, throttle,
          // grip and modest power-delivery variation.
          const targetClutch = Math.min(1, c.clutch + dt * ai.clutchRate)
          stepCar(c, dt, ai.throttle, targetClutch, ai.grip, ai.pace)
        }
      }
       // Keyboard steering: lateral velocity ramps up/down rather than teleporting lanes.
       // Steering is game-assisted; this is NOT a validated F1 tire/yaw model.
       if (phase === 'racing' && launchStarted.current) {
         const steer = Number(keys.current.d) - Number(keys.current.a)
         const targetLateral = steer * MAX_STEER_SPEED * (0.45 + 0.55 * clamp(player.v / 12, 0, 1))
         player.lateralSpeed += (targetLateral - player.lateralSpeed) * clamp(dt * 5, 0, 1)
         const targetX = clamp(player.x + player.lateralSpeed * dt, -TRACK_LIMIT, TRACK_LIMIT)
         // Prevent moving sideways into another car at the same longitudinal position.
         const lateralBlocked = cars.some((other, i) => i !== 4 &&
           Math.abs(player.z - other.z) < 2 * HALF_CAR_LENGTH + CONTACT_MARGIN &&
           Math.abs(targetX - other.x) < 2 * HALF_CAR_WIDTH + CONTACT_MARGIN &&
           Math.abs(player.x - other.x) >= 2 * HALF_CAR_WIDTH + CONTACT_MARGIN)
         if (!lateralBlocked) player.x = targetX
         else player.lateralSpeed = 0
       } else {
         player.lateralSpeed *= Math.max(0, 1 - dt * 7)
       }

       // AI drivers assess the road ahead several times a second, choose an
       // open passing line, and steer smoothly. They may pass the player too.
       for (let i = 0; i < N; i++) {
         if (i === 4) continue
         const c = cars[i]
         const ai = driversRef.current[i]
         if (elapsed.current < ai.reaction) continue
         ai.decisionTimer -= dt
         if (ai.decisionTimer <= 0) {
           ai.decisionTimer = randomBetween(0.16, 0.3)
           const lookAhead = clamp(6 + c.v * 0.75, 7, 24)
           const leader = cars.reduce<{car:CarState;gap:number}|null>((best, other, j) => {
             if (j === i) return best
             const gap = c.z - other.z
             if (gap <= 0 || gap > lookAhead || Math.abs(c.x - other.x) > 2.65) return best
             return !best || gap < best.gap ? {car:other,gap} : best
           }, null)
           const needPass = leader !== null &&
             (c.v > leader.car.v + 0.35 || leader.gap < 8 + ai.patience * 5)
           if (needPass) {
             const options = [clamp(c.x - 3.2, -TRACK_LIMIT, TRACK_LIMIT), clamp(c.x + 3.2, -TRACK_LIMIT, TRACK_LIMIT)]
             const scored = options.map(x => {
               let penalty = Math.abs(x - ai.preferredX) * 0.08
               for (let j = 0; j < N; j++) {
                 if (j === i) continue
                 const other = cars[j]
                 const dz = Math.abs(other.z - c.z)
                 if (Math.abs(x - other.x) < 2 * HALF_CAR_WIDTH + 0.5 && dz < 11) penalty += 100
                 else if (Math.abs(x - other.x) < 2.8 && dz < 22) penalty += 12
               }
               return {x,penalty}
             }).sort((a,b)=>a.penalty-b.penalty)
             if (scored[0].penalty < 50) ai.targetX = scored[0].x
              else ai.targetX = c.x
           } else {
             // Keep the passing lane until there is room to merge back.
             const clear = cars.every((other,j)=>j===i || Math.abs(other.z-c.z)>9 || Math.abs(other.x-ai.preferredX)>2.7)
             if (clear && !leader) ai.targetX = ai.preferredX
           }
         }
         const diff = ai.targetX - c.x
         const desiredLateral = Math.abs(diff) < 0.12 ? 0 : clamp(diff * 2.2, -ai.steerSpeed, ai.steerSpeed)
         c.lateralSpeed += (desiredLateral - c.lateralSpeed) * clamp(dt * 4, 0, 1)
         const nextX = clamp(c.x + c.lateralSpeed * dt, -TRACK_LIMIT, TRACK_LIMIT)
         const blocked = cars.some((other,j)=>j!==i &&
           Math.abs(c.z-other.z)<2*HALF_CAR_LENGTH+0.45 &&
           Math.abs(nextX-other.x)<2*HALF_CAR_WIDTH+CONTACT_MARGIN &&
           Math.abs(c.x-other.x)>=2*HALF_CAR_WIDTH+CONTACT_MARGIN)
         if (!blocked) c.x=nextX
         else c.lateralSpeed=0
       }

       // Vehicle-sized longitudinal collision constraints.
       // Iterate from the frontmost car to the rearmost so followers cannot tunnel
       // through cars ahead during a fixed physics step.
       const sorted = cars.map((c, i) => ({ c, i })).sort((a, b) => a.c.z - b.c.z)
       for (let k = 1; k < sorted.length; k++) {
         const follower = sorted[k].c
         for (let j = 0; j < k; j++) {
           const leader = sorted[j].c
           const gap = follower.z - leader.z
           const samePath = Math.abs(follower.x - leader.x) < 2 * HALF_CAR_WIDTH + CONTACT_MARGIN
           const minGap = 2 * HALF_CAR_LENGTH + CONTACT_MARGIN
           if (samePath && gap < minGap && gap >= 0) {
             follower.z = leader.z + minGap
             follower.distance = grid(sorted[k].i).z - follower.z
             follower.v = Math.min(follower.v, leader.v)
             break
           }
         }
       }

       // Record the player's 100 m split by interpolating the crossing within the step.
       if (player.split100 === null && player.distance >= 100) {
         const overshoot = player.distance - 100
         player.split100 = Math.max(0, elapsed.current - overshoot / Math.max(player.v, 0.01))
       }
      if(phase==='racing' && player.distance>=FINISH){
        const rank=1+cars.filter((c,i)=>i!==4 && c.z<player.z).length
        setPhase('finished');setHud(h=>({...h,position:rank,distance:player.distance,split100:player.split100,result:`200 m complete — P${rank}. ${rank<5?`Gained ${5-rank} places.`:rank>5?`Lost ${rank-5} places.`:'Held P5.'}`}))
      }
    }
    updateCounter.current++
    if(updateCounter.current%8===0){
      const rank=1+cars.filter((c,i)=>i!==4&&c.z<player.z).length
      setHud(h=>({...h,position:rank,speed:player.v*3.6,rpm:player.rpm,distance:Math.max(0,player.distance),reaction:player.reaction,wheelspin:player.wheelspin,clutch:player.clutch,elapsed:elapsed.current,split100:player.split100,steering:player.lateralSpeed}))
    }
  },[])
  return <main className="game">
    <header className="topbar"><div className="logo">APEX<span>ACADEMY</span></div><div className="level">LEVEL 01 / 2026 HYBRID LAUNCH</div></header>
    <section className="viewport">
      <World key={raceId} cars={carsRef.current} phase={hud.phase} lights={hud.lights} tick={tick}/>
      <div className="hud"><div>LIVE POSITION</div><strong>P{hud.position}</strong><div>STARTED P5</div></div>
      <div className="telemetry">
        <div><span>SPEED</span><b>{Math.round(hud.speed)} <small>km/h</small></b></div>
        <div><span>ENGINE</span><b>{Math.round(hud.rpm).toLocaleString()} <small>RPM</small></b></div>
        <div><span>CLUTCH</span><b>{Math.round(hud.clutch*100)}<small>% engaged</small></b></div>
        <div><span>WHEELSPIN</span><b>{Math.round(hud.wheelspin)}<small>% proxy</small></b></div>
        <div><span>DISTANCE</span><b>{Math.min(200,Math.round(hud.distance))}<small> / 200 m</small></b></div>
        <div><span>100 M SPLIT</span><b>{hud.split100===null?'—':hud.split100.toFixed(2)} <small>{hud.split100===null?'':'s'}</small></b></div>
        <div><span>STEERING</span><b>{Math.abs(hud.steering)<0.15?'STRAIGHT':hud.steering<0?'LEFT':'RIGHT'}</b></div>
        <div><span>REACTION</span><b>{hud.reaction===null?'—':hud.reaction<0?'JUMP':Math.round(hud.reaction*1000)}<small>{hud.reaction!==null&&hud.reaction>=0?' ms':''}</small></b></div>
      </div>
      <div className="instructions">
        {hud.phase==='ready'&&'HOLD SPACE (CLUTCH), HOLD W (THROTTLE) TO START'}
        {hud.phase==='lights'&&'KEEP SPACE HELD — WAIT FOR LIGHTS OUT'}
        {hud.phase==='armed'&&'LIGHTS OUT! RELEASE SPACE TO LAUNCH'}
        {hud.phase==='racing'&&'W: THROTTLE • A/D: STEER • OPPONENTS CAN OVERTAKE YOU • SHIFT: SLOW CLUTCH'}
        {hud.phase==='finished'&&<><strong>{hud.result}</strong><div>PRESS R TO RESTART</div></>}
      </div>
    </section>
    {showIntro && (
  <div className="race-modal-backdrop">
    <div className="race-modal">
      <div className="race-modal-kicker">
        APEX ACADEMY / LEVEL 01
      </div>

      <h1>LIGHTS OUT<span>.</span></h1>
      <h2>HOW FAST CAN YOU REACT?</h2>

      <p>
        You're starting from <strong>P5</strong>.
        Get the best possible launch over 200 metres.
      </p>

      <div className="race-steps">
        <div><b>01</b><span><strong>HOLD SPACE</strong> — Engage your clutch.</span></div>
        <div><b>02</b><span><strong>WATCH THE LIGHTS</strong> — Wait for all five red lights to go out.</span></div>
        <div><b>03</b><span><strong>RELEASE SPACE</strong> — Launch as quickly as possible.</span></div>
        <div><b>04</b><span><strong>HOLD W</strong> to accelerate. Use A/D to steer.</span></div>
      </div>

      <p className="race-modal-note">
        Your reaction time and finishing position will be recorded.
      </p>

      <button
        className="race-primary-button"
        onClick={() => setShowIntro(false)}
      >
        I'M READY — LET'S RACE ↗
      </button>

      <div className="race-modal-tip">
        THEN HOLD SPACE TO START THE LIGHTS
      </div>
    </div>
  </div>
)}

{!showIntro && hud.phase === 'finished' && (
  <div className="race-modal-backdrop">
    <div className="race-modal race-results">
      <div className="race-modal-kicker">
        APEX ACADEMY / 200M RESULT
      </div>

      <h1>
        {hud.reaction !== null && hud.reaction < 0
          ? <>JUMP START<span>.</span></>
          : <>LIGHTS OUT<span>.</span></>}
      </h1>

      <div className="race-result-label">YOUR REACTION TIME</div>

      <div className="race-reaction-time">
        {hud.reaction === null
          ? '—'
          : hud.reaction < 0
            ? 'JUMP START'
            : `${Math.round(hud.reaction * 1000)} `}
        {hud.reaction !== null && hud.reaction >= 0 && (
          <small>ms</small>
        )}
      </div>

      <p className="race-result-description">
        {hud.reaction !== null && hud.reaction < 0
          ? 'You released the clutch before the lights went out.'
          : 'Your launch reaction from lights out to clutch release.'}
      </p>

      <div className="race-result-grid">
        <div>
          <span>STARTING POSITION</span>
          <strong>P5</strong>
        </div>

        <div>
          <span>FINISHING POSITION</span>
          <strong>{hud.reaction !== null && hud.reaction < 0 ? 'DSQ' : `P${hud.position}`}</strong>
        </div>
      </div>

      <div
  className={`race-position-change ${
    hud.reaction !== null && hud.reaction < 0
      ? 'position-lost'
      : hud.position < 5
        ? 'position-gained'
        : hud.position > 5
          ? 'position-lost'
          : 'position-neutral'
  }`}
>
  {hud.reaction !== null && hud.reaction < 0
    ? 'INVALID START'
    : hud.position < 5
      ? `+${5 - hud.position} POSITIONS GAINED`
      : hud.position > 5
        ? `-${hud.position - 5} POSITIONS LOST`
        : 'POSITION MAINTAINED'}
</div>
  

      <div className="race-result-actions">
        <button
          className="race-secondary-button"
          onClick={onLevelSelect}
          disabled={!onLevelSelect}
        >
          LEVEL SELECTION
        </button>

        <button
          className="race-primary-button"
          onClick={onQualifying}
          disabled={!onQualifying}
        >
          FIGURE OUT WHY YOU STARTED P5 ↗
        </button>
      </div>
      <div className="race-retry-container">
  <button
    type="button"
    className="race-retry-button"
    onClick={reset}
  >
    RETRY REACTION TIME ↻
  </button>
</div>
    </div>
    </div>
)}
    <footer className="footer"><span>SPACE: CLUTCH RELEASE</span><span>W: THROTTLE</span><span>A/D: STEER</span><span>SHIFT: SLOW CLUTCH ENGAGEMENT</span><span>R: RESTART</span></footer>
  </main>
}
