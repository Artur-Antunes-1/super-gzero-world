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
  type EntitySpawn,
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

  it('um CharacterDef de exemplo satisfaz o tipo (com abilityName/abilityDesc)', () => {
    const renan: CharacterDef = {
      id: 'renan',
      name: 'Renan',
      abilityId: 'salto_visionario',
      abilityName: 'Salto Visionário',
      abilityDesc: 'Pulo duplo no ar',
      color: '#ff0055',
      accent: '#0099ff',
      hearts: 3,
      jumpVelMul: 1.06,
      walkMul: 1.0,
      runMul: 1.0,
      weightMul: 0.96,
    }
    expect(renan.abilityId).toBe('salto_visionario')
    expect(renan.abilityName).toBe('Salto Visionário')
    expect(renan.abilityDesc).toBe('Pulo duplo no ar')
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

  // --- 2026-06-11: mola, plataforma movel e progressao por next ---

  it('EntitySpawn aceita type "spring" e "mover" com axis/amplitude/speed', () => {
    const spring: EntitySpawn = { type: 'spring', col: 5, row: 8 }
    const mover: EntitySpawn = {
      type: 'mover',
      col: 10,
      row: 6,
      axis: 'y',
      amplitude: 2, // em TILES
      speed: 0.8, // px/frame
    }
    expect(spring.type).toBe('spring')
    expect(mover.type).toBe('mover')
    expect(mover.axis).toBe('y')
    expect(mover.amplitude).toBe(2)
    expect(mover.speed).toBe(0.8)
  })

  it('LevelDef aceita next (id da proxima fase) opcional', () => {
    const level: LevelDef = {
      id: 'a',
      world: 1,
      zone: 1,
      rows: ['S.G', '###'],
      next: 'b',
    }
    expect(level.next).toBe('b')
    const semNext: LevelDef = { id: 'b', world: 1, zone: 2, rows: ['S.G', '###'] }
    expect(semNext.next).toBeUndefined()
  })

  it('ParsedLevel aceita springs, movers e next', () => {
    const parsed: ParsedLevel = {
      widthTiles: 2,
      heightTiles: 2,
      widthPx: 96,
      heightPx: 96,
      tiles: [
        ['empty', 'empty'],
        ['ground', 'ground'],
      ],
      playerSpawn: { x: 0, y: 0 },
      goal: { x: 48, y: 0 },
      coins: [],
      enemies: [],
      qBlocks: [],
      hearts: [],
      checkpoints: [],
      timeStart: 250,
      foolSpawns: [],
      springs: [{ col: 1, row: 0 }],
      movers: [{ col: 0, row: 0, axis: 'x', amplitude: 3, speed: 1.2 }],
      next: 'zona1',
    }
    expect(parsed.springs).toEqual([{ col: 1, row: 0 }])
    expect(parsed.movers[0].axis).toBe('x')
    expect(parsed.next).toBe('zona1')
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
