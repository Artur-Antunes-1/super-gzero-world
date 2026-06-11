import type { LevelDef } from '../schema'

// World 1 - Zona 1 (greybox jogavel; M1 ganha 2 tolos 'F').
// Errata E3+E4: 40 colunas x 11 linhas. Cada string tem EXATAMENTE 40 caracteres.
// Legenda (CONTRATO): #=ground  ==platform  o=coin  F=fool  S=spawn  G=goal  .=empty
//
// Layout (errata de fisica 2026-06-11: moedas desceram da row 3 para a row 4 —
// row 3 exigia subida de ~198px, acima do alcance do pior saltador ~170px;
// row 4 exige ~150px, alcancavel por todos):
//   rows 0-3:  espaco vazio
//   row 4:     moedas nas colunas 10, 20, 30 + 2 tolos 'F' nas colunas 14 e 24
//   row 5:     plataformas decorativas (cols 14-15 e 24-25)
//   rows 6-7:  espaco vazio
//   row 8:     spawn col 2, goal col 36
//   rows 9-10: chao continuo (sem buracos -> nivel 100% caminhavel/vencivel a direita)
//
// Os tolos ficam na row 4 (acima das plataformas '==' da row 5), colunas 14 e 24.
// Ao cair sobre as plataformas, patrulham ALI acima do caminho do chao (row 8),
// sem bloquear a rota spawn->goal. Colunas longe do spawn (col 2) e do goal (col 36).
export const world1Zona1: LevelDef = {
  id: 'world1-zona1',
  world: 1,
  zone: 1,
  rows: [
    '........................................', // 0  (40 chars)
    '........................................', // 1  (40 chars)
    '........................................', // 2  (40 chars)
    '........................................', // 3  (40 chars)
    '..........o...F.....o...F.....o.........', // 4  (coins col 10,20,30 + tolos col 14,24 — 40 chars)
    '..............==........==..............', // 5  (plataformas decorativas — 40 chars)
    '........................................', // 6  (40 chars)
    '........................................', // 7  (40 chars)
    '..S.................................G...', // 8  (spawn col 2, goal col 36 — 40 chars)
    '########################################', // 9  (chao — 40 chars)
    '########################################', // 10 (chao — 40 chars)
  ],
}
