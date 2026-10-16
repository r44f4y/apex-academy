export class QualifyingEngineAudio {
  private ctx: AudioContext | null = null
  private oscillators: OscillatorNode[] = []
  private gain: GainNode | null = null
  private filters: BiquadFilterNode[] = []
  private rpm = 1100

  private muted = false

  async start() {
    if (this.ctx) {
      await this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0.075
    master.connect(ctx.destination)
    this.gain = master
    for (const [i, type] of (['sawtooth', 'triangle', 'sawtooth'] as OscillatorType[]).entries()) {
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const volume = ctx.createGain()
      osc.type = type
      filter.type = 'lowpass'
      filter.frequency.value = 700
      volume.gain.value = [0.24, 0.55, 0.12][i]
      osc.connect(filter)
      filter.connect(volume)
      volume.connect(master)
      osc.start()
      this.oscillators.push(osc)
      this.filters.push(filter)
    }
  }

  update(speed: number, throttle: boolean, braking: boolean, dt: number) {
    if (!this.ctx || !this.gain) return
    const ctx = this.ctx
    // Simulated automatic gearbox; engine revs follow speed and throttle.
    const newGear = Math.min(7, Math.max(1, Math.floor(speed / 36) + 1))
    const low = (newGear - 1) * 36
    const gearFraction = Math.max(0, Math.min(1, (speed - low) / 36))
    const target = speed < 3 && !throttle
      ? 1100
      : Math.min(11500, 1800 + gearFraction * 6700 + (throttle ? 1500 : 0) - (braking ? 1100 : 0))
    this.rpm += (target - this.rpm) * (1 - Math.exp(-(target < this.rpm ? 6 : 3.5) * dt))
    const base = 32 + this.rpm / 105
    this.oscillators.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(base * [1, 1.5, 2.01][i], ctx.currentTime, 0.035)
    })
    this.filters.forEach(filter => {
      filter.frequency.setTargetAtTime(380 + this.rpm * 0.24, ctx.currentTime, 0.07)
    })
    this.gain.gain.setTargetAtTime(this.muted ? 0 : (0.035 + this.rpm / 145000) * (throttle ? 1 : 0.72), ctx.currentTime, 0.09)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.ctx && this.gain && muted) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04)
  }

  stop() {
    this.oscillators.forEach(osc => { try { osc.stop() } catch { /* already stopped */ } })
    this.oscillators = []
    this.filters = []
    void this.ctx?.close()
    this.ctx = null
    this.gain = null
    this.rpm = 1100
  }
}
