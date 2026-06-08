// src/game/humanware.ts
import { HW_TIME_SCALE, HW_METER_MAX } from '../engine/constants'

/**
 * Estado do medidor Humanware e do "Modo".
 * - meter: carga atual (0..HW_METER_MAX). Cheio em 1000 (= 4 seg de 250).
 * - modeTimer: frames restantes do Modo ativo (>0 enquanto ativo).
 * - cooldown: frames restantes ate poder ativar de novo (armado ao fim do Modo).
 * Estilo: funcoes puras que MUTAM o HumanwareState recebido (sem retornar novo objeto),
 * exceto tryActivate (boolean) e os getters isActive/humanwareWorldScale.
 */
export interface HumanwareState {
  meter: number
  modeTimer: number
  cooldown: number
}

const HW_MODE_FRAMES = 300
const HW_COOLDOWN_FRAMES = 300

/** Cria um estado zerado: {0,0,0}. */
export function createHumanware(): HumanwareState {
  return { meter: 0, modeTimer: 0, cooldown: 0 }
}

/**
 * Adiciona n ao medidor, saturando em HW_METER_MAX.
 * Ganhos canonicos (chamados por outras tarefas): moeda=8, stomp=60,
 * reparar zona=250, lifecard=500, heart-orb=25.
 */
export function addMeter(hw: HumanwareState, n: number): void {
  hw.meter = Math.min(HW_METER_MAX, hw.meter + n)
}

/**
 * Tenta ativar o Modo. So ativa com o medidor CHEIO, sem cooldown e sem Modo ja ativo.
 * Em sucesso: modeTimer=300, meter=0, retorna true. Caso contrario nao muda nada e retorna false.
 */
export function tryActivate(hw: HumanwareState): boolean {
  if (hw.meter >= HW_METER_MAX && hw.cooldown <= 0 && hw.modeTimer <= 0) {
    hw.modeTimer = HW_MODE_FRAMES
    hw.meter = 0
    return true
  }
  return false
}

/**
 * Avanca os timers em dt frames.
 * - Se o Modo esta ativo: decrementa modeTimer; se cruzar para <=0 NESTA chamada, arma cooldown=300.
 * - Senao, se ha cooldown: decrementa cooldown (sem rearmar).
 * Garante que o cooldown e armado uma unica vez na transicao (modeTimer>0 -> <=0).
 */
export function updateHumanware(hw: HumanwareState, dt: number): void {
  if (hw.modeTimer > 0) {
    hw.modeTimer -= dt
    if (hw.modeTimer <= 0) {
      hw.cooldown = HW_COOLDOWN_FRAMES
    }
  } else if (hw.cooldown > 0) {
    hw.cooldown -= dt
  }
}

/** true enquanto o Modo esta ativo (modeTimer>0). */
export function isActive(hw: HumanwareState): boolean {
  return hw.modeTimer > 0
}

/** Escala de tempo do MUNDO: HW_TIME_SCALE (0.35) com Modo ativo, 1 fora. */
export function humanwareWorldScale(hw: HumanwareState): number {
  return isActive(hw) ? HW_TIME_SCALE : 1
}
