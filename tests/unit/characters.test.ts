// tests/unit/characters.test.ts
import { describe, it, expect } from 'vitest'
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../../src/data/characters'
import { COLOR_MAGENTA, COLOR_BLUE } from '../../src/engine/constants'

describe('CHARACTERS registry', () => {
  it('expoe renan como personagem default', () => {
    expect(DEFAULT_CHARACTER_ID).toBe('renan')
    expect(CHARACTERS[DEFAULT_CHARACTER_ID]).toBeDefined()
  })

  it('renan tem os stats canonicos da §0.4', () => {
    const renan = CHARACTERS['renan']
    expect(renan.id).toBe('renan')
    expect(renan.name).toBe('Renan')
    expect(renan.abilityId).toBe('salto_visionario')
    expect(renan.hearts).toBe(3)
    expect(renan.jumpVelMul).toBe(1.06)
    expect(renan.walkMul).toBe(1.0)
    expect(renan.runMul).toBe(1.0)
    expect(renan.weightMul).toBe(0.96)
    expect(renan.color).toBe(COLOR_MAGENTA)
    expect(renan.accent).toBe(COLOR_BLUE)
  })

  it('no M0 implementa apenas renan', () => {
    expect(Object.keys(CHARACTERS)).toEqual(['renan'])
  })
})
