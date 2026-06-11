import { TILE, TIME_START, PLAYER_H } from '../engine/constants'
import type {
  LevelDef,
  ParsedLevel,
  SpawnPoint,
  TileType,
} from '../data/schema'

// Mapeia cada caractere da legenda ASCII canonica (CONTRATO) para o TileType
// solido correspondente. Caracteres ausentes deste mapa viram 'empty' (incluindo
// S, G, >, o, g, H, F, '.' e espaco, que sao tratados como camadas separadas).
// 2026-06-11: '^' DEIXOU de ser spike e virou MOLA (camada springs, tile empty).
// O TileType 'spike' permanece no schema SEM produtor (volta quando tiver dano/arte).
const CHAR_TO_TILE: Record<string, TileType> = {
  '#': 'ground',
  B: 'brick',
  '=': 'platform',
  '?': 'block',
}

// Defaults da plataforma movel '~' (entities type 'mover' sobrescrevem).
const MOVER_DEFAULTS = { axis: 'x' as const, amplitude: 3, speed: 1.2 }

/**
 * Converte um LevelDef (ASCII tilemap) em ParsedLevel.
 *
 * Legenda (C3a):
 * - tiles[row][col] usa CHAR_TO_TILE; demais caracteres viram 'empty'.
 * - 'S' playerSpawn pelos PES: y = (row+1)*TILE - PLAYER_H (hitbox honesta
 *   2026-06-11: h=64 > TILE — o top-left enterrava os pes 16px na celula de
 *   baixo e, sobre piso 'platform' one-way, o corpo ATRAVESSAVA no 1o frame).
 * - 'G' e '>' goal — { x: col*TILE, y: row*TILE } (top-left).
 * - 'o' moeda; 'H' coracao (tile empty, entrada em hearts).
 * - '?' tile solido 'block' + entrada em qBlocks; payload vem de entities
 *   (type 'block' com mesmo col/row), default 'coin'.
 * - 'g' = empty IGNORADO (marcador visual; Tolos vem de entities).
 * - 'F' legacy: foolSpawn sem patrol (+ espelho em enemies p/ compat).
 * - foolSpawns = entities tipo 'fool' (com patrol) + legacy 'F'.
 * - '^' MOLA: tile empty + entrada em springs (2026-06-11; era spike).
 * - '~' plataforma MOVEL: tile empty + entrada em movers; defaults axis 'x',
 *   amplitude 3 (tiles), speed 1.2 (px/frame); entity 'mover' no mesmo
 *   col/row sobrescreve.
 * - checkpoints/timeStart/next copiados do LevelDef (timeStart default TIME_START).
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
  const springs: ParsedLevel['springs'] = []
  const movers: ParsedLevel['movers'] = []
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
          // Spawn pelos pes: base do corpo alinhada a base da celula 'S'.
          playerSpawn = { x: px, y: py + TILE - PLAYER_H }
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
        case '^':
          // Mola: tile empty + entrada em springs.
          springs.push({ col, row })
          break
        case '~': {
          // Plataforma movel: defaults sobrescritos por entity 'mover' no col/row.
          const ent = entities.find(
            (e) => e.type === 'mover' && e.col === col && e.row === row,
          )
          movers.push({
            col,
            row,
            axis: ent?.axis ?? MOVER_DEFAULTS.axis,
            amplitude: ent?.amplitude ?? MOVER_DEFAULTS.amplitude,
            speed: ent?.speed ?? MOVER_DEFAULTS.speed,
          })
          break
        }
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
    springs,
    movers,
    next: def.next,
  }
}

// --- Alcancabilidade (2026-06-11, playtest) ---------------------------------
// REACH_MAX: subida maxima exigivel dos PES do jogador num pulo. Pior saltador:
// Einstein (jumpVelMul 0.94) — apex continuo (18*0.94)^2/1.6 ≈ 179px; a simulacao
// discreta da ~170px. REACH_MAX = 170 (sem margem extra: o discreto JA e o piso).
const REACH_MAX = 170
// Com MOLA por perto (SPRING_VEL -22 ≈ 6 tiles) o limite sobe.
const REACH_SPRING = 300
const REACH_WINDOW_COLS = 2 // janela de busca de apoio: ±2 colunas
const SPRING_WINDOW_COLS = 3 // janela de busca de mola: ±3 colunas

// Caracteres em que da para APOIAR os pes (topo de solido ou platform one-way).
const STANDABLE = new Set(['#', 'B', '?', '='])

// Subida de pes necessaria para o corpo do jogador sobrepor a celula do item:
// pes no topo do apoio (srow*TILE); basta o topo do corpo (pes - PLAYER_H)
// alcancar a base da celula do item ((row+1)*TILE).
// Hitbox honesta 2026-06-11 (PLAYER_H 42 -> 64): as subidas exigidas FICAM
// MENORES — o validador absorve a mudanca sem tocar nos tilemaps canonicos.
// Ex.: apoio row 9 -> item row 4 = (9-4-1)*48 - 64 = 128px (moedas row 4);
//      item row 3 = 176px (caso do greybox que motivou a errata segue > 170).
function riseNeeded(supportRow: number, itemRow: number): number {
  return Math.max(0, (supportRow - itemRow - 1) * TILE - PLAYER_H)
}

/**
 * Valida um LevelDef. Lanca Error se:
 * - faltar spawn 'S' ou goal ('G'/'>');
 * - larguras de linha inconsistentes;
 * - checkpoint fora de [0, cols);
 * - moeda/qblock/heart inalcancavel (sem apoio em ±2 colunas com subida
 *   <= REACH_MAX; com mola em ±3 colunas o limite sobe para REACH_SPRING).
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

  // Alcancabilidade de moedas ('o'), qblocks ('?') e hearts ('H').
  const springCols: number[] = []
  for (const line of rows) {
    for (let col = 0; col < line.length; col++) {
      if (line[col] === '^') springCols.push(col)
    }
  }

  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = rows[row][col]
      if (ch !== 'o' && ch !== '?' && ch !== 'H') continue

      const hasSpring = springCols.some((sc) => Math.abs(sc - col) <= SPRING_WINDOW_COLS)
      const limit = hasSpring ? REACH_SPRING : REACH_MAX

      let reachable = false
      for (
        let scol = Math.max(0, col - REACH_WINDOW_COLS);
        scol <= Math.min(cols - 1, col + REACH_WINDOW_COLS) && !reachable;
        scol++
      ) {
        for (let srow = 0; srow < rows.length; srow++) {
          // A propria celula do item nao conta como apoio (qblock e solido,
          // mas em cima dele nao da para coleta-lo).
          if (scol === col && srow === row) continue
          if (!STANDABLE.has(rows[srow][scol])) continue
          // Celula acima do apoio precisa estar livre para o jogador ficar de pe.
          if (srow > 0 && STANDABLE.has(rows[srow - 1][scol])) continue
          if (riseNeeded(srow, row) <= limit) {
            reachable = true
            break
          }
        }
      }

      if (!reachable) {
        throw new Error(
          `level ${def.id}: item '${ch}' inalcancavel em col ${col}, row ${row} ` +
            `(sem apoio em ±${REACH_WINDOW_COLS} colunas com subida <= ${limit}px)`,
        )
      }
    }
  }
}
