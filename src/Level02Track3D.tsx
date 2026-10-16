import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

export const TRACK = [
  { x: 205, y: 480 }, { x: 215, y: 260 }, { x: 340, y: 155 }, { x: 560, y: 155 },
  { x: 760, y: 245 }, { x: 790, y: 420 }, { x: 660, y: 525 }, { x: 420, y: 515 },
]
export type CarPose = { x: number; y: number; heading: number; speed: number; steer?: number }

const SCALE = 0.12
const ROAD_HALF = 6.75 // Same 112-pixel road width as the original game, approximately.
const P = (x: number, y: number) => new THREE.Vector3((x - 500) * SCALE, 0, (y - 325) * SCALE)
const CURVE = new THREE.CatmullRomCurve3(TRACK.map(p => P(p.x, p.y)), true, 'centripetal', 0.5)
const SAMPLES = 320
const at = (t: number) => CURVE.getPointAt(((t % 1) + 1) % 1)
const tangent = (t: number) => CURVE.getTangentAt(((t % 1) + 1) % 1).normalize()
const normal = (t: number) => {
  const d = tangent(t)
  return new THREE.Vector3(-d.z, 0, d.x)
}
const edge = (t: number, side: number, offset: number) => at(t).addScaledVector(normal(t), side * offset)

export function distanceToTrackCenter(x: number, y: number) {
  const px = (x - 500) * SCALE
  const pz = (y - 325) * SCALE
  let best = Infinity
  for (let i = 0; i < SAMPLES; i++) {
    const a = at(i / SAMPLES)
    const b = at((i + 1) / SAMPLES)
    const dx = b.x - a.x, dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz)))
  }
  return best
}

function Ribbon({ inner, outer, color, y = 0.02, dashed = false }: {
  inner: number; outer: number; color: string; y?: number; dashed?: boolean
}) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const indices: number[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const c = at(t), n = normal(t)
      for (const off of [inner, outer]) {
        positions.push(c.x + n.x * off, y, c.z + n.z * off)
      }
      if (i < SAMPLES && (!dashed || Math.floor(i / 5) % 2 === 0)) {
        const k = 2 * i
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [inner, outer, y, dashed])
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
  </mesh>
}

function Road() {
  return <group>
    <Ribbon inner={-ROAD_HALF - 2.5} outer={ROAD_HALF + 2.5} color="#777c79" y={0.004} />
    <Ribbon inner={-ROAD_HALF} outer={ROAD_HALF} color="#292d33" y={0.018} />
    {[-1, 1].map(side => <group key={side}>
      <Ribbon inner={side * (ROAD_HALF - 0.18)} outer={side * (ROAD_HALF - 0.02)} color="#f4f3ed" y={0.041} />
      {Array.from({ length: 160 }, (_, i) => {
        const t0 = i / 160
        const t1 = (i + 1) / 160
        const offset = side * (ROAD_HALF + 0.55)
        const halfWidth = 0.55
        const p0 = at(t0), p1 = at(t1)
        const n0 = normal(t0), n1 = normal(t1)
        const vertices = [
          p0.clone().addScaledVector(n0, offset - halfWidth),
          p0.clone().addScaledVector(n0, offset + halfWidth),
          p1.clone().addScaledVector(n1, offset - halfWidth),
          p1.clone().addScaledVector(n1, offset + halfWidth),
        ]
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(
          [vertices[0], vertices[1], vertices[2], vertices[1], vertices[3], vertices[2]]
            .flatMap(v => [v.x, 0.055, v.z]), 3))
        geometry.computeVertexNormals()
        return <mesh key={i} geometry={geometry} receiveShadow>
          <meshStandardMaterial color={i % 2 ? '#d71932' : '#f4f4f2'} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      })}
    </group>)}
    <Ribbon inner={-0.055} outer={0.055} color="#9a9ca1" y={0.033} dashed />
  </group>
}

function SafetyBarriers() {
  // Small separated guardrail sections FOLLOW the curve, rather than cutting through corners.
  return <group>{[-1, 1].flatMap(side =>
    Array.from({ length: 110 }, (_, i) => {
      const t = (i + 0.5) / 110
      const p = edge(t, side, ROAD_HALF + 4.2)
      const d = tangent(t)
      const angle = -Math.atan2(d.z, d.x)
      const len = CURVE.getLength() / 110 * 0.94
      return <group key={`${side}-${i}`} position={[p.x, 0, p.z]} rotation={[0, angle, 0]}>
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[len, 0.9, 0.22]} />
          <meshStandardMaterial color={i % 10 < 2 ? '#d9293f' : '#c6cbd0'} metalness={0.35} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[len, 0.10, 0.28]} />
          <meshStandardMaterial color="#a6acb2" metalness={0.5} roughness={0.45} />
        </mesh>
      </group>
    })
  )}</group>
}

function StartFinish() {
  // The finish stripe is made of flat tiles rather than overlapping road-height boxes.
  const p = at(0)
  const d = tangent(0)
  const angle = -Math.atan2(d.z, d.x)
  const across = 16
  const along = 2
  const tileWidth = (ROAD_HALF * 2 - 0.5) / across
  return <group position={[p.x, 0.065, p.z]} rotation={[0, angle, 0]}>
    {Array.from({ length: across * along }, (_, i) => {
      const row = Math.floor(i / across)
      const col = i % across
      return <mesh key={i} position={[(row - 0.5) * 0.7, 0, (col - (across - 1) / 2) * tileWidth]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tileWidth, 0.7]} />
        <meshBasicMaterial color={(row + col) % 2 ? '#161616' : '#ffffff'} side={THREE.DoubleSide} depthWrite />
      </mesh>
    })}
  </group>
}

function BrakingBoard({ t, side, value }: { t: number; side: number; value: string }) {
  const p = edge(t, side, ROAD_HALF + 7)
  const d = tangent(t)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 240, 240)
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 105px Arial'; ctx.fillText(value, 128, 132)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [value])
  return <group position={[p.x, 0, p.z]} rotation={[0, -Math.atan2(d.z, d.x), 0]}>
    <mesh position={[0, 1.15, 0]} castShadow>
      <boxGeometry args={[2.1, 2.1, 0.13]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
    <mesh position={[0, 1.15, side > 0 ? 0.09 : -0.09]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <boxGeometry args={[0.11, 0.84, 0.11]} />
      <meshStandardMaterial color="#888b8d" />
    </mesh>
  </group>
}

function Environment() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; s: number }[] = []
    for (let i = 0; i < 140; i++) {
      const x = ((i * 79.3 + 17) % 220) - 110
      const z = ((i * 113.7 + 39) % 200) - 100
      const nearRoad = Array.from({ length: 100 }, (_, j) => at(j / 100)).some(p => Math.hypot(p.x - x, p.z - z) < ROAD_HALF + 16)
      if (!nearRoad) result.push({ x, z, s: 0.8 + (i % 5) * 0.14 })
    }
    return result
  }, [])
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial color="#37664b" roughness={1} />
    </mesh>
    {trees.map((p, i) => <group key={i} position={[p.x, 0, p.z]} scale={p.s}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 2.2, 6]} />
        <meshStandardMaterial color="#594d39" />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <coneGeometry args={[1.25, 4, 7]} />
        <meshStandardMaterial color={i % 3 === 0 ? '#214b31' : '#285c3a'} />
      </mesh>
    </group>)}
  </group>
}

function Circuit() {
  return <group>
    <Environment />
    <Road />
    <SafetyBarriers />
    <StartFinish />
    {[0.115, 0.365, 0.62, 0.87].flatMap((corner, i) =>
      [0.025, 0.047, 0.07].map((before, j) =>
        <BrakingBoard key={`${i}-${j}`} t={corner - before} side={1} value={['50', '100', '150'][j]} />
      )
    )}
  </group>
}

function RacingCar({ pose }: { pose: React.RefObject<CarPose> }) {
  const { scene } = useGLTF('/models/formula-car/formula-car/scene.gltf')
  const car = useRef<THREE.Group>(null)
  const model = useMemo(() => {
    const root = scene.clone(true)
    root.rotation.y = Math.PI
    const original = new THREE.Box3().setFromObject(root)
    const size = original.getSize(new THREE.Vector3())
    root.scale.setScalar(5.8 / Math.max(size.x, size.z, 0.001))
    const bounds = new THREE.Box3().setFromObject(root)
    const center = bounds.getCenter(new THREE.Vector3())
    root.position.set(-center.x, -bounds.min.y + 0.08, -center.z)
    root.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return root
  }, [scene])
  useFrame((_, dt) => {
    if (!car.current) return
    const p = pose.current
    car.current.position.set((p.x - 500) * SCALE, 0.08, (p.y - 325) * SCALE)
    car.current.rotation.y = -p.heading - Math.PI / 2
  })
  return <group ref={car}>
    <primitive object={model} />

  </group>
}

function ChaseCamera({ pose }: { pose: React.RefObject<CarPose> }) {
  const { camera } = useThree()
  useFrame((_, dt) => {
    const p = pose.current
    const x = (p.x - 500) * SCALE, z = (p.y - 325) * SCALE
    const fx = Math.cos(p.heading), fz = Math.sin(p.heading)
    const desired = new THREE.Vector3(x - fx * 6.3, 2.85, z - fz * 6.3)
    camera.position.lerp(desired, 1 - Math.exp(-5 * dt))
    camera.lookAt(x + fx * 8, 1.1, z + fz * 8)
  })
  return null
}


// Non-colliding translucent reference car, synchronized to the fastest AI lap.
function PoleGhost({ clock, lapTime }: {
  clock: React.RefObject<number>; lapTime: number
}) {
  const ghost = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ghost.current) return
    ghost.current.visible = lapTime > 0 && clock.current > 0 && clock.current <= lapTime
    if (!ghost.current.visible) return
    const progress = Math.min(0.9999, clock.current / lapTime)
    const point = at(progress)
    const direction = tangent(progress)
    ghost.current.position.set(point.x, 0.22, point.z)
    ghost.current.rotation.y = -Math.atan2(direction.z, direction.x) - Math.PI / 2
  })
  return <group ref={ghost} visible={false}>
    <mesh position={[0, 0.38, 0]}>
      <boxGeometry args={[2.1, 0.35, 5.5]} />
      <meshBasicMaterial color="#49e5ff" transparent opacity={0.33} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0.64, -0.4]}>
      <boxGeometry args={[1.2, 0.52, 1.9]} />
      <meshBasicMaterial color="#7ceeff" transparent opacity={0.38} depthWrite={false} />
    </mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 1.18, 0.28, -1.55]}>
        <boxGeometry args={[0.43, 0.52, 0.82]} />
        <meshBasicMaterial color="#30c9ed" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh position={[side * 1.18, 0.28, 1.55]}>
        <boxGeometry args={[0.43, 0.52, 0.82]} />
        <meshBasicMaterial color="#30c9ed" transparent opacity={0.48} depthWrite={false} />
      </mesh>
    </group>)}
    <mesh position={[0, 0.5, -2.3]}>
      <boxGeometry args={[3.1, 0.10, 0.6]} />
      <meshBasicMaterial color="#49e5ff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  </group>
}
export default function Level02Track3D({ pose, ghostClock, ghostLapTime }: {
  pose: React.RefObject<CarPose>
  ghostClock: React.RefObject<number>
  ghostLapTime: number
}) {
  return <Canvas shadows camera={{ position: [-18, 8, 20], fov: 64, near: 0.1, far: 500 }} dpr={[1, 1.7]} gl={{ antialias: true }} style={{ width: '100%', height: '100%', display: 'block' }}>
    <color attach="background" args={['#b3d2e5']} />
    <fog attach="fog" args={['#b3d2e5', 105, 260]} />
    <ambientLight intensity={0.9} />
    <hemisphereLight args={['#e7f4ff', '#35583b', 1.1]} />
    <directionalLight position={[35, 70, 25]} intensity={2.0} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={110} shadow-camera-bottom={-110} />
    <Circuit />
    <Suspense fallback={null}><RacingCar pose={pose} /></Suspense>
    <PoleGhost clock={ghostClock} lapTime={ghostLapTime} />
    <ChaseCamera pose={pose} />
  </Canvas>
}

useGLTF.preload('/models/formula-car/formula-car/scene.gltf')
