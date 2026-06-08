import { TILE } from '../engine/constants'
import type {
  LevelDef,
  ParsedLevel,
  SpawnPoint,
  TileType,
} from '../data/schema'

// Mapeia cada caractere da legenda ASCII canonica (CONTRATO) para o TileType
// solido correspondente. Caracteres ausentes deste mapa viram 'empty' (incluindo
// S, G, o, g, *, F, L, '.' e espaco, que sao tratados como camadas separadas).
const CHAR_TO_TILE: Record<string, TileType> = {
  '#': 'ground',
  B: 'brick',
  '=': 'platform',
  '?': 'block',
  '^': 'spike',
}

/**
 * Converte um LevelDef (ASCII tilemap) em ParsedLevel.
 *
 * - tiles[row][col] usa CHAR_TO_TILE; celulas S/G/o/g/*.../F/L/espaco/' ' viram 'empty'.
 * - playerSpawn: celula S -> { x: col*TILE, y: row*TILE } (top-left da celula).
 * - goal:        celula G -> { x: col*TILE, y: row*TILE }.
 * - coins:       cada 'o'  -> { x: col*TILE, y: row*TILE } (top-left; centralizar depois se necessario).
 * - enemies:     cada 'g'  -> { x, y, kind: 'enemy' }; 'F' -> kind: 'fool'.
 */
export function parseLevel(def: LevelDef): ParsedLevel {
  const rows = def.rows
  const heightTiles = rows.length
  // Largura = maior comprimento de linha (linhas curtas sao preenchidas com 'empty').
  const widthTiles = rows.reduce((max, row) => Math.max(max, row.length), 0)

  const tiles: TileType[][] = []
  const coins: SpawnPoint[] = []
  const enemies: Array<{ x: number; y: number; kind: string }> = []
  let playerSpawn: SpawnPoint = { x: 0, y: 0 }
  let goal: SpawnPoint = { x: 0, y: 0 }

  for (let row = 0; row < heightTiles; row++) {
    const line = rows[row]
    const tileRow: TileType[] = []
    for (let col = 0; col < widthTiles; col++) {
      const ch = line[col] ?? '.'
      const px = col * TILE
      const py = row * TILE

      switch (ch) {
        case 'S':
          playerSpawn = { x: px, y: py }
          break
        case 'G':
          goal = { x: px, y: py }
          break
        case 'o':
          coins.push({ x: px, y: py })
          break
        case 'g':
          enemies.push({ x: px, y: py, kind: 'enemy' })
          break
        case 'F':
          enemies.push({ x: px, y: py, kind: 'fool' })
          break
        default:
          break
      }

      tileRow.push(CHAR_TO_TILE[ch] ?? 'empty')
    }
    tiles.push(tileRow)
  }

  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn,
    goal,
    coins,
    enemies,
  }
}
