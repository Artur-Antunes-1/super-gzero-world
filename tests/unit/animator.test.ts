// tests/unit/animator.test.ts
import { describe, it, expect } from 'vitest'
import { WALK_MAX } from '../../src/engine/constants'
import {
  createAnimator,
  classifyAnim,
  updateAnimator,
  triggerOneShot,
  getTransform,
  getFrameTransform,
  type AnimState,
} from '../../src/engine/animator'

// Body minimo aceito por classifyAnim/getTransform (subconjunto estrutural de physics.Body)
function body(over: { vx?: number; vy?: number; onGround?: boolean } = {}) {
  return { vx: 0, vy: 0, onGround: true, ...over }
}

describe('createAnimator', () => {
  it('comeca em idle com t=0 e campos de one-shot zerados', () => {
    const an = createAnimator()
    expect(an.state).toBe('idle')
    expect(an.t).toBe(0)
    expect(an.oneShot).toBeNull()
    expect(an.oneShotT).toBe(0)
    expect(an.oneShotDur).toBe(0)
    expect(an.prevOnGround).toBe(true)
  })
})

describe('classifyAnim (6 casos + fronteiras)', () => {
  it('hurt: iframes>0 tem prioridade sobre tudo', () => {
    // Mesmo correndo no chao, iframes>0 => hurt
    const s: AnimState = classifyAnim(body({ vx: 99, vy: 0, onGround: true }), 1)
    expect(s).toBe('hurt')
    // E mesmo no ar
    expect(classifyAnim(body({ vy: -5, onGround: false }), 90)).toBe('hurt')
  })

  it('jump: no ar subindo (vy<0)', () => {
    expect(classifyAnim(body({ vy: -0.01, onGround: false }), 0)).toBe('jump')
  })

  it('fall: no ar caindo/parado verticalmente (vy>=0)', () => {
    expect(classifyAnim(body({ vy: 0, onGround: false }), 0)).toBe('fall')
    expect(classifyAnim(body({ vy: 5, onGround: false }), 0)).toBe('fall')
  })

  it('run: no chao com |vx| > WALK_MAX+0.3', () => {
    expect(classifyAnim(body({ vx: WALK_MAX + 0.31, onGround: true }), 0)).toBe('run')
    expect(classifyAnim(body({ vx: -(WALK_MAX + 0.31), onGround: true }), 0)).toBe('run')
  })

  it('fronteira run/walk: exatamente WALK_MAX+0.3 NAO e run (e walk)', () => {
    expect(classifyAnim(body({ vx: WALK_MAX + 0.3, onGround: true }), 0)).toBe('walk')
  })

  it('walk: no chao com |vx| > 0.3 e ate WALK_MAX+0.3', () => {
    expect(classifyAnim(body({ vx: 0.31, onGround: true }), 0)).toBe('walk')
    expect(classifyAnim(body({ vx: WALK_MAX, onGround: true }), 0)).toBe('walk')
  })

  it('fronteira walk/idle: exatamente 0.3 NAO e walk (e idle)', () => {
    expect(classifyAnim(body({ vx: 0.3, onGround: true }), 0)).toBe('idle')
    expect(classifyAnim(body({ vx: -0.3, onGround: true }), 0)).toBe('idle')
  })

  it('idle: no chao parado (|vx| <= 0.3) e iframes=0', () => {
    expect(classifyAnim(body({ vx: 0, onGround: true }), 0)).toBe('idle')
  })
})

describe('updateAnimator (classificacao basica)', () => {
  it('reseta t para 0 ao TROCAR de estado', () => {
    const an = createAnimator() // idle, t=0
    updateAnimator(an, body({ vx: 0, onGround: true }), 0, 5)
    expect(an.state).toBe('idle')
    expect(an.t).toBe(5)
    // troca para walk => t reinicia em 0
    updateAnimator(an, body({ vx: 1, onGround: true }), 0, 1)
    expect(an.state).toBe('walk')
    expect(an.t).toBe(0)
  })

  it('incrementa t por dt quando o estado NAO muda', () => {
    const an = createAnimator()
    updateAnimator(an, body(), 0, 1)
    updateAnimator(an, body(), 0, 1)
    updateAnimator(an, body(), 0, 2)
    expect(an.state).toBe('idle')
    expect(an.t).toBe(4)
  })

  it('retorna { landed: false } quando nao ha borda de pouso', () => {
    const an = createAnimator()
    expect(updateAnimator(an, body(), 0, 1)).toEqual({ landed: false })
    // entrando no ar tambem nao e pouso
    expect(updateAnimator(an, body({ vy: 5, onGround: false }), 0, 1)).toEqual({
      landed: false,
    })
  })
})

describe('updateAnimator — landed (borda de pouso)', () => {
  it('landed=true SOMENTE na borda ar->chao; auto-dispara land por 10 frames', () => {
    const an = createAnimator()
    // 1 frame no ar
    updateAnimator(an, body({ vy: 5, onGround: false }), 0, 1)
    expect(an.state).toBe('fall')
    // toca o chao: borda
    const r = updateAnimator(an, body({ onGround: true }), 0, 1)
    expect(r.landed).toBe(true)
    expect(an.state).toBe('land') // one-shot auto-disparado
    expect(an.oneShot).toBe('land')
    expect(an.oneShotDur).toBe(10) // LAND_FRAMES
    expect(an.t).toBe(0) // trocou de estado -> t zera
    // proximo frame no chao: ja nao e borda
    const r2 = updateAnimator(an, body({ onGround: true }), 0, 1)
    expect(r2.landed).toBe(false)
    expect(an.state).toBe('land') // one-shot segue ativo
  })

  it('land expira apos a duracao e volta a classificacao normal', () => {
    const an = createAnimator()
    updateAnimator(an, body({ vy: 5, onGround: false }), 0, 1)
    updateAnimator(an, body({ onGround: true }), 0, 1) // dispara land (dur=10)
    // roda ate expirar (com folga)
    let frames = 0
    while (an.state === 'land' && frames < 30) {
      updateAnimator(an, body({ onGround: true }), 0, 1)
      frames++
    }
    expect(frames).toBeLessThanOrEqual(11)
    expect(an.state).toBe('idle')
    expect(an.oneShot).toBeNull() // limpo apos expirar
    expect(an.t).toBe(0) // trocou de estado ao expirar
  })

  it('pouso com hurtFrames>0: landed=true mas NAO dispara land (estado hurt)', () => {
    const an = createAnimator()
    updateAnimator(an, body({ vy: 5, onGround: false }), 0, 1)
    const r = updateAnimator(an, body({ onGround: true }), 3, 1)
    expect(r.landed).toBe(true)
    expect(an.state).toBe('hurt')
    expect(an.oneShot).toBeNull()
  })

  it('pouso com one-shot ativo: landed=true mas NAO sobrescreve o one-shot', () => {
    const an = createAnimator()
    updateAnimator(an, body({ vy: 5, onGround: false }), 0, 1)
    triggerOneShot(an, 'cast', 18)
    const r = updateAnimator(an, body({ onGround: true }), 0, 1)
    expect(r.landed).toBe(true)
    expect(an.oneShot).toBe('cast') // cast continua
    expect(an.state).toBe('cast')
  })
})

describe('updateAnimator — one-shots (prioridade/expiracao)', () => {
  it('triggerOneShot seta oneShot/oneShotT/oneShotDur', () => {
    const an = createAnimator()
    triggerOneShot(an, 'cast', 18)
    expect(an.oneShot).toBe('cast')
    expect(an.oneShotT).toBe(0)
    expect(an.oneShotDur).toBe(18)
  })

  it('one-shot tem prioridade sobre a classificacao continua', () => {
    const an = createAnimator()
    triggerOneShot(an, 'cast', 18)
    // mesmo correndo, o estado e cast enquanto o one-shot dura
    updateAnimator(an, body({ vx: WALK_MAX + 1, onGround: true }), 0, 1)
    expect(an.state).toBe('cast')
    expect(an.oneShotT).toBe(1)
  })

  it('one-shot expira por oneShotT>=oneShotDur e classifica de novo', () => {
    const an = createAnimator()
    triggerOneShot(an, 'skid', 3)
    updateAnimator(an, body({ vx: WALK_MAX + 1, onGround: true }), 0, 1) // oneShotT 1
    updateAnimator(an, body({ vx: WALK_MAX + 1, onGround: true }), 0, 1) // oneShotT 2
    updateAnimator(an, body({ vx: WALK_MAX + 1, onGround: true }), 0, 1) // oneShotT 3
    expect(an.state).toBe('skid')
    // 3 >= 3 -> inativo: volta a classificar (run)
    updateAnimator(an, body({ vx: WALK_MAX + 1, onGround: true }), 0, 1)
    expect(an.state).toBe('run')
    expect(an.oneShot).toBeNull()
  })

  it('hurtFrames>0 cancela one-shot ativo e forca hurt', () => {
    const an = createAnimator()
    triggerOneShot(an, 'cast', 18)
    updateAnimator(an, body(), 0, 1)
    expect(an.state).toBe('cast')
    // toma dano no meio do cast
    updateAnimator(an, body(), 24, 1)
    expect(an.state).toBe('hurt')
    expect(an.oneShot).toBeNull()
    // hurt acabou: NAO retoma o cast cancelado
    updateAnimator(an, body(), 0, 1)
    expect(an.state).toBe('idle')
  })

  it('t zera ao ENTRAR no one-shot e acumula dentro dele', () => {
    const an = createAnimator()
    updateAnimator(an, body(), 0, 7) // idle t=7
    triggerOneShot(an, 'victory', 20)
    updateAnimator(an, body(), 0, 1)
    expect(an.state).toBe('victory')
    expect(an.t).toBe(0) // trocou de estado
    updateAnimator(an, body(), 0, 1)
    expect(an.t).toBe(1)
  })
})

describe('getFrameTransform (overlay sutil sobre os frames)', () => {
  const ALL: AnimState[] = [
    'idle', 'walk', 'run', 'jump', 'fall', 'hurt', 'land', 'skid', 'cast', 'victory',
  ]

  it('100% deterministico: mesmas entradas -> mesmo transform', () => {
    for (const st of ALL) {
      const a = createAnimator()
      a.state = st
      a.t = 17
      a.oneShot = st
      a.oneShotT = 4
      a.oneShotDur = 10
      const b = { ...a }
      expect(getFrameTransform(a, body({ vx: 3 }))).toEqual(
        getFrameTransform(b, body({ vx: 3 })),
      )
    }
  })

  it('sempre finito para todos os estados em varios t', () => {
    const an = createAnimator()
    for (const st of ALL) {
      for (const t of [0, 1, 7, 33, 120, 999]) {
        an.state = st
        an.t = t
        const tf = getFrameTransform(an, body({ vx: 2 }))
        for (const v of [tf.scaleX, tf.scaleY, tf.rotation, tf.offsetY]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })

  it('idle: respiracao SUTIL em scaleY (1 +/- 0.015), oscilando com t', () => {
    const an = createAnimator()
    an.state = 'idle'
    const ys: number[] = []
    for (let t = 0; t < 150; t++) {
      an.t = t
      const tf = getFrameTransform(an, body())
      expect(tf.scaleX).toBe(1)
      expect(tf.rotation).toBe(0)
      expect(tf.scaleY).toBeGreaterThanOrEqual(1 - 0.015 - 1e-9)
      expect(tf.scaleY).toBeLessThanOrEqual(1 + 0.015 + 1e-9)
      ys.push(tf.scaleY)
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.02) // oscila de fato
  })

  it('walk/run: lean +/-0.04 na direcao do vx + bob de ate 1px', () => {
    const an = createAnimator()
    for (const st of ['walk', 'run'] as const) {
      an.state = st
      an.t = 5
      const dir = getFrameTransform(an, body({ vx: 3 }))
      expect(dir.rotation).toBeCloseTo(0.04, 10)
      const esq = getFrameTransform(an, body({ vx: -3 }))
      expect(esq.rotation).toBeCloseTo(-0.04, 10)
      expect(Math.abs(dir.offsetY)).toBeLessThanOrEqual(1)
    }
  })

  it('jump: scaleY 1.04 / scaleX 0.97; fall: scaleY 1.06 / scaleX 0.96', () => {
    const an = createAnimator()
    an.state = 'jump'
    let tf = getFrameTransform(an, body({ onGround: false, vy: -3 }))
    expect(tf.scaleY).toBeCloseTo(1.04, 10)
    expect(tf.scaleX).toBeCloseTo(0.97, 10)
    an.state = 'fall'
    tf = getFrameTransform(an, body({ onGround: false, vy: 3 }))
    expect(tf.scaleY).toBeCloseTo(1.06, 10)
    expect(tf.scaleX).toBeCloseTo(0.96, 10)
  })

  it('land: squash 0.86/1.12 -> 1/1 interpolado por oneShotT/oneShotDur', () => {
    const an = createAnimator()
    an.state = 'land'
    an.oneShot = 'land'
    an.oneShotDur = 10
    // inicio: squash cheio
    an.oneShotT = 0
    let tf = getFrameTransform(an, body())
    expect(tf.scaleY).toBeCloseTo(0.86, 10)
    expect(tf.scaleX).toBeCloseTo(1.12, 10)
    // meio: entre o squash e a identidade
    an.oneShotT = 5
    tf = getFrameTransform(an, body())
    expect(tf.scaleY).toBeGreaterThan(0.86)
    expect(tf.scaleY).toBeLessThan(1)
    expect(tf.scaleX).toBeGreaterThan(1)
    expect(tf.scaleX).toBeLessThan(1.12)
    // fim: identidade
    an.oneShotT = 10
    tf = getFrameTransform(an, body())
    expect(tf.scaleY).toBeCloseTo(1, 10)
    expect(tf.scaleX).toBeCloseTo(1, 10)
    // duracao 0 nao divide por zero
    an.oneShotDur = 0
    tf = getFrameTransform(an, body())
    expect(Number.isFinite(tf.scaleY)).toBe(true)
    expect(tf.scaleY).toBeCloseTo(1, 10)
  })

  it('skid: rotation -0.08*sign(vx)', () => {
    const an = createAnimator()
    an.state = 'skid'
    expect(getFrameTransform(an, body({ vx: 5 })).rotation).toBeCloseTo(-0.08, 10)
    expect(getFrameTransform(an, body({ vx: -5 })).rotation).toBeCloseTo(0.08, 10)
  })

  it('cast: scaleX 1.05 breve', () => {
    const an = createAnimator()
    an.state = 'cast'
    const tf = getFrameTransform(an, body())
    expect(tf.scaleX).toBeCloseTo(1.05, 10)
    expect(tf.scaleY).toBe(1)
  })

  it('hurt e victory: identidade (1,1,0,0)', () => {
    const an = createAnimator()
    for (const st of ['hurt', 'victory'] as const) {
      an.state = st
      an.t = 42
      const tf = getFrameTransform(an, body())
      expect(tf).toEqual({ scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 })
    }
  })
})

describe('getTransform (procedural M2a — fallback do spriteDraw)', () => {
  const STATES: AnimState[] = [
    'idle', 'walk', 'run', 'jump', 'fall', 'hurt', 'land', 'skid', 'cast', 'victory',
  ]

  it('retorna sempre valores finitos para todos os estados em varios t', () => {
    const an = createAnimator()
    for (const st of STATES) {
      for (const t of [0, 1, 7, 33, 120, 999]) {
        an.state = st
        an.t = t
        const tf = getTransform(an, body())
        for (const v of [tf.scaleX, tf.scaleY, tf.rotation, tf.offsetY]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })

  it('idle: offsetY oscila com t (respiracao) — nao e constante', () => {
    const an = createAnimator()
    an.state = 'idle'
    const samples: number[] = []
    for (let t = 0; t < 120; t++) {
      an.t = t
      samples.push(getTransform(an, body()).offsetY)
    }
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5)
  })

  it('hurt e estados novos: transform "flat" (1,1,0,0)', () => {
    const an = createAnimator()
    for (const st of ['hurt', 'land', 'skid', 'cast', 'victory'] as const) {
      an.state = st
      an.t = 42
      expect(getTransform(an, body())).toEqual({
        scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0,
      })
    }
  })

  it('jump: stretch (scaleY>1, scaleX<1)', () => {
    const an = createAnimator()
    an.state = 'jump'
    an.t = 3
    const tf = getTransform(an, body())
    expect(tf.scaleY).toBeGreaterThan(1)
    expect(tf.scaleX).toBeLessThan(1)
  })
})
