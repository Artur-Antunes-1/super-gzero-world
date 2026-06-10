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
  // ESCALA INTEIRA (contrato de animacao §1): drawH = 96 (1x) — fator
  // nao-inteiro causa shimmer. O corpo ocupa ~78px da celula (bodyHpx).
  drawH: 96,
  bodyHpx: 78,
  anims: {
    idle: { key: 'char.artur.idle', frames: 3, fps: 6, loop: true },
    walk: { key: 'char.artur.corrida', frames: 4, fps: 10, loop: true },
    run: { key: 'char.artur.corrida', frames: 4, fps: 15, loop: true },
    jump: { key: 'char.artur.pulo', frames: 3, fps: 12, loop: false },
    fall: { key: 'char.artur.queda', frames: 4, fps: 12, loop: false },
    hurt: { key: 'char.artur.danificado', frames: 3, fps: 8, loop: true },
    // one-shot de habilidade (J); land/skid/victory ficam no fallback procedural.
    cast: { key: 'char.artur.ataque', frames: 4, fps: 12, loop: false },
  },
}

export const CHAR_ANIMS: Record<string, CharAnimSet> = {
  artur: ARTUR_ANIMS,
}
