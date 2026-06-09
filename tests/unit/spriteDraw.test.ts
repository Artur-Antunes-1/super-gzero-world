// tests/unit/spriteDraw.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { Renderer } from '../../src/engine/render'
import type { ImageAsset } from '../../src/engine/assets'
import { createAnimator } from '../../src/engine/animator'
import { drawAnimatedSprite } from '../../src/engine/spriteDraw'

// ctx espiao: jsdom nao desenha; registramos as chamadas.
function makeCtxStub() {
  return {
    canvas: { width: 960, height: 528 },
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
  }
}

// Renderer falso que so expoe o ctx (drawAnimatedSprite usa r.ctx.*).
function makeRenderer(ctx: ReturnType<typeof makeCtxStub>): Renderer {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    present: vi.fn(),
  }
}

// ImageAsset falso: src e so um marcador; drawImage nunca toca o pixel real.
const FAKE_SRC = { tag: 'fake-image' } as unknown as CanvasImageSource
const asset: ImageAsset = { src: FAKE_SRC, w: 64, h: 96 }

const body = { vx: 0, vy: 0, onGround: true }

describe('drawAnimatedSprite', () => {
  it('com asset desenha 1x via save/translate/scale/rotate/drawImage e fecha com restore', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    const an = createAnimator()
    drawAnimatedSprite(r, asset, an, 100, 200, 34, 42, 1, body)

    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.translate).toHaveBeenCalledTimes(1)
    expect(ctx.scale).toHaveBeenCalledTimes(1)
    expect(ctx.rotate).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
    // o primeiro argumento de drawImage e a IMAGEM do asset
    expect(ctx.drawImage.mock.calls[0][0]).toBe(FAKE_SRC)
  })

  it('asset null NAO desenha (fallback fica no game via drawPlaceholder)', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    const an = createAnimator()
    drawAnimatedSprite(r, null, an, 100, 200, 34, 42, 1, body)

    expect(ctx.drawImage).not.toHaveBeenCalled()
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.restore).not.toHaveBeenCalled()
  })

  it('ancora no centro horizontal: translate recebe x exato passado (centro do corpo)', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    const an = createAnimator()
    drawAnimatedSprite(r, asset, an, 100, 200, 34, 42, 1, body)
    // translate(x, y + offsetY): primeiro arg e o centro horizontal recebido
    expect(ctx.translate.mock.calls[0][0]).toBe(100)
  })

  it('facing=-1 espelha: scaleX fica negativo', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    const an = createAnimator()
    drawAnimatedSprite(r, asset, an, 100, 200, 34, 42, -1, body)
    // scale(facing*scaleX, scaleY) -> primeiro arg negativo
    expect(ctx.scale.mock.calls[0][0]).toBeLessThan(0)
  })

  it('todos os argumentos de translate/scale/rotate sao finitos', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    const an = createAnimator()
    drawAnimatedSprite(r, asset, an, 100, 200, 34, 42, 1, body)
    for (const args of [
      ...ctx.translate.mock.calls,
      ...ctx.scale.mock.calls,
      ...ctx.rotate.mock.calls,
    ]) {
      for (const v of args) expect(Number.isFinite(v as number)).toBe(true)
    }
  })
})
