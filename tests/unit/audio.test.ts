// tests/unit/audio.test.ts — D2: motor de audio procedural (WebAudio).
// jsdom NAO implementa WebAudio: o caminho no-op e testado direto e o
// caminho real via FakeAudioContext (vi.stubGlobal).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createAudio } from '../../src/engine/audio'

// ---------- Fakes WebAudio ----------

class FakeParam {
  value = 0
  sets: Array<{ v: number; t: number }> = []
  ramps: Array<{ v: number; t: number }> = []
  setValueAtTime(v: number, t: number): void {
    this.sets.push({ v, t })
    this.value = v
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    this.ramps.push({ v, t })
  }
}

class FakeNode {
  targets: unknown[] = []
  connect(t: unknown): unknown {
    this.targets.push(t)
    return t
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  onended: (() => void) | null = null
  started = false
  stopped = false
  start(): void {
    this.started = true
  }
  stop(): void {
    this.stopped = true
  }
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  onended: (() => void) | null = null
  started = false
  start(): void {
    this.started = true
  }
  stop(): void {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  sampleRate = 48000
  currentTime = 0
  state = 'suspended'
  destination = { eDestino: true }
  resumeCalls = 0
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  bufferSources: FakeBufferSource[] = []
  buffersCreated = 0
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createGain(): FakeGain {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator()
    this.oscillators.push(o)
    return o
  }
  createBuffer(_ch: number, len: number, _rate: number): { getChannelData(c: number): Float32Array } {
    this.buffersCreated++
    const data = new Float32Array(len)
    return { getChannelData: () => data }
  }
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource()
    this.bufferSources.push(s)
    return s
  }
  resume(): Promise<void> {
    this.resumeCalls++
    this.state = 'running'
    return Promise.resolve()
  }
}

// Cria o bus com o fake stubado e devolve tambem o contexto criado.
function setup(): { bus: ReturnType<typeof createAudio>; ctx: FakeAudioContext } {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  const bus = createAudio()
  const ctx = FakeAudioContext.instances[FakeAudioContext.instances.length - 1]
  return { bus, ctx }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeAudioContext.instances.length = 0
})

// ---------- Sem AudioContext (jsdom puro) ----------

describe('createAudio sem AudioContext', () => {
  it('vira no-op silencioso: enabled=false e play/unlock nao lancam', () => {
    const bus = createAudio()
    expect(bus.enabled).toBe(false)
    expect(() => bus.play('jump')).not.toThrow()
    expect(() => bus.play('inexistente')).not.toThrow()
    expect(() => bus.unlock()).not.toThrow()
  })

  it('construtor que lanca tambem vira no-op', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('boom')
        }
      },
    )
    const bus = createAudio()
    expect(bus.enabled).toBe(false)
    expect(() => bus.play('coin')).not.toThrow()
  })

  it('cai no webkitAudioContext quando so ele existe (Safari antigo)', () => {
    vi.stubGlobal('webkitAudioContext', FakeAudioContext)
    const bus = createAudio()
    expect(bus.enabled).toBe(true)
    expect(FakeAudioContext.instances).toHaveLength(1)
  })
})

// ---------- Com FakeAudioContext ----------

describe('createAudio com AudioContext', () => {
  it('init: master gain 0.35 no destination e ruido gerado UMA vez', () => {
    const { bus, ctx } = setup()
    expect(bus.enabled).toBe(true)
    // gains[0] e o master.
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.35)
    expect(ctx.gains[0].targets).toContain(ctx.destination)
    // Buffer de ruido criado no init, nao por play.
    expect(ctx.buffersCreated).toBe(1)
    bus.play('hurt')
    expect(ctx.buffersCreated).toBe(1)
  })

  it('play(jump): oscilador square 220->440Hz, 80ms, started', () => {
    const { bus, ctx } = setup()
    bus.play('jump')
    expect(ctx.oscillators).toHaveLength(1)
    const osc = ctx.oscillators[0]
    expect(osc.type).toBe('square')
    expect(osc.started).toBe(true)
    expect(osc.frequency.sets[0].v).toBe(220)
    expect(osc.frequency.ramps[0].v).toBe(440)
    expect(osc.frequency.ramps[0].t).toBeCloseTo(0.08)
  })

  it('play(jump): envelope exponencial aplicado (pico -> ~0) e roteado pelo master', () => {
    const { bus, ctx } = setup()
    bus.play('jump')
    // gains[0] = master; gains[1] = envelope da nota.
    const env = ctx.gains[1]
    expect(env.gain.sets[0].v).toBeGreaterThan(0)
    expect(env.gain.ramps[0].v).toBeLessThanOrEqual(0.01)
    expect(env.gain.ramps[0].t).toBeCloseTo(0.08)
    // Roteamento: osc -> env -> master.
    expect(ctx.oscillators[0].targets).toContain(env)
    expect(env.targets).toContain(ctx.gains[0])
  })

  it('coin tem 2 notas, win tem 3 (arpejo), humanware tem 2 (acorde)', () => {
    const { bus, ctx } = setup()
    bus.play('coin')
    expect(ctx.oscillators).toHaveLength(2)
    expect(ctx.oscillators.every((o) => o.type === 'triangle')).toBe(true)
    bus.play('win')
    expect(ctx.oscillators).toHaveLength(5)
    bus.play('humanware')
    expect(ctx.oscillators).toHaveLength(7)
  })

  it('hurt = oscilador + ruido (buffer source com envelope)', () => {
    const { bus, ctx } = setup()
    bus.play('hurt')
    expect(ctx.oscillators).toHaveLength(1)
    expect(ctx.bufferSources).toHaveLength(1)
    const src = ctx.bufferSources[0]
    expect(src.started).toBe(true)
    expect(src.buffer).not.toBeNull()
  })

  it('todos os eventos do contrato tocam sem lancar', () => {
    const { bus, ctx } = setup()
    const eventos = [
      'jump', 'coin', 'stomp', 'hurt', 'cast', 'humanware',
      'win', 'over', 'checkpoint', 'qblock', 'heart',
    ]
    for (const e of eventos) {
      expect(() => bus.play(e)).not.toThrow()
      // Cada onended dispara para liberar a voz (evita bater no cap aqui).
      for (const o of ctx.oscillators) o.onended?.()
      for (const s of ctx.bufferSources) s.onended?.()
    }
    expect(ctx.oscillators.length).toBeGreaterThan(0)
  })

  it('cap de vozes: acima de 8 fontes ativas play vira no-op', () => {
    const { bus, ctx } = setup()
    for (let i = 0; i < 12; i++) bus.play('qblock') // 1 fonte por play
    expect(ctx.oscillators).toHaveLength(8)
  })

  it('onended libera a voz e play volta a funcionar', () => {
    const { bus, ctx } = setup()
    for (let i = 0; i < 8; i++) bus.play('qblock')
    expect(ctx.oscillators).toHaveLength(8)
    ctx.oscillators[0].onended?.()
    bus.play('qblock')
    expect(ctx.oscillators).toHaveLength(9)
  })

  it('unlock chama resume() do contexto', () => {
    const { bus, ctx } = setup()
    expect(ctx.resumeCalls).toBe(0)
    bus.unlock()
    expect(ctx.resumeCalls).toBe(1)
    expect(() => bus.unlock()).not.toThrow()
  })

  it('evento desconhecido e bus desabilitado nao criam fontes', () => {
    const { bus, ctx } = setup()
    bus.play('nao-existe')
    expect(ctx.oscillators).toHaveLength(0)
    bus.enabled = false
    bus.play('jump')
    expect(ctx.oscillators).toHaveLength(0)
  })
})
