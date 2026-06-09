// src/engine/spriteAnim.ts
// M2b: animacao FRAME-A-FRAME (sprite-sheets do personagem). Logica pura
// (frameIndex) + desenho (drawCharFrame). Reusa AnimState/Animator de animator.ts;
// o procedural do M2a (spriteDraw.ts) permanece como FALLBACK no game.
import { FIXED_DT } from './constants'
import type { Renderer } from './render'
import type { AssetStore } from './assets'
import type { AnimState } from './animator'

export interface FrameAnim {
  /** Chave do sprite-sheet no AssetStore. */
  key: string
  /** Numero de frames (celulas) no sheet, em linha. */
  frames: number
  /** Frames-de-ANIMACAO por segundo. */
  fps: number
  /** true: repete (loop); false: segura o ultimo frame. */
  loop: boolean
}

export interface CharAnimSet {
  /** Largura/altura da celula no sheet (px). */
  cellW: number
  cellH: number
  /** Ponto-ancora na celula: centro horizontal do corpo (x) e pes (y), em px. */
  anchorX: number
  anchorY: number
  /** Altura desenhada da CELULA na tela (px); o personagem ocupa parte dela. */
  drawH: number
  /** Mapeamento estado-de-animacao -> animacao. 'idle' serve de fallback interno. */
  anims: Partial<Record<AnimState, FrameAnim>>
}

/**
 * Indice do frame atual. `t` = frames-de-JOGO acumulados no estado (Animator.t);
 * `fps` = frames-de-ANIMACAO/seg; FIXED_DT = segundos por frame-de-jogo (1/60).
 * loop -> wrap; nao-loop -> clamp no ultimo frame. Sempre finito e em [0, frames-1].
 */
export function frameIndex(fa: FrameAnim, t: number): number {
  const n = fa.frames > 0 ? Math.floor(fa.frames) : 1
  const adv = Math.floor(t * fa.fps * FIXED_DT)
  if (fa.loop) return (((adv % n) + n) % n)
  return adv < 0 ? 0 : adv >= n ? n - 1 : adv
}

/**
 * Desenha a celula do frame atual ancorada nos PES do corpo (x = centro
 * horizontal, y = base), espelhada por `facing`. Retorna `false` SEM desenhar
 * quando falta a animacao do estado (e o idle) ou o sheet no store — o game
 * entao faz fallback (procedural/placeholder).
 */
export function drawCharFrame(
  r: Renderer,
  store: AssetStore,
  set: CharAnimSet,
  state: AnimState,
  t: number,
  x: number,
  y: number,
  facing: 1 | -1,
): boolean {
  const fa = set.anims[state] ?? set.anims.idle
  if (!fa) return false
  const sheet = store.get(fa.key)
  if (!sheet) return false

  const idx = frameIndex(fa, t)
  const scale = set.cellH > 0 ? set.drawH / set.cellH : 1
  const dw = set.cellW * scale
  const dh = set.cellH * scale
  const sx = idx * set.cellW

  const ctx = r.ctx
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing, 1)
  // (anchorX, anchorY) da celula cai na origem (pes do corpo).
  ctx.drawImage(
    sheet.src,
    sx,
    0,
    set.cellW,
    set.cellH,
    -set.anchorX * scale,
    -set.anchorY * scale,
    dw,
    dh,
  )
  ctx.restore()
  return true
}
