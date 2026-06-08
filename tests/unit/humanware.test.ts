// tests/unit/humanware.test.ts
import { describe, it, expect } from 'vitest'
import {
  createHumanware,
  addMeter,
  tryActivate,
  updateHumanware,
  isActive,
  humanwareWorldScale,
} from '../../src/game/humanware'
import { HW_METER_MAX, HW_TIME_SCALE } from '../../src/engine/constants'

describe('createHumanware', () => {
  it('zera meter, modeTimer e cooldown', () => {
    const hw = createHumanware()
    expect(hw.meter).toBe(0)
    expect(hw.modeTimer).toBe(0)
    expect(hw.cooldown).toBe(0)
  })
})

describe('addMeter', () => {
  it('soma ganhos canonicos (moeda 8, stomp 60, heart-orb 25)', () => {
    const hw = createHumanware()
    addMeter(hw, 8)
    addMeter(hw, 60)
    addMeter(hw, 25)
    expect(hw.meter).toBe(93)
  })

  it('reparar zona (250) e lifecard (500) tambem somam', () => {
    const hw = createHumanware()
    addMeter(hw, 250)
    addMeter(hw, 500)
    expect(hw.meter).toBe(750)
  })

  it('satura em HW_METER_MAX (nunca passa de 1000)', () => {
    const hw = createHumanware()
    addMeter(hw, 900)
    addMeter(hw, 500)
    expect(hw.meter).toBe(HW_METER_MAX)
    expect(hw.meter).toBe(1000)
  })
})

describe('tryActivate', () => {
  it('ativa quando cheio e cooldown/modo livres: modeTimer=300, meter=0, retorna true', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX
    const ok = tryActivate(hw)
    expect(ok).toBe(true)
    expect(hw.modeTimer).toBe(300)
    expect(hw.meter).toBe(0)
  })

  it('nao ativa se o medidor nao esta cheio', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX - 1
    const ok = tryActivate(hw)
    expect(ok).toBe(false)
    expect(hw.modeTimer).toBe(0)
    expect(hw.meter).toBe(HW_METER_MAX - 1)
  })

  it('nao ativa enquanto o Modo ja esta ativo (modeTimer>0)', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX
    hw.modeTimer = 120
    const ok = tryActivate(hw)
    expect(ok).toBe(false)
    expect(hw.modeTimer).toBe(120)
    expect(hw.meter).toBe(HW_METER_MAX)
  })

  it('nao ativa enquanto cooldown>0, mesmo cheio', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX
    hw.cooldown = 50
    const ok = tryActivate(hw)
    expect(ok).toBe(false)
    expect(hw.modeTimer).toBe(0)
    expect(hw.meter).toBe(HW_METER_MAX)
  })
})

describe('updateHumanware', () => {
  it('decrementa modeTimer enquanto o Modo dura, sem mexer no cooldown', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX
    tryActivate(hw)
    updateHumanware(hw, 1)
    expect(hw.modeTimer).toBe(299)
    expect(hw.cooldown).toBe(0)
  })

  it('ao terminar o Modo (chega a <=0) inicia cooldown=300', () => {
    const hw = createHumanware()
    hw.modeTimer = 1
    updateHumanware(hw, 1)
    expect(hw.modeTimer).toBeLessThanOrEqual(0)
    expect(hw.cooldown).toBe(300)
  })

  it('com Modo inativo, decrementa cooldown (nao reinicia)', () => {
    const hw = createHumanware()
    hw.cooldown = 300
    updateHumanware(hw, 1)
    expect(hw.cooldown).toBe(299)
    expect(hw.modeTimer).toBe(0)
  })

  it('Modo dura exatamente 300 frames; no 300o tick termina e arma cooldown', () => {
    const hw = createHumanware()
    hw.meter = HW_METER_MAX
    tryActivate(hw)
    for (let i = 0; i < 299; i++) updateHumanware(hw, 1)
    expect(hw.modeTimer).toBe(1)
    expect(hw.cooldown).toBe(0)
    updateHumanware(hw, 1)
    expect(hw.modeTimer).toBeLessThanOrEqual(0)
    expect(hw.cooldown).toBe(300)
  })

  it('cooldown drena ao longo de 300 frames ate 0', () => {
    const hw = createHumanware()
    hw.cooldown = 300
    for (let i = 0; i < 300; i++) updateHumanware(hw, 1)
    expect(hw.cooldown).toBeLessThanOrEqual(0)
  })

  it('nao arma cooldown duas vezes na mesma transicao', () => {
    const hw = createHumanware()
    hw.modeTimer = 1
    updateHumanware(hw, 1) // termina, cooldown=300
    updateHumanware(hw, 1) // ja com modeTimer<=0: so drena cooldown
    expect(hw.cooldown).toBe(299)
  })
})

describe('isActive / humanwareWorldScale', () => {
  it('isActive reflete modeTimer>0', () => {
    const hw = createHumanware()
    expect(isActive(hw)).toBe(false)
    hw.modeTimer = 1
    expect(isActive(hw)).toBe(true)
  })

  it('worldScale = HW_TIME_SCALE (0.35) com Modo ativo, 1 fora', () => {
    const hw = createHumanware()
    expect(humanwareWorldScale(hw)).toBe(1)
    hw.modeTimer = 10
    expect(humanwareWorldScale(hw)).toBe(HW_TIME_SCALE)
    expect(humanwareWorldScale(hw)).toBe(0.35)
  })
})
