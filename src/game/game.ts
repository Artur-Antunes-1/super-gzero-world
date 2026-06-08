// src/game/game.ts
import type { Renderer } from '../engine/render'
import type { Input } from '../engine/input'
import type { ParsedLevel } from '../data/schema'
import { createStateMachine } from '../engine/state'
import { createCamera, followCamera } from '../engine/camera'
import { createPlayer, updatePlayer, type Player } from './player'
import { checkGoal } from './goal'
import { drawPlaceholder } from './sprites'
import { drawHud } from '../ui/hud'
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../data/characters'
import {
  TILE,
  FIXED_DT,
  TIME_START,
  COIN_SIZE,
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_INK,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_TEXT,
  VIEW_W,
  VIEW_H,
} from '../engine/constants'
import type { TileType } from '../data/schema'

// Colour per tile type (in world space)
function tileColor(t: TileType): string {
  switch (t) {
    case 'ground':
      return COLOR_SURFACE
    case 'brick':
      return COLOR_INK
    case 'block':
      return COLOR_SURFACE
    case 'platform':
      return '#2a2a32'
    case 'goal':
      return COLOR_MAGENTA
    default:
      return COLOR_BG
  }
}

export interface Game {
  update(dt: number): void
  render(alpha: number): void
  state: ReturnType<typeof createStateMachine>
  player: Player
}

export function createGame(
  renderer: Renderer,
  input: Input,
  level: ParsedLevel,
): Game {
  const state = createStateMachine('playing')
  const cam = createCamera()
  const player = createPlayer(CHARACTERS[DEFAULT_CHARACTER_ID], level.playerSpawn)

  let time = TIME_START
  // Make a mutable copy of the coins array so we can remove collected ones
  const coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
  let coinCount = 0

  function update(dt: number): void {
    if (state.is('playing')) {
      // a) Update player physics + input
      updatePlayer(player, input, level, dt)

      // b) Follow camera
      followCamera(cam, player, level)

      // c) Decrement timer in seconds; clamp at 0, no state change (E7)
      time = Math.max(0, time - FIXED_DT)

      // d) Coin pickup: AABB overlap
      const pr = player.x + player.w
      const pb = player.y + player.h
      for (const coin of coins) {
        if (!coin.active) continue
        const cr = coin.x + COIN_SIZE
        const cb = coin.y + COIN_SIZE
        if (player.x < cr && pr > coin.x && player.y < cb && pb > coin.y) {
          coin.active = false
          coinCount++
        }
      }

      // e) Goal check → win
      if (checkGoal(player, level)) {
        state.set('win')
      }
    }

    // input.update() LAST — consume edges after game logic reads them
    input.update()
  }

  function render(alpha: number): void {
    // 1. Clear background
    renderer.clear(COLOR_BG)

    // 2. Begin world transform
    renderer.beginWorld(cam.x, cam.y)

    // 3. Draw visible tiles
    const startCol = Math.max(0, Math.floor(cam.x / TILE))
    const endCol = Math.min(level.widthTiles - 1, Math.ceil((cam.x + VIEW_W) / TILE))
    const startRow = Math.max(0, Math.floor(cam.y / TILE))
    const endRow = Math.min(level.heightTiles - 1, Math.ceil((cam.y + VIEW_H) / TILE))

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const t = level.tiles[row][col]
        if (t === 'empty') continue
        const px = col * TILE
        const py = row * TILE
        renderer.drawRect(px, py, TILE, TILE, tileColor(t))
      }
    }

    // Draw goal cell (the G position in the level) as a magenta portal
    renderer.drawRect(level.goal.x, level.goal.y, TILE, TILE, COLOR_MAGENTA)

    // Draw coins (only active ones)
    const coinOffset = (TILE - COIN_SIZE) / 2
    for (const coin of coins) {
      if (!coin.active) continue
      renderer.drawRect(
        coin.x + coinOffset,
        coin.y + coinOffset,
        COIN_SIZE,
        COIN_SIZE,
        COLOR_LIME,
      )
    }

    // 4. Draw player placeholder
    drawPlaceholder(renderer, player.char, player.x, player.y, player.w, player.h, player.facing)

    // 5. End world transform
    renderer.endWorld()

    // 6. Draw HUD in screen space
    drawHud(renderer, { time: Math.ceil(time), lives: player.lives, coins: coinCount, hwMeter: 0 })

    // 7. Win overlay
    if (state.is('win')) {
      const ctx = renderer.ctx
      ctx.save()
      // Dark panel
      ctx.fillStyle = 'rgba(9,9,11,0.88)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      // Win text
      ctx.font = 'bold 22px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = COLOR_MAGENTA
      ctx.fillText('VOCE TAMBEM ACREDITA QUE PODEMOS', VIEW_W / 2, VIEW_H / 2 - 24)
      ctx.fillText('MUDAR O MUNDO? BORA JUNTOS.', VIEW_W / 2, VIEW_H / 2 + 12)
      ctx.fillStyle = COLOR_TEXT
      ctx.font = '14px monospace'
      ctx.fillText('-- GRAVIDADE ZERO --', VIEW_W / 2, VIEW_H / 2 + 56)
      ctx.restore()
    }

    // Suppress unused alpha warning — alpha interpolation reserved for future sprite lerp
    void alpha
  }

  return { update, render, state, player }
}
