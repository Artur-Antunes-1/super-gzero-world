// tests/unit/spriteAnim.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { Renderer } from '../../src/engine/render'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'
import type { SpriteTransform } from '../../src/engine/animator'
import {
  frameIndex,
  drawCharFrame,
  drawContactShadow,
  type CharAnimSet,
} from '../../src/engine/spriteAnim'

// FIXED_DT = 1/60 -> adv = floor(t * fps / 60).
function makeCtxStub() {
  return {
    canvas: { width: 960, height: 528 },
    globalAlpha: 1,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
  }
}
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
const FAKE_SRC = { tag: 'fake-sheet' } as unknown as CanvasImageSource
const FAKE_ASSET: ImageAsset = { src: FAKE_SRC, w: 384, h: 96 }
const storeWith: AssetStore = { get: () => FAKE_ASSET, ready: true }
const storeEmpty: AssetStore = { get: () => null, ready: true }
// Store que registra as chaves pedidas (para verificar fallbacks)
function makeStoreSpy() {
  const get = vi.fn((_key: string) => FAKE_ASSET)
  const store = { get, ready: true } as unknown as AssetStore
  return { store, get }
}

const SET: CharAnimSet = {
  cellW: 96,
  cellH: 96,
  anchorX: 48,
  anchorY: 92,
  drawH: 110,
  anims: {
    idle: { key: 'char.artur.idle', frames: 3, fps: 6, loop: true },
    walk: { key: 'char.artur.corrida', frames: 4, fps: 10, loop: true },
    jump: { key: 'char.artur.pulo', frames: 3, fps: 12, loop: false },
  },
}

describe('frameIndex', () => {
  it('loop: t=0 -> frame 0', () => {
    expect(frameIndex(SET.anims.walk!, 0)).toBe(0)
  })
  it('loop: avanca conforme fps e da wrap', () => {
    // walk fps=10: t=30 -> adv=floor(30*10/60)=5 -> 5%4=1
    expect(frameIndex(SET.anims.walk!, 30)).toBe(1)
    // t=60 -> adv=10 -> 10%4=2
    expect(frameIndex(SET.anims.walk!, 60)).toBe(2)
    // t=24 -> adv=floor(4)=4 -> 4%4=0 (volta ao inicio)
    expect(frameIndex(SET.anims.walk!, 24)).toBe(0)
  })
  it('nao-loop: clampa no ultimo frame', () => {
    // jump frames=3 fps=12: t=60 -> adv=12 -> clamp 2
    expect(frameIndex(SET.anims.jump!, 60)).toBe(2)
    // t=6 -> adv=floor(6*12/60)=floor(1.2)=1
    expect(frameIndex(SET.anims.jump!, 6)).toBe(1)
    expect(frameIndex(SET.anims.jump!, 0)).toBe(0)
  })
  it('indice sempre em [0, frames-1] e finito', () => {
    for (const t of [0, 1, 7, 50, 999]) {
      const i = frameIndex(SET.anims.walk!, t)
      expect(Number.isInteger(i)).toBe(true)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(SET.anims.walk!.frames)
    }
  })
  it('t negativo: loop usa modulo euclidiano (em range); nao-loop clampa em 0', () => {
    const il = frameIndex(SET.anims.walk!, -30)
    expect(il).toBeGreaterThanOrEqual(0)
    expect(il).toBeLessThan(SET.anims.walk!.frames)
    expect(frameIndex(SET.anims.jump!, -30)).toBe(0)
  })
})

describe('drawCharFrame', () => {
  it('com sheet: desenha 1x (save/translate/scale/rotate/drawImage/restore) e retorna true', () => {
    const ctx = makeCtxStub()
    const ok = drawCharFrame(makeRenderer(ctx), storeWith, SET, 'idle', 0, 100, 200, 1)
    expect(ok).toBe(true)
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.translate).toHaveBeenCalledTimes(1)
    expect(ctx.scale).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage.mock.calls[0][0]).toBe(FAKE_SRC)
  })
  it('recorta a celula certa: sx = idx*cellW', () => {
    const ctx = makeCtxStub()
    // walk t=30 -> idx 1 -> sx=96
    drawCharFrame(makeRenderer(ctx), storeWith, SET, 'walk', 30, 100, 200, 1)
    const call = ctx.drawImage.mock.calls[0]
    expect(call[1]).toBe(96) // sx
    expect(call[3]).toBe(96) // sw=cellW
    expect(call[4]).toBe(96) // sh=cellH
  })
  it('sem sheet no store: retorna false e NAO desenha', () => {
    const ctx = makeCtxStub()
    const ok = drawCharFrame(makeRenderer(ctx), storeEmpty, SET, 'idle', 0, 100, 200, 1)
    expect(ok).toBe(false)
    expect(ctx.drawImage).not.toHaveBeenCalled()
    expect(ctx.save).not.toHaveBeenCalled()
  })
  it('estado sem animacao cai no idle (fallback interno)', () => {
    const ctx = makeCtxStub()
    // 'fall' nao esta no SET -> usa idle -> desenha
    const ok = drawCharFrame(makeRenderer(ctx), storeWith, SET, 'fall', 0, 100, 200, 1)
    expect(ok).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
  })
  it('estado ausente E sem idle: retorna false', () => {
    const ctx = makeCtxStub()
    const noIdle: CharAnimSet = { ...SET, anims: { walk: SET.anims.walk! } }
    const ok = drawCharFrame(makeRenderer(ctx), storeWith, noIdle, 'jump', 0, 100, 200, 1)
    expect(ok).toBe(false)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
  it('facing=-1 espelha (scale.x < 0); args finitos', () => {
    const ctx = makeCtxStub()
    drawCharFrame(makeRenderer(ctx), storeWith, SET, 'idle', 0, 100, 200, -1)
    expect(ctx.scale.mock.calls[0][0]).toBeLessThan(0)
    for (const args of [...ctx.translate.mock.calls, ...ctx.scale.mock.calls]) {
      for (const v of args) expect(Number.isFinite(v as number)).toBe(true)
    }
  })

  it('sem tf: identidade — translate(x,y), scale(facing,1), rotate(0)', () => {
    const ctx = makeCtxStub()
    drawCharFrame(makeRenderer(ctx), storeWith, SET, 'idle', 0, 100, 200, 1)
    expect(ctx.translate).toHaveBeenCalledWith(100, 200)
    expect(ctx.scale).toHaveBeenCalledWith(1, 1)
    expect(ctx.rotate).toHaveBeenCalledWith(0)
  })

  it('com tf: translate(x, y+offsetY) -> scale(facing*scaleX, scaleY) -> rotate(rotation)', () => {
    const ctx = makeCtxStub()
    const tf: SpriteTransform = { scaleX: 1.12, scaleY: 0.86, rotation: 0.05, offsetY: -2 }
    drawCharFrame(makeRenderer(ctx), storeWith, SET, 'idle', 0, 100, 200, -1, tf)
    expect(ctx.translate).toHaveBeenCalledWith(100, 198)
    expect(ctx.scale).toHaveBeenCalledWith(-1 * 1.12, 0.86)
    expect(ctx.rotate).toHaveBeenCalledWith(0.05)
    // ordem do spriteDraw.ts: translate -> scale -> rotate
    const order = [
      ctx.translate.mock.invocationCallOrder[0],
      ctx.scale.mock.invocationCallOrder[0],
      ctx.rotate.mock.invocationCallOrder[0],
    ]
    expect(order[0]).toBeLessThan(order[1])
    expect(order[1]).toBeLessThan(order[2])
  })
})

describe('drawCharFrame — fallbacks de one-shot (ONE_SHOT_FALLBACK)', () => {
  // SET sem nenhum one-shot: land/cast caem no idle, skid no run, victory no jump
  const FB_SET: CharAnimSet = {
    ...SET,
    anims: {
      idle: { key: 'k.idle', frames: 3, fps: 6, loop: true },
      run: { key: 'k.run', frames: 4, fps: 15, loop: true },
      jump: { key: 'k.jump', frames: 3, fps: 12, loop: false },
    },
  }

  it('land -> idle', () => {
    const { store, get } = makeStoreSpy()
    const ok = drawCharFrame(makeRenderer(makeCtxStub()), store, FB_SET, 'land', 0, 0, 0, 1)
    expect(ok).toBe(true)
    expect(get).toHaveBeenCalledWith('k.idle')
  })
  it('skid -> run', () => {
    const { store, get } = makeStoreSpy()
    const ok = drawCharFrame(makeRenderer(makeCtxStub()), store, FB_SET, 'skid', 0, 0, 0, 1)
    expect(ok).toBe(true)
    expect(get).toHaveBeenCalledWith('k.run')
  })
  it('cast -> idle', () => {
    const { store, get } = makeStoreSpy()
    const ok = drawCharFrame(makeRenderer(makeCtxStub()), store, FB_SET, 'cast', 0, 0, 0, 1)
    expect(ok).toBe(true)
    expect(get).toHaveBeenCalledWith('k.idle')
  })
  it('victory -> jump', () => {
    const { store, get } = makeStoreSpy()
    const ok = drawCharFrame(makeRenderer(makeCtxStub()), store, FB_SET, 'victory', 0, 0, 0, 1)
    expect(ok).toBe(true)
    expect(get).toHaveBeenCalledWith('k.jump')
  })
  it('skid sem run no set: cai no idle (ultimo fallback)', () => {
    const { store, get } = makeStoreSpy()
    const onlyIdle: CharAnimSet = {
      ...SET,
      anims: { idle: { key: 'k.idle', frames: 3, fps: 6, loop: true } },
    }
    const ok = drawCharFrame(makeRenderer(makeCtxStub()), store, onlyIdle, 'skid', 0, 0, 0, 1)
    expect(ok).toBe(true)
    expect(get).toHaveBeenCalledWith('k.idle')
  })
  it('animacao direta do one-shot tem prioridade sobre o fallback', () => {
    const { store, get } = makeStoreSpy()
    const withLand: CharAnimSet = {
      ...FB_SET,
      anims: {
        ...FB_SET.anims,
        land: { key: 'k.land', frames: 2, fps: 15, loop: false },
      },
    }
    drawCharFrame(makeRenderer(makeCtxStub()), store, withLand, 'land', 0, 0, 0, 1)
    expect(get).toHaveBeenCalledWith('k.land')
  })
})

describe('drawContactShadow', () => {
  it('no chao: elipse preta alpha 0.25, largura cheia, com save/fill/restore', () => {
    const ctx = makeCtxStub()
    drawContactShadow(makeRenderer(ctx), 100, 200, 40, true)
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.beginPath).toHaveBeenCalledTimes(1)
    expect(ctx.ellipse).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
    // restore e mock: o globalAlpha setado dentro fica visivel
    expect(ctx.globalAlpha).toBe(0.25)
    const [cx, cy, rx, ry] = ctx.ellipse.mock.calls[0] as number[]
    expect(cx).toBe(100)
    expect(cy).toBe(200)
    expect(rx).toBeCloseTo(20, 10) // w/2
    expect(ry).toBeCloseTo(40 * 0.18 * 0.5, 10) // altura total ~w*0.18
  })

  it('no ar: alpha 0.12 e largura x0.7', () => {
    const ctxGround = makeCtxStub()
    drawContactShadow(makeRenderer(ctxGround), 100, 200, 40, true)
    const rxGround = (ctxGround.ellipse.mock.calls[0] as number[])[2]

    const ctxAir = makeCtxStub()
    drawContactShadow(makeRenderer(ctxAir), 100, 200, 40, false)
    expect(ctxAir.globalAlpha).toBe(0.12)
    const rxAir = (ctxAir.ellipse.mock.calls[0] as number[])[2]
    expect(rxAir).toBeCloseTo(rxGround * 0.7, 10)
  })

  it('alphas distintos entre chao e ar', () => {
    const a = makeCtxStub()
    const b = makeCtxStub()
    drawContactShadow(makeRenderer(a), 0, 0, 30, true)
    drawContactShadow(makeRenderer(b), 0, 0, 30, false)
    expect(a.globalAlpha).not.toBe(b.globalAlpha)
    expect(a.globalAlpha).toBeGreaterThan(b.globalAlpha)
  })
})
