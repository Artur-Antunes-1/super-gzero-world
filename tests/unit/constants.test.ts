import { describe, it, expect } from 'vitest'
import {
  TILE,
  JUMP_VEL,
  HW_TIME_SCALE,
  HW_METER_MAX,
  VIEW_W,
} from '../../src/engine/constants'

describe('engine/constants', () => {
  it('TILE vale 48', () => {
    expect(TILE).toBe(48)
  })

  it('JUMP_VEL vale -15.4', () => {
    expect(JUMP_VEL).toBe(-15.4)
  })

  it('HW_TIME_SCALE vale 0.35', () => {
    expect(HW_TIME_SCALE).toBe(0.35)
  })

  it('HW_METER_MAX vale 1000', () => {
    expect(HW_METER_MAX).toBe(1000)
  })

  it('VIEW_W vale 960', () => {
    expect(VIEW_W).toBe(960)
  })
})
