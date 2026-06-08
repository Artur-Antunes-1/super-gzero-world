// tests/unit/loop.test.ts
// Per Errata E1: step receives dt in FRAMES. Each fixed step calls step(1).
// The accumulator uses real wall-clock time: every FIXED_DT seconds elapsed -> 1 fixed step -> step(1).
import { describe, it, expect, vi } from 'vitest'
import { createLoop, type Loop } from '../../src/engine/loop'
import { FIXED_DT, MAX_SUBSTEPS } from '../../src/engine/constants'

// tick is exposed for testing without changing the public Loop interface.
type TestableLoop = Loop & { tick(tMs: number): void }

const FIXED_MS = FIXED_DT * 1000 // 1/60 s em ms

describe('createLoop', () => {
  it('chama step uma vez por FIXED_DT acumulado, com argumento 1 (dt em frames)', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    // primeiro tick estabelece o tempo base (sem acumular dt anterior)
    loop.tick(0)
    expect(step).toHaveBeenCalledTimes(0)

    // avanca exatamente 3 passos fixos
    t = 3 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(3)
    // cada step recebe exatamente 1 (dt em frames, per Errata E1)
    for (const call of step.mock.calls) {
      expect(call[0]).toBe(1)
    }
  })

  it('acumula fracoes entre frames sem perder tempo', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    // meio passo: nao deve disparar step ainda
    t = 0.5 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(0)

    // mais meio passo: agora completa 1 passo
    t = 1.0 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(1)
    // step recebe 1 (um frame), per Errata E1
    expect(step.mock.calls[0][0]).toBe(1)
  })

  it('faz clamp em MAX_SUBSTEPS para evitar a espiral da morte', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    // salto enorme de tempo (ex.: aba ficou em background por 1s = 60 passos)
    t = 60 * FIXED_MS
    loop.tick(t)
    // mesmo com 60 passos pendentes, no maximo MAX_SUBSTEPS por frame
    expect(step).toHaveBeenCalledTimes(MAX_SUBSTEPS)
    // todos com argumento 1
    for (const call of step.mock.calls) {
      expect(call[0]).toBe(1)
    }
  })

  it('chama render uma vez por tick com alpha em [0,1)', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    expect(render).toHaveBeenCalledTimes(1)

    // 1.5 passos: 1 step + sobra 0.5 -> alpha ~= 0.5
    t = 1.5 * FIXED_MS
    loop.tick(t)
    expect(render).toHaveBeenCalledTimes(2)
    const lastAlpha = render.mock.calls[render.mock.calls.length - 1][0] as number
    expect(lastAlpha).toBeGreaterThanOrEqual(0)
    expect(lastAlpha).toBeLessThan(1)
    expect(lastAlpha).toBeCloseTo(0.5, 6)
  })

  it('start agenda via requestAnimationFrame e stop cancela', () => {
    const step = vi.fn()
    const render = vi.fn()

    const rafCalls: FrameRequestCallback[] = []
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback): number => {
        rafCalls.push(cb)
        return rafCalls.length
      })
    const cancelSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => {})

    const loop = createLoop(step, render)
    loop.start()
    expect(rafSpy).toHaveBeenCalledTimes(1)

    // simula o primeiro frame entregue pelo navegador
    rafCalls[0](0)
    // o frame reagenda o proximo raf
    expect(rafSpy).toHaveBeenCalledTimes(2)

    loop.stop()
    expect(cancelSpy).toHaveBeenCalledTimes(1)

    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })
})
