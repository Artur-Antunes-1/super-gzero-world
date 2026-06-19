// src/data/charAnims.ts
// M2b (dono unico): descritor de animacao FRAME-A-FRAME por personagem.
// Mapeia AnimState (animator.ts) -> sheet/frames/fps. Só o Artur por enquanto;
// personagens ausentes daqui usam o fallback procedural/placeholder no game.
import type { CharAnimSet } from '../engine/spriteAnim'

/**
 * Conjunto de animacoes do Artur (celula 96x96). U-HF (2026-06-19): frames
 * re-extraidos do NOVO character sheet do Artur (Higgsfield, fundo magenta) —
 * idle 4 / corrida 6 / pulo 2 / queda 2 / danificado 1 / land 1. As poses de
 * QUEDA (bracos erguidos) tambem servem de 'victory'. O sheet novo nao traz
 * pose de ataque nem de freada, entao 'cast' e 'skid' caem no fallback do
 * engine (cast->idle, skid->run) com o overlay procedural por cima — tudo
 * sobre a arte NOVA, sem misturar com o sheet antigo.
 */
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
    idle: { key: 'char.artur.idle', frames: 4, fps: 6, loop: true },
    // corrida = ciclo de 8 frames com pernas ALTERNADAS: 4 com a perna direita
    // a frente (reach/push/recoil/pass) + 4 espelhadas (perna esquerda). O sheet
    // novo so trazia uma perna liderando (frames 4-6 eram quase copias do 1), entao
    // a metade esquerda foi sintetizada espelhando SO as pernas no quadril.
    walk: { key: 'char.artur.corrida', frames: 8, fps: 10, loop: true },
    run: { key: 'char.artur.corrida', frames: 8, fps: 15, loop: true },
    jump: { key: 'char.artur.pulo', frames: 2, fps: 12, loop: false },
    fall: { key: 'char.artur.queda', frames: 2, fps: 12, loop: false },
    hurt: { key: 'char.artur.danificado', frames: 1, fps: 8, loop: true },
    // U-HF: pouso ganhou frame dedicado (crouch) — one-shot de ~10f no engine.
    land: { key: 'char.artur.land', frames: 1, fps: 15, loop: false },
    // victory = poses de QUEDA (bracos erguidos), alterna em loop na tela de win.
    victory: { key: 'char.artur.vitoria', frames: 2, fps: 6, loop: true },
  },
}

export const CHAR_ANIMS: Record<string, CharAnimSet> = {
  artur: ARTUR_ANIMS,
}
