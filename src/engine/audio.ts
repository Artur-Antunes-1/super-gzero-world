// src/engine/audio.ts — D2: SFX 100% procedurais via WebAudio (zero assets).
// Receitas curtas (50-300ms): osciladores square/triangle com sweep de
// frequencia + envelope exponencial, e ruido branco gerado UMA vez no init.
// Sem AudioContext disponivel (testes/jsdom) vira no-op silencioso.

export interface AudioBus {
  play(name: string): void
  unlock(): void
  enabled: boolean
}

const MASTER_VOL = 0.35
// Cap de fontes ativas simultaneas: acima disso play vira no-op.
const VOICE_CAP = 8
const NOISE_SECONDS = 0.15
// Alvo do decaimento exponencial (exponentialRamp nao aceita 0).
const ENV_FLOOR = 0.001

// Uma nota: oscilador com sweep opcional f0->f1 e envelope exponencial.
interface Nota {
  type: OscillatorType
  f0: number
  /** Frequencia final do sweep; ausente = tom constante. */
  f1?: number
  /** Offset do inicio dentro da receita (s). */
  at: number
  /** Duracao (s). */
  dur: number
  /** Pico do envelope (default 0.5). */
  vol?: number
}

interface Receita {
  notas: Nota[]
  ruido?: { at: number; dur: number; vol: number }
}

// Mapa de receitas por nome de evento (mesmos nomes do contrato game.events).
const RECEITAS: Record<string, Receita> = {
  jump: { notas: [{ type: 'square', f0: 220, f1: 440, at: 0, dur: 0.08 }] },
  coin: {
    // 2 notas curtas subindo (90ms no total).
    notas: [
      { type: 'triangle', f0: 880, at: 0, dur: 0.045 },
      { type: 'triangle', f0: 1320, at: 0.045, dur: 0.045 },
    ],
  },
  stomp: { notas: [{ type: 'square', f0: 160, f1: 80, at: 0, dur: 0.07 }] },
  hurt: {
    notas: [{ type: 'square', f0: 200, f1: 90, at: 0, dur: 0.14 }],
    ruido: { at: 0, dur: 0.06, vol: 0.25 },
  },
  cast: { notas: [{ type: 'triangle', f0: 520, f1: 780, at: 0, dur: 0.07 }] },
  humanware: {
    // Acorde (duas notas simultaneas).
    notas: [
      { type: 'triangle', f0: 440, at: 0, dur: 0.2, vol: 0.35 },
      { type: 'triangle', f0: 660, at: 0, dur: 0.2, vol: 0.35 },
    ],
  },
  win: {
    // Arpejo C5/E5/G5, 3 notas de 80ms.
    notas: [
      { type: 'triangle', f0: 523, at: 0, dur: 0.08 },
      { type: 'triangle', f0: 659, at: 0.08, dur: 0.08 },
      { type: 'triangle', f0: 784, at: 0.16, dur: 0.08 },
    ],
  },
  over: { notas: [{ type: 'square', f0: 196, f1: 98, at: 0, dur: 0.3 }] },
  checkpoint: { notas: [{ type: 'triangle', f0: 660, f1: 880, at: 0, dur: 0.08 }] },
  qblock: { notas: [{ type: 'square', f0: 700, at: 0, dur: 0.05 }] },
  heart: { notas: [{ type: 'triangle', f0: 990, f1: 1320, at: 0, dur: 0.09 }] },
}

// Bus inerte para ambientes sem WebAudio (jsdom/testes).
function noopBus(): AudioBus {
  return { play() {}, unlock() {}, enabled: false }
}

export function createAudio(): AudioBus {
  type CtxCtor = new () => AudioContext
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined
  // Safari antigo expoe so webkitAudioContext.
  const Ctor = (w?.AudioContext ?? w?.webkitAudioContext) as CtxCtor | undefined
  if (!Ctor) return noopBus()

  let ctx: AudioContext
  let master: GainNode
  let noiseBuf: AudioBuffer
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = MASTER_VOL
    master.connect(ctx.destination)
    // Ruido branco gerado UMA vez no init (aleatoriedade de runtime e
    // permitida AQUI dentro — a restricao de determinismo vale so pro animator).
    const len = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  } catch {
    return noopBus()
  }

  let vozes = 0

  // Conta a fonte como voz ativa e libera quando ela termina.
  function rastreia(src: AudioScheduledSourceNode): void {
    vozes++
    src.onended = () => {
      vozes = Math.max(0, vozes - 1)
    }
  }

  // Envelope exponencial: ataque imediato no pico, decai ate o floor.
  function envelope(vol: number, ini: number, dur: number): GainNode {
    const env = ctx.createGain()
    env.gain.setValueAtTime(vol, ini)
    env.gain.exponentialRampToValueAtTime(ENV_FLOOR, ini + dur)
    env.connect(master)
    return env
  }

  function tocaNota(n: Nota, t0: number): void {
    const ini = t0 + n.at
    const osc = ctx.createOscillator()
    osc.type = n.type
    osc.frequency.setValueAtTime(n.f0, ini)
    if (n.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(n.f1, ini + n.dur)
    osc.connect(envelope(n.vol ?? 0.5, ini, n.dur))
    rastreia(osc)
    osc.start(ini)
    osc.stop(ini + n.dur + 0.01)
  }

  function tocaRuido(r: { at: number; dur: number; vol: number }, t0: number): void {
    const ini = t0 + r.at
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    src.connect(envelope(r.vol, ini, r.dur))
    rastreia(src)
    src.start(ini)
    src.stop(ini + r.dur + 0.01)
  }

  const bus: AudioBus = {
    enabled: true,
    play(name: string): void {
      if (!bus.enabled) return
      // FINAL (revisão): contexto suspenso nao agenda nada — fontes num
      // contexto parado nunca disparam onended (cap travaria) e tocariam
      // todas de uma vez quando o contexto resumisse.
      if (ctx.state && ctx.state !== 'running') return
      const rec = RECEITAS[name]
      if (!rec) return
      if (vozes >= VOICE_CAP) return // cap de vozes atingido
      try {
        const t0 = ctx.currentTime
        for (const n of rec.notas) tocaNota(n, t0)
        if (rec.ruido) tocaRuido(rec.ruido, t0)
      } catch {
        // audio nunca derruba o jogo
      }
    },
    unlock(): void {
      // Autoplay policy: resume() no primeiro gesto do usuario.
      try {
        void Promise.resolve(ctx.resume()).catch(() => {})
      } catch {
        // contexto sem resume — ignora
      }
    },
  }
  return bus
}
