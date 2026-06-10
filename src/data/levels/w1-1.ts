import type { LevelDef, EntitySpawn } from '../schema'

// W1-1 — "O Primeiro Passo Leve" (spec mestre, secao 8.3 '#### W1-1').
// 144 cols x 11 rows, montadas das 4 janelas de 36 cols do spec (transcricao
// caractere a caractere das janelas 1-4).
//
// MODIFICACAO DOCUMENTADA: o spec NAO marca spawn no mapa — 'S' adicionado na
// col 2 row 8 (janela 1) conforme tarefa C3a.
// Os 'g' do mapa sao marcadores visuais dos Tolos; o parser os ignora
// (os spawns reais vem de `entities` abaixo, com patrulha).
// Goal: '>' col 136 row 8 (ja presente na janela 4).

// Janela 1 — cols 0-35 (Secoes A-B). row8: 'S' col 2 (adicionado) + 'g' col 24.
const WIN1 = [
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '..........ooooo.....................',
  '....................................',
  '............................?.......',
  '....................................',
  '..S.....................g...........',
  '====================================',
  '====================================',
]

// Janela 2 — cols 36-71 (Secoes C-D). Gap real cols 41-43 (rows 9-10 abertos).
const WIN2 = [
  '....................................',
  '....................................',
  '....................................',
  '....................................',
  '.....ooooo..........................',
  '....................................',
  '......................?.?.?.........',
  '....................................',
  '..............................H.....',
  '=====...=====================.......',
  '=====...============================',
]

// Janela 3 — cols 72-107 (Secoes E-F inicio). Tolos col 78/88 via entities.
const WIN3 = [
  '....................................',
  '....................................',
  '....................................',
  '............................#.......',
  '.........................#..oo......',
  '......................#.............',
  '...................#................',
  '..............B.....................',
  '......g...........g.................',
  '====================================',
  '====================================',
]

// Janela 4 — cols 108-143 (Secoes F fim-G). Portal '>' col 136 row 8.
const WIN4 = [
  '....................................',
  '....................................',
  '....................................',
  '....#...............................',
  '....?...............................',
  '........................oooo........',
  '....................................',
  '....................................',
  '............................>.......',
  '====================================',
  '====================================',
]

// Concatena as 4 janelas linha a linha -> 11 linhas de 144 chars.
const ROWS = WIN1.map((line, i) => line + WIN2[i] + WIN3[i] + WIN4[i])

// Spawns de W1-1 (spec, bloco W1_1_entities).
const W1_1_ENTITIES: EntitySpawn[] = [
  { type: 'fool', col: 24, row: 8, patrol: [24, 30] },
  { type: 'block', col: 28, row: 6, payload: 'coin' },
  { type: 'block', col: 58, row: 6, payload: 'item' }, // cogumelo
  { type: 'block', col: 60, row: 6, payload: 'coin' },
  { type: 'block', col: 62, row: 6, payload: 'coin' },
  { type: 'heart', col: 66, row: 8 }, // +25% medidor
  { type: 'fool', col: 78, row: 8, patrol: [78, 84] },
  { type: 'fool', col: 88, row: 8, patrol: [88, 94] },
  { type: 'block', col: 112, row: 4, payload: 'star' }, // estrela escondida
  // moedas: geradas a partir dos 'o' do tilemap (parser converte)
]

export const W1_1: LevelDef = {
  id: 'w1-1',
  world: 1,
  zone: 1,
  rows: ROWS,
  entities: W1_1_ENTITIES,
  checkpoints: [72],
  timeStart: 250,
}
