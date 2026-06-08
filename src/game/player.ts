// src/game/player.ts
import type { Body } from '../engine/physics'
import { stepBody } from '../engine/physics'
import type { Input } from '../engine/input'
import type { CharacterDef, ParsedLevel, SpawnPoint } from '../data/schema'
import {
  PLAYER_W,
  PLAYER_H,
  WALK_ACCEL,
  RUN_ACCEL,
  WALK_MAX,
  RUN_MAX,
  GROUND_DECEL,
  AIR_DECEL,
  JUMP_VEL,
  COYOTE_FRAMES,
  JUMP_BUFFER_FRAMES,
  START_LIVES,
  IFRAME_FRAMES,
  KNOCKBACK_VX,
  KNOCKBACK_VY,
} from '../engine/constants'
import type { AbilityState } from './ability'
import { createAbilityState, abilityHasShield, abilityConsumeShield } from './ability'

export interface Player extends Body {
  char: CharacterDef
  facing: 1 | -1
  coyote: number
  jumpBuffer: number
  lives: number
  hearts: number
  iframes: number
  ability: AbilityState
}

export function createPlayer(char: CharacterDef, spawn: SpawnPoint): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    char,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    lives: START_LIVES,
    hearts: char.hearts,
    iframes: 0,
    ability: createAbilityState(char),
  }
}

export function updatePlayer(
  player: Player,
  input: Input,
  level: ParsedLevel,
  dt: number,
): void {
  const char = player.char

  const running = input.isDown('run')
  const accel = running ? RUN_ACCEL * char.runMul : WALK_ACCEL * char.walkMul
  const maxSpeed = running ? RUN_MAX * char.runMul : WALK_MAX * char.walkMul

  const goLeft = input.isDown('left')
  const goRight = input.isDown('right')

  // Horizontal acceleration from input; decelerate when no direction held.
  if (goRight && !goLeft) {
    player.facing = 1
    player.vx += accel * dt
    if (player.vx > maxSpeed) player.vx = maxSpeed
  } else if (goLeft && !goRight) {
    player.facing = -1
    player.vx -= accel * dt
    if (player.vx < -maxSpeed) player.vx = -maxSpeed
  } else {
    const decel = player.onGround ? GROUND_DECEL * dt : AIR_DECEL * dt
    if (player.vx > 0) {
      player.vx -= decel
      if (player.vx < 0) player.vx = 0
    } else if (player.vx < 0) {
      player.vx += decel
      if (player.vx > 0) player.vx = 0
    }
  }

  // Coyote time: counts frames since last grounded state.
  if (player.onGround) {
    player.coyote = COYOTE_FRAMES
  } else if (player.coyote > 0) {
    player.coyote = Math.max(0, player.coyote - dt)
  }

  // Jump buffer: records jump intent for a few frames.
  if (input.pressed('jump')) {
    player.jumpBuffer = JUMP_BUFFER_FRAMES
  } else if (player.jumpBuffer > 0) {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt)
  }

  // Fire jump if there's a buffered intent AND (on ground OR within coyote window).
  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = JUMP_VEL * char.jumpVelMul
    player.onGround = false
    player.jumpBuffer = 0
    player.coyote = 0
  }

  // Integrate physics (gravity up to MAX_FALL) and resolve tile collisions.
  // stepBody handles gravity, position integration, and per-axis collision resolution.
  // M1 TODO: scale gravity by player.char.weightMul (currently stepBody uses fixed GRAVITY)
  stepBody(player, level, dt)
}

/**
 * Apply damage to the player from an enemy at `fromX`.
 * Returns:
 *   'blocked' — no damage taken (iframes active or shield absorbed)
 *   'hit'     — damage taken; hearts > 0 or life lost but lives > 0 (hearts reset)
 *   'death'   — lives reached 0
 */
export function damagePlayer(player: Player, fromX: number): 'blocked' | 'hit' | 'death' {
  // Already invulnerable: no-op
  if (player.iframes > 0) return 'blocked'

  // Shield absorbs the hit
  if (abilityHasShield(player)) {
    abilityConsumeShield(player)
    player.iframes = IFRAME_FRAMES
    return 'blocked'
  }

  // Take damage
  player.hearts -= 1
  player.iframes = IFRAME_FRAMES
  // Knockback: away from the source
  player.vx = player.x < fromX ? -KNOCKBACK_VX : KNOCKBACK_VX
  player.vy = KNOCKBACK_VY

  if (player.hearts <= 0) {
    player.lives -= 1
    if (player.lives <= 0) {
      return 'death'
    }
    // Life lost but lives remain: reset hearts (game will call respawnPlayer to reposition)
    player.hearts = player.char.hearts
    return 'hit'
  }

  return 'hit'
}

/**
 * Reposition the player at a spawn point, resetting velocity, hearts and ability state.
 * Called by the game after a life is lost (per Errata E2).
 */
export function respawnPlayer(player: Player, spawn: SpawnPoint): void {
  player.x = spawn.x
  player.y = spawn.y
  player.vx = 0
  player.vy = 0
  player.hearts = player.char.hearts
  player.iframes = IFRAME_FRAMES
  player.ability = createAbilityState(player.char)
}

/**
 * Decrement per-frame timers on the player (iframes, etc.).
 * Called once per update tick after all logic runs.
 */
export function tickPlayerTimers(player: Player, dt: number): void {
  player.iframes = Math.max(0, player.iframes - dt)
}
