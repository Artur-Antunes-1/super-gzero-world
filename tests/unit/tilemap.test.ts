import { describe, it, expect, vi } from 'vitest'
import { TILE } from '../../src/engine/constants'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import type { Renderer } from '../../src/engine/render'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'
import {
  computeTileVariants,
  drawTile,
  type TileAtlasSet,
} from '../../src/engine/tilemap'

// Legenda minima local (nao depende do parser): '#'=ground, B=brick, '?'=block,
// '='=platform, '^'=spike, resto=empty.
const CHAR: Record<string, TileType> = {
  '#': 'ground',
  B: 'brick',
  '?': 'block',
  '=': 'platform',
  '^': 'spike',
}

// ParsedLevel minimo para computeTileVariants (so usa widthTiles/heightTiles/tiles).
function makeLevel(rows: string[]): ParsedLevel {
  const heightTiles = rows.length
  const widthTiles = rows[0].length
  const tiles: TileType[][] = rows.map((line) =>
    Array.from(line, (ch) => CHAR[ch] ?? 'empty'),
  )
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies: [],
  } as unknown as ParsedLevel
}

// Indice row-major: row * widthTiles + col.
function idx(level: ParsedLevel, col: number, row: number): number {
  return row * level.widthTiles + col
}

describe('computeTileVariants', () => {
  it('retorna Uint8Array com len = widthTiles*heightTiles', () => {
    const level = makeLevel(['...', '.#.', '...'])
    const v = computeTileVariants(level)
    expect(v).toBeInstanceOf(Uint8Array)
    expect(v.length).toBe(9)
  })

  it('celula solida isolada (vizinhos empty) = variant 0', () => {
    const level = makeLevel(['...', '.#.', '...'])
    const v = computeTileVariants(level)
    expect(v[idx(level, 1, 1)]).toBe(0)
  })

  it('celulas nao-solidas (empty/spike) ficam com 0 e nao ligam bit no vizinho', () => {
    // mapa 2x1: '^' spike + '#' ground
    const level = makeLevel(['^#'])
    const v = computeTileVariants(level)
    // '^' nao e solida: fica 0 (default do Uint8Array).
    expect(v[idx(level, 0, 0)]).toBe(0)
    // '#': N fora(1) + E fora(2) + S fora(4); W='^' nao liga = 7
    expect(v[idx(level, 1, 0)]).toBe(7)
  })

  it('fora do mapa conta como vizinho ligado (mapa 1x1 solido = 15)', () => {
    const level = makeLevel(['#'])
    const v = computeTileVariants(level)
    expect(v[0]).toBe(15)
  })

  it('faixa de chao no meio do mapa: pontas e meio com bits corretos', () => {
    // .....
    // .###.
    // .....
    const level = makeLevel(['.....', '.###.', '.....'])
    const v = computeTileVariants(level)
    // ponta esquerda (1,1): so E ligado = 2
    expect(v[idx(level, 1, 1)]).toBe(2)
    // meio (2,1): E(2) + W(8) = 10
    expect(v[idx(level, 2, 1)]).toBe(10)
    // ponta direita (3,1): so W ligado = 8
    expect(v[idx(level, 3, 1)]).toBe(8)
  })

  it('chao na ultima row: S fora do mapa conta como ligado', () => {
    // .....
    // #####
    const level = makeLevel(['.....', '#####'])
    const v = computeTileVariants(level)
    // meio (2,1): N empty(0) + E(2) + S fora(4) + W(8) = 14
    expect(v[idx(level, 2, 1)]).toBe(14)
    // ponta esquerda (0,1): E(2) + S fora(4) + W fora(8) = 14
    expect(v[idx(level, 0, 1)]).toBe(14)
  })

  it('bloco 3x2 todo solido: interior cercado = 15 em todas as celulas', () => {
    const level = makeLevel(['###', '###'])
    const v = computeTileVariants(level)
    // (1,0): N fora(1) + E(2) + S(4) + W(8) = 15
    expect(v[idx(level, 1, 0)]).toBe(15)
    // (1,1): N(1) + E(2) + S fora(4) + W(8) = 15
    expect(v[idx(level, 1, 1)]).toBe(15)
  })

  it('tipos solidos diferentes conectam (ground encosta em brick/block)', () => {
    // .....
    // .#B?.
    // .....
    const level = makeLevel(['.....', '.#B?.', '.....'])
    const v = computeTileVariants(level)
    expect(v[idx(level, 1, 1)]).toBe(2) // '#': E=brick liga
    expect(v[idx(level, 2, 1)]).toBe(10) // 'B': E=block(2) + W=ground(8)
    expect(v[idx(level, 3, 1)]).toBe(8) // '?': W=brick liga
  })

  it('platform calcula bitmask no proprio grupo (conecta com platform e solidos)', () => {
    // ...
    // =#.
    // ...
    const level = makeLevel(['...', '=#.', '...'])
    const v = computeTileVariants(level)
    // platform: W=fora(8) + E=ground(2) -> 10 (topo aberto = grama)
    expect(v[idx(level, 0, 1)]).toBe(10)
    // ground: platform a W NAO liga bit (solidos conectam so entre solidos)
    expect(v[idx(level, 1, 1)]).toBe(0)
  })

  it('chao one-way de 2 linhas com ceu acima (W1-1): linha de cima ganha topo de grama', () => {
    // ....
    // ====
    // ====
    const level = makeLevel(['....', '====', '===='])
    const v = computeTileVariants(level)
    // linha de cima do chao: N aberto (ceu), E/W/S ligados = 14 (tile com grama)
    expect(v[idx(level, 1, 1)]).toBe(14)
    expect(v[idx(level, 0, 1)]).toBe(14) // ponta: W = fora do mapa liga
    // linha de baixo: tudo ligado (S = fora do mapa) = 15 (interior)
    expect(v[idx(level, 1, 2)]).toBe(15)
  })
})

// --- drawTile ---

const FAKE_IMG_SRC = { fake: true } as unknown as CanvasImageSource

function makeStore(map: Record<string, ImageAsset>): AssetStore {
  return {
    get: (key: string) => map[key] ?? null,
    ready: true,
  }
}

function makeRendererSpy() {
  return { drawSprite: vi.fn() } as unknown as Renderer
}

const SET: TileAtlasSet = {
  assetKey: 'tiles.terra',
  tile: 16,
  cells: {
    10: [1, 2],
    15: [3, 0],
  },
}

describe('drawTile', () => {
  it('desenha a celula do atlas com sx/sy/sw/sh e destino col/row em px', () => {
    const store = makeStore({
      'tiles.terra': { src: FAKE_IMG_SRC, w: 64, h: 48 },
    })
    const r = makeRendererSpy()
    const ok = drawTile(r, store, SET, 10, 5, 9)
    expect(ok).toBe(true)
    expect(r.drawSprite).toHaveBeenCalledWith(
      FAKE_IMG_SRC,
      1 * 16, // sx = cell[0]*set.tile
      2 * 16, // sy = cell[1]*set.tile
      16, // sw
      16, // sh
      5 * TILE, // dx
      9 * TILE, // dy
      TILE, // dw
      TILE, // dh
    )
  })

  it('variant ausente no mapa cai no fallback cells[15]', () => {
    const store = makeStore({
      'tiles.terra': { src: FAKE_IMG_SRC, w: 64, h: 48 },
    })
    const r = makeRendererSpy()
    const ok = drawTile(r, store, SET, 7, 0, 0)
    expect(ok).toBe(true)
    expect(r.drawSprite).toHaveBeenCalledWith(
      FAKE_IMG_SRC,
      3 * 16,
      0 * 16,
      16,
      16,
      0,
      0,
      TILE,
      TILE,
    )
  })

  it('retorna false (e nao desenha) se o asset estiver ausente', () => {
    const store = makeStore({})
    const r = makeRendererSpy()
    const ok = drawTile(r, store, SET, 10, 1, 1)
    expect(ok).toBe(false)
    expect(r.drawSprite).not.toHaveBeenCalled()
  })

  it('retorna false se nem variant nem fallback 15 existirem no atlas', () => {
    const store = makeStore({
      'tiles.terra': { src: FAKE_IMG_SRC, w: 64, h: 48 },
    })
    const setSem15: TileAtlasSet = { assetKey: 'tiles.terra', tile: 16, cells: { 10: [1, 2] } }
    const r = makeRendererSpy()
    const ok = drawTile(r, store, setSem15, 7, 0, 0)
    expect(ok).toBe(false)
    expect(r.drawSprite).not.toHaveBeenCalled()
  })
})
