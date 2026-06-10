import type { LevelDef } from '../schema'

// Fase de TESTE do Humanware (nao faz parte do jogo; acessivel via ?level=hw-test).
// Corredor plano com 130 moedas (130x8 = 1040 >= HW_METER_MAX 1000): andar reto
// enche o medidor e permite ativar o Modo — gate e2e "encher -> ativar".
// Decisao registrada (2026-06-10): a economia da W1-1 segue o canone §8.3
// (max ~387); o Modo pleno entra no curriculo em W1-2/W1-3 (spec §8.2). O gate
// automatizado da mecanica-assinatura vive AQUI.
const VAZIO = '.'.repeat(150)

export const hwTest: LevelDef = {
  id: 'hw-test',
  world: 0,
  zone: 0,
  rows: [
    VAZIO, // 0
    VAZIO, // 1
    VAZIO, // 2
    VAZIO, // 3
    VAZIO, // 4
    VAZIO, // 5
    VAZIO, // 6
    VAZIO, // 7
    // spawn col 2 · moedas cols 5-134 (130) · Tolo col 140 · portal col 146
    '..S..' + 'o'.repeat(130) + '.....F.....>...',
    '#'.repeat(150), // 9
    '#'.repeat(150), // 10
  ],
}
