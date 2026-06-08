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
} from '../engine/constants'

export interface Player extends Body {
  char: CharacterDef
  facing: 1 | -1
  coyote: number
  jumpBuffer: number
  lives: number
  hearts: number
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
  stepBody(player, level, dt)
}
