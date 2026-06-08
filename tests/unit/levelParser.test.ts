import { describe, it, expect } from 'vitest'
import { parseLevel } from '../../src/game/levelParser'
import { TILE } from '../../src/engine/constants'
import type { LevelDef } from '../../src/data/schema'

// ---------------------------------------------------------------------------
// Mapa de teste 8 colunas x 4 linhas.
// Legenda: #=ground = =platform ?=block ^=spike o=coin S=spawn G=goal .=empty
// col:     0 1 2 3 4 5 6 7
// ---------------------------------------------------------------------------
const def: LevelDef = {
  id: 'test-mini',
  world: 9,
  zone: 9,
  rows: [
    '...o....', // linha 0: 1 moeda em col 3
    'S..=..G.', // linha 1: spawn col 0, platform col 3, goal col 6
    '....?...', // linha 2: block col 4
    '##^#####', // linha 3: ground em 0,1,3..7 e spike em col 2
  ],
}

describe('parseLevel', () => {
  it('calcula dimensoes em tiles e em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.widthTiles).toBe(8)
    expect(lvl.heightTiles).toBe(4)
    expect(lvl.widthPx).toBe(8 * TILE)
    expect(lvl.heightPx).toBe(4 * TILE)
  })

  it('monta a matriz tiles[row][col] com os tipos corretos', () => {
    const lvl = parseLevel(def)
    // linha 3: ground/spike
    expect(lvl.tiles[3][0]).toBe('ground')
    expect(lvl.tiles[3][1]).toBe('ground')
    expect(lvl.tiles[3][2]).toBe('spike')
    expect(lvl.tiles[3][3]).toBe('ground')
    expect(lvl.tiles[3][7]).toBe('ground')
    // platform e block
    expect(lvl.tiles[1][3]).toBe('platform')
    expect(lvl.tiles[2][4]).toBe('block')
  })

  it('marca como empty as celulas de spawn, goal, coin e vazio', () => {
    const lvl = parseLevel(def)
    expect(lvl.tiles[1][0]).toBe('empty') // S
    expect(lvl.tiles[1][6]).toBe('empty') // G
    expect(lvl.tiles[0][3]).toBe('empty') // o
    expect(lvl.tiles[0][0]).toBe('empty') // .
  })

  it('posiciona o playerSpawn na celula S em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.playerSpawn).toEqual({ x: 0 * TILE, y: 1 * TILE })
  })

  it('posiciona o goal na celula G em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.goal).toEqual({ x: 6 * TILE, y: 1 * TILE })
  })

  it('coleta as moedas nas celulas o em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.coins).toEqual([{ x: 3 * TILE, y: 0 * TILE }])
  })

  it('inicia sem inimigos quando o mapa nao tem g', () => {
    const lvl = parseLevel(def)
    expect(lvl.enemies).toEqual([])
  })

  it('coleta inimigos g em px com kind "enemy"', () => {
    const withEnemy: LevelDef = {
      id: 'test-enemy',
      world: 9,
      zone: 9,
      rows: ['....', '.g..', '####'],
    }
    const lvl = parseLevel(withEnemy)
    expect(lvl.enemies).toEqual([{ x: 1 * TILE, y: 1 * TILE, kind: 'enemy' }])
    expect(lvl.tiles[1][1]).toBe('empty')
  })
})

// ---------------------------------------------------------------------------
// Sanidade da fase real world1-zona1 (Errata E3+E4):
//   - 40 cols x 11 rows, todas exatamente 40 chars
//   - spawn col 2 row 8, goal col 36 row 8
//   - row 9 e row 10 sao chao continuo (sem gap entre spawn col e goal col)
// ---------------------------------------------------------------------------
import { world1Zona1 } from '../../src/data/levels/world1-zona1'

describe('world1-zona1 (fase greybox — Errata E3+E4)', () => {
  it('todas as linhas tem exatamente 40 chars', () => {
    for (let i = 0; i < world1Zona1.rows.length; i++) {
      expect(world1Zona1.rows[i].length, `row ${i} deve ter 40 chars`).toBe(40)
    }
  })

  it('widthTiles === 40 e heightTiles === 11', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.widthTiles).toBe(40)
    expect(lvl.heightTiles).toBe(11)
    expect(lvl.widthPx).toBe(40 * TILE)
    expect(lvl.heightPx).toBe(11 * TILE)
  })

  it('tem exatamente 1 S (spawn col 2, row 8) e 1 G (goal col 36, row 8)', () => {
    // Conta ocorrencias de S e G nas rows
    const allChars = world1Zona1.rows.join('')
    const sCount = allChars.split('').filter((c) => c === 'S').length
    const gCount = allChars.split('').filter((c) => c === 'G').length
    expect(sCount).toBe(1)
    expect(gCount).toBe(1)

    const lvl = parseLevel(world1Zona1)
    // Errata E3+E4: spawn col 2, row 8; goal col 36, row 8
    expect(lvl.playerSpawn).toEqual({ x: 2 * TILE, y: 8 * TILE })
    expect(lvl.goal).toEqual({ x: 36 * TILE, y: 8 * TILE })
  })

  it('sanidade de travessia: chao continuo entre spawn col e goal col (rows 9 e 10)', () => {
    const lvl = parseLevel(world1Zona1)
    const spawnCol = 2
    const goalCol = 36
    // Row 9 e row 10 devem ser ground continuo entre spawnCol e goalCol
    for (let col = spawnCol; col <= goalCol; col++) {
      expect(lvl.tiles[9][col], `row 9 col ${col} deve ser ground`).toBe('ground')
      expect(lvl.tiles[10][col], `row 10 col ${col} deve ser ground`).toBe('ground')
    }
  })

  it('sem inimigos na fase M0', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.enemies).toEqual([])
  })

  it('tem 3 moedas (cols 10, 20, 30 na row 3)', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.coins.length).toBe(3)
    expect(lvl.coins).toContainEqual({ x: 10 * TILE, y: 3 * TILE })
    expect(lvl.coins).toContainEqual({ x: 20 * TILE, y: 3 * TILE })
    expect(lvl.coins).toContainEqual({ x: 30 * TILE, y: 3 * TILE })
  })
})
