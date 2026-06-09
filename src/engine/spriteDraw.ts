// src/engine/spriteDraw.ts
// DONO Task 5 (M2a): desenho do sprite animado ancorado nos pes.
// Consome: Renderer (render.ts), ImageAsset (assets.ts), Animator/getTransform (animator.ts).
// NAO contem logica de jogo nem de fisica.
import type { Renderer } from './render'
import type { ImageAsset } from './assets'
import type { Animator } from './animator'
import { getTransform } from './animator'

/**
 * Altura-alvo do sprite desenhado (px). Maior que a hitbox 34x42 para o
 * personagem parecer maior que a colisao, como num platformer classico.
 */
export const SPRITE_DRAW_H = 90

/**
 * Desenha o sprite animado do personagem ancorado nos PES.
 *
 * @param r      Renderer (usa r.ctx.* diretamente).
 * @param asset  ImageAsset ja carregado (ou null -> nao desenha; fallback no game).
 * @param an     Animator (estado/t) -> getTransform produz a "fluidez".
 * @param x      Centro HORIZONTAL do corpo (x do corpo + w/2).
 * @param y      Base/PE do corpo (y do corpo + h).
 * @param _w     Largura da hitbox (referencia; nao usada para escalar a altura).
 * @param _h     Altura da hitbox (referencia; nao usada para escalar a altura).
 * @param facing 1 (direita) | -1 (esquerda) -> espelha em X.
 * @param body   { vx, vy, onGround } -> entrada de getTransform.
 */
export function drawAnimatedSprite(
  r: Renderer,
  asset: ImageAsset | null,
  an: Animator,
  x: number,
  y: number,
  _w: number,
  _h: number,
  facing: 1 | -1,
  body: { vx: number; vy: number; onGround: boolean },
): void {
  // Sem arte -> nao desenha; o game faz fallback para drawPlaceholder.
  if (asset === null) return

  const ctx = r.ctx
  const tf = getTransform(an, body)

  // Altura desenhada fixa em SPRITE_DRAW_H; largura proporcional ao aspecto.
  const aspect = asset.w > 0 && asset.h > 0 ? asset.w / asset.h : 1
  const dh = SPRITE_DRAW_H
  const dw = dh * aspect

  ctx.save()
  // Origem nos pes (x = centro horizontal, y = base) + respiracao/bob vertical.
  ctx.translate(x, y + tf.offsetY)
  // facing espelha em X; scaleX/scaleY do transform dao a vida (stretch/bob).
  ctx.scale(facing * tf.scaleX, tf.scaleY)
  ctx.rotate(tf.rotation)
  // Centrado no eixo X (-dw/2) e ancorado nos pes (-dh na vertical).
  ctx.drawImage(asset.src, -dw / 2, -dh, dw, dh)
  ctx.restore()
}
