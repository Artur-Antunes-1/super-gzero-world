// tests/unit/characters.test.ts
import { describe, it, expect } from 'vitest'
import { CHARACTERS, DEFAULT_CHARACTER_ID, ABILITY_PARAMS } from '../../src/data/characters'
import {
  COLOR_MAGENTA,
  COLOR_MAGENTA2,
  COLOR_BLUE,
  COLOR_LIME,
  COLOR_VIOLET,
  COLOR_TEXT,
} from '../../src/engine/constants'
import type { AbilityId } from '../../src/data/schema'

describe('CHARACTERS registry', () => {
  it('expoe renan como personagem default', () => {
    expect(DEFAULT_CHARACTER_ID).toBe('renan')
    expect(CHARACTERS[DEFAULT_CHARACTER_ID]).toBeDefined()
  })

  it('tem os 5 personagens selecionaveis do M1', () => {
    expect(Object.keys(CHARACTERS)).toEqual([
      'renan',
      'dante',
      'julio',
      'artur',
      'einstein',
    ])
  })

  it('renan: stats §0.4 + cores canonicas', () => {
    const c = CHARACTERS['renan']
    expect(c.id).toBe('renan')
    expect(c.name).toBe('Renan')
    expect(c.abilityId).toBe('salto_visionario')
    expect(c.abilityName).toBe('Salto Visionário')
    expect(c.abilityDesc).toBe('Pulo duplo no ar')
    expect(c.jumpVelMul).toBe(1.06)
    expect(c.walkMul).toBe(1.0)
    expect(c.runMul).toBe(1.0)
    expect(c.weightMul).toBe(0.96)
    expect(c.hearts).toBe(3)
    expect(c.color).toBe(COLOR_MAGENTA)
    expect(c.accent).toBe(COLOR_BLUE)
  })

  it('dante: stats §0.4 + cores canonicas', () => {
    const c = CHARACTERS['dante']
    expect(c.id).toBe('dante')
    expect(c.name).toBe('Dante')
    expect(c.abilityId).toBe('dash_criativo')
    expect(c.abilityName).toBe('Dash Criativo')
    expect(c.abilityDesc).toBe('Investida rápida e invencível')
    expect(c.jumpVelMul).toBe(1.0)
    expect(c.walkMul).toBe(1.06)
    expect(c.runMul).toBe(1.08)
    expect(c.weightMul).toBe(1.0)
    expect(c.hearts).toBe(3)
    expect(c.color).toBe(COLOR_BLUE)
    expect(c.accent).toBe(COLOR_LIME)
  })

  it('julio: stats §0.4 + cores canonicas', () => {
    const c = CHARACTERS['julio']
    expect(c.id).toBe('julio')
    expect(c.name).toBe('Julio')
    expect(c.abilityId).toBe('escudo_governanca')
    expect(c.abilityName).toBe('Escudo de Governança')
    expect(c.abilityDesc).toBe('Bloqueia dano enquanto durar')
    expect(c.jumpVelMul).toBe(1.0)
    expect(c.walkMul).toBe(1.0)
    expect(c.runMul).toBe(1.0)
    expect(c.weightMul).toBe(1.08)
    expect(c.hearts).toBe(4)
    expect(c.color).toBe(COLOR_VIOLET)
    expect(c.accent).toBe(COLOR_MAGENTA)
  })

  it('artur: stats §0.4 + cores canonicas', () => {
    const c = CHARACTERS['artur']
    expect(c.id).toBe('artur')
    expect(c.name).toBe('Artur')
    expect(c.abilityId).toBe('builder')
    expect(c.abilityName).toBe('Builder')
    expect(c.abilityDesc).toBe('Constrói um bloco temporário')
    expect(c.jumpVelMul).toBe(1.0)
    expect(c.walkMul).toBe(1.0)
    expect(c.runMul).toBe(1.0)
    expect(c.weightMul).toBe(1.0)
    expect(c.hearts).toBe(3)
    expect(c.color).toBe(COLOR_LIME)
    expect(c.accent).toBe(COLOR_BLUE)
  })

  it('einstein: stats §0.4 + cores canonicas', () => {
    const c = CHARACTERS['einstein']
    expect(c.id).toBe('einstein')
    expect(c.name).toBe('Einstein')
    expect(c.abilityId).toBe('emc2')
    expect(c.abilityName).toBe('E=mc²')
    expect(c.abilityDesc).toBe('Desacelera o tempo do mundo')
    expect(c.jumpVelMul).toBe(0.94)
    expect(c.walkMul).toBe(0.92)
    expect(c.runMul).toBe(1.0)
    expect(c.weightMul).toBe(1.0)
    expect(c.hearts).toBe(2)
    expect(c.color).toBe(COLOR_TEXT)
    expect(c.accent).toBe(COLOR_MAGENTA2)
  })

  it('todos os 5 tem abilityName e abilityDesc nao vazios (Fase E2)', () => {
    for (const c of Object.values(CHARACTERS)) {
      expect(c.abilityName.length).toBeGreaterThan(0)
      expect(c.abilityDesc.length).toBeGreaterThan(0)
    }
  })

  it('cada char aponta para um abilityId valido', () => {
    const ids: AbilityId[] = [
      'salto_visionario',
      'dash_criativo',
      'escudo_governanca',
      'builder',
      'emc2',
      'amplificador',
    ]
    for (const c of Object.values(CHARACTERS)) {
      expect(ids).toContain(c.abilityId)
    }
  })
})

describe('ABILITY_PARAMS', () => {
  it('tem as 6 chaves de AbilityId', () => {
    expect(Object.keys(ABILITY_PARAMS).sort()).toEqual(
      [
        'salto_visionario',
        'dash_criativo',
        'escudo_governanca',
        'builder',
        'emc2',
        'amplificador',
      ].sort(),
    )
  })

  it('salto_visionario: valores canonicos', () => {
    const p = ABILITY_PARAMS.salto_visionario
    expect(p.kind).toBe('salto_visionario')
    expect(p.cooldown).toBe(0)
    expect(p.m1Implemented).toBe(true)
    expect(p.maxAirJumps).toBe(1)
    expect(p.airJumpMul).toBe(0.92)
  })

  it('dash_criativo: valores canonicos', () => {
    const p = ABILITY_PARAMS.dash_criativo
    expect(p.kind).toBe('dash_criativo')
    expect(p.cooldown).toBe(24)
    expect(p.m1Implemented).toBe(true)
    expect(p.dashSpeed).toBe(12.0)
    expect(p.dashFrames).toBe(12)
    expect(p.dashIFrames).toBe(16)
  })

  it('escudo_governanca: valores canonicos', () => {
    const p = ABILITY_PARAMS.escudo_governanca
    expect(p.kind).toBe('escudo_governanca')
    expect(p.cooldown).toBe(240)
    expect(p.m1Implemented).toBe(true)
    expect(p.shieldStamina).toBe(180)
  })

  it('builder: valores canonicos', () => {
    const p = ABILITY_PARAMS.builder
    expect(p.kind).toBe('builder')
    expect(p.cooldown).toBe(90)
    expect(p.m1Implemented).toBe(true)
    expect(p.builderTtl).toBe(240)
  })

  it('emc2: valores canonicos', () => {
    const p = ABILITY_PARAMS.emc2
    expect(p.kind).toBe('emc2')
    expect(p.cooldown).toBe(300)
    expect(p.m1Implemented).toBe(true)
    expect(p.einsteinScale).toBe(0.25)
    expect(p.einsteinDuration).toBe(210)
  })

  it('amplificador: chave existe mas desligada no M1 (§0.9)', () => {
    const p = ABILITY_PARAMS.amplificador
    expect(p.kind).toBe('amplificador')
    expect(p.cooldown).toBe(0)
    expect(p.m1Implemented).toBe(false)
  })
})
