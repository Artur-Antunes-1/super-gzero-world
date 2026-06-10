// tests/unit/levels.test.ts — registry de fases + sanidade da W1-1 (C3a).
import { describe, it, expect } from 'vitest'
import { TILE } from '../../src/engine/constants'
import { validateLevel, parseLevel } from '../../src/game/levelParser'
import {
  LEVELS,
  DEFAULT_LEVEL_ID,
  parseLevelById,
} from '../../src/data/levels/index'
import { W1_1 } from '../../src/data/levels/w1-1'

describe('registry de fases (data/levels/index)', () => {
  it('DEFAULT_LEVEL_ID e "w1-1" e o registry contem w1-1 e zona1', () => {
    expect(DEFAULT_LEVEL_ID).toBe('w1-1')
    expect(Object.keys(LEVELS).sort()).toEqual(['w1-1', 'zona1'])
  })

  it('validateLevel passa em TODOS os LEVELS', () => {
    for (const [id, def] of Object.entries(LEVELS)) {
      expect(() => validateLevel(def), `level ${id} deve validar`).not.toThrow()
    }
  })

  it('parseLevelById re-parseia FRESCO a cada chamada (sem cache)', () => {
    const a = parseLevelById('w1-1')
    const b = parseLevelById('w1-1')
    expect(a).not.toBe(b)
    expect(a.tiles).not.toBe(b.tiles)
    // Mutacao em um parse nao vaza para o proximo.
    a.tiles[9][0] = 'empty'
    a.checkpoints.push(999)
    const c = parseLevelById('w1-1')
    expect(c.tiles[9][0]).toBe('platform')
    expect(c.checkpoints).toEqual([72])
  })

  it('id desconhecido cai no DEFAULT (w1-1)', () => {
    const lvl = parseLevelById('nao-existe')
    expect(lvl.widthTiles).toBe(144)
    expect(lvl.goal.x).toBe(136 * TILE)
  })

  it('parseLevelById("zona1") devolve a fase greybox de 40 cols', () => {
    const lvl = parseLevelById('zona1')
    expect(lvl.widthTiles).toBe(40)
  })
})

describe('W1-1 — "O Primeiro Passo Leve" (transcricao do spec)', () => {
  it('144 colunas x 11 linhas; toda linha tem exatamente 144 chars', () => {
    expect(W1_1.rows.length).toBe(11)
    for (let i = 0; i < W1_1.rows.length; i++) {
      expect(W1_1.rows[i].length, `row ${i} deve ter 144 chars`).toBe(144)
    }
    const lvl = parseLevel(W1_1)
    expect(lvl.widthTiles).toBe(144)
    expect(lvl.heightTiles).toBe(11)
  })

  it('spawn adicionado na col 2 row 8; goal ">" na col 136 row 8', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.playerSpawn).toEqual({ x: 2 * TILE, y: 8 * TILE })
    expect(lvl.goal).toEqual({ x: 136 * TILE, y: 8 * TILE })
  })

  it('3 tolos via entities, com patrulhas do spec; "g" do mapa ignorado', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.foolSpawns).toEqual([
      { col: 24, row: 8, patrol: [24, 30] },
      { col: 78, row: 8, patrol: [78, 84] },
      { col: 88, row: 8, patrol: [88, 94] },
    ])
    // Nenhum espelho legacy: o mapa nao usa 'F'.
    expect(lvl.enemies).toEqual([])
  })

  it('qBlocks com payloads do spec (coin@28, item@58, coin@60, coin@62, star@112)', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.qBlocks).toEqual([
      { col: 112, row: 4, payload: 'star' }, // escada alta (row menor vem antes no scan)
      { col: 28, row: 6, payload: 'coin' },
      { col: 58, row: 6, payload: 'item' },
      { col: 60, row: 6, payload: 'coin' },
      { col: 62, row: 6, payload: 'coin' },
    ])
    // Todo qBlock corresponde a um tile solido 'block' no mapa.
    for (const q of lvl.qBlocks) {
      expect(lvl.tiles[q.row][q.col]).toBe('block')
    }
  })

  it('1 coracao na col 66 row 8', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.hearts).toEqual([{ col: 66, row: 8 }])
  })

  it('checkpoint [72] e timeStart 250', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.checkpoints).toEqual([72])
    expect(lvl.timeStart).toBe(250)
  })

  it('contagem de moedas >= 15 (trilhas do spec)', () => {
    const lvl = parseLevel(W1_1)
    expect(lvl.coins.length).toBeGreaterThanOrEqual(15)
  })

  it('gap real nas cols 41-43 (rows 9-10 abertos) com pousos solidos dos dois lados', () => {
    const lvl = parseLevel(W1_1)
    for (let col = 41; col <= 43; col++) {
      expect(lvl.tiles[9][col]).toBe('empty')
      expect(lvl.tiles[10][col]).toBe('empty')
    }
    expect(lvl.tiles[9][40]).toBe('platform')
    expect(lvl.tiles[9][44]).toBe('platform')
  })

  it('piso continuo (platform) sob as patrulhas dos tolos', () => {
    const lvl = parseLevel(W1_1)
    for (const f of lvl.foolSpawns) {
      const [min, max] = f.patrol!
      for (let col = min; col <= max; col++) {
        expect(lvl.tiles[9][col], `row 9 col ${col}`).toBe('platform')
      }
    }
  })
})
