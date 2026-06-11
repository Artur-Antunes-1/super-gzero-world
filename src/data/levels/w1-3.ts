import type { LevelDef, EntitySpawn } from '../schema'

// W1-3 — "O Coração Acende" (spec mestre §8.3, secao '#### W1-3').
// 168 cols x 11 rows, difficulty 4 (alvo da curva §8.4 — o schema nao tem o
// campo; fica registrado aqui). Beats por secao (tabela do spec):
//   A (0-24)    aquecimento: recombina one-way + mola + 2 Tolos; coracao 'H'
//               col 20 — comeca a encher o medidor de proposito.
//   B (25-47)   SIMPLIFICACAO DOCUMENTADA: o spec pedia '?' falso com portal
//               secreto '*' -> sala-bonus separada (12x11, 14 moedas). O
//               parser atual nao tem salas: virou '?' col 36 com payload STAR
//               + trilha bonus de moedas ALTA (row 3) alcancada pela mola da
//               col 40 — a recompensa exploratoria fica, sem sala. checkpoint 48.
//   C (49-95)   corredor de stomps: 5 Tolos nas plataformas escalonadas
//               (patrulhas do spec) + coracao 'H' col 78.
//   D (96-140)  GAUNTLET (climax do Modo Humanware): 6 Tolos em mix
//               veloz/atirador (spec pedia 8; ajuste p/ projeteis somarem a
//               pressao sem injustica), 2 gaps com movers (speed 1.5 do spec)
//               e espinhos 'x' no chao dos trechos 117-119 e 134-135.
//               checkpoints 96 e 140.
//   E (141-155) desafio OPCIONAL: 3 one-ways altas -> Lifecard 'L' col 150
//               (alto). Recompensa narrativa (Renan).
//   F (156-167) plataforma ELEVADA (piso rows 7-8) + portal '>' col 160.
//
// MODIFICACAO DOCUMENTADA (como na W1-1/W1-2): o spec nao marca spawn no mapa
// — 'S' na col 2 row 8. Grade programatica (fill/put), auditavel por beat.
// Toda posicao de item respeita o validador de alcancabilidade do parser.

const COLS = 168
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

// --- Chao (rows 9-10): continuo exceto os 2 gaps do gauntlet -----------------
fill(9, 0, 107, '#')
fill(10, 0, 107, '#')
// gap 1: cols 108-112 (mover '~' na col 110)
fill(9, 113, 125, '#')
fill(10, 113, 125, '#')
// gap 2: cols 126-130 (mover '~' na col 128)
fill(9, 131, 167, '#')
fill(10, 131, 167, '#')

// --- F (156-167): piso ELEVADO (rows 7-8 solidos) + portal -------------------
fill(7, 156, 167, '#')
fill(8, 156, 167, '#')
put(6, 160, '>') // portal de saida (goalCol do spec)

// --- A (0-24): aquecimento — one-way + mola + 2 Tolos + coracao --------------
put(8, 2, 'S')
fill(8, 4, 6, 'o') // aquecimento no chao
fill(7, 8, 10, '=') // one-way baixa
fill(6, 8, 10, 'o')
put(8, 13, '^') // MOLA -> plataforma alta
fill(5, 12, 14, '=')
fill(4, 12, 14, 'o')
put(6, 20, 'H') // coracao col 20 (Tolos patrulham embaixo)

// --- B (25-47): '?' estrela + trilha bonus alta via mola ---------------------
fill(8, 27, 29, 'o')
put(8, 33, 'o')
put(6, 36, '?') // payload star (entity abaixo) — o "portal secreto" simplificado
put(8, 40, '^') // MOLA da trilha bonus
fill(4, 39, 42, '=')
fill(3, 39, 42, 'o') // trilha bonus alta

// --- C (49-95): corredor de stomps (5 plataformas escalonadas) ---------------
fill(8, 49, 50, 'o')
fill(8, 52, 58, '=') // plataforma 1 (Tolo row 7, patrol 52-58)
fill(6, 53, 57, 'o')
fill(7, 60, 66, '=') // plataforma 2 (Tolo row 6, patrol 60-66)
fill(5, 61, 65, 'o')
fill(8, 68, 74, '=') // plataforma 3 (Tolo row 7, patrol 68-74)
put(6, 78, 'H') // coracao col 78 (medidor ~cheio aqui — spec)
fill(6, 80, 88, '=') // plataforma 4 alta (Tolo row 5, patrol 80-88)
fill(4, 82, 86, 'o')
fill(8, 88, 94, '=') // plataforma 5 (Tolo row 7, patrol 88-94)

// --- D (96-140): GAUNTLET — espinhos no chao + moedas nas bordas dos gaps ----
fill(8, 117, 119, 'x') // espinhos (metade inferior da celula; hazard de contato)
fill(8, 134, 135, 'x')
put(8, 110, '~') // mover do gap 1 (override speed 1.5 via entity)
put(8, 128, '~') // mover do gap 2 (override speed 1.5 via entity)
put(7, 109, 'o')
put(7, 111, 'o')
put(7, 127, 'o')
put(7, 129, 'o')

// --- E (141-155): 3 one-ways altas -> Lifecard alto --------------------------
fill(7, 143, 144, '=')
fill(5, 146, 147, '=')
fill(3, 149, 151, '=')
put(2, 150, 'L') // LIFECARD (col 150, alto — spec: desbloqueia Renan)
put(2, 149, 'o')
put(2, 151, 'o')
fill(8, 152, 154, 'o') // moedas de chao rumo ao F

// --- F: moedas no piso elevado ------------------------------------------------
fill(6, 163, 165, 'o')

const ROWS = grid.map((r) => r.join(''))

// Spawns de W1-3 (spec, bloco W1_3_entities — adaptados aos beats acima).
const W1_3_ENTITIES: EntitySpawn[] = [
  // A — 2 Tolos comuns sob o coracao
  { type: 'fool', col: 17, row: 8, patrol: [16, 19] },
  { type: 'fool', col: 21, row: 8, patrol: [20, 23] },
  // B — estrela escondida no '?' (o "portal secreto" simplificado)
  { type: 'block', col: 36, row: 6, payload: 'star' },
  // C — corredor de stomps (5 Tolos nas plataformas escalonadas)
  { type: 'fool', col: 54, row: 7, patrol: [52, 58] },
  { type: 'fool', col: 62, row: 6, patrol: [60, 66] },
  { type: 'fool', col: 70, row: 7, patrol: [68, 74] },
  { type: 'fool', col: 82, row: 5, patrol: [80, 88] },
  { type: 'fool', col: 90, row: 7, patrol: [88, 94] },
  // D — GAUNTLET: mix veloz/atirador (6)
  { type: 'fool_veloz', col: 98, row: 8, patrol: [96, 102] },
  { type: 'fool_atirador', col: 104, row: 8, patrol: [103, 107] },
  { type: 'fool_veloz', col: 114, row: 8, patrol: [113, 116] },
  { type: 'fool_atirador', col: 122, row: 8, patrol: [121, 125] },
  { type: 'fool_veloz', col: 132, row: 8, patrol: [131, 133] },
  { type: 'fool_atirador', col: 137, row: 8, patrol: [136, 139] },
  // D — movers dos gaps (spec: amplitude 3, speed 1.5)
  { type: 'mover', col: 110, row: 8, amplitude: 3, speed: 1.5 },
  { type: 'mover', col: 128, row: 8, amplitude: 3, speed: 1.5 },
  // moedas: geradas a partir dos 'o' do tilemap (parser converte)
]

export const W1_3: LevelDef = {
  id: 'w1-3',
  world: 1,
  zone: 3,
  rows: ROWS,
  entities: W1_3_ENTITIES,
  checkpoints: [48, 96, 140],
  timeStart: 250,
  bgTheme: 'sky',
  // U4: props decorativos (so visual; o game desenha atras dos tiles).
  decor: [
    { col: 5, row: 8, key: 'prop.arvore' },
    { col: 31, row: 8, key: 'prop.arvore' },
    { col: 93, row: 8, key: 'prop.arvore' },
    { col: 75, row: 8, key: 'prop.cristal' },
    { col: 147, row: 8, key: 'prop.cristal' },
  ],
  // Ultima fase do fluxo atual (W1 completo): sem next — a vitoria mostra a
  // frase de marca da Gzero (game.ts, painel de resultado).
}
