import type { LevelDef, ParsedLevel } from '../schema'
import { parseLevel } from '../../game/levelParser'
import { W1_1 } from './w1-1'
import { world1Zona1 } from './world1-zona1'
import { hwTest } from './hw-test'

// Registry canonico de fases (CONTRATO C3a).
export const LEVELS: Record<string, LevelDef> = {
  'w1-1': W1_1,
  zona1: world1Zona1,
  // Fase de TESTE (gate e2e do Humanware) — fora do fluxo normal do jogo.
  'hw-test': hwTest,
}

export const DEFAULT_LEVEL_ID = 'w1-1'

// Re-parseia FRESCO a cada chamada (sem cache — estado mutavel por sessao).
// Id desconhecido -> DEFAULT_LEVEL_ID.
export function parseLevelById(id: string): ParsedLevel {
  const def = LEVELS[id] ?? LEVELS[DEFAULT_LEVEL_ID]
  return parseLevel(def)
}
