// src/ui/selectScreen.ts
// Tela de SELECAO de personagem (M1, Task 7 — DONO; Fase E2: tela digna).
// Navega left/right com wrap; jump|confirm retorna o id do char no index; senao null.
// drawSelect desenha cada char (idle ANIMADO no selecionado via clock; silhueta
// 'EM BREVE' nos sem arte) + nome/habilidade/descricao + painel de detalhe
// (coracoes pixelados + barras de stats VEL/PULO).
import type { Input } from '../engine/input'
import type { CharacterDef } from '../data/schema'
import type { Renderer } from '../engine/render'
import type { AssetStore } from '../engine/assets'
import { CHAR_ANIMS } from '../data/charAnims'
import { frameIndex } from '../engine/spriteAnim'
import { drawPlaceholder } from '../game/sprites'
import {
  VIEW_W,
  VIEW_H,
  COLOR_BG,
  COLOR_TEXT,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_OBJETIVO,
  COLOR_TECH,
} from '../engine/constants'

// CONTRATO Fase E: cursor inicia no Artur (index 3 na ordem canonica do roster).
export const SELECT_START_INDEX = 3

// Paineis com contraste legivel (o COLOR_SURFACE era quase invisivel).
const PANEL_BG = '#1c1c22'
const PANEL_BORDER = '#2e2e36'
const BAR_BG = '#26262e'

export interface SelectState {
  index: number
}

export function createSelect(): SelectState {
  return { index: SELECT_START_INDEX }
}

// Avanca/recua o cursor com wrap; em jump|confirm retorna chars[index].id; senao null.
export function updateSelect(
  sel: SelectState,
  input: Input,
  chars: CharacterDef[],
): string | null {
  const n = chars.length
  if (n === 0) return null

  if (input.pressed('left')) {
    sel.index = (sel.index - 1 + n) % n
  }
  if (input.pressed('right')) {
    sel.index = (sel.index + 1) % n
  }

  // Mantem index valido caso a lista mude de tamanho entre frames.
  if (sel.index < 0 || sel.index >= n) {
    sel.index = ((sel.index % n) + n) % n
  }

  if (input.pressed('jump') || input.pressed('confirm')) {
    return chars[sel.index].id
  }

  return null
}

// Painel retangular padrao: borda 1px + fundo.
function drawPanel(r: Renderer, x: number, y: number, w: number, h: number): void {
  r.drawRect(x - 1, y - 1, w + 2, h + 2, PANEL_BORDER)
  r.drawRect(x, y, w, h, PANEL_BG)
}

// Coracao pixelado ~14x12 (s=2) desenhado por fillRect em COLOR_OBJETIVO.
function drawPixelHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = COLOR_OBJETIVO
  ctx.fillRect(x + s, y, 2 * s, s) // lobo esquerdo
  ctx.fillRect(x + 4 * s, y, 2 * s, s) // lobo direito
  ctx.fillRect(x, y + s, 7 * s, 2 * s) // corpo
  ctx.fillRect(x + s, y + 3 * s, 5 * s, s) // afunila
  ctx.fillRect(x + 2 * s, y + 4 * s, 3 * s, s)
  ctx.fillRect(x + 3 * s, y + 5 * s, s, s) // ponta
}

// Barra horizontal de stat: rotulo 10px + trilho BAR_BG + preenchimento COLOR_TECH.
function drawStatBar(
  ctx: CanvasRenderingContext2D,
  label: string,
  t: number, // 0..1
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.font = '10px monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR_TEXT
  ctx.fillText(label, x - 8, y + 1)
  ctx.fillStyle = BAR_BG
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = COLOR_TECH
  ctx.fillRect(x, y, Math.round(w * t), h)
}

// Normaliza um multiplicador 0.9..1.1 para 0..1 (clamp nas pontas).
function normMul(v: number): number {
  return Math.max(0, Math.min(1, (v - 0.9) / 0.2))
}

// Desenha em screen space (chamada SEM beginWorld). Mostra os personagens em
// uma fileira horizontal: arte real (idle animado no SELECIONADO via clock) ou
// placeholder; nome + abilityName + abilityDesc; painel de detalhe do
// selecionado na faixa inferior. store opcional: sem ele, todo card usa
// placeholder. clock opcional: frames de jogo acumulados (anima o idle).
export function drawSelect(
  r: Renderer,
  sel: SelectState,
  chars: CharacterDef[],
  store?: AssetStore,
  clock?: number,
): void {
  const ctx = r.ctx

  // Fundo da tela.
  r.clear(COLOR_BG)

  ctx.save()
  ctx.textBaseline = 'top'

  // Titulo.
  ctx.font = 'bold 32px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR_TEXT
  ctx.fillText('SELECIONE SEU PERSONAGEM', VIEW_W / 2, 56)

  // Dica de controles.
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = COLOR_LIME
  ctx.fillText('< >  MOVER     PULO / ENTER  CONFIRMAR', VIEW_W / 2, 100)

  const n = chars.length
  if (n === 0) {
    ctx.restore()
    return
  }

  // Layout em fileira: divide a largura util em n colunas.
  const marginX = 80
  const usableW = VIEW_W - marginX * 2
  const slotW = usableW / n
  const slotCx = (i: number): number => marginX + slotW * (i + 0.5)

  // Caixa do personagem (placeholder maior que o player in-game para leitura).
  const boxW = 72
  const boxH = 92
  const boxTop = VIEW_H / 2 - boxH / 2

  for (let i = 0; i < n; i++) {
    const c = chars[i]
    const cx = slotCx(i)
    const boxX = Math.round(cx - boxW / 2)
    const selected = i === sel.index

    // Painel de fundo do slot (fundo + borda 1px legiveis).
    const panelPad = 14
    const panelX = Math.round(cx - slotW / 2 + 8)
    const panelW = Math.round(slotW - 16)
    const panelY = boxTop - panelPad - 28
    const panelH = boxH + panelPad * 2 + 80
    drawPanel(r, panelX, panelY, panelW, panelH)

    // Cursor: moldura magenta em torno do slot selecionado.
    if (selected) {
      const border = 4
      r.drawRect(panelX - border, panelY - border, panelW + border * 2, border, COLOR_MAGENTA)
      r.drawRect(panelX - border, panelY + panelH, panelW + border * 2, border, COLOR_MAGENTA)
      r.drawRect(panelX - border, panelY - border, border, panelH + border * 2, COLOR_MAGENTA)
      r.drawRect(panelX + panelW, panelY - border, border, panelH + border * 2, COLOR_MAGENTA)
    }

    // Arte real do personagem (M2b): idle ancorado nos PES (anchorY) na base da
    // caixa. SELECIONADO anima via frameIndex(idle, clock); demais ficam no
    // frame 0. Sem CHAR_ANIMS: silhueta padronizada + tag EM BREVE. Com
    // CHAR_ANIMS mas sem sheet no store: fallback de asset (placeholder cheio).
    const set = CHAR_ANIMS[c.id]
    const idle = set?.anims.idle
    const sheet = store && idle ? store.get(idle.key) : null
    if (set && idle && sheet && set.cellW > 0 && set.cellH > 0) {
      const scale = boxH / set.cellH
      const dh = boxH
      const dw = set.cellW * scale
      const fi = selected ? frameIndex(idle, clock ?? 0) : 0
      ctx.drawImage(
        sheet.src,
        fi * set.cellW,
        0,
        set.cellW,
        set.cellH,
        cx - dw / 2,
        boxTop + boxH - set.anchorY * scale,
        dw,
        dh,
      )
    } else if (set) {
      drawPlaceholder(r, c, boxX, Math.round(boxTop), boxW, boxH, 1)
    } else {
      // Silhueta padronizada (alpha 0.45) + tag EM BREVE no topo do card.
      ctx.save()
      ctx.globalAlpha = 0.45
      drawPlaceholder(r, c, boxX, Math.round(boxTop), boxW, boxH, 1)
      ctx.restore()
      ctx.save()
      ctx.globalAlpha = 0.7
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = COLOR_TEXT
      ctx.fillText('EM BREVE', cx, panelY + 8)
      ctx.restore()
    }

    // Nome.
    ctx.textAlign = 'center'
    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = selected ? COLOR_TEXT : '#9a96a0'
    ctx.fillText(c.name, cx, boxTop + boxH + 12)

    // Nome legivel da habilidade (em vez do abilityId snake_case).
    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = selected ? COLOR_LIME : '#6f6b75'
    ctx.fillText(c.abilityName, cx, boxTop + boxH + 36)

    // Descricao curta da habilidade — SO no card selecionado (nas demais
    // colunas o texto excede a largura do slot e atropela os vizinhos).
    if (selected) {
      ctx.font = '11px monospace'
      ctx.fillStyle = '#c9c5cf'
      ctx.fillText(c.abilityDesc, cx, boxTop + boxH + 52)
    }
  }

  // PAINEL DE DETALHE do selecionado: faixa inferior (y 420-500) com coracoes
  // pixelados (vida) + barras de stats VEL/PULO normalizadas 0.9-1.1 -> 0..1.
  const det = chars[sel.index]
  if (det) {
    const dpX = marginX
    const dpY = 420
    const dpW = usableW
    const dpH = 80
    drawPanel(r, dpX, dpY, dpW, dpH)

    // Coracoes (hearts do char) — icones por fillRect em COLOR_OBJETIVO.
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = COLOR_TEXT
    ctx.fillText('VIDA', dpX + 24, dpY + 14)
    const hs = 2 // 1 "pixel" do coracao = 2px (coracao 14x12)
    for (let h = 0; h < det.hearts; h++) {
      drawPixelHeart(ctx, dpX + 24 + h * 22, dpY + 32, hs)
    }

    // Barras de stats horizontais (120px): VEL = media walk/run; PULO = jumpVelMul.
    // U4: barras deslocadas para a esquerda — abre espaco para o retrato curado
    // no canto direito do painel.
    const barW = 120
    const barH = 10
    const barX = dpX + dpW - barW - 160
    drawStatBar(ctx, 'VEL', normMul((det.walkMul + det.runMul) / 2), barX, dpY + 18, barW, barH)
    drawStatBar(ctx, 'PULO', normMul(det.jumpVelMul), barX, dpY + 44, barW, barH)

    // U4: retrato curado do Artur (96x96, 'ui.retrato.artur') a direita do
    // painel de detalhe — base alinhada a base do painel (o topo "salta" 16px).
    if (det.id === 'artur' && store) {
      const retrato = store.get('ui.retrato.artur')
      if (retrato) {
        ctx.drawImage(
          retrato.src,
          0,
          0,
          retrato.w,
          retrato.h,
          dpX + dpW - 120,
          dpY + dpH - 96,
          96,
          96,
        )
      }
    }
  }

  ctx.restore()
}
