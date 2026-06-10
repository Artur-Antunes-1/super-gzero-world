// tests/unit/tilesData.test.ts
// C2: atlases Wang (terra/tijolo) — mapeamento bitmask de vizinhanca -> celula do grid 4x4.
import { describe, it, expect } from 'vitest'
import { TERRA_ATLAS, TIJOLO_ATLAS, TILE_ATLASES } from '../../src/data/tiles'

const ATLASES = [
  ['TERRA_ATLAS', TERRA_ATLAS, 'tiles.terra'],
  ['TIJOLO_ATLAS', TIJOLO_ATLAS, 'tiles.tijolo'],
] as const

describe.each(ATLASES)('%s', (_name, atlas, assetKey) => {
  it('usa o assetKey do manifesto e tile de 48px (16px escalado 3x)', () => {
    expect(atlas.assetKey).toBe(assetKey)
    expect(atlas.tile).toBe(48)
  })

  it('tem as 16 entradas (bitmask 0..15) em cells', () => {
    const keys = Object.keys(atlas.cells).map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([...Array(16).keys()])
  })

  it('toda celula cai dentro do grid 4x4 do atlas', () => {
    for (const [col, row] of Object.values(atlas.cells)) {
      expect(col).toBeGreaterThanOrEqual(0)
      expect(col).toBeLessThanOrEqual(3)
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThanOrEqual(3)
      expect(Number.isInteger(col)).toBe(true)
      expect(Number.isInteger(row)).toBe(true)
    }
  })

  it('mapeia interior cheio (15) e borda superior (14) nas celulas validadas', () => {
    // travado pela validacao visual: wang_0 = interior, wang_12 = topo com borda
    expect(atlas.cells[15]).toEqual([2, 1])
    expect(atlas.cells[14]).toEqual([3, 0])
    // interior nunca usa o tile todo-ar (wang_15 em [0,3])
    expect(atlas.cells[15]).not.toEqual([0, 3])
  })

  it('nenhuma mask degenerada cai no tile todo-ar (celula [0,3])', () => {
    // tile sem vizinho continua VISIVEL (isolado, barras e colunas de 1 tile)
    for (const m of [0, 1, 2, 4, 5, 8, 10]) {
      expect(atlas.cells[m]).not.toEqual([0, 3])
    }
  })
})

describe('TILE_ATLASES', () => {
  it('cobre os 4 tipos solidos: ground/platform -> terra, brick/block -> tijolo', () => {
    expect(TILE_ATLASES.ground).toBe(TERRA_ATLAS)
    expect(TILE_ATLASES.platform).toBe(TERRA_ATLAS)
    expect(TILE_ATLASES.brick).toBe(TIJOLO_ATLAS)
    expect(TILE_ATLASES.block).toBe(TIJOLO_ATLAS)
  })

  it('nao registra atlas para tipos nao-solidos', () => {
    expect(Object.keys(TILE_ATLASES).sort()).toEqual(
      ['block', 'brick', 'ground', 'platform'].sort(),
    )
  })
})
