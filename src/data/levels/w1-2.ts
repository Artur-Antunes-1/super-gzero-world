import type { LevelDef, EntitySpawn } from '../schema'

// W1-2 — "Plataformas Flutuantes" (spec mestre §8.3, secao '#### W1-2').
// 156 cols x 11 rows, difficulty 2.5. Beats por secao (tabela do spec):
//   A (0-22)    one-ways escalonadas (cols ~8 e ~14) com moedas; chao seguro.
//   B (23-40)   mola col 30 -> nicho alto com '?' (item) + 4 moedas; Tolo col 34.
//   C (41-62)   gap de 5 tiles (46-50) com mover horizontal; checkpoint 60.
//   D (63-92)   torre leve alternando '=' e '^' (4 niveis); coracao col 84 alto;
//               2 Tolos patrulhando as plataformas largas.
//   E (93-118)  mover VERTICAL (amplitude 4, speed 1.0) sobe o poco (98-102);
//               estrela em '?' col 104; checkpoint 110.
//   F (119-146) arquipelago: 4 one-ways pequenas + 2 movers horizontais sobre
//               o vao 120-143; trilha de moedas premia a rota arriscada.
//   G (147-155) pouso amplo + portal '>' col 148.
//
// MODIFICACAO DOCUMENTADA (como na W1-1): o spec nao marca spawn no mapa —
// 'S' adicionado na col 2 row 8. A grade e montada programaticamente
// (fill/put) em vez de strings de 156 chars: mais auditavel batida-a-batida.
// Cada posicao respeita o validador de alcancabilidade do parser (subida
// <= 170px ate o item, ou <= 300px com mola a ate ±3 colunas).

const COLS = 156
const ROWS_N = 11

const grid: string[][] = Array.from({ length: ROWS_N }, () =>
  Array.from({ length: COLS }, () => '.'),
)

// Escreve `ch` na faixa horizontal [c0..c1] da linha `row`.
function fill(row: number, c0: number, c1: number, ch: string): void {
  for (let c = c0; c <= c1; c++) grid[row][c] = ch
}
function put(row: number, col: number, ch: string): void {
  grid[row][col] = ch
}

// --- Chao (rows 9-10) com 3 vaos: C (46-50), poco E (98-102), F (120-143) ---
fill(9, 0, 45, '#')
fill(10, 0, 45, '#')
fill(9, 51, 97, '#')
fill(10, 51, 97, '#')
fill(9, 103, 119, '#')
fill(10, 103, 119, '#')
fill(9, 144, 155, '#')
fill(10, 144, 155, '#')

// --- A (0-22): spawn + duas one-ways escalonadas com moedas -----------------
put(8, 2, 'S')
fill(8, 4, 5, 'o') // aquecimento no chao
fill(7, 7, 9, '=') // one-way baixa
fill(6, 7, 9, 'o')
fill(5, 13, 15, '=') // one-way alta (escalonada)
fill(4, 13, 15, 'o')
put(6, 18, '?') // bloco '?' (coin) bativel do chao

// --- B (23-40): mola -> nicho alto ('?' item + 4 moedas); Tolo embaixo ------
put(8, 30, '^') // MOLA (lanca ~6 tiles)
put(3, 28, '?') // item (cogumelo) no alto do nicho
put(3, 29, 'o')
fill(3, 31, 33, 'o') // 4 moedas do nicho (29 + 31-33)

// --- C (41-62): gap 46-50 com mover horizontal (defaults x/3/1.2) -----------
put(8, 46, '~') // origem col 46: varre cols 43-49 sobre o vao
put(7, 45, 'o')
put(7, 47, 'o')
put(7, 49, 'o') // arco de moedas sobre o gap

// --- D (63-92): torre leve '=' e '^' subindo 4 niveis (9 -> 7 -> 5 -> 3) ----
put(8, 64, '^') // mola do chao para o nivel 1
fill(7, 66, 75, '=') // nivel 1 (Tolo patrulha 66-74)
fill(6, 67, 69, 'o')
put(6, 75, '^') // mola do nivel 1 para o nivel 2
fill(5, 78, 88, '=') // nivel 2 (Tolo patrulha 78-86)
fill(3, 79, 81, 'o') // trilha alta (fora da cabeca do Tolo)
put(3, 84, 'H') // coracao no topo da torre

// --- E (93-118): poco 98-102 com mover VERTICAL; estrela '?' col 104 --------
fill(8, 95, 96, 'o')
put(8, 100, '~') // override por entity: axis y, amplitude 4, speed 1.0
fill(6, 103, 107, '=') // beirada alta de saida do poco
put(4, 104, '?') // estrela escondida (bump da beirada)
fill(5, 105, 106, 'o')

// --- F (119-146): arquipelago de 4 one-ways + 2 movers horizontais ----------
fill(7, 121, 122, '=') // ilha 1
fill(6, 121, 122, 'o')
put(7, 124, '~') // mover 1 (override speed 1.3): varre cols 121-127
put(5, 124, 'o')
put(5, 126, 'o')
fill(6, 128, 129, '=') // ilha 2
fill(5, 128, 129, 'o')
fill(7, 131, 132, '=') // ilha 3
fill(6, 131, 132, 'o')
put(6, 134, '~') // mover 2 (override speed 1.3): varre cols 131-137
put(5, 134, 'o')
put(5, 137, 'o')
fill(6, 139, 140, '=') // ilha 4
fill(5, 139, 140, 'o')

// --- G (147-155): pouso amplo + portal -------------------------------------
fill(8, 145, 146, 'o')
put(8, 148, '>') // portal (goalCol do spec)

const ROWS = grid.map((r) => r.join(''))

// Spawns de W1-2 (spec, bloco W1_2_entities; movers '~' do mapa ganham
// override aqui quando fogem dos defaults do parser x/3/1.2).
const W1_2_ENTITIES: EntitySpawn[] = [
  { type: 'block', col: 18, row: 6, payload: 'coin' },
  { type: 'block', col: 28, row: 3, payload: 'item' }, // cogumelo do nicho
  { type: 'fool', col: 34, row: 8, patrol: [32, 38] },
  { type: 'fool', col: 70, row: 6, patrol: [66, 74] },
  { type: 'fool', col: 80, row: 4, patrol: [78, 86] },
  { type: 'mover', col: 100, row: 8, axis: 'y', amplitude: 4, speed: 1.0 },
  { type: 'block', col: 104, row: 4, payload: 'star' }, // estrela escondida
  { type: 'mover', col: 124, row: 7, amplitude: 3, speed: 1.3 },
  { type: 'mover', col: 134, row: 6, amplitude: 3, speed: 1.3 },
  // moedas: geradas a partir dos 'o' do tilemap (parser converte)
]

export const W1_2: LevelDef = {
  id: 'w1-2',
  world: 1,
  zone: 2,
  rows: ROWS,
  entities: W1_2_ENTITIES,
  checkpoints: [60, 110],
  timeStart: 250,
  // Ultima fase do fluxo por enquanto (W1-3 ainda nao existe): sem next.
}
