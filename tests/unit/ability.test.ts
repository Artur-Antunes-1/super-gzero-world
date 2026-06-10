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
import { JUMP_VEL, TILE, COLOR_TECH } from '../../src/engine/constants'
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

// Renderer fake para FX (Fase D): grava drawRect (com alpha no momento da
// chamada) e ctx.arc (com alpha/strokeStyle/lineWidth no momento da chamada).
interface RectCall { x: number; y: number; w: number; h: number; color: string; alpha: number }
interface ArcCall {
  x: number; y: number; r: number; a0: number; a1: number
  alpha: number; stroke: string; lineWidth: number
}
function makeFxRenderer(): { r: Renderer; rects: RectCall[]; arcs: ArcCall[] } {
  const rects: RectCall[] = []
  const arcs: ArcCall[] = []
  const alphaStack: number[] = []
  const ctxObj: Record<string, unknown> & {
    globalAlpha: number; strokeStyle: string; lineWidth: number
  } = { globalAlpha: 1, strokeStyle: '', lineWidth: 0 }
  ctxObj.save = () => { alphaStack.push(ctxObj.globalAlpha) }
  ctxObj.restore = () => { ctxObj.globalAlpha = alphaStack.pop() ?? 1 }
  ctxObj.beginPath = () => {}
  ctxObj.stroke = () => {}
  ctxObj.arc = (x: number, y: number, rad: number, a0: number, a1: number) => {
    arcs.push({
      x, y, r: rad, a0, a1,
      alpha: ctxObj.globalAlpha, stroke: ctxObj.strokeStyle, lineWidth: ctxObj.lineWidth,
    })
  }
  const r: Renderer = {
    ctx: ctxObj as unknown as CanvasRenderingContext2D,
    clear() {}, beginWorld() {}, endWorld() {}, present() {},
    drawSprite() {},
    drawRect(x, y, w, h, color) { rects.push({ x, y, w, h, color, alpha: ctxObj.globalAlpha }) },
  }
  return { r, rects, arcs }
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

describe('drawAbilityFx — Fase D', () => {
  it('dash ativo: 3 after-images COLOR_TECH contra o movimento (alphas 0.25/0.15/0.08)', () => {
    const p = makePlayer('dash_criativo'); p.facing = 1
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), [])) // ativa: vx=+dashSpeed
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    const ghosts = m.rects.filter(
      (rc) => rc.color === COLOR_TECH && rc.w === p.w && rc.h === p.h,
    )
    expect(ghosts).toHaveLength(3)
    // vx>0 -> deslocadas para TRAS (esquerda), -10/-20/-30.
    expect(ghosts.map((g) => g.x)).toEqual([p.x - 10, p.x - 20, p.x - 30])
    expect(ghosts.map((g) => g.y)).toEqual([p.y, p.y, p.y])
    expect(ghosts.map((g) => g.alpha)).toEqual([0.25, 0.15, 0.08])
  })

  it('dash com facing=-1: after-images deslocadas para a DIREITA (contra o vx<0)', () => {
    const p = makePlayer('dash_criativo'); p.facing = -1
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), [])) // vx negativo
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    const ghosts = m.rects.filter((rc) => rc.color === COLOR_TECH && rc.w === p.w)
    expect(ghosts.map((g) => g.x)).toEqual([p.x + 10, p.x + 20, p.x + 30])
  })

  it('dash INATIVO: nenhuma after-image', () => {
    const p = makePlayer('dash_criativo')
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects.filter((rc) => rc.w === p.w && rc.h === p.h)).toHaveLength(0)
  })

  it('escudo: arco frontal de 160 graus, raio 34, alpha proporcional a stamina', () => {
    const p = makePlayer('escudo_governanca'); p.facing = 1
    const input = new FakeInput(); input.set('ability', true)
    const ctx = makeCtx(makeLevel(), [])
    updateAbility(p, input, 1, ctx); input.update(); input.set('ability', false)
    const stamina = ABILITY_PARAMS.escudo_governanca.shieldStamina ?? 0

    // Recem-ativado: shieldTimer = stamina -> alpha 1.
    let m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.arcs).toHaveLength(1)
    let arc = m.arcs[0]
    expect(arc.alpha).toBeCloseTo(p.ability.shieldTimer / stamina, 5)
    expect(arc.alpha).toBeCloseTo(1, 5)
    expect(arc.r).toBe(34)
    expect(arc.stroke).toBe(COLOR_TECH)
    expect(arc.lineWidth).toBe(3)
    // 160 graus de abertura, centrado no facing=1 (angulo 0).
    expect(arc.a1 - arc.a0).toBeCloseTo((160 * Math.PI) / 180, 5)
    expect((arc.a0 + arc.a1) / 2).toBeCloseTo(0, 5)
    // Centro no peito (40% da altura).
    expect(arc.x).toBeCloseTo(p.x + p.w / 2, 5)
    expect(arc.y).toBeCloseTo(p.y + p.h * 0.4, 5)

    // Metade da stamina gasta -> alpha ~0.5 (proporcional).
    const half = Math.floor(stamina / 2)
    for (let i = 0; i < half; i++) { updateAbility(p, input, 1, ctx); input.update() }
    m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.arcs).toHaveLength(1)
    arc = m.arcs[0]
    expect(arc.alpha).toBeCloseTo(p.ability.shieldTimer / stamina, 5)
    expect(arc.alpha).toBeCloseTo(0.5, 2)
  })

  it('escudo com facing=-1: arco orientado para tras (centro em PI)', () => {
    const p = makePlayer('escudo_governanca'); p.facing = -1
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect((m.arcs[0].a0 + m.arcs[0].a1) / 2).toBeCloseTo(Math.PI, 5)
  })

  it('builder PRONTO (cooldown 0): outline COLOR_TECH (4 linhas 2px) na celula-alvo', () => {
    const p = makePlayer('builder'); p.facing = 1; p.x = 5 * TILE; p.y = 7 * TILE
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    const cellX = Math.floor((p.x + p.w) / TILE) * TILE
    const cellY = Math.floor((p.y + p.h - 1) / TILE) * TILE
    const lines = m.rects.filter((rc) => rc.color === COLOR_TECH)
    expect(lines).toHaveLength(4)
    expect(lines.every((rc) => rc.w === 2 || rc.h === 2)).toBe(true)
    // Topo e fundo da celula presentes.
    expect(lines.some((rc) => rc.x === cellX && rc.y === cellY)).toBe(true)
    expect(lines.some((rc) => rc.x === cellX && rc.y === cellY + TILE - 2)).toBe(true)
  })

  it('builder em COOLDOWN: sem indicador de celula-alvo', () => {
    const p = makePlayer('builder'); p.x = 5 * TILE; p.y = 7 * TILE
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), [])) // arma cooldown=90
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects.filter((rc) => rc.color === COLOR_TECH)).toHaveLength(0)
  })

  it('emc2 ativo: anel de relogio (arco fino COLOR_TECH, alpha 0.5) em volta do player', () => {
    const p = makePlayer('emc2')
    const input = new FakeInput(); input.set('ability', true)
    updateAbility(p, input, 1, makeCtx(makeLevel(), []))
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.arcs).toHaveLength(1)
    const arc = m.arcs[0]
    expect(arc.alpha).toBeCloseTo(0.5, 5)
    expect(arc.stroke).toBe(COLOR_TECH)
    expect(arc.lineWidth).toBeLessThanOrEqual(2) // fino
    expect(arc.x).toBeCloseTo(p.x + p.w / 2, 5)
    expect(arc.y).toBeCloseTo(p.y + p.h / 2, 5)
    // Recem-ativado (frac=1): varredura completa a partir do topo.
    expect(arc.a0).toBeCloseTo(-Math.PI / 2, 5)
    expect(arc.a1 - arc.a0).toBeCloseTo(Math.PI * 2, 5)
  })

  it('sem FX ativo nao desenha nada (nem rects, nem arcos)', () => {
    const p = makePlayer('salto_visionario')
    const m = makeFxRenderer()
    drawAbilityFx(m.r, p)
    expect(m.rects).toHaveLength(0)
    expect(m.arcs).toHaveLength(0)
  })
})

// Suppress unused import warnings for Enemy type used in makeEnemy
void makeEnemy(0, 0)
// Suppress unused import warning for AbilityState and AbilityCtx type
void (null as unknown as AbilityState)
