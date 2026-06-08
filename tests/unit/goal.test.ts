// tests/unit/goal.test.ts
import { describe, it, expect } from 'vitest'
import { checkGoal } from '../../src/game/goal'
import { createPlayer } from '../../src/game/player'
import { CHARACTERS } from '../../src/data/characters'
import { TILE, PLAYER_W, PLAYER_H } from '../../src/engine/constants'
import type { ParsedLevel, TileType } from '../../src/data/schema'

function makeLevel(goalCol = 36, goalRow = 8): ParsedLevel {
  const widthTiles = 40
  const heightTiles = 11
  const tiles: TileType[][] = Array.from({ length: heightTiles }, (_, r) =>
    Array.from({ length: widthTiles }, (_, c) =>
      r >= 9 ? 'ground' : 'empty',
    ),
  )
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 2 * TILE, y: goalRow * TILE },
    goal: { x: goalCol * TILE, y: goalRow * TILE },
    coins: [],
    enemies: [],
  }
}

describe('checkGoal', () => {
  const level = makeLevel(36, 8)
  const goalX = 36 * TILE
  const goalY = 8 * TILE

  it('returns true when player AABB overlaps goal tile (full overlap)', () => {
    const player = createPlayer(CHARACTERS['renan'], { x: goalX, y: goalY })
    expect(checkGoal(player, level)).toBe(true)
  })

  it('returns true when player partially overlaps goal tile (left edge inside)', () => {
    // Player right edge is 1px inside the goal
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX + TILE - 1 - PLAYER_W,
      y: goalY,
    })
    expect(checkGoal(player, level)).toBe(true)
  })

  it('returns true when player partially overlaps goal tile (right side entry)', () => {
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX + 1, // player starts just inside the goal tile
      y: goalY,
    })
    expect(checkGoal(player, level)).toBe(true)
  })

  it('returns false when player is entirely to the left of the goal tile', () => {
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX - PLAYER_W - 1,
      y: goalY,
    })
    expect(checkGoal(player, level)).toBe(false)
  })

  it('returns false when player is entirely to the right of the goal tile', () => {
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX + TILE + 1,
      y: goalY,
    })
    expect(checkGoal(player, level)).toBe(false)
  })

  it('returns false when player is above the goal tile', () => {
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX,
      y: goalY - PLAYER_H - 1,
    })
    expect(checkGoal(player, level)).toBe(false)
  })

  it('returns false when player is below the goal tile', () => {
    const player = createPlayer(CHARACTERS['renan'], {
      x: goalX,
      y: goalY + TILE + 1,
    })
    expect(checkGoal(player, level)).toBe(false)
  })

  it('returns false at spawn (far from goal)', () => {
    const player = createPlayer(CHARACTERS['renan'], { x: 2 * TILE, y: 8 * TILE })
    expect(checkGoal(player, level)).toBe(false)
  })
})
