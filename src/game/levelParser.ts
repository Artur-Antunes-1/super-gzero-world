import { TILE, TIME_START } from '../engine/constants'
import type {
  LevelDef,
  ParsedLevel,
  SpawnPoint,
  TileType,
} from '../data/schema'

// Mapeia cada caractere da legenda ASCII canonica (CONTRATO) para o TileType
// solido correspondente. Caracteres ausentes deste mapa viram 'empty' (incluindo
// S, G, >, o, g, H, F, '.' e espaco, que sao tratados como camadas separadas).
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
 * Legenda (C3a):
 * - tiles[row][col] usa CHAR_TO_TILE; demais caracteres viram 'empty'.
 * - 'S' playerSpawn; 'G' e '>' goal — { x: col*TILE, y: row*TILE } (top-left).
 * - 'o' moeda; 'H' coracao (tile empty, entrada em hearts).
 * - '?' tile solido 'block' + entrada em qBlocks; payload vem de entities
 *   (type 'block' com mesmo col/row), default 'coin'.
 * - 'g' = empty IGNORADO (marcador visual; Tolos vem de entities).
 * - 'F' legacy: foolSpawn sem patrol (+ espelho em enemies p/ compat).
 * - foolSpawns = entities tipo 'fool' (com patrol) + legacy 'F'.
 * - checkpoints/timeStart copiados do LevelDef (timeStart default TIME_START).
 */
export function parseLevel(def: LevelDef): ParsedLevel {
  const rows = def.rows
  const heightTiles = rows.length
  // Largura = maior comprimento de linha (linhas curtas sao preenchidas com 'empty').
  const widthTiles = rows.reduce((max, row) => Math.max(max, row.length), 0)

  const entities = def.entities ?? []

  const tiles: TileType[][] = []
  const coins: SpawnPoint[] = []
  const enemies: Array<{ x: number; y: number; kind: string }> = []
  const qBlocks: ParsedLevel['qBlocks'] = []
  const hearts: ParsedLevel['hearts'] = []
  // entities tipo 'fool' primeiro (com patrol); legacy 'F' anexado no scan.
  const foolSpawns: ParsedLevel['foolSpawns'] = entities
    .filter((e) => e.type === 'fool')
    .map((e) => ({ col: e.col, row: e.row, patrol: e.patrol }))
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
        case '>':
          goal = { x: px, y: py }
          break
        case 'o':
          coins.push({ x: px, y: py })
          break
        case 'H':
          hearts.push({ col, row })
          break
        case '?': {
          // Payload resolvido por entities (type 'block', mesmo col/row); default 'coin'.
          const ent = entities.find(
            (e) => e.type === 'block' && e.col === col && e.row === row,
          )
          qBlocks.push({ col, row, payload: ent?.payload ?? 'coin' })
          break
        }
        case 'F':
          // Legacy: foolSpawn sem patrol + espelho em enemies (compat).
          foolSpawns.push({ col, row })
          enemies.push({ x: px, y: py, kind: 'fool' })
          break
        // 'g' ignorado: marcador visual do Tolo (entities mandam).
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
    qBlocks,
    hearts,
    checkpoints: [...(def.checkpoints ?? [])],
    timeStart: def.timeStart ?? TIME_START,
    foolSpawns,
  }
}

/**
 * Valida um LevelDef. Lanca Error se:
 * - faltar spawn 'S' ou goal ('G'/'>');
 * - larguras de linha inconsistentes;
 * - checkpoint fora de [0, cols).
 */
export function validateLevel(def: LevelDef): void {
  const rows = def.rows
  if (rows.length === 0) {
    throw new Error(`level ${def.id}: sem linhas`)
  }

  const cols = rows[0].length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== cols) {
      throw new Error(
        `level ${def.id}: largura inconsistente na linha ${i} (${rows[i].length} != ${cols})`,
      )
    }
  }

  const all = rows.join('')
  if (!all.includes('S')) {
    throw new Error(`level ${def.id}: sem spawn 'S'`)
  }
  if (!all.includes('G') && !all.includes('>')) {
    throw new Error(`level ${def.id}: sem goal ('G' ou '>')`)
  }

  for (const cp of def.checkpoints ?? []) {
    if (cp < 0 || cp >= cols) {
      throw new Error(`level ${def.id}: checkpoint ${cp} fora de [0, ${cols})`)
    }
  }
}
