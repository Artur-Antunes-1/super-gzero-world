// src/data/tiles.ts
// DONO Task C2: atlases de tiles (PixelLab, Wang tileset15 4x4 escalado 3x -> 48px).
// bitmask de vizinhanca por ARESTA: N=1, E=2, S=4, W=8 (bit ON = vizinho solido).
// Encoding da fonte: wang_N onde N = SE(1)+SW(2)+NE(4)+NW(8) com bit ON = canto "upper" (ar);
// canto solido <=> AMBAS as arestas adjacentes ligadas. Masks degeneradas (0,1,2,4,5,8,10)
// nao tem tile Wang exato — escolhidas a mao e validadas visualmente (nunca o tile todo-ar).
import type { TileAtlasSet } from '../engine/tilemap'
import type { TileType } from './schema'

// Grid 4x4 (col,row) por nome wang:
//   linha 0: wang_13 wang_10 wang_4  wang_12
//   linha 1: wang_6  wang_8  wang_0  wang_1
//   linha 2: wang_11 wang_3  wang_2  wang_5
//   linha 3: wang_15 wang_14 wang_9  wang_7
const CELLS_BASE: Record<number, [number, number]> = {
  0: [3, 0], // isolado -> wang_12 (topo com borda; visivel)
  1: [1, 2], // ponta inferior de coluna -> wang_3 (borda embaixo)
  2: [1, 3], // ponta esquerda de barra -> wang_14 (quina sup-esq)
  3: [0, 2], // quina inferior-esquerda -> wang_11
  4: [3, 0], // topo de coluna -> wang_12
  5: [2, 1], // meio de coluna -> wang_0 (cheio)
  6: [1, 3], // quina superior-esquerda -> wang_14
  7: [1, 0], // borda esquerda -> wang_10
  8: [0, 0], // ponta direita de barra -> wang_13 (quina sup-dir)
  9: [3, 3], // quina inferior-direita -> wang_7
  10: [3, 0], // meio de barra -> wang_12 (grama/borda em cima)
  11: [1, 2], // borda inferior -> wang_3
  12: [0, 0], // quina superior-direita -> wang_13
  13: [3, 2], // borda direita -> wang_5
  14: [3, 0], // borda superior -> wang_12
  15: [2, 1], // interior cheio -> wang_0
}

/** Terra com grama (ground/platform): bloco isolado vira "tufo" com grama em cima. */
export const TERRA_ATLAS: TileAtlasSet = {
  assetKey: 'tiles.terra',
  tile: 48,
  cells: { ...CELLS_BASE },
}

/** Tijolos claros (brick/block): bloco isolado usa o tijolo CHEIO (le como bloco classico). */
export const TIJOLO_ATLAS: TileAtlasSet = {
  assetKey: 'tiles.tijolo',
  tile: 48,
  cells: { ...CELLS_BASE, 0: [2, 1] },
}

/** Atlas por tipo de tile solido; tipos nao-solidos ficam de fora. */
export const TILE_ATLASES: Partial<Record<TileType, TileAtlasSet>> = {
  ground: TERRA_ATLAS,
  platform: TERRA_ATLAS,
  brick: TIJOLO_ATLAS,
  block: TIJOLO_ATLAS,
}
