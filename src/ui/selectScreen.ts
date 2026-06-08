// src/ui/selectScreen.ts
// Tela de SELECAO de personagem (M1, Task 7 — DONO).
// Navega left/right com wrap; jump|confirm retorna o id do char no index; senao null.
// drawSelect desenha cada char (drawPlaceholder + nome + habilidade) com cursor.
import type { Input } from '../engine/input'
import type { CharacterDef } from '../data/schema'
import type { Renderer } from '../engine/render'
import { drawPlaceholder } from '../game/sprites'
import {
  VIEW_W,
  VIEW_H,
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_TEXT,
  COLOR_MAGENTA,
  COLOR_LIME,
} from '../engine/constants'

export interface SelectState {
  index: number
}

export function createSelect(): SelectState {
  return { index: 0 }
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

// Desenha em screen space (chamada SEM beginWorld). Mostra os personagens em
// uma fileira horizontal: placeholder + nome + habilidade, com cursor no selecionado.
export function drawSelect(r: Renderer, sel: SelectState, chars: CharacterDef[]): void {
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

    // Painel de fundo do slot (destacado quando selecionado).
    const panelPad = 14
    const panelX = Math.round(cx - slotW / 2 + 8)
    const panelW = Math.round(slotW - 16)
    const panelY = boxTop - panelPad - 28
    const panelH = boxH + panelPad * 2 + 64
    r.drawRect(panelX, panelY, panelW, panelH, COLOR_SURFACE)

    // Cursor: moldura magenta em torno do slot selecionado.
    if (selected) {
      const border = 4
      r.drawRect(panelX - border, panelY - border, panelW + border * 2, border, COLOR_MAGENTA)
      r.drawRect(panelX - border, panelY + panelH, panelW + border * 2, border, COLOR_MAGENTA)
      r.drawRect(panelX - border, panelY - border, border, panelH + border * 2, COLOR_MAGENTA)
      r.drawRect(panelX + panelW, panelY - border, border, panelH + border * 2, COLOR_MAGENTA)
    }

    // Placeholder do personagem (M0 sprites.drawPlaceholder), virado para a direita.
    drawPlaceholder(r, c, boxX, Math.round(boxTop), boxW, boxH, 1)

    // Nome.
    ctx.textAlign = 'center'
    ctx.font = 'bold 18px monospace'
    ctx.fillStyle = selected ? COLOR_TEXT : '#9a96a0'
    ctx.fillText(c.name, cx, boxTop + boxH + 12)

    // Habilidade (id canonico).
    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = selected ? COLOR_LIME : '#6f6b75'
    ctx.fillText(c.abilityId, cx, boxTop + boxH + 38)
  }

  ctx.restore()
}
