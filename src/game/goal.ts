// src/game/goal.ts
import { TILE } from '../engine/constants'
import type { Player } from './player'
import type { ParsedLevel } from '../data/schema'

/**
 * Returns true when the player's AABB overlaps the goal tile.
 * level.goal is the top-left pixel of a TILE×TILE goal cell.
 */
export function checkGoal(player: Player, level: ParsedLevel): boolean {
  const goalLeft = level.goal.x
  const goalTop = level.goal.y
  const goalRight = goalLeft + TILE
  const goalBottom = goalTop + TILE

  const playerRight = player.x + player.w
  const playerBottom = player.y + player.h

  return (
    player.x < goalRight &&
    playerRight > goalLeft &&
    player.y < goalBottom &&
    playerBottom > goalTop
  )
}
