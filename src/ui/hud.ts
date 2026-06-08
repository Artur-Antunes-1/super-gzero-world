// src/ui/hud.ts
import {
  VIEW_W,
  HW_METER_MAX,
  COLOR_TEXT,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_SURFACE,
} from '../engine/constants'
import type { Renderer } from '../engine/render'

// Layout do medidor Humanware (canto direito, abaixo da faixa de texto).
const SEGMENTS = 4
const SEG_W = 26
const SEG_H = 10
const SEG_GAP = 4
const METER_Y = 44

// Layout dos coracoes (canto esquerdo, abaixo da faixa de texto).
const HEART_SIZE = 14
const HEART_GAP = 4
const HEART_Y = 42

/**
 * Desenha o HUD em screen space (chamar APOS endWorld).
 *
 * Texto (TIME/LIVES/COINS) via ctx.fillText; medidor Humanware (4 segmentos)
 * e coracoes via r.drawRect (M0). N segmentos cheios = round(hwMeter/HW_METER_MAX * 4).
 */
export function drawHud(
  r: Renderer,
  data: {
    time: number
    lives: number
    coins: number
    hwMeter: number
    hearts: number
  },
): void {
  const ctx = r.ctx

  ctx.save()

  ctx.font = 'bold 18px monospace'
  ctx.textBaseline = 'top'

  // Faixa de fundo no topo.
  ctx.fillStyle = 'rgba(9,9,11,0.82)'
  ctx.fillRect(0, 0, VIEW_W, 36)

  // TIME — centro.
  const timeStr = `TIME  ${String(data.time).padStart(3, '0')}`
  ctx.fillStyle = COLOR_TEXT
  ctx.textAlign = 'center'
  ctx.fillText(timeStr, VIEW_W / 2, 9)

  // LIVES — esquerda.
  const livesStr = `LIVES  ${data.lives}`
  ctx.textAlign = 'left'
  ctx.fillStyle = COLOR_MAGENTA
  ctx.fillText(livesStr, 16, 9)

  // COINS — direita.
  const coinsStr = `COINS  ${String(data.coins).padStart(2, '0')}`
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR_LIME
  ctx.fillText(coinsStr, VIEW_W - 16, 9)

  ctx.restore()

  // --- Coracoes (HP da fase) — canto esquerdo, abaixo da faixa ---
  const hearts = Math.max(0, Math.floor(data.hearts))
  for (let i = 0; i < hearts; i++) {
    const hx = 16 + i * (HEART_SIZE + HEART_GAP)
    r.drawRect(hx, HEART_Y, HEART_SIZE, HEART_SIZE, COLOR_MAGENTA)
  }

  // --- Medidor Humanware (4 segmentos) — canto direito, abaixo da faixa ---
  const ratio = HW_METER_MAX > 0 ? data.hwMeter / HW_METER_MAX : 0
  const filled = Math.max(0, Math.min(SEGMENTS, Math.round(ratio * SEGMENTS)))
  const meterW = SEGMENTS * SEG_W + (SEGMENTS - 1) * SEG_GAP
  const meterX0 = VIEW_W - 16 - meterW
  for (let i = 0; i < SEGMENTS; i++) {
    const sx = meterX0 + i * (SEG_W + SEG_GAP)
    // Trilho vazio sempre.
    r.drawRect(sx, METER_Y, SEG_W, SEG_H, COLOR_SURFACE)
    // Preenchimento dos primeiros `filled` segmentos.
    if (i < filled) {
      r.drawRect(sx, METER_Y, SEG_W, SEG_H, COLOR_LIME)
    }
  }
}
