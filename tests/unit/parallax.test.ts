import { describe, it, expect } from 'vitest'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import { drawParallax, type ParallaxLayer } from '../../src/engine/parallax'
import type { Renderer } from '../../src/engine/render'
import type { Camera } from '../../src/engine/camera'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

interface Op {
  op: string
  args: unknown[]
}

// Gravador de ctx: registra a SEQUENCIA de chamadas (ordem importa para
// reconstruir blocos save/translate/scale/drawImage/restore dos espelhados).
function makeCtxRecorder() {
  const ops: Op[] = []
  const make =
    (op: string) =>
    (...args: unknown[]) => {
      ops.push({ op, args })
    }
  const ctx = {
    drawImage: make('drawImage'),
    save: make('save'),
    restore: make('restore'),
    translate: make('translate'),
    scale: make('scale'),
    fillRect: make('fillRect'),
    fillStyle: '' as string,
  }
  return { ctx, ops }
}

function makeRenderer(ctx: object): Renderer {
  return { ctx } as unknown as Renderer
}

// ImageAsset fake: src nao e validado em jsdom.
function makeAsset(w: number, h: number): ImageAsset {
  return { src: { tag: 'img' } as unknown as CanvasImageSource, w, h }
}

function makeStore(entries: Record<string, ImageAsset | null>): AssetStore {
  return {
    get: (key: string) => (key in entries ? entries[key] : null),
    ready: true,
  }
}

function makeCam(x: number, y = 0): Camera {
  return { x, y }
}

// ---------------------------------------------------------------------------
// Reconstrucao de tiles a partir das ops
// ---------------------------------------------------------------------------

interface Tile {
  x: number // dx na tela (borda esquerda do tile)
  w: number // largura desenhada (imgW)
  dy: number
  dh: number
  mirrored: boolean
}

// Normal: drawImage direto (dx = args[5]).
// Espelhado: save -> translate(dx+imgW, 0) -> scale(-1,1) -> drawImage(...,0,0,imgW,VIEW_H) -> restore.
function extractTiles(ops: Op[]): Tile[] {
  const tiles: Tile[] = []
  let i = 0
  while (i < ops.length) {
    const o = ops[i]
    if (o.op === 'drawImage') {
      tiles.push({
        x: o.args[5] as number,
        w: o.args[7] as number,
        dy: o.args[6] as number,
        dh: o.args[8] as number,
        mirrored: false,
      })
      i++
    } else if (o.op === 'save') {
      const tr = ops[i + 1]
      const sc = ops[i + 2]
      const di = ops[i + 3]
      const re = ops[i + 4]
      // bloco espelhado deve ter exatamente esta forma
      expect(tr?.op).toBe('translate')
      expect(sc?.op).toBe('scale')
      expect(di?.op).toBe('drawImage')
      expect(re?.op).toBe('restore')
      const w = di.args[7] as number
      tiles.push({
        x: (tr.args[0] as number) - w, // translate recebe dx+imgW
        w,
        dy: di.args[6] as number,
        dh: di.args[8] as number,
        mirrored: true,
      })
      i += 5
    } else {
      i++
    }
  }
  return tiles
}

// Atalho: roda drawParallax com uma layer (asset quadrado VIEW_H x VIEW_H,
// logo imgW = VIEW_H = 528) e devolve os tiles desenhados.
function tilesFor(camX: number, factor: number): Tile[] {
  const { ctx, ops } = makeCtxRecorder()
  const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
  drawParallax(makeRenderer(ctx), [{ key: 'bg.sky', factor }], store, makeCam(camX))
  return extractTiles(ops)
}

// Mapa worldX -> orientacao. worldX = x_tela + cam.x*factor (posicao absoluta
// do tile no "mundo" da camada — independe de onde a camera esta).
function worldMap(tiles: Tile[], camX: number, factor: number): Map<number, boolean> {
  const m = new Map<number, boolean>()
  for (const t of tiles) m.set(Math.round(t.x + camX * factor), t.mirrored)
  return m
}

// ---------------------------------------------------------------------------

describe('drawParallax (mirror-tiling)', () => {
  it('desenha com deslocamento -(cam.x*factor) (factor 0.5, cam.x=100 -> primeiro tile em -50)', () => {
    const tiles = tilesFor(100, 0.5)
    expect(tiles.length).toBeGreaterThanOrEqual(1)
    expect(tiles[0].x).toBeCloseTo(-50, 6)
    // cada tile cobre a altura toda, ancorado no topo
    for (const t of tiles) {
      expect(t.dy).toBe(0)
      expect(t.dh).toBe(VIEW_H)
    }
  })

  it('tiles alternam orientacao normal/espelhada ao longo da viewport', () => {
    // cam.x=100, factor 1 -> tiles em -100, 428, 956 (3 tiles em 960px)
    const tiles = tilesFor(100, 1)
    expect(tiles.length).toBeGreaterThanOrEqual(3)
    expect(tiles.some((t) => t.mirrored)).toBe(true)
    expect(tiles.some((t) => !t.mirrored)).toBe(true)
    for (let i = 1; i < tiles.length; i++) {
      expect(tiles[i].mirrored).toBe(!tiles[i - 1].mirrored)
    }
  })

  it('tile espelhado usa save -> translate(dx+imgW, 0) -> scale(-1,1) -> drawImage em 0 -> restore', () => {
    const { ctx, ops } = makeCtxRecorder()
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
    drawParallax(makeRenderer(ctx), [{ key: 'bg.sky', factor: 1 }], store, makeCam(100))

    // tiles: -100 (normal), 428 (espelhado), 956 (normal)
    const saveIdx = ops.findIndex((o) => o.op === 'save')
    expect(saveIdx).toBeGreaterThanOrEqual(0)
    const tr = ops[saveIdx + 1]
    const sc = ops[saveIdx + 2]
    const di = ops[saveIdx + 3]
    const re = ops[saveIdx + 4]

    expect(tr.op).toBe('translate')
    expect(tr.args[0]).toBeCloseTo(428 + VIEW_H, 6) // dx + imgW = 956
    expect(tr.args[1]).toBe(0)

    expect(sc.op).toBe('scale')
    expect(sc.args).toEqual([-1, 1])

    expect(di.op).toBe('drawImage')
    expect(di.args[5]).toBe(0) // dx local 0 (apos translate+scale)
    expect(di.args[6]).toBe(0) // dy
    expect(di.args[7]).toBeCloseTo(VIEW_H, 6) // dw = imgW
    expect(di.args[8]).toBe(VIEW_H) // dh

    expect(re.op).toBe('restore')

    // save/restore sempre balanceados
    const saves = ops.filter((o) => o.op === 'save').length
    const restores = ops.filter((o) => o.op === 'restore').length
    expect(saves).toBe(restores)
    expect(saves).toBeGreaterThan(0)
  })

  it('paridade ESTAVEL: mesmo tile absoluto mantem orientacao em cam.x=100 e cam.x=400', () => {
    const a = worldMap(tilesFor(100, 1), 100, 1)
    const b = worldMap(tilesFor(400, 1), 400, 1)
    const shared = [...a.keys()].filter((k) => b.has(k))
    expect(shared.length).toBeGreaterThanOrEqual(2)
    for (const k of shared) expect(a.get(k)).toBe(b.get(k))
  })

  it('paridade ESTAVEL cruzando multiplo exato de imgW (cam.x=0 vs cam.x=10)', () => {
    // ox = 0 e o caso-armadilha: floor ingenuo de -ox/imgW pula um indice aqui.
    const a = worldMap(tilesFor(0, 1), 0, 1)
    const b = worldMap(tilesFor(10, 1), 10, 1)
    const shared = [...a.keys()].filter((k) => b.has(k))
    expect(shared.length).toBeGreaterThanOrEqual(2)
    for (const k of shared) expect(a.get(k)).toBe(b.get(k))
  })

  it('paridade ESTAVEL com cam.x negativo (indices de tile negativos)', () => {
    const a = worldMap(tilesFor(-300, 1), -300, 1)
    const b = worldMap(tilesFor(-100, 1), -100, 1)
    const shared = [...a.keys()].filter((k) => b.has(k))
    expect(shared.length).toBeGreaterThanOrEqual(2)
    for (const k of shared) expect(a.get(k)).toBe(b.get(k))
  })

  it('cobertura completa da viewport (sem buracos) para varios cam.x', () => {
    for (const camX of [0, 100, 333.7, 528, 1234.5, -777.25]) {
      const tiles = tilesFor(camX, 1)
      expect(tiles.length).toBeGreaterThanOrEqual(2)
      // primeiro tile comeca em ou antes da borda esquerda
      expect(tiles[0].x).toBeLessThanOrEqual(0)
      // tiles contiguos: cada um comeca onde o anterior termina
      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i].x).toBeCloseTo(tiles[i - 1].x + tiles[i - 1].w, 4)
      }
      // ultimo tile cobre ate a borda direita (ou alem)
      const last = tiles[tiles.length - 1]
      expect(last.x + last.w).toBeGreaterThanOrEqual(VIEW_W)
    }
  })

  it('factor 0 ignora cam.x: mesmos tiles e mesmas orientacoes para cam.x=0 e 9999', () => {
    const a = tilesFor(0, 0)
    const b = tilesFor(9999, 0)
    expect(b.map((t) => [t.x, t.mirrored])).toEqual(a.map((t) => [t.x, t.mirrored]))
  })

  it('layer ausente (store.get null) e pulado sem desenhar e sem lancar', () => {
    const { ctx, ops } = makeCtxRecorder()
    const store = makeStore({})
    expect(() =>
      drawParallax(makeRenderer(ctx), [{ key: 'bg.sky', factor: 0.3 }], store, makeCam(200)),
    ).not.toThrow()
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(0)
  })

  it('lista de layers vazia nao desenha nada e nao lanca', () => {
    const { ctx, ops } = makeCtxRecorder()
    const store = makeStore({ 'bg.sky': makeAsset(VIEW_H, VIEW_H) })
    expect(() => drawParallax(makeRenderer(ctx), [], store, makeCam(0))).not.toThrow()
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(0)
  })

  it('protege contra asset degenerado (h<=0): nao lanca e nao desenha', () => {
    const { ctx, ops } = makeCtxRecorder()
    const store = makeStore({ 'bg.sky': makeAsset(0, 0) })
    expect(() =>
      drawParallax(makeRenderer(ctx), [{ key: 'bg.sky', factor: 0.3 }], store, makeCam(10)),
    ).not.toThrow()
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(0)
  })

  it('desenha multiplas camadas na ordem da lista (back-to-front)', () => {
    const { ctx, ops } = makeCtxRecorder()
    const store = makeStore({
      'bg.far': makeAsset(VIEW_H, VIEW_H),
      'bg.near': makeAsset(VIEW_H, VIEW_H),
    })
    const layers: ParallaxLayer[] = [
      { key: 'bg.far', factor: 0.1 },
      { key: 'bg.near', factor: 0.6 },
    ]
    drawParallax(makeRenderer(ctx), layers, store, makeCam(0))
    // ambas as camadas desenharam (cada uma cobre 960px com imgW=528 -> >=2 tiles cada)
    expect(ops.filter((o) => o.op === 'drawImage').length).toBeGreaterThanOrEqual(4)
  })
})
