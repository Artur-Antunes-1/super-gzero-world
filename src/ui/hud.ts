// src/ui/hud.ts
import {
  VIEW_W,
  HW_METER_MAX,
  COLOR_TEXT,
  COLOR_LIME,
  COLOR_SURFACE,
  COLOR_OBJETIVO,
  COLOR_TECH,
} from '../engine/constants'
import type { Renderer } from '../engine/render'

// Cores proprias do HUD (exportadas para os testes).
export const COIN_GOLD = '#f5c842' // moeda dourada
export const HEART_EMPTY = '#3a3a42' // coracao vazio (cinza escuro)
export const COLOR_LABEL = '#a8a3ad' // rotulos 10px (cinza claro)

// Layout do medidor Humanware (canto direito, abaixo da faixa de texto).
const SEGMENTS = 4
const SEG_W = 26
const SEG_H = 10
const SEG_GAP = 4
const METER_Y = 52
const METER_LABEL_Y = 38

// Layout dos coracoes (canto esquerdo, abaixo da faixa de texto).
const HEART_W = 12
const HEART_GAP = 4
const HEART_Y = 42

// Dados do HUD. hwActive/hwReady/maxHearts sao opcionais (game pode nao passar).
export interface HudData {
  time: number
  lives: number
  coins: number
  hwMeter: number
  hearts: number
  maxHearts?: number // default = hearts (sem vazios)
  hwActive?: boolean // Modo Humanware rodando (default false)
  hwReady?: boolean // medidor cheio, H disponivel (default false)
}

// Mini coracao pixel ~12px: 2 lobos + corpo + ponta (4 fillRects).
function drawHeart(ctx: CanvasRenderingContext2D, hx: number, hy: number): void {
  ctx.fillRect(hx + 1, hy, 4, 3) // lobo esquerdo
  ctx.fillRect(hx + 7, hy, 4, 3) // lobo direito
  ctx.fillRect(hx, hy + 3, 12, 4) // corpo
  ctx.fillRect(hx + 3, hy + 7, 6, 3) // ponta
}

/**
 * Desenha o HUD em screen space (chamar APOS endWorld).
 *
 * Hierarquia: numeros em "Pixelify Sans", monospace bold; rotulos 10px cinza (COLOR_LABEL).
 * Medidor Humanware: N cheios = floor(hwMeter/HW_METER_MAX * 4) — o 4º so
 * acende com meter >= max (fix do round que mostrava cheio com 875-999).
 */
export function drawHud(r: Renderer, data: HudData): void {
  const ctx = r.ctx

  ctx.save()
  ctx.textBaseline = 'top'

  // Faixa de fundo no topo.
  ctx.fillStyle = 'rgba(9,9,11,0.82)'
  ctx.fillRect(0, 0, VIEW_W, 36)

  // --- VIDAS — esquerda: mini retrato 12px + 'xN' (14px bold) ---
  ctx.fillStyle = COLOR_TEXT
  ctx.fillRect(16, 11, 12, 12) // retrato quadrado
  ctx.font = 'bold 14px "Pixelify Sans", monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`x${Math.max(0, data.lives)}`, 34, 13)

  // --- TIME — centro: rotulo 10px cinza + numero 18px bold com aviso ---
  ctx.font = '10px "Pixelify Sans", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR_LABEL
  ctx.fillText('TIME', VIEW_W / 2, 4)

  // Aviso: <50 pisca em COLOR_OBJETIVO (floor(time*2)); <10 pisca rapido (floor(time*4)).
  let timeVisible = true
  let timeColor = COLOR_TEXT
  if (data.time < 50) {
    timeColor = COLOR_OBJETIVO
    const rate = data.time < 10 ? 4 : 2
    timeVisible = (Math.floor(data.time * rate) & 1) === 0
  }
  if (timeVisible) {
    const timeStr = String(Math.max(0, Math.ceil(data.time))).padStart(3, '0')
    ctx.font = 'bold 18px "Pixelify Sans", monospace'
    ctx.fillStyle = timeColor
    ctx.fillText(timeStr, VIEW_W / 2, 14)
  }

  // --- COINS — direita: mini moeda dourada (circulo 10px) + numero ---
  ctx.beginPath()
  ctx.arc(VIEW_W - 56, 18, 5, 0, Math.PI * 2)
  ctx.fillStyle = COIN_GOLD
  ctx.fill()
  ctx.font = 'bold 18px "Pixelify Sans", monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR_TEXT
  ctx.fillText(String(Math.max(0, data.coins)).padStart(2, '0'), VIEW_W - 16, 9)

  // --- Coracoes (HP da fase) — esquerda, abaixo da faixa ---
  const hearts = Math.max(0, Math.floor(data.hearts))
  const maxHearts = Math.max(hearts, Math.floor(data.maxHearts ?? hearts))
  for (let i = 0; i < maxHearts; i++) {
    const hx = 16 + i * (HEART_W + HEART_GAP)
    if (i < hearts) {
      ctx.globalAlpha = 1
      ctx.fillStyle = COLOR_OBJETIVO
    } else {
      // Vazio (dano tomado): mesma forma, cinza escuro, alpha 0.25.
      ctx.globalAlpha = 0.25
      ctx.fillStyle = HEART_EMPTY
    }
    drawHeart(ctx, hx, HEART_Y)
  }
  ctx.globalAlpha = 1

  // --- Rotulo do medidor — acima dos segmentos, alinhado a direita ---
  ctx.font = '10px "Pixelify Sans", monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR_LABEL
  ctx.fillText('HUMANWARE [H]', VIEW_W - 16, METER_LABEL_Y)

  ctx.restore()

  // --- Medidor Humanware (4 segmentos) — direita, abaixo do rotulo ---
  // FIX: floor (nao round) — o 4º segmento so acende com meter >= max.
  const ratio = HW_METER_MAX > 0 ? data.hwMeter / HW_METER_MAX : 0
  const filled = Math.max(0, Math.min(SEGMENTS, Math.floor(ratio * SEGMENTS)))

  // Cor do preenchimento por estado (active > ready > normal).
  let fillColor = COLOR_LIME
  if (data.hwActive) {
    // Modo rodando: barra de drenagem em COLOR_TECH solido.
    fillColor = COLOR_TECH
  } else if (data.hwReady) {
    // Cheio: pisca OBJETIVO/TECH a cada 16 frames; base = time*60 truncado (deterministico).
    const frameBase = Math.trunc(data.time * 60)
    fillColor = Math.floor(frameBase / 16) % 2 === 0 ? COLOR_OBJETIVO : COLOR_TECH
  }

  const meterW = SEGMENTS * SEG_W + (SEGMENTS - 1) * SEG_GAP
  const meterX0 = VIEW_W - 16 - meterW
  for (let i = 0; i < SEGMENTS; i++) {
    const sx = meterX0 + i * (SEG_W + SEG_GAP)
    // Trilho vazio sempre.
    r.drawRect(sx, METER_Y, SEG_W, SEG_H, COLOR_SURFACE)
    // Preenchimento dos primeiros `filled` segmentos.
    if (i < filled) {
      r.drawRect(sx, METER_Y, SEG_W, SEG_H, fillColor)
    }
  }
}
