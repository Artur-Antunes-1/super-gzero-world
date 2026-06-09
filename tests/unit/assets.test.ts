// tests/unit/assets.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chromaKeyPixels,
  loadImage,
  loadAssets,
  type AssetEntry,
} from '../../src/engine/assets'

// ---- chromaKeyPixels: funcao PURA, sem canvas (roda em jsdom) ----
describe('chromaKeyPixels', () => {
  it('zera o alpha de pixels off-white (luma>=235 e max-min<=18)', () => {
    // 1 pixel quase-branco neutro: 245,245,245 -> luma>=235, spread=0
    const data = new Uint8ClampedArray([245, 245, 245, 255])
    chromaKeyPixels(data)
    expect(data[3]).toBe(0)
    // RGB nao precisa mudar; o que importa e o alpha
  })

  it('preserva pixels coloridos saturados mesmo se claros', () => {
    // magenta forte: max-min grande -> NAO e off-white -> alpha mantido
    const data = new Uint8ClampedArray([255, 0, 85, 255])
    chromaKeyPixels(data)
    expect(data[3]).toBe(255)
  })

  it('preserva pixels escuros (luma baixa)', () => {
    const data = new Uint8ClampedArray([10, 10, 12, 255])
    chromaKeyPixels(data)
    expect(data[3]).toBe(255)
  })

  it('preserva cinza claro com spread maior que 18 (nao off-white)', () => {
    // 240,240,210 -> luma alta mas spread=30 (>18) -> mantem
    const data = new Uint8ClampedArray([240, 240, 210, 255])
    chromaKeyPixels(data)
    expect(data[3]).toBe(255)
  })

  it('processa multiplos pixels in-place', () => {
    const data = new Uint8ClampedArray([
      245, 245, 245, 255, // off-white -> 0
      255, 0, 85, 255, // magenta -> 255
    ])
    chromaKeyPixels(data)
    expect(data[3]).toBe(0)
    expect(data[7]).toBe(255)
  })
})

// ---- Mock de Image e canvas para loadImage/loadAssets em jsdom ----
// Em jsdom, new Image() nunca dispara onload sozinho e canvas.getContext('2d')
// retorna null. Mockamos ambos com spies (padrao de render.test.ts).

class FakeImage {
  onload: (() => void) | null = null
  onerror: ((e?: unknown) => void) | null = null
  width = 4
  height = 2
  naturalWidth = 4
  naturalHeight = 2
  decoding = 'async'
  private _src = ''
  set src(v: string) {
    this._src = v
    // resolve de forma assincrona, como o browser
    queueMicrotask(() => this.onload && this.onload())
  }
  get src(): string {
    return this._src
  }
}

// ctx 2d falso: registra drawImage e devolve um ImageData controlado.
function makeFakeCtx(pixels: number[]) {
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(pixels),
      width: 4,
      height: 2,
    })),
    putImageData: vi.fn(),
  }
}

describe('loadImage / loadAssets (Image mockada)', () => {
  let createdCanvasCtx: ReturnType<typeof makeFakeCtx>

  beforeEach(() => {
    // 8 px (4x2) todos off-white -> chroma key deve zerar todos os alphas
    const offWhite: number[] = []
    for (let i = 0; i < 8; i++) offWhite.push(245, 245, 245, 255)
    createdCanvasCtx = makeFakeCtx(offWhite)

    // @ts-expect-error: substituimos o Image global por um fake controlavel
    globalThis.Image = FakeImage as unknown as typeof Image

    // canvas offscreen falso (document.createElement('canvas'))
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: (k: string) => (k === '2d' ? createdCanvasCtx : null),
        } as unknown as HTMLCanvasElement
      }
      // fallback p/ qualquer outro elemento (nao usado aqui)
      return {} as unknown as HTMLElement
    }) as typeof document.createElement)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loadImage sem chromaKey usa a propria Image como src', async () => {
    const entry: AssetEntry = { url: '/assets/x.png' }
    const asset = await loadImage(entry)
    expect(asset.w).toBe(4)
    expect(asset.h).toBe(2)
    // src e a Image (FakeImage), nao um canvas
    expect((asset.src as FakeImage) instanceof FakeImage).toBe(true)
    expect(createdCanvasCtx.drawImage).not.toHaveBeenCalled()
  })

  it('loadImage com chromaKey desenha num canvas e devolve o canvas como src', async () => {
    const entry: AssetEntry = { url: '/assets/x.png', chromaKey: true }
    const asset = await loadImage(entry)
    expect(createdCanvasCtx.drawImage).toHaveBeenCalled()
    expect(createdCanvasCtx.getImageData).toHaveBeenCalled()
    expect(createdCanvasCtx.putImageData).toHaveBeenCalled()
    expect(asset.w).toBe(4)
    expect(asset.h).toBe(2)
    // src NAO e a FakeImage (e o canvas offscreen)
    expect((asset.src as unknown) instanceof FakeImage).toBe(false)
  })

  it('loadAssets carrega tudo, cacheia por chave, get retorna asset e ready=true', async () => {
    const store = await loadAssets({
      a: { url: '/assets/a.png' },
      b: { url: '/assets/b.png', chromaKey: true },
    })
    expect(store.ready).toBe(true)
    expect(store.get('a')).not.toBeNull()
    expect(store.get('b')).not.toBeNull()
    expect(store.get('a')!.w).toBe(4)
  })

  it('store.get retorna null para chave ausente', async () => {
    const store = await loadAssets({ a: { url: '/assets/a.png' } })
    expect(store.get('zzz')).toBeNull()
  })
})
