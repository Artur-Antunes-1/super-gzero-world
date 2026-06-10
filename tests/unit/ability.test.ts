// tests/unit/ability.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createAbilityState,
  updateAbility,
  abilityWorldScale,
  abilityHasShield,
  abilityConsumeShield,
  abilityKillsEnemy,
  abilityBuilderTile,
  drawAbilityFx,
  type AbilityState,
  type AbilityCtx,
} from '../../src/game/ability'
import type { Player } from '../../src/game/player'
import type { Enemy } from '../../src/game/enemy'
import type { CharacterDef, AbilityId, ParsedLevel, TileType } from '../../src/data/schema'
import type { Input, InputAction } from '../../src/engine/input'
import type { Renderer } from '../../src/engine/render'
import { JUMP_VEL, TILE } from '../../src/engine/constants'
import { ABILITY_PARAMS } from '../../src/data/characters'

// FakeInput canonico (mesmo padrao de player.test.ts): pressed = edge desde o ultimo update().
class FakeInput implements Input {
  private down = new Set<InputAction>()
  private prev = new Set<InputAction>()
  set(a: InputAction, v: boolean): void { if (v) this.down.add(a); else this.down.delete(a) }
  isDown(a: InputAction): boolean { return this.down.has(a) }
  pressed(a: InputAction): boolean { return this.down.has(a) && !this.prev.has(a) }
  update(): void { this.prev = new Set(this.down) }
  attach(): void {}
}

// Char minimo por habilidade.
function makeChar(abilityId: AbilityId): CharacterDef {
  return {
    id: abilityId, name: abilityId, abilityId,
    color: '#ffffff', accent: '#000000',
    hearts: 3, jumpVelMul: 1, walkMul: 1, runMul: 1, weightMul: 1,
  }
}

// Player-like: cobre Body + campos M1 (iframes, ability) usados pela ability.ts.
function makePlayer(abilityId: AbilityId): Player {
  const char = makeChar(abilityId)
  return {
    x: 100, y: 100, w: 34, h: 42, vx: 0, vy: 0, onGround: true,
    char, facing: 1, coyote: 0, jumpBuffer: 0, lives: 3, hearts: char.hearts,
    iframes: 0, ability: createAbilityState(char),
  } as unknown as Player
}

// Enemy-like minimo (Body + campos de enemy.ts).
function makeEnemy(x: number, y: number): Enemy {
  return {
    x, y, w: 38, h: 34, vx: 0, vy: 0, onGround: true,
    kind: 'tolo', dir: -1, alive: true, frozen: false,
  } as unknown as Enemy
}

// Level plano 40x11, chao nas rows 9-10 (igual canone world1-zona1).
function makeLevel(): ParsedLevel {
  const widthTiles = 40, heightTiles = 11
  const tiles: TileType[][] = Array.from({ length: heightTiles }, (_, r) =>
    Array.from({ length: widthTiles }, () => (r >= 9 ? 'ground' : 'empty') as TileType))
  return {
    widthTiles, heightTiles, widthPx: widthTiles * TILE, heightPx: heightTiles * TILE,
    tiles, playerSpawn: { x: 2 * TILE, y: 8 * TILE }, goal: { x: 36 * TILE, y: 8 * TILE },
    coins: [], enemies: [],
  }
}

function makeCtx(level: ParsedLevel, enemies: Enemy[]): AbilityCtx { return { level, enemies } }

// Renderer fake que apenas conta drawRect.
function makeRenderer(): { r: Renderer; rects: number } {
  const state = { rects: 0 }
  const r: Renderer = {
    ctx: {} as CanvasRenderingContext2D,
    clear() {}, beginWorld() {}, endWorld() {}, present() {},
    drawRect() { state.rects++ },
  }
  return { r, get rects() { return state.rects } } as unknown as { r: Renderer; rects: number }
}

// --- tests ---

describe('createAbilityState', () => {
  it('zera todos os campos e usa char.abilityId', () => {
    const s = createAbilityState(makeChar('dash_criativo'))
    expect(s.id).toBe('dash_criativo')
    expect(s.cooldown).toBe(0)
    expect(s.active).toBe(false)
    expect(s.timer).toBe(0)
    expect(s.airJumps).toBe(0)
    expect(s.shield).toBe(false)
    expect(s.shieldTimer).toBe(0)
    expect(s.builder).toBeNull()
    expect(s.einsteinTimer).toBe(0)
  })
})

describe('updateAbility — salto_visionario', () => {
  let input: FakeInput, level: ParsedLevel, ctx: AbilityCtx
  beforeEach(() => { input = new FakeInput(); level = makeLevel(); ctx = makeCtx(level, []) })

  it('no AR concede 1 pulo extra (vy=JUMP_VEL*jumpVelMul*airJumpMul) e incrementa airJumps', () => {
    const p = makePlayer('salto_visionario')
    p.onGround = false; p.vy = 2 // caindo
    input.set('ability', true)
    updateAbility(p, input, 1, ctx); input.update()
    const expected = JUMP_VEL * p.char.jumpVelMul * (ABILITY_PARAMS.salto_visionario.airJumpMul ?? 1)
    expect(p.vy).toBeCloseTo(expected, 5)
    expect(p.ability.airJumps).toBe(1)
  })

  it('nao concede um segundo pulo extra alem de maxAirJumps', () => {
    const p = makePlayer('salto_visionario')
    p.onGround = false
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    const vyApos1 = p.vy
    // segundo aperto de ability ainda no ar: airJumps ja == maxAirJumps(1) -> sem mudanca de vy
    input.set('ability', false); input.update()
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    expect(p.ability.airJumps).toBe(1)
    expect(p.vy).toBe(vyApos1) // updateAbility nao integra fisica; vy inalterado
  })

  it('airJumps reseta para 0 quando onGround', () => {
    const p = makePlayer('salto_visionario')
    p.ability.airJumps = 1; p.onGround = true
    updateAbility(p, input, 1, ctx)
    expect(p.ability.airJumps).toBe(0)
  })

  it('no chao a habilidade nao dispara pulo extra', () => {
    const p = makePlayer('salto_visionario'); p.onGround = true; p.vy = 0
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(p.vy).toBe(0); expect(p.ability.airJumps).toBe(0)
  })
})

describe('updateAbility — dash_criativo', () => {
  let input: FakeInput, level: ParsedLevel, ctx: AbilityCtx
  beforeEach(() => { input = new FakeInput(); level = makeLevel(); ctx = makeCtx(level, []) })

  it('ativa: vx=facing*dashSpeed, active=true, timer=dashFrames, e concede i-frames/kill', () => {
    const p = makePlayer('dash_criativo'); p.facing = 1
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    expect(p.vx).toBeCloseTo(ABILITY_PARAMS.dash_criativo.dashSpeed ?? 0, 5)
    expect(p.ability.active).toBe(true)
    expect(p.ability.timer).toBeGreaterThan(0)
    // i-frames concedidos diretamente em player.iframes (abilityIFramesOnHit removido — A2)
    expect(p.iframes).toBeGreaterThan(0)
    expect(abilityKillsEnemy(p)).toBe(true)
  })

  it('respeita facing=-1 (vx negativo)', () => {
    const p = makePlayer('dash_criativo'); p.facing = -1
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(p.vx).toBeCloseTo(-(ABILITY_PARAMS.dash_criativo.dashSpeed ?? 0), 5)
  })

  it('ao terminar dashFrames: active=false e cooldown=24; depois kill fica false', () => {
    const p = makePlayer('dash_criativo')
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    input.set('ability', false)
    // gasta dashFrames frames adicionais
    const frames = ABILITY_PARAMS.dash_criativo.dashFrames ?? 0
    for (let i = 0; i < frames; i++) { updateAbility(p, input, 1, ctx); input.update() }
    expect(p.ability.active).toBe(false)
    expect(p.ability.cooldown).toBe(ABILITY_PARAMS.dash_criativo.cooldown)
    expect(abilityKillsEnemy(p)).toBe(false)
  })

  it('mantem vx durante o dash (nao reinicia ao soltar a tecla)', () => {
    const p = makePlayer('dash_criativo'); p.facing = 1
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    input.set('ability', false); p.vx = 0 // simula deceleracao externa
    updateAbility(p, input, 1, ctx)
    expect(p.vx).toBeCloseTo(ABILITY_PARAMS.dash_criativo.dashSpeed ?? 0, 5) // dash reescreve vx
  })

  it('apos ativar dash, player.iframes >= dashIFrames(16)', () => {
    const p = makePlayer('dash_criativo'); p.iframes = 0
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(p.iframes).toBeGreaterThanOrEqual(ABILITY_PARAMS.dash_criativo.dashIFrames ?? 0)
    expect(p.iframes).toBe(16)
  })

  it('dashIFrames nao reduz iframes ja maiores que dashIFrames', () => {
    const p = makePlayer('dash_criativo'); p.iframes = 100
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(p.iframes).toBe(100)
  })
})

describe('updateAbility — escudo_governanca', () => {
  let input: FakeInput, ctx: AbilityCtx
  beforeEach(() => { input = new FakeInput(); ctx = makeCtx(makeLevel(), []) })

  it('ativa shield + shieldTimer=180 + cooldown=240', () => {
    const p = makePlayer('escudo_governanca')
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(abilityHasShield(p)).toBe(true)
    expect(p.ability.shieldTimer).toBe(ABILITY_PARAMS.escudo_governanca.shieldStamina)
    expect(p.ability.cooldown).toBe(ABILITY_PARAMS.escudo_governanca.cooldown)
  })

  it('abilityConsumeShield desliga o escudo (absorve 1 hit)', () => {
    const p = makePlayer('escudo_governanca')
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(abilityHasShield(p)).toBe(true)
    abilityConsumeShield(p)
    expect(abilityHasShield(p)).toBe(false)
    expect(p.ability.shield).toBe(false)
    expect(p.ability.shieldTimer).toBe(0)
  })

  it('shield expira por tempo (shieldTimer -> 0 desliga shield)', () => {
    const p = makePlayer('escudo_governanca')
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    input.set('ability', false)
    const ticks = (ABILITY_PARAMS.escudo_governanca.shieldStamina ?? 0)
    for (let i = 0; i < ticks; i++) { updateAbility(p, input, 1, ctx); input.update() }
    expect(abilityHasShield(p)).toBe(false)
  })
})

describe('updateAbility — builder', () => {
  let input: FakeInput, level: ParsedLevel, ctx: AbilityCtx
  beforeEach(() => { input = new FakeInput(); level = makeLevel(); ctx = makeCtx(level, []) })

  it('cria bloco na celula a FRENTE (facing=1) na linha dos pes + cooldown=90', () => {
    const p = makePlayer('builder'); p.facing = 1
    p.x = 5 * TILE; p.y = 7 * TILE // pes em (7*48 + 41) -> row 7
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    const tile = abilityBuilderTile(p)
    expect(tile).not.toBeNull()
    const expectedCol = Math.floor((p.x + p.w) / TILE)
    const expectedRow = Math.floor((p.y + p.h - 1) / TILE)
    expect(tile!.col).toBe(expectedCol)
    expect(tile!.row).toBe(expectedRow)
    expect(p.ability.cooldown).toBe(ABILITY_PARAMS.builder.cooldown)
  })

  it('facing=-1 cria bloco na celula a esquerda', () => {
    const p = makePlayer('builder'); p.facing = -1; p.x = 5 * TILE; p.y = 7 * TILE
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    const tile = abilityBuilderTile(p)!
    expect(tile.col).toBe(Math.floor(p.x / TILE) - 1)
  })

  it('borda esquerda (x=0, facing=-1): col clampado para >=0', () => {
    const p = makePlayer('builder'); p.facing = -1; p.x = 0; p.y = 7 * TILE
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    const tile = abilityBuilderTile(p)!
    expect(tile.col).toBeGreaterThanOrEqual(0)
  })

  it('borda direita (facing=1, x proximo ao limite): col clampado para <=widthTiles-1', () => {
    const p = makePlayer('builder'); p.facing = 1
    // posiciona o player perto da borda direita do level (40 tiles)
    p.x = (level.widthTiles - 1) * TILE; p.y = 7 * TILE
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    const tile = abilityBuilderTile(p)!
    expect(tile.col).toBeLessThanOrEqual(level.widthTiles - 1)
  })

  it('o bloco EXPIRA quando ttl<=0 (builder volta a null)', () => {
    const p = makePlayer('builder'); p.x = 5 * TILE; p.y = 7 * TILE
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    input.set('ability', false)
    const ttl = ABILITY_PARAMS.builder.builderTtl ?? 0
    for (let i = 0; i < ttl; i++) { updateAbility(p, input, 1, ctx); input.update() }
    expect(abilityBuilderTile(p)).toBeNull()
  })
})

describe('updateAbility — emc2 / abilityWorldScale', () => {
  let input: FakeInput, ctx: AbilityCtx
  beforeEach(() => { input = new FakeInput(); ctx = makeCtx(makeLevel(), []) })

  it('inativo: worldScale=1', () => {
    const p = makePlayer('emc2')
    expect(abilityWorldScale(p)).toBe(1)
  })

  it('ativa: einsteinTimer=210, cooldown=300 e worldScale=0.25', () => {
    const p = makePlayer('emc2')
    input.set('ability', true); updateAbility(p, input, 1, ctx)
    expect(p.ability.einsteinTimer).toBe(ABILITY_PARAMS.emc2.einsteinDuration)
    expect(p.ability.cooldown).toBe(ABILITY_PARAMS.emc2.cooldown)
    expect(abilityWorldScale(p)).toBeCloseTo(ABILITY_PARAMS.emc2.einsteinScale ?? 1, 5)
  })

  it('apos einsteinDuration frames volta a worldScale=1', () => {
    const p = makePlayer('emc2')
    input.set('ability', true); updateAbility(p, input, 1, ctx); input.update()
    input.set('ability', false)
    const dur = ABILITY_PARAMS.emc2.einsteinDuration ?? 0
    for (let i = 0; i < dur; i++) { updateAbility(p, input, 1, ctx); input.update() }
    expect(abilityWorldScale(p)).toBe(1)
  })
})

describe('updateAbility — amplificador (M3, desligado)', () => {
  it('e no-op: nada muda no estado', () => {
    const p = makePlayer('amplificador')
    const input = new FakeInput(); input.set('ability', true)
    const before = JSON.stringify(p.ability)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    expect(JSON.stringify(p.ability)).toBe(before)
  })
})

describe('drawAbilityFx', () => {
  it('com escudo ativo, desenha exatamente 4 retangulos (aura de contorno)', () => {
    const p = makePlayer('escudo_governanca')
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    const m = makeRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects).toBe(4)
  })

  it('com bloco do builder ativo, desenha exatamente 1 retangulo (bloco)', () => {
    const p = makePlayer('builder'); p.x = 5 * TILE; p.y = 7 * TILE
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    const m = makeRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects).toBe(1)
  })

  it('com emc2 ativo, desenha exatamente 1 retangulo (faixa topo)', () => {
    const p = makePlayer('emc2')
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    const m = makeRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects).toBe(1)
  })

  it('sem FX ativo nao desenha nada', () => {
    const p = makePlayer('salto_visionario')
    const m = makeRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects).toBe(0)
  })
})

// Suppress unused import warnings for Enemy type used in makeEnemy
void makeEnemy(0, 0)
// Suppress unused import warning for AbilityState and AbilityCtx type
void (null as unknown as AbilityState)
