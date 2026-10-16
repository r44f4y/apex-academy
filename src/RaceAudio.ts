/**
 * APEX Academy procedural race audio. No external sound assets required.
 * Audio is created only after a player gesture (GO TO STARTING GRID).
 */
export type SeasonSound = 'summer' | 'autumn' | 'winter' | 'spring'
export class RaceAudio {
  private ctx: AudioContext | null = null
  private engine: OscillatorNode | null = null
  private engineHarmonic: OscillatorNode | null = null
  private engineGain: GainNode | null = null
  private rainSource: AudioBufferSourceNode | null = null
  private rainGain: GainNode | null = null
  private lastImpact = -100
  private lastHazard = -100
  private lastRainSlip = -100
  private lastLight = 0
  private season: SeasonSound
  constructor(season: SeasonSound) { this.season = season }

  start() {
    if (this.ctx) { void this.ctx.resume(); return }
    const ctx = new AudioContext()
    this.ctx = ctx
    void ctx.resume()
    const master = ctx.createDynamicsCompressor()
    master.threshold.value = -12
    master.ratio.value = 4
    master.connect(ctx.destination)
    const engineGain = ctx.createGain()
    engineGain.gain.value = 0
    engineGain.connect(master)
    this.engineGain = engineGain
    const low = ctx.createOscillator()
    const high = ctx.createOscillator()
    low.type = 'sawtooth'
    high.type = 'triangle'
    const highGain = ctx.createGain()
    highGain.gain.value = 0.32
    low.connect(engineGain)
    high.connect(highGain).connect(engineGain)
    low.frequency.value = 62
    high.frequency.value = 124
    low.start(); high.start()
    this.engine = low
    this.engineHarmonic = high
  }
  private tone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine', slide = 1) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(10, freq), t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, freq * slide), t + duration)
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t); osc.stop(t + duration + 0.02)
  }
  private noise(duration: number, volume: number, highpass: number, lowpass: number) {
    const ctx = this.ctx
    if (!ctx) return
    const frames = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i=0;i<frames;i++) samples[i] = Math.random()*2-1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = highpass
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = lowpass
    const gain = ctx.createGain()
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(volume, t+0.018)
    gain.gain.exponentialRampToValueAtTime(0.001, t+duration)
    src.connect(hp).connect(lp).connect(gain).connect(ctx.destination)
    src.start(); src.stop(t+duration+0.02)
  }
  light(index: number) {
    if (!this.ctx || index <= this.lastLight || index > 5) return
    this.lastLight = index
    this.tone(720, 0.22, 0.23, 'square', 0.99)
    this.tone(360, 0.22, 0.12, 'sine')
  }
  lightsOut() {
    this.tone(1030, 0.48, 0.30, 'square', 1.28)
    this.tone(515, 0.50, 0.18, 'triangle', 1.12)
  }
  engineSpeed(speed: number, accelerating: boolean) {
    const ctx = this.ctx
    if (!ctx || !this.engine || !this.engineHarmonic || !this.engineGain) return
    const t = ctx.currentTime
    const speedFraction = Math.max(0, Math.min(1, speed / 24))
    const freq = 58 + speedFraction * 190 + (accelerating ? 24 : 0)
    this.engine.frequency.setTargetAtTime(freq, t, 0.10)
    this.engineHarmonic.frequency.setTargetAtTime(freq * 2.02, t, 0.10)
    this.engineGain.gain.setTargetAtTime(0.0135 + speedFraction * 0.0225, t, 0.12)
  }
  silenceEngine() {
    if (this.ctx && this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
  }
  impact() {
    const ctx = this.ctx
    if (!ctx || ctx.currentTime - this.lastImpact < 0.35) return
    this.lastImpact = ctx.currentTime
    this.noise(0.24, 0.20, 90, 1250)
    this.tone(110, 0.25, 0.23, 'triangle', 0.36)
  }
  hazard() {
    const ctx = this.ctx
    if (!ctx || ctx.currentTime - this.lastHazard < 0.5) return
    this.lastHazard = ctx.currentTime
    if (this.season === 'summer') {
      this.noise(0.85, 0.11, 300, 2900)
      this.tone(180, 0.55, 0.055, 'sawtooth', 0.62)
    } else if (this.season === 'autumn') {
      this.noise(0.44, 0.16, 650, 6800)
      this.noise(0.24, 0.11, 1400, 9000)
    } else if (this.season === 'spring') {
      this.noise(0.36, 0.13, 250, 1800)
      this.tone(270, 0.37, 0.16, 'sine', 0.42)
    }
  }
  setRain(on: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    if (!on) {
      this.rainGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
      return
    }
    if (this.rainSource) {
      this.rainGain?.gain.setTargetAtTime(0.055, ctx.currentTime, 0.5)
      return
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1
    const src = ctx.createBufferSource()
    src.buffer=buffer; src.loop=true
    const filter=ctx.createBiquadFilter()
    filter.type='lowpass'; filter.frequency.value=2200
    const gain=ctx.createGain()
    gain.gain.value=0
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
    gain.gain.setTargetAtTime(0.055, ctx.currentTime, 0.5)
    this.rainSource=src; this.rainGain=gain
  }
  slip(intensity: number) {
    const ctx=this.ctx
    if (!ctx || this.season!=='winter' || ctx.currentTime-this.lastRainSlip<0.65) return
    if (intensity < 0.4) return
    this.lastRainSlip=ctx.currentTime
    this.noise(0.48, 0.07, 1100, 6000)
    this.tone(460, 0.35, 0.045, 'triangle', 0.67)
  }
  resetStart() { this.lastLight=0; this.setRain(false) }
  stop() {
    if (!this.ctx) return
    void this.ctx.close()
    this.ctx=null; this.engine=null; this.engineHarmonic=null
    this.engineGain=null; this.rainSource=null; this.rainGain=null
  }
}
