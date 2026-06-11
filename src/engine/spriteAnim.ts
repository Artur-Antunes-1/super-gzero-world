// src/engine/spriteAnim.ts
// M2b: animacao FRAME-A-FRAME (sprite-sheets do personagem). Logica pura
// (frameIndex) + desenho (drawCharFrame + drawContactShadow). Reusa
// AnimState/SpriteTransform de animator.ts; o procedural do M2a
// (spriteDraw.ts) permanece como FALLBACK no game.
import { FIXED_DT } from './constants'
import type { Renderer } from './render'
import type { AssetStore } from './assets'
import type { AnimState, SpriteTransform } from './animator'

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
  /**
   * Altura do CORPO dentro da celula (px), declarada pelo personagem
   * (contrato: ~78 na celula 96). Opcional — usada por HUD/sombra/escala.
   */
  bodyHpx?: number
  /** Mapeamento estado-de-animacao -> animacao. 'idle' serve de fallback interno. */
  anims: Partial<Record<AnimState, FrameAnim>>
}

// One-shots sem sheet caem numa animacao "parecida" antes do 'idle' final
// (contrato 2026-06-09: land->idle, skid->run, cast->idle, victory->jump;
// G3: death->hurt — morte reusa o sheet de dano).
const ONE_SHOT_FALLBACK: Partial<Record<AnimState, AnimState>> = {
  land: 'idle',
  skid: 'run',
  cast: 'idle',
  victory: 'jump',
  death: 'hurt',
}

// Cadeia: anims[state] -> anims[fallback do one-shot] -> anims['idle'].
function pickAnim(set: CharAnimSet, state: AnimState): FrameAnim | undefined {
  const direct = set.anims[state]
  if (direct) return direct
  const fb = ONE_SHOT_FALLBACK[state]
  return (fb ? set.anims[fb] : undefined) ?? set.anims.idle
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

// Sem tf, drawCharFrame aplica identidade (comportamento de antes).
const IDENTITY_TF: SpriteTransform = { scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 }

/**
 * Desenha a celula do frame atual ancorada nos PES do corpo (x = centro
 * horizontal, y = base), espelhada por `facing`. `tf` (opcional) e o overlay
 * procedural de getFrameTransform, aplicado em volta do drawImage na MESMA
 * ordem do spriteDraw.ts: translate -> scale -> rotate. Retorna `false` SEM
 * desenhar quando falta a animacao do estado (apos os fallbacks) ou o sheet
 * no store — o game entao faz fallback (procedural/placeholder).
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
  tf?: SpriteTransform,
): boolean {
  const fa = pickAnim(set, state)
  if (!fa) return false
  const sheet = store.get(fa.key)
  if (!sheet) return false

  const idx = frameIndex(fa, t)
  const scale = set.cellH > 0 ? set.drawH / set.cellH : 1
  const dw = set.cellW * scale
  const dh = set.cellH * scale
  const sx = idx * set.cellW

  const T = tf ?? IDENTITY_TF
  const ctx = r.ctx
  ctx.save()
  // Mesma ordem do spriteDraw.ts: translate (com offsetY) -> scale -> rotate.
  ctx.translate(x, y + T.offsetY)
  ctx.scale(facing * T.scaleX, T.scaleY)
  ctx.rotate(T.rotation)
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

/**
 * Sombra de contato: elipse preta nos pes. No chao: alpha 0.25 e largura w;
 * no ar: alpha 0.12 e largura w*0.7 (encolhe). Altura total ~w*0.18.
 * Chamador desenha ANTES do sprite.
 */
export function drawContactShadow(
  r: Renderer,
  cx: number,
  footY: number,
  w: number,
  onGround: boolean,
): void {
  const ctx = r.ctx
  const rx = (onGround ? w : w * 0.7) / 2
  const ry = (w * 0.18) / 2
  ctx.save()
  ctx.globalAlpha = onGround ? 0.25 : 0.12
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(cx, footY, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
