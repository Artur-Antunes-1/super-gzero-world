// tests/unit/player.test.ts
// dt=1 throughout (frames convention, E1). E2: jump assertion = JUMP_VEL*jumpVelMul + GRAVITY*weightMul.
import { describe, it, expect, beforeEach } from 'vitest'
import { createPlayer, updatePlayer, damagePlayer, respawnPlayer, tickPlayerTimers, type Player } from '../../src/game/player'
import { CHARACTERS } from '../../src/data/characters'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType, SpawnPoint } from '../../src/data/schema'
import {
  TILE,
  GRAVITY,
  WALK_MAX,
  RUN_MAX,
  JUMP_VEL,
  JUMP_CUT_VY,
  PLAYER_W,
  PLAYER_H,
  START_LIVES,
  COYOTE_FRAMES,
  JUMP_BUFFER_FRAMES,
  IFRAME_FRAMES,
  KNOCKBACK_VX,
  KNOCKBACK_VY,
  HURT_FRAMES,
} from '../../src/engine/constants'

// FakeInput: implements exactly the Input interface from the CONTRATO.
// pressed() = action went from not-down to down since last update().
class FakeInput implements Input {
  private down = new Set<InputAction>()
  private prev = new Set<InputAction>()

  set(a: InputAction, v: boolean): void {
    if (v) this.down.add(a)
    else this.down.delete(a)
  }

  isDown(a: InputAction): boolean {
    return this.down.has(a)
  }

  pressed(a: InputAction): boolean {
    return this.down.has(a) && !this.prev.has(a)
  }

  update(): void {
    this.prev = new Set(this.down)
  }

  attach(): void {
    /* no-op in tests */
  }
}

// Build a flat ParsedLevel: ground on the last row, rest empty.
// Player is spawned on the row just above the ground.
function makeFlatLevel(widthTiles = 40, heightTiles = 11): ParsedLevel {
  const tiles: TileType[][] = []
  for (let ty = 0; ty < heightTiles; ty++) {
    const row: TileType[] = []
    for (let tx = 0; tx < widthTiles; tx++) {
      row.push(ty === heightTiles - 1 ? 'ground' : 'empty')
    }
    tiles.push(row)
  }
  const spawn: SpawnPoint = { x: 2 * TILE, y: (heightTiles - 2) * TILE }
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: spawn,
    goal: { x: (widthTiles - 2) * TILE, y: (heightTiles - 2) * TILE },
    coins: [],
    enemies: [],
  }
}

// Run N frames with dt=1 (frames convention, E1).
function steps(player: Player, input: FakeInput, level: ParsedLevel, n: number): void {
  for (let i = 0; i < n; i++) {
    updatePlayer(player, input, level, 1)
    input.update()
  }
}

describe('createPlayer', () => {
  it('posiciona no spawn e copia stats do char', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    expect(p.x).toBe(level.playerSpawn.x)
    expect(p.y).toBe(level.playerSpawn.y)
    expect(p.w).toBe(PLAYER_W)
    expect(p.h).toBe(PLAYER_H)
    expect(p.char).toBe(CHARACTERS['renan'])
    expect(p.hearts).toBe(CHARACTERS['renan'].hearts)
    expect(p.facing).toBe(1)
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
  })

  it('usa START_LIVES para o campo lives (E5)', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    expect(p.lives).toBe(START_LIVES)
    expect(p.lives).toBe(3) // START_LIVES === 3, verify consistency
  })
})

describe('updatePlayer — corrida horizontal', () => {
  let level: ParsedLevel
  let input: FakeInput
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    input = new FakeInput()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
  })

  it('segurar right acelera ate WALK_MAX (sem ultrapassar) e facing=1', () => {
    input.set('right', true)
    steps(p, input, level, 200)
    const cap = WALK_MAX * CHARACTERS['renan'].walkMul // walkMul=1.0
    expect(p.vx).toBeGreaterThan(cap - 0.5)
    expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
    expect(p.facing).toBe(1)
  })

  it('segurar right + run acelera ate RUN_MAX (sem ultrapassar)', () => {
    input.set('right', true)
    input.set('run', true)
    steps(p, input, level, 200)
    const cap = RUN_MAX * CHARACTERS['renan'].runMul // runMul=1.0
    expect(p.vx).toBeGreaterThan(WALK_MAX) // passed walk cap
    expect(p.vx).toBeGreaterThan(cap - 0.5)
    expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
  })

  it('segurar left vira facing para -1 e acelera negativo', () => {
    input.set('left', true)
    steps(p, input, level, 30)
    expect(p.facing).toBe(-1)
    expect(p.vx).toBeLessThan(0)
    const cap = WALK_MAX * CHARACTERS['renan'].walkMul
    expect(p.vx).toBeGreaterThanOrEqual(-cap - 1e-6)
  })
})

describe('updatePlayer — pulo', () => {
  let level: ParsedLevel
  let input: FakeInput
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    input = new FakeInput()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
  })

  it('assenta no chao (onGround) depois de alguns frames', () => {
    steps(p, input, level, 10)
    expect(p.onGround).toBe(true)
    expect(p.vy).toBe(0)
  })

  it('jump em onGround: onGround===false e vy === JUMP_VEL*jumpVelMul + GRAVITY*weightMul (E2)', () => {
    steps(p, input, level, 10) // settle on ground
    expect(p.onGround).toBe(true)
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    // E2: stepBody runs after the jump impulse, adding GRAVITY*weightMul once
    const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul + GRAVITY * CHARACTERS['renan'].weightMul
    expect(p.vy).toBeCloseTo(expected, 5)
    expect(p.onGround).toBe(false)
  })

  it('coyote: pulo logo apos sair da borda ainda dispara (E2 assertion)', () => {
    steps(p, input, level, 10) // settle on ground
    // Remove the floor to force the player off the edge without jumping
    const groundRow = level.heightTiles - 1
    for (let tx = 0; tx < level.widthTiles; tx++) level.tiles[groundRow][tx] = 'empty'
    // 1 frame with no ground and no jump: still within coyote window
    updatePlayer(p, input, level, 1)
    input.update()
    expect(p.onGround).toBe(false)
    // Press jump within COYOTE_FRAMES
    expect(COYOTE_FRAMES).toBeGreaterThan(1)
    input.set('jump', true)
    const vyBefore = p.vy
    updatePlayer(p, input, level, 1)
    input.update()
    // E2: vy should reflect jump impulse + one GRAVITY*weightMul step
    const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul + GRAVITY * CHARACTERS['renan'].weightMul
    expect(p.vy).toBeLessThan(vyBefore) // upward impulse (more negative)
    expect(p.vy).toBeCloseTo(expected, 5)
  })

  it('jump buffer: pulo pressionado no ar dispara ao aterrissar', () => {
    // Settle on ground first
    steps(p, input, level, 10)
    expect(p.onGround).toBe(true)

    // Jump: player leaves the ground
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    input.set('jump', false)
    input.update()
    expect(p.onGround).toBe(false)

    // Advance frames until the player is falling AND within JUMP_BUFFER_FRAMES
    // frames of landing. With dt=1 (frames convention), at terminal velocity MAX_FALL=17,
    // the player covers at most 17px/frame. So "within 8 frames" ≈ within 136px.
    // Wait until y >= landingY - JUMP_BUFFER_FRAMES * MAX_FALL.
    const groundY = (level.heightTiles - 1) * TILE // tile top of ground row = 480
    const landingY = groundY - PLAYER_H // y where bottom == ground = 438
    const MAX_FALL = 17
    const nearGroundY = landingY - JUMP_BUFFER_FRAMES * MAX_FALL // ≈ 302

    let guard = 0
    while (p.y < nearGroundY && guard < 200 && !p.onGround) {
      updatePlayer(p, input, level, 1)
      input.update()
      guard++
    }

    // Now close to the ground and falling. Press jump to set the buffer.
    expect(p.onGround).toBe(false)
    expect(JUMP_BUFFER_FRAMES).toBeGreaterThan(1)
    input.set('jump', true)
    updatePlayer(p, input, level, 1)
    input.update()
    input.set('jump', false)
    input.update()

    // Within JUMP_BUFFER_FRAMES the player should land and the buffered jump fires.
    let jumped = false
    for (let i = 0; i < JUMP_BUFFER_FRAMES + 2 && !jumped; i++) {
      updatePlayer(p, input, level, 1)
      input.update()
      if (p.vy < 0) jumped = true // upward impulse = buffered jump fired
    }
    expect(jumped).toBe(true)
  })
})

// --- Jump-cut (pulo variavel, errata de fisica 2026-06-11) ---
describe('updatePlayer — jump-cut (JUMP_CUT_VY)', () => {
  let level: ParsedLevel
  let input: FakeInput
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    input = new FakeInput()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    steps(p, input, level, 10) // assenta no chao
    expect(p.onGround).toBe(true)
  })

  it('soltar jump na subida corta vy para JUMP_CUT_VY (+1 passo de gravidade)', () => {
    input.set('jump', true)
    updatePlayer(p, input, level, 1) // pulo dispara
    input.update()
    updatePlayer(p, input, level, 1) // ainda segurando: sem corte
    input.update()
    expect(p.vy).toBeLessThan(JUMP_CUT_VY) // ascensao rapida preservada
    input.set('jump', false)
    updatePlayer(p, input, level, 1) // soltou: corta ANTES do stepBody
    input.update()
    const g = GRAVITY * CHARACTERS['renan'].weightMul
    expect(p.vy).toBeCloseTo(JUMP_CUT_VY + g, 5)
  })

  it('segurando jump a subida NAO e cortada (vy segue abaixo de JUMP_CUT_VY)', () => {
    input.set('jump', true)
    for (let i = 0; i < 5; i++) {
      updatePlayer(p, input, level, 1)
      input.update()
    }
    const g = GRAVITY * CHARACTERS['renan'].weightMul
    const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul + 5 * g
    expect(p.vy).toBeCloseTo(expected, 5)
    expect(p.vy).toBeLessThan(JUMP_CUT_VY)
  })

  it('corte tambem se aplica a impulsos externos (stomp-bounce) sem jump segurado', () => {
    // Sem rastrear a origem do impulso, o corte vale SEMPRE (estilo Mario:
    // segurar pulo mantem o quique do stomp alto; soltar encurta).
    input.set('jump', true)
    updatePlayer(p, input, level, 1) // sai do chao
    input.update()
    input.set('jump', false)
    p.vy = -11.5 // simula STOMP_BOUNCE no ar
    updatePlayer(p, input, level, 1)
    input.update()
    const g = GRAVITY * CHARACTERS['renan'].weightMul
    expect(p.vy).toBeCloseTo(JUMP_CUT_VY + g, 5)
  })

  it('vy acima de JUMP_CUT_VY (descida/subida lenta) NAO e alterado pelo corte', () => {
    input.set('jump', true)
    updatePlayer(p, input, level, 1) // sai do chao
    input.update()
    input.set('jump', false)
    p.vy = 4 // caindo
    updatePlayer(p, input, level, 1)
    input.update()
    const g = GRAVITY * CHARACTERS['renan'].weightMul
    expect(p.vy).toBeCloseTo(4 + g, 5) // so gravidade; sem corte
  })
})

describe('updatePlayer — gravidade escalada por weightMul', () => {
  it('no ar, sem input: julio (1.08) acumula vy maior que renan (0.96)', () => {
    const level = makeFlatLevel()
    const input = new FakeInput()
    const julio = createPlayer(CHARACTERS['julio'], level.playerSpawn)
    const renan = createPlayer(CHARACTERS['renan'], level.playerSpawn)

    updatePlayer(julio, input, level, 1)
    updatePlayer(renan, input, level, 1)

    expect(julio.onGround).toBe(false)
    expect(renan.onGround).toBe(false)
    expect(julio.vy).toBeCloseTo(GRAVITY * CHARACTERS['julio'].weightMul, 5)
    expect(renan.vy).toBeCloseTo(GRAVITY * CHARACTERS['renan'].weightMul, 5)
    expect(julio.vy).toBeGreaterThan(renan.vy)
  })

  it('weightMul 1.0 (artur): vy idêntico ao comportamento pré-mudança', () => {
    const level = makeFlatLevel()
    const input = new FakeInput()
    const p = createPlayer(CHARACTERS['artur'], level.playerSpawn)

    updatePlayer(p, input, level, 1)

    expect(p.onGround).toBe(false)
    expect(p.vy).toBeCloseTo(GRAVITY, 5)
  })
})

// --- M1 Task 6: damage/hearts/i-frames/death ---

describe('createPlayer — M1 fields', () => {
  it('initializes iframes=0 and ability state', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    expect(p.iframes).toBe(0)
    expect(p.ability).toBeDefined()
    expect(p.ability.id).toBe(CHARACTERS['renan'].abilityId)
  })
})

describe('damagePlayer', () => {
  let level: ParsedLevel
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    // Settle on ground
    const input = new FakeInput()
    steps(p, input, level, 10)
    // Ensure hearts and lives are clean
    p.hearts = p.char.hearts // 3 for renan
    p.lives = START_LIVES    // 3
    p.iframes = 0
  })

  it('reduces hearts by 1, sets iframes=IFRAME_FRAMES, applies knockback, returns "hit"', () => {
    const fromX = p.x + 100 // enemy is to the right => player knocked left
    const result = damagePlayer(p, fromX)
    expect(result).toBe('hit')
    expect(p.hearts).toBe(p.char.hearts - 1)
    expect(p.iframes).toBe(IFRAME_FRAMES)
    expect(p.vy).toBe(KNOCKBACK_VY)
    // player.x < fromX => knocked left (negative vx)
    expect(p.vx).toBe(-KNOCKBACK_VX)
  })

  it('knockback away from fromX: enemy to the left => player knocked right', () => {
    const fromX = p.x - 100 // enemy is to the left
    damagePlayer(p, fromX)
    // player.x > fromX => knocked right (positive vx)
    expect(p.vx).toBe(KNOCKBACK_VX)
  })

  it('iframes > 0 blocks damage and returns "blocked"', () => {
    p.iframes = IFRAME_FRAMES
    const heartsBefore = p.hearts
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('blocked')
    expect(p.hearts).toBe(heartsBefore)
  })

  it('shield blocks damage, consumes shield, sets iframes, returns "blocked"', () => {
    p.iframes = 0
    p.ability.shield = true
    p.ability.shieldTimer = 180
    const heartsBefore = p.hearts
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('blocked')
    expect(p.hearts).toBe(heartsBefore)
    expect(p.iframes).toBe(IFRAME_FRAMES)
    expect(p.ability.shield).toBe(false)
    expect(p.ability.shieldTimer).toBe(0)
  })

  it('hearts going to 0 with lives remaining resets hearts to char.hearts and returns "hit"', () => {
    p.hearts = 1
    p.lives = 2
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('hit')
    expect(p.lives).toBe(1)
    expect(p.hearts).toBe(p.char.hearts) // hearts reset
  })

  it('hearts going to 0 and lives going to 0 returns "death"', () => {
    p.hearts = 1
    p.lives = 1
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('death')
    expect(p.lives).toBe(0)
  })

  it('normal heart loss (hearts > 1) does not reset hearts', () => {
    p.hearts = 3
    p.lives = 3
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('hit')
    expect(p.hearts).toBe(2)
    expect(p.lives).toBe(3) // lives unchanged
  })
})

describe('respawnPlayer', () => {
  it('resets position, velocity, hearts to char.hearts, iframes to IFRAME_FRAMES, resets ability', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    // Mess up state
    p.x = 999
    p.y = 999
    p.vx = 5
    p.vy = -10
    p.hearts = 0
    p.iframes = 0
    p.ability.shield = true
    p.ability.shieldTimer = 100
    const spawn: SpawnPoint = { x: 100, y: 200 }
    respawnPlayer(p, spawn)
    expect(p.x).toBe(100)
    expect(p.y).toBe(200)
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
    expect(p.hearts).toBe(p.char.hearts)
    expect(p.iframes).toBe(IFRAME_FRAMES)
    // ability should be freshly initialized
    expect(p.ability.shield).toBe(false)
    expect(p.ability.shieldTimer).toBe(0)
  })
})

// --- M2 fase B: hurtTimer (estado visual 'hurt', separado dos i-frames) ---

describe('hurtTimer (M2 fase B)', () => {
  let level: ParsedLevel
  let p: Player

  beforeEach(() => {
    level = makeFlatLevel()
    p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    p.hearts = p.char.hearts
    p.lives = START_LIVES
    p.iframes = 0
  })

  it('createPlayer inicia hurtTimer=0', () => {
    expect(p.hurtTimer).toBe(0)
  })

  it('dano que conecta ("hit") seta hurtTimer=HURT_FRAMES alem dos iframes', () => {
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('hit')
    expect(p.hurtTimer).toBe(HURT_FRAMES)
    expect(p.iframes).toBe(IFRAME_FRAMES) // iframes continuam separados
  })

  it('dano fatal ("death") tambem seta hurtTimer=HURT_FRAMES', () => {
    p.hearts = 1
    p.lives = 1
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('death')
    expect(p.hurtTimer).toBe(HURT_FRAMES)
  })

  it('dano "blocked" por iframes NAO seta hurtTimer', () => {
    p.iframes = IFRAME_FRAMES
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('blocked')
    expect(p.hurtTimer).toBe(0)
  })

  it('dano "blocked" por escudo NAO seta hurtTimer', () => {
    p.ability.shield = true
    p.ability.shieldTimer = 180
    const result = damagePlayer(p, p.x + 100)
    expect(result).toBe('blocked')
    expect(p.hurtTimer).toBe(0)
  })

  it('respawnPlayer zera hurtTimer', () => {
    p.hurtTimer = HURT_FRAMES
    respawnPlayer(p, level.playerSpawn)
    expect(p.hurtTimer).toBe(0)
  })

  it('tickPlayerTimers decrementa hurtTimer junto com iframes (clamp em 0)', () => {
    p.hurtTimer = HURT_FRAMES
    p.iframes = IFRAME_FRAMES
    tickPlayerTimers(p, 1)
    expect(p.hurtTimer).toBe(HURT_FRAMES - 1)
    expect(p.iframes).toBe(IFRAME_FRAMES - 1)
    tickPlayerTimers(p, 1000)
    expect(p.hurtTimer).toBe(0)
    expect(p.iframes).toBe(0)
  })
})

describe('tickPlayerTimers', () => {
  it('decrements iframes by dt, clamped to 0', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    p.iframes = IFRAME_FRAMES // 90
    tickPlayerTimers(p, 1)
    expect(p.iframes).toBe(IFRAME_FRAMES - 1)
    tickPlayerTimers(p, 1000) // large dt clamps to 0
    expect(p.iframes).toBe(0)
  })

  it('does not go below 0', () => {
    const level = makeFlatLevel()
    const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    p.iframes = 5
    tickPlayerTimers(p, 10)
    expect(p.iframes).toBe(0)
  })
})
