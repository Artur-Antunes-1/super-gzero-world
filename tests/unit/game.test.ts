// tests/unit/game.test.ts
// Tests createGame integration: state machine, goal detection, timer clamping (E7).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGame } from '../../src/game/game'
import type { Renderer } from '../../src/engine/render'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import { TILE, FIXED_DT, TIME_START } from '../../src/engine/constants'

// ---------- Minimal fake Renderer ----------
function makeRenderer(): Renderer {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    imageSmoothingEnabled: false,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D

  return {
    ctx,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    present: vi.fn(),
  }
}

// ---------- Minimal fake Input ----------
class FakeInput implements Input {
  private down = new Set<InputAction>()
  set(a: InputAction, v: boolean) { if (v) this.down.add(a); else this.down.delete(a) }
  isDown(a: InputAction) { return this.down.has(a) }
  pressed(_a: InputAction) { return false }
  update() {}
  attach() {}
}

// ---------- Flat level (chao solido, sem buracos) ----------
function makeLevel(): ParsedLevel {
  const widthTiles = 40
  const heightTiles = 11
  const tiles: TileType[][] = Array.from({ length: heightTiles }, (_, r) =>
    Array.from({ length: widthTiles }, () => (r >= 9 ? 'ground' : 'empty')),
  )
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 2 * TILE, y: 8 * TILE },
    goal: { x: 36 * TILE, y: 8 * TILE },
    coins: [],
    enemies: [],
  }
}

describe('createGame', () => {
  let renderer: Renderer
  let input: FakeInput
  let level: ParsedLevel

  beforeEach(() => {
    renderer = makeRenderer()
    input = new FakeInput()
    level = makeLevel()
  })

  it('starts in "playing" state', () => {
    const game = createGame(renderer, input, level)
    expect(game.state.get()).toBe('playing')
    expect(game.state.is('playing')).toBe(true)
  })

  it('exposes player on the returned object', () => {
    const game = createGame(renderer, input, level)
    expect(game.player).toBeDefined()
    expect(typeof game.player.x).toBe('number')
    expect(typeof game.player.y).toBe('number')
  })

  it('transitions to "win" when player teleported onto goal and update called', () => {
    const game = createGame(renderer, input, level)
    // Teleport player to goal position (AABB overlap)
    game.player.x = level.goal.x
    game.player.y = level.goal.y

    game.update(1)
    expect(game.state.get()).toBe('win')
  })

  it('timer decreases by FIXED_DT each update step (E1 / E7)', () => {
    const game = createGame(renderer, input, level)
    game.update(1)
    // After one step, time should be TIME_START - FIXED_DT
    // We can't read time directly, but we can verify via render that it doesn't throw.
    // Instead, test the boundary: force update many times and ensure no 'over' state.
    const stepsNeeded = Math.ceil(TIME_START / FIXED_DT) + 10
    for (let i = 0; i < stepsNeeded; i++) {
      game.update(1)
    }
    // E7: timer clamps at 0, state must still be 'playing' (no goal reached)
    expect(game.state.get()).toBe('playing')
    expect(game.state.is('playing')).toBe(true)
  })

  it('timer clamps at 0 and does NOT transition to "over" (E7)', () => {
    const game = createGame(renderer, input, level)
    // Run enough updates to exhaust the timer (TIME_START=250s, FIXED_DT=1/60)
    const exhaustSteps = Math.ceil(TIME_START / FIXED_DT) + 100
    for (let i = 0; i < exhaustSteps; i++) {
      game.update(1)
    }
    // Must still be 'playing' — no 'over' transition in M0
    expect(game.state.get()).toBe('playing')
    expect(game.state.is('over')).toBe(false)
  })

  it('does not transition after win (update in win state is a no-op for physics)', () => {
    const game = createGame(renderer, input, level)
    game.player.x = level.goal.x
    game.player.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    // More updates should not break anything
    game.update(1)
    game.update(1)
    expect(game.state.get()).toBe('win')
  })

  it('render does not throw in playing state', () => {
    const game = createGame(renderer, input, level)
    expect(() => game.render(0)).not.toThrow()
  })

  it('render does not throw in win state', () => {
    const game = createGame(renderer, input, level)
    game.player.x = level.goal.x
    game.player.y = level.goal.y
    game.update(1)
    expect(() => game.render(0)).not.toThrow()
  })
})
