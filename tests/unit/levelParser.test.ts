import { describe, it, expect } from 'vitest'
import { parseLevel, validateLevel } from '../../src/game/levelParser'
import { TILE, TIME_START } from '../../src/engine/constants'
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

  it('inicia sem inimigos/foolSpawns quando o mapa nao tem F nem entities', () => {
    const lvl = parseLevel(def)
    expect(lvl.enemies).toEqual([])
    expect(lvl.foolSpawns).toEqual([])
  })

  it('defaults: checkpoints=[], timeStart=TIME_START, hearts=[]', () => {
    const lvl = parseLevel(def)
    expect(lvl.checkpoints).toEqual([])
    expect(lvl.timeStart).toBe(TIME_START)
    expect(lvl.hearts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Legenda nova (C3a): '?' qBlocks, 'H' heart, '>' goal, 'g' ignorado,
// foolSpawns via entities (com patrol) + legacy 'F' (sem patrol).
// ---------------------------------------------------------------------------
describe('parseLevel — legenda nova (C3a)', () => {
  it('"?" vira tile block + entrada em qBlocks com payload das entities (default coin)', () => {
    const d: LevelDef = {
      id: 'test-qblocks',
      world: 9,
      zone: 9,
      rows: [
        '.?.?....', // blocks col 1 e col 3, row 0
        'S.....G.',
        '########',
      ],
      entities: [{ type: 'block', col: 3, row: 0, payload: 'star' }],
    }
    const lvl = parseLevel(d)
    expect(lvl.tiles[0][1]).toBe('block')
    expect(lvl.tiles[0][3]).toBe('block')
    expect(lvl.qBlocks).toEqual([
      { col: 1, row: 0, payload: 'coin' }, // sem entity -> default
      { col: 3, row: 0, payload: 'star' }, // payload da entity matching col/row
    ])
  })

  it('"H" vira tile empty + entrada em hearts (col/row)', () => {
    const d: LevelDef = {
      id: 'test-heart',
      world: 9,
      zone: 9,
      rows: ['..H.....', 'S.....G.', '########'],
    }
    const lvl = parseLevel(d)
    expect(lvl.tiles[0][2]).toBe('empty')
    expect(lvl.hearts).toEqual([{ col: 2, row: 0 }])
  })

  it('">" posiciona o goal igual a "G"', () => {
    const d: LevelDef = {
      id: 'test-portal',
      world: 9,
      zone: 9,
      rows: ['........', 'S....>..', '########'],
    }
    const lvl = parseLevel(d)
    expect(lvl.goal).toEqual({ x: 5 * TILE, y: 1 * TILE })
    expect(lvl.tiles[1][5]).toBe('empty')
  })

  it('"g" e ignorado (marcador visual; tolos vem das entities)', () => {
    const d: LevelDef = {
      id: 'test-g-marker',
      world: 9,
      zone: 9,
      rows: ['........', 'Sg....G.', '########'],
    }
    const lvl = parseLevel(d)
    expect(lvl.tiles[1][1]).toBe('empty')
    expect(lvl.enemies).toEqual([])
    expect(lvl.foolSpawns).toEqual([])
  })

  it('foolSpawns = entities fool (com patrol) + legacy F (sem patrol)', () => {
    const d: LevelDef = {
      id: 'test-fools',
      world: 9,
      zone: 9,
      rows: ['........', 'S..F..G.', '########'],
      entities: [{ type: 'fool', col: 5, row: 1, patrol: [4, 6] }],
    }
    const lvl = parseLevel(d)
    expect(lvl.foolSpawns).toEqual([
      { col: 5, row: 1, patrol: [4, 6] }, // entity primeiro
      { col: 3, row: 1 }, // legacy 'F' sem patrol
    ])
    // Espelho legacy: 'F' continua em enemies (compat).
    expect(lvl.enemies).toEqual([{ x: 3 * TILE, y: 1 * TILE, kind: 'fool' }])
  })

  it('copia checkpoints e timeStart do LevelDef', () => {
    const d: LevelDef = {
      id: 'test-meta',
      world: 9,
      zone: 9,
      rows: ['........', 'S.....G.', '########'],
      checkpoints: [4],
      timeStart: 99,
    }
    const lvl = parseLevel(d)
    expect(lvl.checkpoints).toEqual([4])
    expect(lvl.timeStart).toBe(99)
  })
})

// ---------------------------------------------------------------------------
// validateLevel: spawn/goal obrigatorios, larguras consistentes, checkpoints
// dentro de [0, cols).
// ---------------------------------------------------------------------------
describe('validateLevel', () => {
  const base = { world: 9, zone: 9 }

  it('aceita fase valida (S, G, larguras iguais, checkpoint no range)', () => {
    const d: LevelDef = {
      id: 'ok',
      ...base,
      rows: ['S.....G.', '########'],
      checkpoints: [0, 7],
    }
    expect(() => validateLevel(d)).not.toThrow()
  })

  it('aceita ">" como goal', () => {
    const d: LevelDef = { id: 'ok-portal', ...base, rows: ['S....>..', '########'] }
    expect(() => validateLevel(d)).not.toThrow()
  })

  it('lanca se faltar spawn S', () => {
    const d: LevelDef = { id: 'sem-spawn', ...base, rows: ['......G.', '########'] }
    expect(() => validateLevel(d)).toThrow(/spawn/)
  })

  it('lanca se faltar goal (G ou >)', () => {
    const d: LevelDef = { id: 'sem-goal', ...base, rows: ['S.......', '########'] }
    expect(() => validateLevel(d)).toThrow(/goal/)
  })

  it('lanca se as larguras de linha forem inconsistentes', () => {
    const d: LevelDef = { id: 'larguras', ...base, rows: ['S.....G.', '#####'] }
    expect(() => validateLevel(d)).toThrow(/largura/)
  })

  it('lanca se checkpoint estiver fora de [0, cols)', () => {
    const tooBig: LevelDef = {
      id: 'cp-grande',
      ...base,
      rows: ['S.....G.', '########'],
      checkpoints: [8],
    }
    expect(() => validateLevel(tooBig)).toThrow(/checkpoint/)
    const negative: LevelDef = {
      id: 'cp-negativo',
      ...base,
      rows: ['S.....G.', '########'],
      checkpoints: [-1],
    }
    expect(() => validateLevel(negative)).toThrow(/checkpoint/)
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

  it('tem exatamente 2 tolos (F) em enemies E foolSpawns, acima das plataformas', () => {
    const lvl = parseLevel(world1Zona1)
    const fools = lvl.enemies.filter((e) => e.kind === 'fool')
    expect(fools.length).toBe(2)
    // Nenhum inimigo 'enemy' (so 'fool' nesta fase).
    expect(lvl.enemies.every((e) => e.kind === 'fool')).toBe(true)
    // foolSpawns espelha os F legacy (sem patrol).
    expect(lvl.foolSpawns).toEqual([
      { col: 14, row: 4 },
      { col: 24, row: 4 },
    ])
    // Os tolos estao na row 4 (acima das plataformas na row 5), sobre chao continuo.
    for (const f of fools) {
      expect(f.y).toBe(4 * TILE)
      const col = Math.round(f.x / TILE)
      // Chao solido abaixo do caminho principal (rows 9-10) segue intacto.
      expect(lvl.tiles[9][col]).toBe('ground')
    }
  })

  it('tem 3 moedas (cols 10, 20, 30 na row 3)', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.coins.length).toBe(3)
    expect(lvl.coins).toContainEqual({ x: 10 * TILE, y: 3 * TILE })
    expect(lvl.coins).toContainEqual({ x: 20 * TILE, y: 3 * TILE })
    expect(lvl.coins).toContainEqual({ x: 30 * TILE, y: 3 * TILE })
  })
})
