// tests/unit/animator.test.ts
import { describe, it, expect } from 'vitest'
import { WALK_MAX } from '../../src/engine/constants'
import {
  createAnimator,
  classifyAnim,
  updateAnimator,
  getTransform,
  type AnimState,
} from '../../src/engine/animator'

// Body minimo aceito por classifyAnim/getTransform (subconjunto estrutural de physics.Body)
function body(over: { vx?: number; vy?: number; onGround?: boolean } = {}) {
  return { vx: 0, vy: 0, onGround: true, ...over }
}

describe('createAnimator', () => {
  it('comeca em idle com t=0', () => {
    const an = createAnimator()
    expect(an.state).toBe('idle')
    expect(an.t).toBe(0)
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
    // |vx| > WALK_MAX+0.3 e estrito; no ponto exato cai em walk
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

describe('updateAnimator', () => {
  it('reseta t para 0 ao TROCAR de estado', () => {
    const an = createAnimator() // idle, t=0
    // acumula tempo em idle
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
    updateAnimator(an, body({ vx: 0, onGround: true }), 0, 1)
    updateAnimator(an, body({ vx: 0, onGround: true }), 0, 1)
    updateAnimator(an, body({ vx: 0, onGround: true }), 0, 2)
    expect(an.state).toBe('idle')
    expect(an.t).toBe(4)
  })
})

describe('getTransform', () => {
  const STATES: AnimState[] = ['idle', 'walk', 'run', 'jump', 'fall', 'hurt']

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
    // pega offsetY ao longo de uma volta do seno (t*0.06)
    const samples: number[] = []
    for (let t = 0; t < 120; t++) {
      an.t = t
      samples.push(getTransform(an, body()).offsetY)
    }
    const min = Math.min(...samples)
    const max = Math.max(...samples)
    expect(max - min).toBeGreaterThan(0.5) // oscila de fato (amplitude ~2)
  })

  it('hurt: transform "flat" (1,1,0,0)', () => {
    const an = createAnimator()
    an.state = 'hurt'
    an.t = 42
    const tf = getTransform(an, body())
    expect(tf.scaleX).toBe(1)
    expect(tf.scaleY).toBe(1)
    expect(tf.rotation).toBe(0)
    expect(tf.offsetY).toBe(0)
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
