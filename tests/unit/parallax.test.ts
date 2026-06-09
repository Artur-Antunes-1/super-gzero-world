import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import { drawParallax, type ParallaxLayer } from '../../src/engine/parallax'
import type { Renderer } from '../../src/engine/render'
import type { Camera } from '../../src/engine/camera'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'

// ctx stub: jsdom nao desenha; registramos as chamadas de drawImage.
function makeCtxStub() {
  return {
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '' as string,
  }
}

// Renderer minimo: so precisamos do ctx (drawParallax usa r.ctx.drawImage).
function makeRenderer(ctx: ReturnType<typeof makeCtxStub>): Renderer {
  return { ctx } as unknown as Renderer
}

// ImageAsset fake: src e um objeto qualquer (CanvasImageSource nao e validado em jsdom).
function makeAsset(w: number, h: number): ImageAsset {
  return { src: { tag: 'img' } as unknown as CanvasImageSource, w, h }
}

// AssetStore fake controlado por um Map.
function makeStore(entries: Record<string, ImageAsset | null>): AssetStore {
  return {
    get: (key: string) => (key in entries ? entries[key] : null),
    ready: true,
  }
}

function makeCam(x: number, y = 0): Camera {
  return { x, y }
}

describe('drawParallax', () => {
  let ctx: ReturnType<typeof makeCtxStub>
  let r: Renderer

  beforeEach(() => {
    ctx = makeCtxStub()
    r = makeRenderer(ctx)
  })

  it('desenha a imagem com deslocamento -(cam.x*factor) (factor 0.5, cam.x=100 -> -50)', () => {
    // img quadrada 528x528 -> escalada p/ altura 528 mantem largura 528 (imgW = VIEW_H).
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
    const layers: ParallaxLayer[] = [{ key: 'bg.sky', factor: 0.5 }]
    drawParallax(r, layers, store, makeCam(100))

    expect(ctx.drawImage).toHaveBeenCalled()
    // startX = normalizado p/ [-imgW,0]: ox=-50, imgW=528 -> startX=-50.
    // A primeira copia desenhada deve comecar em dx=-50.
    const calls = ctx.drawImage.mock.calls
    const firstDx = calls[0][5] // dx e o 6o argumento (src,sx,sy,sw,sh,dx,dy,dw,dh)
    expect(firstDx).toBe(-50)
    // Cada copia cobre a altura toda do canvas (dh = VIEW_H), ancorada em dy=0.
    expect(calls[0][6]).toBe(0) // dy
    expect(calls[0][8]).toBe(VIEW_H) // dh
  })

  it('faz tiling para cobrir os 960px de largura (>=2 copias quando imgW < VIEW_W)', () => {
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) }) // imgW=528 < 960
    drawParallax(r, [{ key: 'bg.sky', factor: 0 }], store, makeCam(0))
    // ox=0 -> startX = -imgW = -528; copias em -528, 0, 528, ... ate passar 960.
    // Precisa de pelo menos 3 copias p/ cobrir [0,960] partindo de -528.
    expect(ctx.drawImage.mock.calls.length).toBeGreaterThanOrEqual(3)
    const dxs = ctx.drawImage.mock.calls.map((c) => c[5] as number)
    expect(dxs).toContain(-528)
    expect(dxs).toContain(0)
    // a ultima copia comeca antes de VIEW_W e cobre ate >= VIEW_W
    const last = dxs[dxs.length - 1]
    expect(last).toBeLessThan(VIEW_W)
    expect(last + VIEW_H).toBeGreaterThanOrEqual(VIEW_W)
  })

  it('layer ausente (store.get null) e pulado sem desenhar e sem lancar', () => {
    const store = makeStore({}) // get sempre null
    expect(() =>
      drawParallax(r, [{ key: 'bg.sky', factor: 0.3 }], store, makeCam(200))
    ).not.toThrow()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('lista de layers vazia nao desenha nada e nao lanca', () => {
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
    expect(() => drawParallax(r, [], store, makeCam(0))).not.toThrow()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('factor 0 ignora cam.x (fundo distante fixo): startX nao muda com cam.x', () => {
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
    drawParallax(r, [{ key: 'bg.sky', factor: 0 }], store, makeCam(0))
    const a = (ctx.drawImage.mock.calls[0][5] as number)
    ctx.drawImage.mockClear()
    drawParallax(r, [{ key: 'bg.sky', factor: 0 }], store, makeCam(9999))
    const b = (ctx.drawImage.mock.calls[0][5] as number)
    expect(a).toBe(b) // factor 0 -> deslocamento independe de cam.x
  })

  it('desenha multiplas camadas na ordem da lista (back-to-front)', () => {
    const store = makeStore({
      'bg.far': makeAsset(VIEW_H, VIEW_H),
      'bg.near': makeAsset(VIEW_H, VIEW_H),
    })
    drawParallax(
      r,
      [
        { key: 'bg.far', factor: 0.1 },
        { key: 'bg.near', factor: 0.6 },
      ],
      store,
      makeCam(0)
    )
    // ambas as camadas desenharam (>= 2 chamadas no total)
    expect(ctx.drawImage.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('protege contra asset degenerado (h<=0): nao lanca e nao desenha', () => {
    const store = makeStore({ 'bg.sky': makeAsset(0, 0) })
    expect(() =>
      drawParallax(r, [{ key: 'bg.sky', factor: 0.3 }], store, makeCam(10))
    ).not.toThrow()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
})
