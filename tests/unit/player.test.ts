// tests/unit/player.test.ts
// dt=1 throughout (frames convention, E1). E2: jump assertion = JUMP_VEL*jumpVelMul + GRAVITY.
import { describe, it, expect, beforeEach } from 'vitest'
import { createPlayer, updatePlayer, type Player } from '../../src/game/player'
import { CHARACTERS } from '../../src/data/characters'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType, SpawnPoint } from '../../src/data/schema'
import {
  TILE,
  GRAVITY,
  WALK_MAX,
  RUN_MAX,
  JUMP_VEL,
  PLAYER_W,
  PLAYER_H,
  START_LIVES,
  COYOTE_FRAMES,
  JUMP_BUFFER_FRAMES,
} from '../../src/engine/constants'

// FakeInput: implements exactly the Input interface from the CONTRATO.
// pressed() = action went from not-down to down since last update().
class FakeInput implements Input {
  private down = new Set<InputAction>()
  private prev = new Set<InputAction>()

  set(a: InputAction, v: boolean): void {
    if (v) this.down.add(a)
    else this.down.delete(a)
  }

  isDown(a: InputAction): boolean {
    return this.down.has(a)
  }

  pressed(a: InputAction): boolean {
    return this.down.has(a) && !this.prev.has(a)
  }

  update(): void {
    this.prev = new Set(this.down)
  }

  attach(): void {
    /* no-op in tests */
  }
}

// Build a flat ParsedLevel: ground on the last row, rest empty.
// Player is spawned on the row just above the ground.
function makeFlatLevel(widthTiles = 40, heightTiles = 11): ParsedLevel {
  const tiles: TileType[][] = []
  for (let ty = 0; ty < heightTiles; ty++) {
    const row: TileType[] = []
    for (let tx = 0; tx < widthTiles; tx++) {
      row.push(ty === heightTiles - 1 ? 'ground' : 'empty')
    }
    tiles.push(row)
  }
  const spawn: SpawnPoint = { x: 2 * TILE, y: (heightTiles - 2) * TILE }
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: spawn,
    goal: { x: (widthTiles - 2) * TILE, y: (heightTiles - 2) * TILE },
    coins: [],
    enemies: [],
  }
}

// Run N frames with dt=1 (frames convention, E1).
function steps(player: Player, input: FakeInput, level: ParsedLevel, n: number): void {
  for (let i = 0; i < n; i++) {
    updatePlayer(player, input, level, 1)
    input.update()
  }
}

describe('createPlayer', () => {
  it('posiciona no spawn e copia stats do char', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    expect(p.x).toBe(level.playerSpawn.x)
    expect(p.y).toBe(level.playerSpawn.y)
    expect(p.w).toBe(PLAYER_W)
    expect(p.h).toBe(PLAYER_H)
    expect(p.char).toBe(CHARACTERS['renan'])
    expect(p.hearts).toBe(CHARACTERS['renan'].hearts)
    expect(p.facing).toBe(1)
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
  })

  it('usa START_LIVES para o campo lives (E5)', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    expect(p.lives).toBe(START_LIVES)
    expect(p.lives).toBe(3) // START_LIVES === 3, verify consistency
  })
})

describe('updatePlayer — corrida horizontal', () => {
  let level: ParsedLevel
  let input: FakeInput
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    input = new FakeInput()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
  })

  it('segurar right acelera ate WALK_MAX (sem ultrapassar) e facing=1', () => {
    input.set('right', true)
    steps(p, input, level, 200)
    const cap = WALK_MAX * CHARACTERS['renan'].walkMul // walkMul=1.0
    expect(p.vx).toBeGreaterThan(cap - 0.5)
    expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
    expect(p.facing).toBe(1)
  })

  it('segurar right + run acelera ate RUN_MAX (sem ultrapassar)', () => {
    input.set('right', true)
    input.set('run', true)
    steps(p, input, level, 200)
    const cap = RUN_MAX * CHARACTERS['renan'].runMul // runMul=1.0
    expect(p.vx).toBeGreaterThan(WALK_MAX) // passed walk cap
    expect(p.vx).toBeGreaterThan(cap - 0.5)
    expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
  })

  it('segurar left vira facing para -1 e acelera negativo', () => {
    input.set('left', true)
    steps(p, input, level, 30)
    expect(p.facing).toBe(-1)
    expect(p.vx).toBeLessThan(0)
    const cap = WALK_MAX * CHARACTERS['renan'].walkMul
    expect(p.vx).toBeGreaterThanOrEqual(-cap - 1e-6)
  })
})

describe('updatePlayer — pulo', () => {
  let level: ParsedLevel
  let input: FakeInput
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    input = new FakeInput()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
  })

  it('assenta no chao (onGround) depois de alguns frames', () => {
    steps(p, input, level, 10)
    expect(p.onGround).toBe(true)
    expect(p.vy).toBe(0)
  })

  it('jump em onGround: onGround===false e vy === JUMP_VEL*jumpVelMul + GRAVITY (E2)', () => {
    steps(p, input, level, 10) // settle on ground
    expect(p.onGround).toBe(true)
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    // E2: stepBody runs after the jump impulse, adding GRAVITY once
    const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul + GRAVITY
    expect(p.vy).toBeCloseTo(expected, 5)
    expect(p.onGround).toBe(false)
  })

  it('coyote: pulo logo apos sair da borda ainda dispara (E2 assertion)', () => {
    steps(p, input, level, 10) // settle on ground
    // Remove the floor to force the player off the edge without jumping
    const groundRow = level.heightTiles - 1
    for (let tx = 0; tx < level.widthTiles; tx++) level.tiles[groundRow][tx] = 'empty'
    // 1 frame with no ground and no jump: still within coyote window
    updatePlayer(p, input, level, 1)
    input.update()
    expect(p.onGround).toBe(false)
    // Press jump within COYOTE_FRAMES
    expect(COYOTE_FRAMES).toBeGreaterThan(1)
    input.set('jump', true)
    const vyBefore = p.vy
    updatePlayer(p, input, level, 1)
    input.update()
    // E2: vy should reflect jump impulse + one GRAVITY step
    const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul + GRAVITY
    expect(p.vy).toBeLessThan(vyBefore) // upward impulse (more negative)
    expect(p.vy).toBeCloseTo(expected, 5)
  })

  it('jump buffer: pulo pressionado no ar dispara ao aterrissar', () => {
    // Settle on ground first
    steps(p, input, level, 10)
    expect(p.onGround).toBe(true)

    // Jump: player leaves the ground
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    input.set('jump', false)
    input.update()
    expect(p.onGround).toBe(false)

    // Advance frames until the player is falling AND within JUMP_BUFFER_FRAMES
    // frames of landing. With dt=1 (frames convention), at terminal velocity MAX_FALL=17,
    // the player covers at most 17px/frame. So "within 8 frames" ≈ within 136px.
    // Wait until y >= landingY - JUMP_BUFFER_FRAMES * MAX_FALL.
    const groundY = (level.heightTiles - 1) * TILE // tile top of ground row = 480
    const landingY = groundY - PLAYER_H // y where bottom == ground = 438
    const MAX_FALL = 17
    const nearGroundY = landingY - JUMP_BUFFER_FRAMES * MAX_FALL // ≈ 302

    let guard = 0
    while (p.y < nearGroundY && guard < 200 && !p.onGround) {
      updatePlayer(p, input, level, 1)
      input.update()
      guard++
    }

    // Now close to the ground and falling. Press jump to set the buffer.
    expect(p.onGround).toBe(false)
    expect(JUMP_BUFFER_FRAMES).toBeGreaterThan(1)
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    input.set('jump', false)
    input.update()

    // Within JUMP_BUFFER_FRAMES the player should land and the buffered jump fires.
    let jumped = false
    for (let i = 0; i < JUMP_BUFFER_FRAMES + 2 && !jumped; i++) {
      updatePlayer(p, input, level, 1)
      input.update()
      if (p.vy < 0) jumped = true // upward impulse = buffered jump fired
    }
    expect(jumped).toBe(true)
  })
})
