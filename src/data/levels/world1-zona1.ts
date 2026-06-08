import type { LevelDef } from '../schema'

// World 1 - Zona 1 (greybox jogavel do M0).
// Errata E3+E4: 40 colunas x 11 linhas. Cada string tem EXATAMENTE 40 caracteres.
// Legenda (CONTRATO): #=ground  =  =platform  o=coin  S=spawn  G=goal  .=empty
//
// Layout:
//   rows 0-2:  espaco vazio
//   row 3:     moedas nas colunas 10, 20, 30
//   rows 4-7:  espaco vazio (row 5 tem plataformas decorativas)
//   row 8:     spawn col 2, goal col 36
//   rows 9-10: chao continuo (sem buracos -> nivel 100% caminhavel)
export const world1Zona1: LevelDef = {
  id: 'world1-zona1',
  world: 1,
  zone: 1,
  rows: [
    '........................................', // 0  (40 chars)
    '........................................', // 1  (40 chars)
    '........................................', // 2  (40 chars)
    '..........o.........o.........o.........', // 3  (coins col 10,20,30 — 40 chars)
    '........................................', // 4  (40 chars)
    '..............==........==..............', // 5  (plataformas decorativas — 40 chars)
    '........................................', // 6  (40 chars)
    '........................................', // 7  (40 chars)
    '..S.................................G...', // 8  (spawn col 2, goal col 36 — 40 chars)
    '########################################', // 9  (chao — 40 chars)
    '########################################', // 10 (chao — 40 chars)
  ],
}
