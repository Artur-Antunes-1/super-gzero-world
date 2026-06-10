// src/game/ability.ts
// DONO do sistema de habilidades (M1). Cria AbilityState + 5 habilidades + helpers.
// dt = frames (E1). updateAbility e chamado APOS updatePlayer, sempre no tempo do PLAYER (escala 1).
// E3: `void ctx` satisfaz noUnusedParameters — ctx e exposto para uso futuro pelo game.
import type { Player } from './player'
import type { Enemy } from './enemy'
import { ABILITY_PARAMS } from '../data/characters'
import type { CharacterDef, AbilityId, ParsedLevel } from '../data/schema'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/render'
import { JUMP_VEL, TILE, COLOR_BLUE, COLOR_LIME, COLOR_TEXT } from '../engine/constants'

export interface AbilityState {
  id: AbilityId
  cooldown: number
  active: boolean
  timer: number
  airJumps: number
  shield: boolean
  shieldTimer: number
  builder: { col: number; row: number; ttl: number } | null
  einsteinTimer: number
}

export function createAbilityState(char: CharacterDef): AbilityState {
  return {
    id: char.abilityId,
    cooldown: 0,
    active: false,
    timer: 0,
    airJumps: 0,
    shield: false,
    shieldTimer: 0,
    builder: null,
    einsteinTimer: 0,
  }
}

export interface AbilityCtx {
  level: ParsedLevel
  enemies: Enemy[]
}

// emc2 ativo (einsteinTimer>0) => escala einsteinScale(0.25); senao 1. (§0.6: o game faz Math.min.)
export function abilityWorldScale(player: Player): number {
  const p = ABILITY_PARAMS[player.ability.id]
  return player.ability.einsteinTimer > 0 ? (p.einsteinScale ?? 1) : 1
}

export function abilityHasShield(player: Player): boolean {
  return player.ability.shield && player.ability.shieldTimer > 0
}

export function abilityConsumeShield(player: Player): void {
  player.ability.shield = false
  player.ability.shieldTimer = 0
}

// (A2) abilityIFramesOnHit removido: sem consumidores — o dash concede i-frames
// diretamente via player.iframes na ativacao (dashIFrames).

// Dash ativo mata tolo por contato (consumido pelo game).
export function abilityKillsEnemy(player: Player): boolean {
  return player.ability.id === 'dash_criativo' && player.ability.active && player.ability.timer > 0
}

// Bloco temporario solido atual do builder (ou null). O game escreve/restaura level.tiles.
export function abilityBuilderTile(player: Player): { col: number; row: number } | null {
  const b = player.ability.builder
  return b ? { col: b.col, row: b.row } : null
}

// Decrementa timers comuns (cooldown/shield/einstein/builder.ttl) sem ir abaixo de 0.
function tickTimers(s: AbilityState, dt: number): void {
  if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt)
  if (s.shieldTimer > 0) {
    s.shieldTimer = Math.max(0, s.shieldTimer - dt)
    if (s.shieldTimer <= 0) s.shield = false
  }
  if (s.einsteinTimer > 0) s.einsteinTimer = Math.max(0, s.einsteinTimer - dt)
  if (s.builder) {
    s.builder.ttl -= dt
    if (s.builder.ttl <= 0) s.builder = null
  }
}

export function updateAbility(player: Player, input: Input, dt: number, ctx: AbilityCtx): void {
  const s = player.ability

  // Pulo duplo: airJumps zera ao tocar o chao.
  if (player.onGround) s.airJumps = 0

  // Tick general timers first (decrement cooldown, shieldTimer, einsteinTimer, builder.ttl).
  tickTimers(s, dt)

  // Dash em andamento: mantem vx e decrementa dash timer AFTER general tick.
  // Cooldown is set when dash ends; this happens AFTER tickTimers so cooldown is not decremented
  // in the same frame it is armed.
  if (s.id === 'dash_criativo' && s.active && s.timer > 0) {
    const p = ABILITY_PARAMS.dash_criativo
    player.vx = player.facing * (p.dashSpeed ?? 0)
    s.timer -= dt
    if (s.timer <= 0) { s.active = false; s.timer = 0; s.cooldown = p.cooldown }
  }

  const params = ABILITY_PARAMS[s.id]
  if (!params.m1Implemented) return // amplificador: no-op no M1
  if (!input.pressed('ability') || s.cooldown > 0) return
  if (s.active) return // dash ja ativo nao reinicia

  switch (s.id) {
    case 'salto_visionario': {
      if (!player.onGround && s.airJumps < (params.maxAirJumps ?? 0)) {
        player.vy = JUMP_VEL * player.char.jumpVelMul * (params.airJumpMul ?? 1)
        s.airJumps += 1
      }
      break
    }
    case 'dash_criativo': {
      s.active = true
      s.timer = params.dashFrames ?? 0
      player.vx = player.facing * (params.dashSpeed ?? 0)
      const p = ABILITY_PARAMS.dash_criativo
      player.iframes = Math.max(player.iframes ?? 0, p.dashIFrames ?? 0)
      break
    }
    case 'escudo_governanca': {
      s.shield = true
      s.shieldTimer = params.shieldStamina ?? 0
      s.cooldown = params.cooldown
      break
    }
    case 'builder': {
      const rawCol = player.facing === 1
        ? Math.floor((player.x + player.w) / TILE)
        : Math.floor(player.x / TILE) - 1
      const col = Math.max(0, Math.min(rawCol, ctx.level.widthTiles - 1))
      const row = Math.max(0, Math.min(Math.floor((player.y + player.h - 1) / TILE), ctx.level.heightTiles - 1))
      s.builder = { col, row, ttl: params.builderTtl ?? 0 }
      s.cooldown = params.cooldown
      break
    }
    case 'emc2': {
      s.einsteinTimer = params.einsteinDuration ?? 0
      s.cooldown = params.cooldown
      break
    }
  }
}

// FX em ESPACO DE MUNDO (chamado pelo game dentro de beginWorld/endWorld).
// Aura do escudo (contorno azul ao redor do player) + bloco do builder (lime) + marca emc2 (text).
export function drawAbilityFx(r: Renderer, player: Player): void {
  const s = player.ability
  if (abilityHasShield(player)) {
    const pad = 4
    // contorno: 4 barras finas ao redor da AABB do player
    r.drawRect(player.x - pad, player.y - pad, player.w + pad * 2, 2, COLOR_BLUE)
    r.drawRect(player.x - pad, player.y + player.h + pad - 2, player.w + pad * 2, 2, COLOR_BLUE)
    r.drawRect(player.x - pad, player.y - pad, 2, player.h + pad * 2, COLOR_BLUE)
    r.drawRect(player.x + player.w + pad - 2, player.y - pad, 2, player.h + pad * 2, COLOR_BLUE)
  }
  if (s.builder) {
    r.drawRect(s.builder.col * TILE, s.builder.row * TILE, TILE, TILE, COLOR_LIME)
  }
  if (s.einsteinTimer > 0) {
    // marca leve do emc2: faixa no topo do player
    r.drawRect(player.x, player.y - 4, player.w, 2, COLOR_TEXT)
  }
}
