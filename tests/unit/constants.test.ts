import { describe, it, expect } from 'vitest'
import {
  TILE,
  JUMP_VEL,
  JUMP_CUT_VY,
  SPRING_VEL,
  HW_TIME_SCALE,
  HW_METER_MAX,
  VIEW_W,
  PLAYER_W,
  PLAYER_H,
} from '../../src/engine/constants'

describe('engine/constants', () => {
  it('TILE vale 48', () => {
    expect(TILE).toBe(48)
  })

  // Errata de fisica (2026-06-11, playtest): -15.4 -> -18.0.
  it('JUMP_VEL vale -18.0', () => {
    expect(JUMP_VEL).toBe(-18.0)
  })

  it('JUMP_CUT_VY vale -6 (pulo variavel)', () => {
    expect(JUMP_CUT_VY).toBe(-6)
  })

  it('SPRING_VEL vale -22 (mola ~6 tiles)', () => {
    expect(SPRING_VEL).toBe(-22)
  })

  // Hitbox honesta (pos-playtest 2026-06-11): 1,22x do corpo visual de 78px
  // (antes 34x42 = 1,86x).
  it('PLAYER_W vale 38 (hitbox honesta)', () => {
    expect(PLAYER_W).toBe(38)
  })

  it('PLAYER_H vale 64 e e MAIOR que TILE (vaos de 1 tile nao sao passaveis)', () => {
    expect(PLAYER_H).toBe(64)
    expect(PLAYER_H).toBeGreaterThan(TILE)
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
