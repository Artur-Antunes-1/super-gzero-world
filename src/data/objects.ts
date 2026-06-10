// src/data/objects.ts
// DONO D1 (Fase D): dados de animacao de OBJETOS (moeda, portal) e do
// inimigo Tolo. Sheets horizontais em public/assets; animados com
// frameIndex(fa, clock) de engine/spriteAnim + clock global do game.

/** Animacao de objeto: sheet horizontal de `frames` celulas cellW x cellH. */
export interface ObjectAnim {
  /** Chave do sheet no AssetStore (ver ASSET_MANIFEST). */
  key: string
  /** Numero de frames (celulas) no sheet, em linha. */
  frames: number
  /** Frames de animacao por segundo. */
  fps: number
  /** true -> repete; false -> trava no ultimo frame. */
  loop: boolean
  /** Largura/altura da celula no sheet (px). */
  cellW: number
  cellH: number
  /** Tamanho desenhado no mundo (px). */
  drawW: number
  drawH: number
}

/**
 * Animacoes dos objetos do mundo 1.
 * - moeda: hitbox 26px; desenha 32 centrado (spin de 6 frames).
 * - portal: apoiado no chao, ~2 tiles de altura (96px).
 * - tolo/toloIdle: inimigo Tolo (andar 8 frames / respirar 4 frames).
 */
export const OBJECT_ANIMS: {
  moeda: ObjectAnim
  portal: ObjectAnim
  tolo: ObjectAnim
  toloIdle: ObjectAnim
} = {
  moeda: {
    key: 'obj.moeda',
    frames: 6,
    fps: 10,
    loop: true,
    cellW: 64,
    cellH: 64,
    drawW: 32,
    drawH: 32,
  },
  portal: {
    key: 'obj.portal',
    frames: 7,
    fps: 8,
    loop: true,
    cellW: 128,
    cellH: 128,
    drawW: 96,
    drawH: 96,
  },
  tolo: {
    key: 'char.tolo',
    frames: 8,
    fps: 10,
    loop: true,
    cellW: 92,
    cellH: 92,
    drawW: 56,
    drawH: 56,
  },
  toloIdle: {
    key: 'char.tolo.idle',
    frames: 4,
    fps: 10,
    loop: true,
    cellW: 92,
    cellH: 92,
    drawW: 56,
    drawH: 56,
  },
}
