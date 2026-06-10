export const TILE_SIZE = 48

export type TileType =
  | 'empty'
  | 'ground'
  | 'brick'
  | 'platform'
  | 'block'
  | 'spike'
  | 'goal'

export type AbilityId =
  | 'salto_visionario'
  | 'dash_criativo'
  | 'escudo_governanca'
  | 'builder'
  | 'emc2'
  | 'amplificador'

export interface AbilityParams {
  kind: AbilityId
  cooldown: number
  m1Implemented: boolean
  maxAirJumps?: number
  airJumpMul?: number
  dashSpeed?: number
  dashFrames?: number
  dashIFrames?: number
  shieldStamina?: number
  builderTtl?: number
  einsteinScale?: number
  einsteinDuration?: number
}

export interface CharacterDef {
  id: string
  name: string
  abilityId: AbilityId
  color: string
  accent: string
  hearts: number
  jumpVelMul: number
  walkMul: number
  runMul: number
  weightMul: number
}

// Spawn declarativo de entidade (CONTRATO C3a): col/row em tiles.
// patrol em colunas (convertido p/ px no spawn); payload so para 'block'.
export interface EntitySpawn {
  type: 'fool' | 'block' | 'heart'
  col: number
  row: number
  patrol?: [number, number]
  payload?: 'coin' | 'item' | 'star'
}

export interface LevelDef {
  id: string
  world: number
  zone: number
  rows: string[]
  entities?: EntitySpawn[]
  checkpoints?: number[]
  timeStart?: number
}

export interface SpawnPoint {
  x: number
  y: number
}

export interface ParsedLevel {
  widthTiles: number
  heightTiles: number
  widthPx: number
  heightPx: number
  tiles: TileType[][]
  playerSpawn: SpawnPoint
  goal: SpawnPoint
  coins: SpawnPoint[]
  enemies: Array<{ x: number; y: number; kind: string }>
  // CONTRATO C3a: camadas novas (col/row em tiles).
  qBlocks: { col: number; row: number; payload: 'coin' | 'item' | 'star' }[]
  hearts: { col: number; row: number }[]
  checkpoints: number[]
  timeStart: number
  foolSpawns: { col: number; row: number; patrol?: [number, number] }[]
}
