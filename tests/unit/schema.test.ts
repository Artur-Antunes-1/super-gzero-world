import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE,
  type TileType,
  type AbilityId,
  type CharacterDef,
  type LevelDef,
  type SpawnPoint,
  type ParsedLevel,
  type AbilityParams,
} from '../../src/data/schema'

describe('schema', () => {
  it('TILE_SIZE é 48', () => {
    expect(TILE_SIZE).toBe(48)
  })

  it('AbilityId aceita os 6 ids do CONTRATO', () => {
    const abilities: AbilityId[] = [
      'salto_visionario',
      'dash_criativo',
      'escudo_governanca',
      'builder',
      'emc2',
      'amplificador',
    ]
    expect(abilities).toHaveLength(6)
    expect(new Set(abilities).size).toBe(6)
  })

  it('um CharacterDef de exemplo satisfaz o tipo', () => {
    const renan: CharacterDef = {
      id: 'renan',
      name: 'Renan',
      abilityId: 'salto_visionario',
      color: '#ff0055',
      accent: '#0099ff',
      hearts: 3,
      jumpVelMul: 1.06,
      walkMul: 1.0,
      runMul: 1.0,
      weightMul: 0.96,
    }
    expect(renan.abilityId).toBe('salto_visionario')
    expect(renan.hearts).toBe(3)
  })

  it('um LevelDef de exemplo satisfaz o tipo', () => {
    const level: LevelDef = {
      id: 'world1-zona1',
      world: 1,
      zone: 1,
      rows: [
        '....G',
        'S...#',
        '#####',
      ],
    }
    expect(level.world).toBe(1)
    expect(level.rows).toHaveLength(3)
  })

  it('um ParsedLevel de exemplo satisfaz o tipo', () => {
    const spawn: SpawnPoint = { x: 0, y: 48 }
    const tiles: TileType[][] = [
      ['empty', 'goal'],
      ['ground', 'ground'],
    ]
    const parsed: ParsedLevel = {
      widthTiles: 2,
      heightTiles: 2,
      widthPx: 96,
      heightPx: 96,
      tiles,
      playerSpawn: spawn,
      goal: { x: 48, y: 0 },
      coins: [{ x: 48, y: 48 }],
      enemies: [{ x: 0, y: 0, kind: 'g' }],
    }
    expect(parsed.widthTiles).toBe(2)
    expect(parsed.tiles[1][0]).toBe('ground')
    expect(parsed.playerSpawn).toEqual({ x: 0, y: 48 })
  })

  it('AbilityParams aceita os campos canonicos do CONTRATO', () => {
    const dash: AbilityParams = {
      kind: 'dash_criativo',
      cooldown: 24,
      m1Implemented: true,
      dashSpeed: 12.0,
      dashFrames: 12,
      dashIFrames: 16,
    }
    expect(dash.kind).toBe('dash_criativo')
    expect(dash.m1Implemented).toBe(true)
    expect(dash.cooldown).toBe(24)
    const amp: AbilityParams = {
      kind: 'amplificador',
      cooldown: 0,
      m1Implemented: false,
    }
    expect(amp.m1Implemented).toBe(false)
  })
})
