// src/game/sprites.ts
import type { Renderer } from '../engine/render'
import type { CharacterDef } from '../data/schema'
import { COLOR_INK } from '../engine/constants'

export function drawPlaceholder(
  r: Renderer,
  char: CharacterDef,
  x: number,
  y: number,
  w: number,
  h: number,
  facing: 1 | -1,
): void {
  // 1) Body: full character rect in char.color.
  r.drawRect(x, y, w, h, char.color)

  // 2) Accent stripe: horizontal band in the upper body area.
  const stripeH = Math.max(2, Math.round(h * 0.18))
  const stripeY = y + Math.round(h * 0.22)
  r.drawRect(x, stripeY, w, stripeH, char.accent)

  // 3) Eye: small square in COLOR_INK, offset toward the facing side.
  const eyeSize = Math.max(2, Math.round(w * 0.18))
  const eyeY = y + Math.round(h * 0.3)
  const centerX = x + w / 2
  const eyeX =
    facing === 1
      ? Math.round(centerX + w * 0.16) // right side
      : Math.round(centerX - w * 0.16 - eyeSize) // left side
  r.drawRect(eyeX, eyeY, eyeSize, eyeSize, COLOR_INK)
}
