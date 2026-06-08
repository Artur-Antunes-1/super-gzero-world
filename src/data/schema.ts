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

export interface LevelDef {
  id: string
  world: number
  zone: number
  rows: string[]
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
}
