import { describe, it, expect } from 'vitest'
import { parseLevel, validateLevel } from '../../src/game/levelParser'
import { TILE, TIME_START } from '../../src/engine/constants'
import type { LevelDef } from '../../src/data/schema'

// ---------------------------------------------------------------------------
// Mapa de teste 8 colunas x 4 linhas.
// Legenda: #=ground = =platform ?=block ^=MOLA (2026-06-11; era spike)
//          o=coin S=spawn G=goal .=empty
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
    '##^#####', // linha 3: ground em 0,1,3..7 e MOLA em col 2
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
    // linha 3: ground; '^' agora e MOLA (tile empty, camada springs)
    expect(lvl.tiles[3][0]).toBe('ground')
    expect(lvl.tiles[3][1]).toBe('ground')
    expect(lvl.tiles[3][2]).toBe('empty')
    expect(lvl.tiles[3][3]).toBe('ground')
    expect(lvl.tiles[3][7]).toBe('ground')
    // platform e block
    expect(lvl.tiles[1][3]).toBe('platform')
    expect(lvl.tiles[2][4]).toBe('block')
  })

  it('"^" gera entrada em springs (col/row) com tile empty', () => {
    const lvl = parseLevel(def)
    expect(lvl.springs).toEqual([{ col: 2, row: 3 }])
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

  it('defaults: checkpoints=[], timeStart=TIME_START, hearts=[], movers=[], next undefined', () => {
    const lvl = parseLevel(def)
    expect(lvl.checkpoints).toEqual([])
    expect(lvl.timeStart).toBe(TIME_START)
    expect(lvl.hearts).toEqual([])
    expect(lvl.movers).toEqual([])
    expect(lvl.next).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 2026-06-11: '~' plataforma movel (defaults + override por entity 'mover')
// e next copiado do LevelDef.
// ---------------------------------------------------------------------------
describe('parseLevel — mola, plataforma movel e next', () => {
  it('"~" vira tile empty + entrada em movers com defaults (x, 3 tiles, 1.2 px/f)', () => {
    const d: LevelDef = {
      id: 'test-mover-default',
      world: 9,
      zone: 9,
      rows: ['........', '..~.....', 'S.....G.', '########'],
    }
    const lvl = parseLevel(d)
    expect(lvl.tiles[1][2]).toBe('empty')
    expect(lvl.movers).toEqual([
      { col: 2, row: 1, axis: 'x', amplitude: 3, speed: 1.2 },
    ])
  })

  it('entity "mover" no mesmo col/row sobrescreve axis/amplitude/speed', () => {
    const d: LevelDef = {
      id: 'test-mover-override',
      world: 9,
      zone: 9,
      rows: ['........', '..~..~..', 'S.....G.', '########'],
      entities: [{ type: 'mover', col: 5, row: 1, axis: 'y', amplitude: 2, speed: 0.8 }],
    }
    const lvl = parseLevel(d)
    expect(lvl.movers).toEqual([
      { col: 2, row: 1, axis: 'x', amplitude: 3, speed: 1.2 }, // defaults
      { col: 5, row: 1, axis: 'y', amplitude: 2, speed: 0.8 }, // override
    ])
  })

  it('next e copiado do LevelDef para o ParsedLevel', () => {
    const d: LevelDef = {
      id: 'test-next',
      world: 9,
      zone: 9,
      rows: ['S.....G.', '########'],
      next: 'proxima-fase',
    }
    expect(parseLevel(d).next).toBe('proxima-fase')
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
// validateLevel — ALCANCABILIDADE (2026-06-11): cada moeda/qblock/heart precisa
// de apoio (topo de solido/platform com celula acima livre) em ±2 colunas com
// subida <= 170px; mola em ±3 colunas sobe o limite para 300px.
// Subida = (rowApoio - rowItem - 1)*48 - PLAYER_H(42).
// ---------------------------------------------------------------------------
describe('validateLevel — alcancabilidade', () => {
  const base = { world: 9, zone: 9 }

  it('moeda a 150px do chao (row 4 sobre piso row 9) passa', () => {
    const d: LevelDef = {
      id: 'coin-150',
      ...base,
      rows: [
        '........', // 0
        '........', // 1
        '........', // 2
        '........', // 3
        '...o....', // 4: moeda col 3 -> subida (9-4-1)*48-42 = 150 <= 170
        '........', // 5
        '........', // 6
        '........', // 7
        'S.....G.', // 8
        '########', // 9
      ],
    }
    expect(() => validateLevel(d)).not.toThrow()
  })

  it('moeda alta demais (294px) SEM mola lanca com col/row no erro', () => {
    const d: LevelDef = {
      id: 'coin-294',
      ...base,
      rows: [
        '...o....', // 0: moeda col 3 -> subida (8-0-1)*48-42 = 294 > 170
        '........', // 1
        '........', // 2
        '........', // 3
        '........', // 4
        '........', // 5
        '........', // 6
        'S.....G.', // 7
        '########', // 8
      ],
    }
    expect(() => validateLevel(d)).toThrow(/inalcancavel/)
    expect(() => validateLevel(d)).toThrow(/col 3/)
    expect(() => validateLevel(d)).toThrow(/row 0/)
  })

  it('a MESMA moeda alta passa com mola em ±3 colunas (limite 300px)', () => {
    const d: LevelDef = {
      id: 'coin-294-mola',
      ...base,
      rows: [
        '...o....', // 0: moeda col 3; subida 294 <= 300 (mola col 4)
        '........', // 1
        '........', // 2
        '........', // 3
        '........', // 4
        '........', // 5
        '........', // 6
        'S...^.G.', // 7: mola col 4 (|4-3| = 1 <= 3)
        '########', // 8
      ],
    }
    expect(() => validateLevel(d)).not.toThrow()
  })

  it('mola FORA da janela de ±3 colunas nao salva o item', () => {
    const d: LevelDef = {
      id: 'coin-mola-longe',
      ...base,
      rows: [
        'o.........', // 0: moeda col 0; mola col 7 (|7-0| = 7 > 3)
        '..........', // 1
        '..........', // 2
        '..........', // 3
        '..........', // 4
        '..........', // 5
        '..........', // 6
        'S......^G.', // 7
        '##########', // 8
      ],
    }
    expect(() => validateLevel(d)).toThrow(/inalcancavel/)
  })

  it('qblock NAO conta a propria celula como apoio (flutuando alto -> lanca)', () => {
    const d: LevelDef = {
      id: 'qblock-flutuante',
      ...base,
      rows: [
        '...?....', // 0: qblock col 3 -> apoio mais proximo e o piso (294px)
        '........', // 1
        '........', // 2
        '........', // 3
        '........', // 4
        '........', // 5
        '........', // 6
        'S.....G.', // 7
        '########', // 8
      ],
    }
    expect(() => validateLevel(d)).toThrow(/inalcancavel/)
  })

  it('apoio vale em ±2 colunas: plataforma vizinha torna o item alcancavel', () => {
    const d: LevelDef = {
      id: 'coin-apoio-vizinho',
      ...base,
      rows: [
        '........', // 0
        '...o....', // 1: moeda col 3
        '........', // 2
        '.....=..', // 3: platform col 5 (|5-3| = 2) -> subida (3-1-1)*48-42 = 6
        '........', // 4
        '........', // 5
        '........', // 6
        'S.....G.', // 7
        '########', // 8
      ],
    }
    expect(() => validateLevel(d)).not.toThrow()
  })

  it('item no nivel do chao (heart) passa trivialmente (subida 0)', () => {
    const d: LevelDef = {
      id: 'heart-chao',
      ...base,
      rows: ['........', 'S..H..G.', '########'],
    }
    expect(() => validateLevel(d)).not.toThrow()
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

  it('tem 3 moedas (cols 10, 20, 30 na row 4 — errata de fisica 2026-06-11)', () => {
    // Row 3 exigia subida ~198px (> alcance do pior saltador); row 4 exige ~150px.
    const lvl = parseLevel(world1Zona1)
    expect(lvl.coins.length).toBe(3)
    expect(lvl.coins).toContainEqual({ x: 10 * TILE, y: 4 * TILE })
    expect(lvl.coins).toContainEqual({ x: 20 * TILE, y: 4 * TILE })
    expect(lvl.coins).toContainEqual({ x: 30 * TILE, y: 4 * TILE })
  })

  it('passa no validador de alcancabilidade (moedas na row 4)', () => {
    expect(() => validateLevel(world1Zona1)).not.toThrow()
  })
})
