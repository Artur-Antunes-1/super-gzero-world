// src/data/charAnims.ts
// M2b (dono unico): descritor de animacao FRAME-A-FRAME por personagem.
// Mapeia AnimState (animator.ts) -> sheet/frames/fps. Só o Artur por enquanto;
// personagens ausentes daqui usam o fallback procedural/placeholder no game.
import type { CharAnimSet } from '../engine/spriteAnim'

/** Conjunto de animacoes do Artur, extraidas do sheet original dele (celula 96x96). */
export const ARTUR_ANIMS: CharAnimSet = {
  cellW: 96,
  cellH: 96,
  anchorX: 48,
  anchorY: 92,
  // celula 96px escalada ~1.15x: o corpo (~78px dentro da celula) renderiza a
  // ~89px na tela, casando com o SPRITE_DRAW_H=90 do fallback procedural (M2a).
  drawH: 110,
  anims: {
    idle: { key: 'char.artur.idle', frames: 3, fps: 6, loop: true },
    walk: { key: 'char.artur.corrida', frames: 4, fps: 10, loop: true },
    run: { key: 'char.artur.corrida', frames: 4, fps: 15, loop: true },
    jump: { key: 'char.artur.pulo', frames: 3, fps: 12, loop: false },
    fall: { key: 'char.artur.queda', frames: 4, fps: 12, loop: false },
    hurt: { key: 'char.artur.danificado', frames: 3, fps: 8, loop: true },
  },
}

export const CHAR_ANIMS: Record<string, CharAnimSet> = {
  artur: ARTUR_ANIMS,
}
