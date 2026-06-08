// tests/unit/enemy.test.ts
import { describe, it, expect } from 'vitest'
import { ENEMY_SPEED, TILE } from '../../src/engine/constants'
import type { ParsedLevel, TileType, CharacterDef } from '../../src/data/schema'
import {
  spawnEnemies,
  updateEnemy,
  isStomp,
  type Enemy,
} from '../../src/game/enemy'
import { createPlayer, type Player } from '../../src/game/player'

// Constroi um ParsedLevel a partir de um mapa ASCII (mesmo padrao do physics.test.ts).
function makeLevel(rows: string[], enemies: ParsedLevel['enemies'] = []): ParsedLevel {
  const heightTiles = rows.length
  const widthTiles = Math.max(...rows.map((r) => r.length))
  const tiles: TileType[][] = []
  for (let ty = 0; ty < heightTiles; ty++) {
    const row: TileType[] = []
    for (let tx = 0; tx < widthTiles; tx++) {
      const ch = rows[ty][tx] ?? '.'
      let t: TileType = 'empty'
      if (ch === '#') t = 'ground'
      else if (ch === 'B') t = 'brick'
      else if (ch === '?') t = 'block'
      else if (ch === '=') t = 'platform'
      row.push(t)
    }
    tiles.push(row)
  }
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies,
  }
}

const CHAR: CharacterDef = {
  id: 'test',
  name: 'Test',
  abilityId: 'salto_visionario',
  color: '#fff',
  accent: '#000',
  hearts: 3,
  jumpVelMul: 1,
  walkMul: 1,
  runMul: 1,
  weightMul: 1,
}

describe('spawnEnemies', () => {
  it('converte fool e enemy em Enemy kind tolo com dims/flags canonicas', () => {
    const level = makeLevel(['....', '####'], [
      { x: 48, y: 0, kind: 'fool' },
      { x: 96, y: 0, kind: 'enemy' },
    ])
    const es = spawnEnemies(level)
    expect(es).toHaveLength(2)
    for (const e of es) {
      expect(e.kind).toBe('tolo')
      expect(e.w).toBe(38)
      expect(e.h).toBe(34)
      expect(e.dir).toBe(-1)
      expect(e.alive).toBe(true)
      expect(e.frozen).toBe(false)
      expect(e.vx).toBe(0)
      expect(e.vy).toBe(0)
      expect(e.onGround).toBe(false)
    }
    expect(es[0].x).toBe(48)
    expect(es[1].x).toBe(96)
  })
})

describe('updateEnemy patrulha', () => {
  it('anda em ENEMY_SPEED*dir sobre chao continuo', () => {
    // Chao continuo (linha 1). Inimigo sobre a celula (col 2), dir=-1 (esquerda).
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 34, w: 38, h: 34, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    const x0 = e.x
    updateEnemy(e, level, 1)
    // Andou para a esquerda ~ ENEMY_SPEED (sem parede no caminho).
    expect(e.x).toBeLessThan(x0)
    expect(x0 - e.x).toBeCloseTo(ENEMY_SPEED, 5)
    expect(e.dir).toBe(-1)
  })

  it('inverte dir ao bater em parede (vx zerou no stepBody)', () => {
    // Parede de brick na coluna 2; piso na linha 2. Inimigo encostando indo a direita (dir=1).
    const level = makeLevel(['..B.....', '..B.....', '########'])
    const e: Enemy = {
      // borda direita encostando na parede (x+w bem proximo de 2*TILE)
      x: 2 * TILE - 38 - 0.5, y: 2 * TILE - 34, w: 38, h: 34, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
    }
    updateEnemy(e, level, 1)
    // Bateu na parede: stepBody zerou vx -> inverteu para a esquerda.
    expect(e.dir).toBe(-1)
  })

  it('inverte na iminencia de borda (nao cai do penhasco)', () => {
    // Chao so nas colunas 0..2 (linha 1). Coluna 3+ e abismo.
    // Inimigo na col 2 indo a direita (dir=1): a celula diante (col 3) nao tem chao abaixo -> inverte.
    const level = makeLevel(['........', '###.....'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 34, w: 38, h: 34, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
    }
    updateEnemy(e, level, 1)
    // Deve ter invertido ANTES de andar para o vazio.
    expect(e.dir).toBe(-1)
    // E nao deve ter avancado para alem do tile de chao (sem cair).
    expect(e.x).toBeLessThanOrEqual(2 * TILE + 1)
  })

  it('nao move quando alive=false', () => {
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 34, w: 38, h: 34, vx: 9, vy: 9,
      onGround: true, kind: 'tolo', dir: -1, alive: false, frozen: false,
    }
    const x0 = e.x, y0 = e.y
    updateEnemy(e, level, 1)
    expect(e.x).toBe(x0)
    expect(e.y).toBe(y0)
  })

  it('nao move quando frozen=true (Modo Humanware)', () => {
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 34, w: 38, h: 34, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: true,
    }
    const x0 = e.x, y0 = e.y
    updateEnemy(e, level, 1)
    expect(e.x).toBe(x0)
    expect(e.y).toBe(y0)
  })
})

describe('isStomp', () => {
  it('true quando o player cai (vy>0) sobre o topo do tolo', () => {
    const player: Player = createPlayer(CHAR, { x: 0, y: 0 })
    const e: Enemy = {
      x: 100, y: 200, w: 38, h: 34, vx: 0, vy: 0,
      onGround: false, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    // Player descendo, pe acima da metade do tolo, sobreposto em X/Y.
    player.x = 100
    player.y = 200 - player.h + 4 // pe em ~204, abaixo do topo 200 mas acima de 200+17
    player.vy = 6
    expect(isStomp(player, e)).toBe(true)
  })

  it('false em colisao lateral (player subindo / pe baixo demais)', () => {
    const player: Player = createPlayer(CHAR, { x: 0, y: 0 })
    const e: Enemy = {
      x: 100, y: 200, w: 38, h: 34, vx: 0, vy: 0,
      onGround: false, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    // Player na mesma altura, vy<=0 (nao descendo) -> nao e stomp.
    player.x = 100
    player.y = 200
    player.vy = -2
    expect(isStomp(player, e)).toBe(false)
  })
})
