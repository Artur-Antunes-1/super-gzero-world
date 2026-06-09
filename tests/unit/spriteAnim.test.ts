// tests/unit/spriteAnim.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { Renderer } from '../../src/engine/render'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'
import { frameIndex, drawCharFrame, type CharAnimSet } from '../../src/engine/spriteAnim'

// FIXED_DT = 1/60 -> adv = floor(t * fps / 60).
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
  it('com sheet: desenha 1x (save/translate/scale/drawImage/restore) e retorna true', () => {
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
})
