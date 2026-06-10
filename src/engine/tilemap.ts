// src/engine/tilemap.ts
// DONO C1: autotiling 4-bit + desenho de tiles via atlas.
// Bitmask de vizinhanca: N=1, E=2, S=4, W=8; bit LIGADO = vizinho do mesmo
// grupo de solidez (qualquer solido pleno conecta, mesmo de tipo diferente).
// Fora do mapa conta como ligado. 'platform' calcula bitmask no proprio grupo
// (platform conecta com platform E com solidos) — assim o chao one-way da
// W1-1 ganha topo de grama (N aberto) e pontas arredondadas.

import { TILE } from './constants'
import { isFullSolid, tileAt } from './physics'
import type { ParsedLevel } from '../data/schema'
import type { Renderer } from './render'
import type { AssetStore } from './assets'

export interface TileAtlasSet {
  assetKey: string
  tile: number // lado da celula do atlas (px na imagem fonte)
  cells: Record<number, [number, number]> // variant -> [col, row] no atlas
}

// Vizinho liga o bit se pertencer ao grupo: solidos plenos sempre;
// platform tambem conta quando o proprio tile e platform. Fora do mapa = ligado.
function neighborOn(
  level: ParsedLevel,
  tx: number,
  ty: number,
  includePlatform: boolean,
): boolean {
  if (tx < 0 || ty < 0 || tx >= level.widthTiles || ty >= level.heightTiles) {
    return true
  }
  const t = tileAt(level, tx, ty)
  return isFullSolid(t) || (includePlatform && t === 'platform')
}

// Variants por celula, indice row-major (row * widthTiles + col).
// Solidos (ground/brick/block) conectam so entre solidos; platform conecta
// com platform E solidos (grupo proprio); demais celulas ficam 0 (default
// do Uint8Array) e nao devem ser desenhadas pelo atlas.
export function computeTileVariants(level: ParsedLevel): Uint8Array {
  const out = new Uint8Array(level.widthTiles * level.heightTiles)
  for (let row = 0; row < level.heightTiles; row++) {
    for (let col = 0; col < level.widthTiles; col++) {
      const t = level.tiles[row][col]
      const i = row * level.widthTiles + col
      const isPlat = t === 'platform'
      if (isPlat || isFullSolid(t)) {
        let v = 0
        if (neighborOn(level, col, row - 1, isPlat)) v |= 1 // N
        if (neighborOn(level, col + 1, row, isPlat)) v |= 2 // E
        if (neighborOn(level, col, row + 1, isPlat)) v |= 4 // S
        if (neighborOn(level, col - 1, row, isPlat)) v |= 8 // W
        out[i] = v
      }
    }
  }
  return out
}

// Desenha a celula do atlas correspondente a variant no tile (col,row) do mundo.
// Fallback: variant ausente no mapa usa cells[15]. Retorna false se o asset
// (ou a celula) estiver ausente — chamador decide o fallback visual.
export function drawTile(
  r: Renderer,
  store: AssetStore,
  set: TileAtlasSet,
  variant: number,
  col: number,
  row: number,
): boolean {
  const img = store.get(set.assetKey)
  if (!img) return false
  const cell = set.cells[variant] ?? set.cells[15]
  if (!cell) return false
  r.drawSprite(
    img.src,
    cell[0] * set.tile,
    cell[1] * set.tile,
    set.tile,
    set.tile,
    col * TILE,
    row * TILE,
    TILE,
    TILE,
  )
  return true
}
