// src/data/characters.ts
import type { CharacterDef, AbilityId, AbilityParams } from './schema'
import {
  COLOR_MAGENTA,
  COLOR_MAGENTA2,
  COLOR_BLUE,
  COLOR_LIME,
  COLOR_VIOLET,
  COLOR_TEXT,
} from '../engine/constants'

export const DEFAULT_CHARACTER_ID = 'renan'

export const CHARACTERS: Record<string, CharacterDef> = {
  renan: {
    id: 'renan',
    name: 'Renan',
    abilityId: 'salto_visionario',
    color: COLOR_MAGENTA,
    accent: COLOR_BLUE,
    hearts: 3,
    jumpVelMul: 1.06,
    walkMul: 1.0,
    runMul: 1.0,
    weightMul: 0.96,
  },
  dante: {
    id: 'dante',
    name: 'Dante',
    abilityId: 'dash_criativo',
    color: COLOR_BLUE,
    accent: COLOR_LIME,
    hearts: 3,
    jumpVelMul: 1.0,
    walkMul: 1.06,
    runMul: 1.08,
    weightMul: 1.0,
  },
  julio: {
    id: 'julio',
    name: 'Julio',
    abilityId: 'escudo_governanca',
    color: COLOR_VIOLET,
    accent: COLOR_MAGENTA,
    hearts: 4,
    jumpVelMul: 1.0,
    walkMul: 1.0,
    runMul: 1.0,
    weightMul: 1.08,
  },
  artur: {
    id: 'artur',
    name: 'Artur',
    abilityId: 'builder',
    color: COLOR_LIME,
    accent: COLOR_BLUE,
    hearts: 3,
    jumpVelMul: 1.0,
    walkMul: 1.0,
    runMul: 1.0,
    weightMul: 1.0,
  },
  einstein: {
    id: 'einstein',
    name: 'Einstein',
    abilityId: 'emc2',
    color: COLOR_TEXT,
    accent: COLOR_MAGENTA2,
    hearts: 2,
    jumpVelMul: 0.94,
    walkMul: 0.92,
    runMul: 1.0,
    weightMul: 1.0,
  },
}

// Parametros canonicos das habilidades (CONTRATO M1). amplificador = M3+, desligado (§0.9).
export const ABILITY_PARAMS: Record<AbilityId, AbilityParams> = {
  salto_visionario: {
    kind: 'salto_visionario',
    cooldown: 0,
    m1Implemented: true,
    maxAirJumps: 1,
    airJumpMul: 0.92,
  },
  dash_criativo: {
    kind: 'dash_criativo',
    cooldown: 24,
    m1Implemented: true,
    dashSpeed: 12.0,
    dashFrames: 12,
    dashIFrames: 16,
  },
  escudo_governanca: {
    kind: 'escudo_governanca',
    cooldown: 240,
    m1Implemented: true,
    shieldStamina: 180,
  },
  builder: {
    kind: 'builder',
    cooldown: 90,
    m1Implemented: true,
    builderTtl: 240,
  },
  emc2: {
    kind: 'emc2',
    cooldown: 300,
    m1Implemented: true,
    einsteinScale: 0.25,
    einsteinDuration: 210,
  },
  amplificador: {
    kind: 'amplificador',
    cooldown: 0,
    m1Implemented: false,
  },
}
