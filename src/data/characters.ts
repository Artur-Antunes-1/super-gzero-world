// src/data/characters.ts
import type { CharacterDef } from './schema'
import { COLOR_MAGENTA, COLOR_BLUE } from '../engine/constants'

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
    weightMul: 0.96, // weightMul: reserved for M1 (per-character gravity scaling); not applied in M0
  },
}
