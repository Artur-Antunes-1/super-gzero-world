// tests/unit/levels.test.ts — registry de fases + sanidade da W1-1 (C3a).
import { describe, it, expect } from 'vitest'
import { TILE, PLAYER_W, PLAYER_H } from '../../src/engine/constants'
import { stepBody, type Body } from '../../src/engine/physics'
import { validateLevel, parseLevel } from '../../src/game/levelParser'
import {
  LEVELS,
  DEFAULT_LEVEL_ID,
  parseLevelById,
} from '../../src/data/levels/index'
import { W1_1 } from '../../src/data/levels/w1-1'
import { W1_2 } from '../../src/data/levels/w1-2'
import { W1_3 } from '../../src/data/levels/w1-3'

describe('registry de fases (data/levels/index)', () => {
  it('DEFAULT_LEVEL_ID e "w1-1" e o registry contem w1-1..w1-3, zona1 e hw-test', () => {
    expect(DEFAULT_LEVEL_ID).toBe('w1-1')
    expect(Object.keys(LEVELS).sort()).toEqual([
      'hw-test',
      'w1-1',
      'w1-2',
      'w1-3',
      'zona1',
    ])
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

  // 2026-06-11: progressao por level.next.
  it('todo next definido aponta para um id existente no registry', () => {
    for (const [id, def] of Object.entries(LEVELS)) {
      if (def.next !== undefined) {
        expect(LEVELS[def.next], `next de ${id} ('${def.next}') deve existir`).toBeDefined()
      }
    }
  })

  it('chain w1-1 -> w1-2 -> w1-3 (U4); w1-3 encerra o fluxo (sem next)', () => {
    expect(W1_1.next).toBe('w1-2')
    expect(parseLevelById('w1-1').next).toBe('w1-2')
    // U4: a w1-2 agora encadeia na w1-3 nova.
    expect(W1_2.next).toBe('w1-3')
    expect(parseLevelById('w1-2').next).toBe('w1-3')
    // w1-3 (ultima do W1), zona1 e hw-test encerram o fluxo (sem next).
    expect(parseLevelById('w1-3').next).toBeUndefined()
    expect(parseLevelById('zona1').next).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// U4 (2026-06-11): W1-3 — "O Coração Acende" (spec §8.3, 168x11, difficulty 4).
// ---------------------------------------------------------------------------
describe('W1-3 — "O Coração Acende" (spec §8.3)', () => {
  it('168 colunas x 11 linhas; toda linha tem exatamente 168 chars', () => {
    expect(W1_3.rows.length).toBe(11)
    for (let i = 0; i < W1_3.rows.length; i++) {
      expect(W1_3.rows[i].length, `row ${i} deve ter 168 chars`).toBe(168)
    }
    const lvl = parseLevel(W1_3)
    expect(lvl.widthTiles).toBe(168)
    expect(lvl.heightTiles).toBe(11)
  })

  it('valida no validateLevel (alcancabilidade incluida)', () => {
    expect(() => validateLevel(W1_3)).not.toThrow()
  })

  it('spawn na col 2 row 8 (pelos pes); portal ">" na col 160 row 6 (piso elevado)', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.playerSpawn).toEqual({ x: 2 * TILE, y: 9 * TILE - PLAYER_H })
    expect(lvl.goal).toEqual({ x: 160 * TILE, y: 6 * TILE })
  })

  it('checkpoints [48, 96, 140], timeStart 250 e bgTheme "cartoon"', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.checkpoints).toEqual([48, 96, 140])
    expect(lvl.timeStart).toBe(250)
    expect(lvl.bgTheme).toBe('cartoon')
  })

  it('lifecard "L" na col 150 row 2 (desafio opcional E)', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.lifecards).toEqual([{ col: 150, row: 2 }])
  })

  it("espinhos 'x' no chao do gauntlet (117-119 e 134-135, row 8)", () => {
    const lvl = parseLevel(W1_3)
    for (const col of [117, 118, 119, 134, 135]) {
      expect(lvl.tiles[8][col], `col ${col} row 8`).toBe('spike')
    }
  })

  it('13 tolos: 7 comuns (A+C), 3 velozes e 3 atiradores no gauntlet', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.foolSpawns).toHaveLength(13)
    const kinds = lvl.foolSpawns.map((f) => f.kind)
    expect(kinds.filter((k) => k === 'tolo')).toHaveLength(7)
    expect(kinds.filter((k) => k === 'tolo_veloz')).toHaveLength(3)
    expect(kinds.filter((k) => k === 'tolo_atirador')).toHaveLength(3)
    // Gauntlet D: todas as variantes vivem nas cols 96-140.
    for (const f of lvl.foolSpawns) {
      if (f.kind !== 'tolo') {
        expect(f.col).toBeGreaterThanOrEqual(96)
        expect(f.col).toBeLessThanOrEqual(140)
      }
    }
  })

  it('2 molas (A col 13, B col 40) e 2 movers de gap com speed 1.5 (spec D)', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.springs).toEqual([
      { col: 13, row: 8 },
      { col: 40, row: 8 },
    ])
    expect(lvl.movers).toEqual([
      { col: 110, row: 8, axis: 'x', amplitude: 3, speed: 1.5 },
      { col: 128, row: 8, axis: 'x', amplitude: 3, speed: 1.5 },
    ])
  })

  it("qBlock star@36 (sala-bonus SIMPLIFICADA) e 2 coracoes (cols 20 e 78)", () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.qBlocks).toEqual([{ col: 36, row: 6, payload: 'star' }])
    expect(lvl.hearts).toEqual([
      { col: 20, row: 6 },
      { col: 78, row: 6 },
    ])
  })

  it('gaps reais do gauntlet: 108-112 e 126-130 com pousos solidos dos lados', () => {
    const lvl = parseLevel(W1_3)
    for (const [c0, c1] of [
      [108, 112],
      [126, 130],
    ] as const) {
      for (let col = c0; col <= c1; col++) {
        expect(lvl.tiles[9][col], `row 9 col ${col} aberto`).toBe('empty')
        expect(lvl.tiles[10][col], `row 10 col ${col} aberto`).toBe('empty')
      }
      expect(lvl.tiles[9][c0 - 1]).toBe('ground')
      expect(lvl.tiles[9][c1 + 1]).toBe('ground')
    }
  })

  it('decor copiado: 3 arvores + 2 cristais (data-driven, sem colisao)', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.decor).toHaveLength(5)
    expect(lvl.decor.filter((d) => d.key === 'prop.arvore')).toHaveLength(3)
    expect(lvl.decor.filter((d) => d.key === 'prop.cristal')).toHaveLength(2)
    // Copia rasa: mutar o parse nao vaza para o def.
    expect(lvl.decor).not.toBe(W1_3.decor)
  })

  it('trilha generosa de moedas (>= 40) — fase de medidor + bonus', () => {
    const lvl = parseLevel(W1_3)
    expect(lvl.coins.length).toBeGreaterThanOrEqual(40)
  })

  it('piso/plataforma continua sob TODAS as patrulhas (tolos nao caem)', () => {
    const lvl = parseLevel(W1_3)
    for (const f of lvl.foolSpawns) {
      const floorRow = f.row + 1
      const [min, max] = f.patrol!
      for (let col = min; col <= max; col++) {
        const t = lvl.tiles[floorRow][col]
        expect(
          t === 'ground' || t === 'platform',
          `row ${floorRow} col ${col} (tolo ${f.kind} @${f.col})`,
        ).toBe(true)
      }
    }
  })

  it('piso ELEVADO da secao F (rows 7-8 solidos nas cols 156-167)', () => {
    const lvl = parseLevel(W1_3)
    for (let col = 156; col <= 167; col++) {
      expect(lvl.tiles[7][col]).toBe('ground')
      expect(lvl.tiles[8][col]).toBe('ground')
    }
  })
})

// ---------------------------------------------------------------------------
// G4 (2026-06-11): W1-2 — "Plataformas Flutuantes" (spec §8.3, 156x11).
// ---------------------------------------------------------------------------
describe('W1-2 — "Plataformas Flutuantes" (spec §8.3)', () => {
  it('156 colunas x 11 linhas; toda linha tem exatamente 156 chars', () => {
    expect(W1_2.rows.length).toBe(11)
    for (let i = 0; i < W1_2.rows.length; i++) {
      expect(W1_2.rows[i].length, `row ${i} deve ter 156 chars`).toBe(156)
    }
    const lvl = parseLevel(W1_2)
    expect(lvl.widthTiles).toBe(156)
    expect(lvl.heightTiles).toBe(11)
  })

  it('valida no validateLevel (alcancabilidade incluida)', () => {
    expect(() => validateLevel(W1_2)).not.toThrow()
  })

  it('spawn na col 2 row 8 (pelos pes); portal ">" na col 148 row 8', () => {
    const lvl = parseLevel(W1_2)
    // Hitbox honesta (2026-06-11): spawn pelos pes — base na base da celula 'S'.
    expect(lvl.playerSpawn).toEqual({ x: 2 * TILE, y: 9 * TILE - PLAYER_H })
    expect(lvl.goal).toEqual({ x: 148 * TILE, y: 8 * TILE })
  })

  it('checkpoints [60, 110] e timeStart 250', () => {
    const lvl = parseLevel(W1_2)
    expect(lvl.checkpoints).toEqual([60, 110])
    expect(lvl.timeStart).toBe(250)
  })

  it('3 molas: nicho B (col 30) e torre D (cols 64 e 75)', () => {
    const lvl = parseLevel(W1_2)
    // Ordem de scan row-major do parser.
    expect(lvl.springs).toEqual([
      { col: 75, row: 6 },
      { col: 30, row: 8 },
      { col: 64, row: 8 },
    ])
    // Mola e tile empty (nao bloqueia).
    for (const s of lvl.springs) {
      expect(lvl.tiles[s.row][s.col]).toBe('empty')
    }
  })

  it('4 movers: C horizontal (defaults), E vertical (override) e 2 no arquipelago F', () => {
    const lvl = parseLevel(W1_2)
    // Ordem de scan row-major do parser.
    expect(lvl.movers).toEqual([
      { col: 134, row: 6, axis: 'x', amplitude: 3, speed: 1.3 },
      { col: 124, row: 7, axis: 'x', amplitude: 3, speed: 1.3 },
      { col: 46, row: 8, axis: 'x', amplitude: 3, speed: 1.2 }, // defaults do '~'
      { col: 100, row: 8, axis: 'y', amplitude: 4, speed: 1.0 }, // poco vertical
    ])
  })

  it('qBlocks: item@28(nicho da mola), star@104(poco), coin@18', () => {
    const lvl = parseLevel(W1_2)
    expect(lvl.qBlocks).toEqual([
      { col: 28, row: 3, payload: 'item' },
      { col: 104, row: 4, payload: 'star' },
      { col: 18, row: 6, payload: 'coin' },
    ])
    for (const q of lvl.qBlocks) {
      expect(lvl.tiles[q.row][q.col]).toBe('block')
    }
  })

  it('1 coracao no alto da torre D (col 84 row 3) e 3 tolos com patrulha', () => {
    const lvl = parseLevel(W1_2)
    expect(lvl.hearts).toEqual([{ col: 84, row: 3 }])
    // U3/U4: o parser agora SEMPRE preenche kind ('fool' legado = 'tolo').
    expect(lvl.foolSpawns).toEqual([
      { col: 34, row: 8, patrol: [32, 38], kind: 'tolo' },
      { col: 70, row: 6, patrol: [66, 74], kind: 'tolo' },
      { col: 80, row: 4, patrol: [78, 86], kind: 'tolo' },
    ])
  })

  it('gaps reais: C 46-50, poco E 98-102, arquipelago F 120-143', () => {
    const lvl = parseLevel(W1_2)
    const openCols = [
      [46, 50],
      [98, 102],
      [120, 143],
    ] as const
    for (const [c0, c1] of openCols) {
      for (let col = c0; col <= c1; col++) {
        expect(lvl.tiles[9][col], `row 9 col ${col} aberto`).toBe('empty')
        expect(lvl.tiles[10][col], `row 10 col ${col} aberto`).toBe('empty')
      }
      // Pousos solidos dos dois lados de cada vao.
      expect(lvl.tiles[9][c0 - 1]).toBe('ground')
      expect(lvl.tiles[9][c1 + 1]).toBe('ground')
    }
  })

  it('trilha generosa de moedas (>= 35) — fase de medidor enchendo', () => {
    const lvl = parseLevel(W1_2)
    expect(lvl.coins.length).toBeGreaterThanOrEqual(35)
  })

  it('piso/plataforma continua sob as patrulhas dos tolos', () => {
    const lvl = parseLevel(W1_2)
    const floorOf = [9, 7, 5] // tolo 1 no chao; 2 na torre row 7; 3 na torre row 5
    lvl.foolSpawns.forEach((f, i) => {
      const [min, max] = f.patrol!
      for (let col = min; col <= max; col++) {
        const t = lvl.tiles[floorOf[i]][col]
        expect(
          t === 'ground' || t === 'platform',
          `row ${floorOf[i]} col ${col} (tolo ${i})`,
        ).toBe(true)
      }
    })
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

  it('spawn adicionado na col 2 row 8 (pelos pes); goal ">" na col 136 row 8', () => {
    const lvl = parseLevel(W1_1)
    // Hitbox honesta (2026-06-11): spawn pelos pes — base na base da celula 'S'.
    expect(lvl.playerSpawn).toEqual({ x: 2 * TILE, y: 9 * TILE - PLAYER_H })
    expect(lvl.goal).toEqual({ x: 136 * TILE, y: 8 * TILE })
  })

  it('3 tolos via entities, com patrulhas do spec; "g" do mapa ignorado', () => {
    const lvl = parseLevel(W1_1)
    // U3/U4: o parser agora SEMPRE preenche kind ('fool' legado = 'tolo').
    expect(lvl.foolSpawns).toEqual([
      { col: 24, row: 8, patrol: [24, 30], kind: 'tolo' },
      { col: 78, row: 8, patrol: [78, 84], kind: 'tolo' },
      { col: 88, row: 8, patrol: [88, 94], kind: 'tolo' },
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

  // Hitbox honesta (2026-06-11): com h=64 o vao de 1 tile (48px) sob o 'B' da
  // col 86 (row 7, piso na row 9) DEIXOU de ser passavel por baixo — o corpo
  // colide de pe na row 8. O caminho canonico vira pular POR CIMA do bloco
  // (apex ~4,2 tiles, trivial). Antes (h=42) dava para passar andando.
  it('hitbox honesta: NAO passa por baixo do B na col 86 (vao de 1 tile)', () => {
    const lvl = parseLevel(W1_1)
    // Geometria do mapa: B na row 7 col 86; row 8 livre; piso one-way na row 9.
    expect(lvl.tiles[7][86]).toBe('brick')
    expect(lvl.tiles[8][86]).toBe('empty')
    expect(lvl.tiles[9][86]).toBe('platform')
    // Pre-condicao da mudanca: o corpo (64) nao cabe no vao de 1 tile (48).
    expect(PLAYER_H).toBeGreaterThan(TILE)
    // Player de pe no piso (pes na row 9), andando para a direita rumo ao B.
    const body: Body = {
      x: 84 * TILE,
      y: 9 * TILE - PLAYER_H,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: true,
    }
    for (let i = 0; i < 60; i++) {
      body.vx = 4 // re-aplica: a colisao zera vx
      stepBody(body, lvl, 1)
    }
    // Travado na parede esquerda do B: borda direita encosta em 86*TILE.
    expect(body.x).toBe(86 * TILE - PLAYER_W)
    expect(body.y).toBe(9 * TILE - PLAYER_H) // segue de pe no piso
  })
})
