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
  // Fase E2: nome legivel + descricao curta da habilidade (tela de selecao).
  abilityName: string
  abilityDesc: string
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
// 'spring' e 'mover' (2026-06-11): axis/amplitude/speed so para 'mover'
// (amplitude em TILES, speed em px/frame); sobrescrevem defaults do '~'.
export interface EntitySpawn {
  type: 'fool' | 'block' | 'heart' | 'spring' | 'mover'
  col: number
  row: number
  patrol?: [number, number]
  payload?: 'coin' | 'item' | 'star'
  axis?: 'x' | 'y'
  amplitude?: number
  speed?: number
}

export interface LevelDef {
  id: string
  world: number
  zone: number
  rows: string[]
  entities?: EntitySpawn[]
  checkpoints?: number[]
  timeStart?: number
  // Id da proxima fase (progressao); ausente = fim do fluxo.
  next?: string
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
  // 2026-06-11: '^' = MOLA (tile empty); '~' = plataforma movel (tile empty).
  springs: { col: number; row: number }[]
  movers: { col: number; row: number; axis: 'x' | 'y'; amplitude: number; speed: number }[]
  // Copiado de LevelDef.next (progressao por fase).
  next?: string
}
