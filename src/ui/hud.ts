// src/ui/hud.ts
import { VIEW_W, COLOR_TEXT, COLOR_MAGENTA, COLOR_LIME } from '../engine/constants'
import type { Renderer } from '../engine/render'

/**
 * Draws the HUD in screen space (call AFTER endWorld).
 * Mono UPPERCASE feel using ctx.fillText directly.
 */
export function drawHud(
  r: Renderer,
  data: { time: number; lives: number; coins: number; hwMeter: number },
): void {
  const ctx = r.ctx

  ctx.save()

  ctx.font = 'bold 18px monospace'
  ctx.textBaseline = 'top'

  // Background strip at the top
  ctx.fillStyle = 'rgba(9,9,11,0.82)'
  ctx.fillRect(0, 0, VIEW_W, 36)

  // TIME — centre
  const timeStr = `TIME  ${String(data.time).padStart(3, '0')}`
  ctx.fillStyle = COLOR_TEXT
  ctx.textAlign = 'center'
  ctx.fillText(timeStr, VIEW_W / 2, 9)

  // LIVES — left
  const livesStr = `LIVES  ${data.lives}`
  ctx.textAlign = 'left'
  ctx.fillStyle = COLOR_MAGENTA
  ctx.fillText(livesStr, 16, 9)

  // COINS — right
  const coinsStr = `COINS  ${String(data.coins).padStart(2, '0')}`
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR_LIME
  ctx.fillText(coinsStr, VIEW_W - 16, 9)

  ctx.restore()
}
