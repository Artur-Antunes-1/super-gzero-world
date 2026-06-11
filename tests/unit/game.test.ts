// tests/unit/game.test.ts
// Integracao M1: title -> select -> playing -> paused/win/over; worldScale;
// colisoes stomp/dash/damage; Humanware congela inimigos e pausa timer.
// dt=1 (convencao por-frame, E1).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGame } from '../../src/game/game'
// E1: contrato E2 — cursor inicial do select (fallback 0 ate o E2 landar).
import { SELECT_START_INDEX } from '../../src/ui/selectScreen'
import type { Renderer } from '../../src/engine/render'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import {
  TILE,
  FIXED_DT,
  TIME_START,
  STOMP_BOUNCE,
  SPRING_VEL,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_OBJETIVO,
  COLOR_TECH,
  COLOR_PERIGO,
  COLOR_COLETAVEL,
  HW_METER_MAX,
  HURT_FRAMES,
  CAST_FRAMES,
  HITSTOP_FRAMES,
  SHAKE_FRAMES,
  SHAKE_PX,
} from '../../src/engine/constants'

// (M2a Task 6) — imports adicionais
import type { AssetStore, ImageAsset } from '../../src/engine/assets'
import * as spriteDraw from '../../src/engine/spriteDraw'
import * as parallax from '../../src/engine/parallax'
import * as particles from '../../src/engine/particles'
import * as sprites from '../../src/game/sprites'
// (M2 fase B) — animator/spriteAnim no contrato B1
import * as animator from '../../src/engine/animator'
import * as spriteAnim from '../../src/engine/spriteAnim'

// Mocka os modulos que tocam canvas real (jsdom nao tem 2d de verdade aqui).
// As fns viram spies; preservamos as fns puras de `particles` que o game usa no update.
vi.mock('../../src/engine/spriteDraw', () => ({
  drawAnimatedSprite: vi.fn(),
}))
vi.mock('../../src/engine/parallax', () => ({
  drawParallax: vi.fn(),
}))
vi.mock('../../src/engine/particles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/particles')>()
  return {
    ...actual,
    drawParticles: vi.fn(),
    drawParticlesWorld: vi.fn(),
    // passthrough-spy: preserva o comportamento real, mas permite inspecionar args
    emitBurst: vi.fn(actual.emitBurst),
  }
})
// drawPlaceholder vira spy com passthrough (comportamento real preservado).
vi.mock('../../src/game/sprites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/game/sprites')>()
  return { ...actual, drawPlaceholder: vi.fn(actual.drawPlaceholder) }
})
// (M2 fase B) animator MOCKADO no formato do contrato B1 (one-shots/landed/transform):
// os testes de integracao do game nao dependem do timing da implementacao real.
vi.mock('../../src/engine/animator', () => ({
  createAnimator: vi.fn(() => ({
    state: 'idle',
    t: 0,
    oneShot: null,
    oneShotT: 0,
    oneShotDur: 0,
    prevOnGround: false,
  })),
  classifyAnim: vi.fn(() => 'idle'),
  updateAnimator: vi.fn(() => ({ landed: false })),
  getTransform: vi.fn(() => ({ scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 })),
  getFrameTransform: vi.fn(() => ({ scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 })),
  triggerOneShot: vi.fn(),
}))
// drawContactShadow vira spy puro; drawCharFrame continua REAL (cascata M2b testada).
vi.mock('../../src/engine/spriteAnim', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/spriteAnim')>()
  return { ...actual, drawContactShadow: vi.fn() }
})

// ---------- FakeInput canonico (igual ao de player.test.ts) ----------
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
    /* no-op */
  }
}

// ---------- Fake Renderer minimo ----------
// save/restore emulam a pilha de globalAlpha (necessario p/ o teste de i-frames).
function makeRenderer(): Renderer {
  const alphaStack: number[] = []
  const ctxObj: Record<string, unknown> & { globalAlpha: number } = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    // D4: drawAbilityFx pode usar arcos (escudo/emc2).
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    // E3: HUD desenha a moeda dourada com ctx.fill().
    fill: vi.fn(),
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  ctxObj.save = vi.fn(() => {
    alphaStack.push(ctxObj.globalAlpha)
  })
  ctxObj.restore = vi.fn(() => {
    ctxObj.globalAlpha = alphaStack.pop() ?? 1
  })
  const ctx = ctxObj as unknown as CanvasRenderingContext2D
  return {
    ctx,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    drawSprite: vi.fn(), // C3b: usado por drawTile (atlas)
    present: vi.fn(),
  }
}

// ---------- Level plano: chao solido nas rows 9-10, resto vazio ----------
// C3b: extras opcionais do contrato (qBlocks/hearts/checkpoints/timeStart).
// Cast via `as ParsedLevel` — converge com o schema novo do C3a sem quebrar antes.
interface LevelExtras {
  qBlocks?: Array<{ col: number; row: number; payload: 'coin' | 'item' | 'star' }>
  hearts?: Array<{ col: number; row: number }>
  checkpoints?: number[]
  timeStart?: number
  // G4: molas, plataformas moveis e progressao por next.
  springs?: Array<{ col: number; row: number }>
  movers?: Array<{
    col: number
    row: number
    axis: 'x' | 'y'
    amplitude: number
    speed: number
  }>
  next?: string
}
function makeLevel(
  enemies: Array<{ x: number; y: number; kind: string }> = [],
  coins: Array<{ x: number; y: number }> = [],
  extras: LevelExtras = {},
): ParsedLevel {
  const widthTiles = 40
  const heightTiles = 11
  const tiles: TileType[][] = Array.from({ length: heightTiles }, (_, r) =>
    Array.from({ length: widthTiles }, () => (r >= 9 ? 'ground' : 'empty')),
  )
  // Blocos '?' sao tiles solidos 'block' (legenda nova do parser).
  for (const qb of extras.qBlocks ?? []) tiles[qb.row][qb.col] = 'block'
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 2 * TILE, y: 8 * TILE },
    goal: { x: 36 * TILE, y: 8 * TILE },
    coins,
    enemies,
    qBlocks: extras.qBlocks ?? [],
    hearts: extras.hearts ?? [],
    checkpoints: extras.checkpoints ?? [],
    timeStart: extras.timeStart ?? TIME_START,
    foolSpawns: [],
    springs: extras.springs ?? [],
    movers: extras.movers ?? [],
    next: extras.next,
  } as ParsedLevel
}

// E1: boot agora comeca em 'title' — confirm (Enter) leva ao select.
function enterSelect(game: ReturnType<typeof createGame>, input: FakeInput): void {
  input.set('confirm', true)
  game.update(1)
  input.set('confirm', false)
  game.update(1)
}

// E1: cursor inicial do select (contrato E2; ?? 0 cobre a janela ate o E2 landar).
const START_INDEX = SELECT_START_INDEX ?? 0
// Ordem canonica do roster (§0.4): renan, dante, julio, artur, einstein.
const SELECT_ORDER = ['renan', 'dante', 'julio', 'artur', 'einstein']
const N_CHARS = SELECT_ORDER.length

// Sai do title (se preciso), navega do cursor inicial ate `target` (wrap) e confirma.
function selectIndex(
  game: ReturnType<typeof createGame>,
  input: FakeInput,
  target: number,
): void {
  if (game.state.is('title')) enterSelect(game, input)
  const steps = (((target - START_INDEX) % N_CHARS) + N_CHARS) % N_CHARS
  for (let i = 0; i < steps; i++) {
    input.set('right', true)
    game.update(1)
    input.set('right', false)
    game.update(1)
  }
  input.set('confirm', true)
  game.update(1)
  input.set('confirm', false)
  game.update(1)
}

// Seleciona 'renan' (index 0 na ordem canonica) com 'confirm'.
function selectFirst(game: ReturnType<typeof createGame>, input: FakeInput): void {
  selectIndex(game, input, 0)
}

// Navega para 'artur' (index 3 em SELECT_ORDER) e confirma.
function selectArtur(game: ReturnType<typeof createGame>, input: FakeInput): void {
  selectIndex(game, input, 3)
}

// E1: o resultado (win/over) so aceita Enter apos 45 frames — drena e confirma.
function confirmResult(game: ReturnType<typeof createGame>, input: FakeInput): void {
  for (let i = 0; i < 45; i++) game.update(1)
  input.set('confirm', true)
  game.update(1)
  input.set('confirm', false)
  game.update(1)
}

// (M2 fase B) Inimigo junto ao spawn pode acertar o player JA durante o select
// (frame de confirm) — isso arma o hitstop e congelaria o proximo update do teste.
// Drena o hitstop incidental antes de configurar o cenario.
function drainHitstop(game: ReturnType<typeof createGame>): void {
  for (let i = 0; i < HITSTOP_FRAMES; i++) game.update(1)
}

// (G4) Hit LETAL agora passa pelo subestado DYING (36 frames com o corpo em
// cena) antes do 'over' — drena ate o estado virar.
const DYING_FRAMES = 36
function drainDying(game: ReturnType<typeof createGame>): void {
  for (let i = 0; i < DYING_FRAMES; i++) game.update(1)
}

// Navega para 'dante' (index 1, dash_criativo) e confirma.
function selectDante(game: ReturnType<typeof createGame>, input: FakeInput): void {
  selectIndex(game, input, 1)
}

describe('createGame — selecao', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('comeca no estado "title" (E1) e confirm leva ao "select"', () => {
    const game = createGame(renderer, input, makeLevel())
    expect(game.state.get()).toBe('title')
    enterSelect(game, input)
    expect(game.state.get()).toBe('select')
  })

  it('confirm na selecao cria o player e vai para "playing"', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    expect(game.state.get()).toBe('playing')
    expect(game.player).not.toBeNull()
    expect(game.player!.char.id).toBe('renan')
  })

  it('render nao lanca nos estados title e select', () => {
    const game = createGame(renderer, input, makeLevel())
    expect(() => game.render(0)).not.toThrow() // title
    enterSelect(game, input)
    expect(() => game.render(0)).not.toThrow() // select
  })
})

describe('createGame — playing', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('transita para "win" ao tocar o goal', () => {
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
  })

  it('stomp mata o inimigo, da bounce e aplica STOMP_BOUNCE', () => {
    // Inimigo na coluna 6, sobre o chao (row 8 = topo do chao). w=38,h=34.
    const level = makeLevel([{ x: 6 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Posiciona o player acima do inimigo, caindo (vy>0), com overlap horizontal.
    const enemyX = 6 * TILE
    p.x = enemyX
    p.y = 8 * TILE + (TILE - 34) - p.h + 4 // bottom do player perto do topo do inimigo
    p.vy = 5
    game.update(1)
    expect(game.state.get()).toBe('playing')
    expect(p.vy).toBe(STOMP_BOUNCE)
  })

  it('dano sem hearts/lives entra no DYING e leva a "over" apos 36 frames (G4)', () => {
    // Inimigo colado ao player; player sem i-frames; reduz lives/hearts ao minimo.
    const level = makeLevel([{ x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    // Forca a beira da morte: 1 life, 1 heart, sem i-frames, sem vy (nao e stomp).
    p.lives = 1
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    // Coloca o inimigo em overlap lateral com o player (mesma faixa vertical, lado).
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34) // alinhado verticalmente ao inimigo => overlap, nao stomp
    game.update(1)
    // G4: frame do hit letal NAO encerra — subestado DYING segura 36 frames.
    expect(game.state.get()).toBe('playing')
    expect(game.events).not.toContain('over')
    drainDying(game)
    expect(game.state.get()).toBe('over')
    // D4: morte empilha o SFX 'over' (agora ao expirar o dying).
    expect(game.events).toContain('over')
  })

  it('ao perder vida com lives>0 o player volta ao spawn (E2)', () => {
    // Inimigo junto ao spawn; player com 2 lives, 1 heart, sem i-frames.
    const level = makeLevel([{ x: 2 * TILE + 4, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 2
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    // Depois do hit com perda de vida, deve continuar playing e player no spawn
    expect(game.state.get()).toBe('playing')
    expect(p.x).toBe(level.playerSpawn.x)
    expect(p.y).toBe(level.playerSpawn.y)
  })

  it('dano com hearts restantes nao vai a "over" nem respawna (apenas perde coracao)', () => {
    const level = makeLevel([{ x: 2 * TILE + 4, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 3
    p.hearts = 3
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    expect(game.state.get()).toBe('playing')
    // Hearts reduced but no respawn (player position unchanged from where it was, NOT spawn)
    // Actually the player takes knockback so position changes, just confirm still playing
    expect(p.hearts).toBe(2)
    // lives unchanged
    expect(p.lives).toBe(3)
  })
})

// E5: Teste REAL de congelamento (sem dead stub, sem void/break).
// Enche o medidor via coins (+8 cada, 125 coins = 1000 = HW_METER_MAX),
// ativa o Modo com KeyH, verifica e.frozen===true e e.x imovel por N updates.
describe('createGame — Humanware congela inimigos', () => {
  it('com medidor cheio por coins, KeyH ativa Modo e os inimigos param', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // 125 coins (=1000) para encher o medidor; 1 inimigo no chao.
    const coins = Array.from({ length: 125 }, (_, i) => ({
      x: (3 + (i % 30)) * TILE,
      y: 8 * TILE,
    }))
    const enemyStartX = 20 * TILE
    const level = makeLevel(
      [{ x: enemyStartX, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      coins,
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Move o player sobre todas as coins coletando (teleporte sucessivo).
    for (const c of level.coins) {
      p.x = c.x
      p.y = c.y
      p.vy = 0
      game.update(1)
    }
    // Agora ativa o Humanware.
    p.x = 2 * TILE
    p.y = 8 * TILE
    input.set('humanware', true)
    game.update(1)
    input.set('humanware', false)
    game.update(1)
    // No Modo, o inimigo congela: avancar updates nao deve mover seu x.
    const e = game.enemies[0]
    expect(e.frozen).toBe(true)
    const xBefore = e.x
    for (let i = 0; i < 30; i++) game.update(1)
    expect(e.frozen).toBe(true)
    expect(e.x).toBe(xBefore)
  })
})

// A2: getter `humanware` expoe o HumanwareState interno (contrato com A1/main.ts).
describe('createGame — getter humanware', () => {
  it('expoe o estado do Humanware com meter inicial 0 e active false', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    expect(game.humanware).toBeDefined()
    expect(game.humanware.meter).toBe(0)
  })

  it('reflete o estado VIVO: coletar uma coin soma +8 no meter visto pelo getter', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [{ x: 5 * TILE, y: 8 * TILE }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.x = 5 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    expect(game.humanware.meter).toBe(8)
  })
})

// A2: burst do Humanware emitido em COORDENADAS DE MUNDO (space 'world').
describe('createGame — burst do Humanware em world space', () => {
  it("na borda de ativacao emite emitBurst(ps, p.x+p.w/2, p.y-30, 24, [...], 'world')", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // 125 coins (=1000=HW_METER_MAX) para encher o medidor.
    const coins = Array.from({ length: 125 }, (_, i) => ({
      x: (3 + (i % 30)) * TILE,
      y: 8 * TILE,
    }))
    const level = makeLevel([], coins)
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    for (const c of level.coins) {
      p.x = c.x
      p.y = c.y
      p.vy = 0
      game.update(1)
    }
    expect(game.humanware.meter).toBe(HW_METER_MAX)

    vi.clearAllMocks()
    p.x = 2 * TILE
    p.y = 8 * TILE
    input.set('humanware', true)
    game.update(1) // tryActivate ocorre no passo 4 deste frame
    input.set('humanware', false)
    game.update(1) // borda de subida detectada no passo 2b -> burst

    const spy = vi.mocked(particles.emitBurst)
    expect(spy).toHaveBeenCalledTimes(1)
    const call = spy.mock.calls[0]
    // emitBurst(ps, x, y, count, colors, space)
    expect(call[1]).toBeCloseTo(p.x + p.w / 2, 5) // x em MUNDO (sem subtrair cam)
    expect(call[2]).toBeCloseTo(p.y - 30, 5) // y em MUNDO
    expect(call[3]).toBe(24)
    expect(call[4]).toEqual([COLOR_MAGENTA, COLOR_LIME])
    expect(call[5]).toBe('world')

    // Frames seguintes (Modo ja ativo): sem novo burst (so na borda de subida).
    game.update(1)
    game.update(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('createGame — reset', () => {
  it('confirm em "win" (apos o delay de 45f) volta para "select"', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
  })

  it('confirm em "over" (apos o delay de 45f) volta para "select"', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([{ x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 1; p.hearts = 1; p.iframes = 0; p.vy = 0
    p.x = 2 * TILE; p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    drainDying(game) // G4: hit letal passa pelo DYING antes do over
    expect(game.state.get()).toBe('over')
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
  })
})

describe("createGame — reset limpa estado M2a (particulas/animacao/hwWasActive)", () => {
  it("apos reset (win -> select -> nova rodada) o sistema de particulas comeca vazio e sem crash", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)

    // Seleciona e vai para playing.
    selectFirst(game, input)
    expect(game.state.get()).toBe("playing")

    // Forca transicao para win.
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe("win")

    // Confirma (apos o delay E1): volta ao select (resetToSelect limpa ps/playerAnim/hwWasActive).
    confirmResult(game, input)
    expect(game.state.get()).toBe("select")

    // Inicia nova rodada.
    selectFirst(game, input)
    expect(game.state.get()).toBe("playing")

    // Avanca alguns updates sem crash — garante que o estado M2a foi resetado corretamente.
    expect(() => {
      for (let i = 0; i < 10; i++) game.update(1)
    }).not.toThrow()

    // Render tambem nao deve lancar apos o reset.
    expect(() => game.render(0)).not.toThrow()
  })

  it("apos reset (over -> select -> nova rodada) render e drawParticles chamados sem crash", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([{ x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: "fool" }])
    const game = createGame(renderer, input, level, makeStore())

    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 1; p.hearts = 1; p.iframes = 0; p.vy = 0
    p.x = 2 * TILE; p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    drainDying(game) // G4: hit letal passa pelo DYING antes do over
    expect(game.state.get()).toBe("over")

    confirmResult(game, input)
    expect(game.state.get()).toBe("select")

    // Nova rodada.
    selectFirst(game, input)
    expect(game.state.get()).toBe("playing")

    // 10 updates — nao deve lancar.
    expect(() => {
      for (let i = 0; i < 10; i++) game.update(1)
    }).not.toThrow()

    // drawParticles deve ser chamado no render da nova rodada.
    vi.clearAllMocks()
    game.render(0)
    expect(particles.drawParticles).toHaveBeenCalledTimes(1)
  })
})

// Builder: bloco temporario aparece em level.tiles e e restaurado apos o TTL.
describe('createGame — builder tile restore', () => {
  // Calculo da celula-alvo:
  //   spawn: x=2*TILE(96), y=8*TILE(384); PLAYER_W=34, PLAYER_H=42, facing=1 (direita)
  //   col = floor((96+34)/48) = floor(130/48) = 2
  //   row = floor((384+42-1)/48) = floor(425/48) = 8
  // Row 8 e 'empty' em makeLevel (chao comeca na row 9) — apto para receber o bloco.
  const BUILDER_COL = 2
  const BUILDER_ROW = 8

  it('builder: bloco temporario aparece e e restaurado', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // Usamos makeLevel sem inimigos: row 8 col 2 e 'empty', chao em rows 9-10.
    const level = makeLevel()
    const game = createGame(renderer, input, level)

    // Confirma-select 'artur' (habilidade builder).
    selectArtur(game, input)
    expect(game.state.get()).toBe('playing')
    expect(game.player!.char.id).toBe('artur')

    // Garante que a celula-alvo esta vazia antes de ativar.
    expect(level.tiles[BUILDER_ROW][BUILDER_COL]).toBe('empty')

    // Ativa a habilidade: pressiona 'ability' por um frame.
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    game.update(1)

    // Celula deve agora ser 'block'.
    expect(level.tiles[BUILDER_ROW][BUILDER_COL]).toBe('block')

    // Avanca builderTtl (240) + alguns frames extras sem pressionar ability.
    for (let i = 0; i < 245; i++) game.update(1)

    // Celula deve ter sido restaurada para 'empty'.
    expect(level.tiles[BUILDER_ROW][BUILDER_COL]).toBe('empty')
  })

  it('builder: resetToSelect restaura celula e nao deixa bloco vazado', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)

    selectArtur(game, input)
    expect(game.player!.char.id).toBe('artur')

    // Ativa o builder.
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    game.update(1)
    expect(level.tiles[BUILDER_ROW][BUILDER_COL]).toBe('block')

    // Forca transicao para 'over' zerando o player.
    game.player!.lives = 1
    game.player!.hearts = 1
    game.player!.iframes = 0
    // Teleporta para fora de qualquer inimigo; usa timeout para chegar ao 'over'.
    game.player!.x = 999 * TILE
    // Esgota o timer para chegar ao 'over'.
    const exhaust = Math.ceil(TIME_START / FIXED_DT) + 10
    for (let i = 0; i < exhaust; i++) game.update(1)
    expect(game.state.get()).toBe('over')

    // Confirma volta ao select (delay E1): resetToSelect deve ter restaurado o bloco.
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')

    // Nenhum vazamento de bloco no level.
    expect(level.tiles[BUILDER_ROW][BUILDER_COL]).toBe('empty')
  })
})

// timer pausado no Modo + clamp -> over
describe('createGame — timer', () => {
  it('timer chega a 0 e transita para "over" quando fora do Modo', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    const exhaust = Math.ceil(TIME_START / FIXED_DT) + 5
    for (let i = 0; i < exhaust; i++) game.update(1)
    expect(game.state.get()).toBe('over')
  })
})

// (M2a Task 6) — integracao da animacao

// Mock de AssetStore: get() devolve um ImageAsset falso para as chaves listadas
// (default: so a arte procedural 'char.artur').
function makeStore(keys: string[] = ['char.artur']): AssetStore {
  const fakeAsset: ImageAsset = {
    src: {} as unknown as CanvasImageSource,
    w: 64,
    h: 96,
  }
  return {
    get: (key: string) => (keys.includes(key) ? fakeAsset : null),
    ready: true,
  }
}

describe('createGame — integracao M2a (animacao)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("SEM store: render usa drawPlaceholder (fallback), nunca drawAnimatedSprite", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel()) // 3 args = sem store
    selectFirst(game, input)
    game.render(0)
    expect(spriteDraw.drawAnimatedSprite).not.toHaveBeenCalled()
  })

  it("COM store: render desenha o player via drawAnimatedSprite", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    // artur tem arte procedural ('char.artur') no store; sem sheets M2b -> cai no procedural.
    selectArtur(game, input)
    game.render(0)
    expect(spriteDraw.drawAnimatedSprite).toHaveBeenCalledTimes(1)
    const call = (spriteDraw.drawAnimatedSprite as ReturnType<typeof vi.fn>).mock.calls[0]
    const p = game.player!
    // drawAnimatedSprite(r, asset, an, x, y, w, h, facing, body)
    // indices:            0  1      2   3  4  5  6  7       8
    // ancora nos pes: x = centro horizontal, y = base do corpo
    expect(call[3]).toBe(p.x + p.w / 2) // x
    expect(call[4]).toBe(p.y + p.h)     // y
    expect(call[7]).toBe(p.facing)      // facing
  })

  it("render no estado playing desenha o parallax e o sprite animado", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    selectFirst(game, input)
    game.render(0)
    expect(parallax.drawParallax).toHaveBeenCalledTimes(1)
    // clear acontece antes do parallax (fundo coberto por cima do COLOR_BG)
    expect(renderer.clear).toHaveBeenCalled()
    expect(particles.drawParticles).toHaveBeenCalledTimes(1)
  })

  it("render chama drawParticlesWorld DENTRO do bloco beginWorld/endWorld", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    selectFirst(game, input)
    game.render(0)
    expect(particles.drawParticlesWorld).toHaveBeenCalledTimes(1)
    // Ordem: beginWorld -> drawParticlesWorld -> endWorld (mundo), drawParticles depois (tela).
    const beginOrder = vi.mocked(renderer.beginWorld).mock.invocationCallOrder[0]
    const worldOrder = vi.mocked(particles.drawParticlesWorld).mock.invocationCallOrder[0]
    const endOrder = vi.mocked(renderer.endWorld).mock.invocationCallOrder[0]
    const screenOrder = vi.mocked(particles.drawParticles).mock.invocationCallOrder[0]
    expect(beginOrder).toBeLessThan(worldOrder)
    expect(worldOrder).toBeLessThan(endOrder)
    expect(endOrder).toBeLessThan(screenOrder)
  })

  it("render no select NAO chama drawParticlesWorld", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    enterSelect(game, input) // E1: boot em title
    expect(game.state.get()).toBe('select')
    game.render(0)
    expect(particles.drawParticlesWorld).not.toHaveBeenCalled()
  })

  it("i-frames: alpha 0.45 em frames alternados, NUNCA pula o draw, e restaura depois", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    selectArtur(game, input)
    const p = game.player!
    // Captura o globalAlpha NO MOMENTO do draw do sprite.
    let alphaAtDraw = -1
    vi.mocked(spriteDraw.drawAnimatedSprite).mockImplementation((r: Renderer) => {
      alphaAtDraw = r.ctx.globalAlpha
    })
    // iframes com bit (iframes>>2)&1 == 1 -> desenha COM alpha 0.45
    p.iframes = 4 // (4>>2)&1 = 1
    game.render(0)
    expect(spriteDraw.drawAnimatedSprite).toHaveBeenCalledTimes(1)
    expect(alphaAtDraw).toBeCloseTo(0.45, 5)
    // alpha restaurado apos o draw (save/restore)
    expect(renderer.ctx.globalAlpha).toBe(1)
    // iframes com bit 0 -> desenha com alpha cheio
    vi.clearAllMocks()
    p.iframes = 8 // (8>>2)&1 = 0
    game.render(0)
    expect(spriteDraw.drawAnimatedSprite).toHaveBeenCalledTimes(1)
    expect(alphaAtDraw).toBe(1)
    vi.mocked(spriteDraw.drawAnimatedSprite).mockReset()
  })

  it("update no estado playing nao lanca com store presente", () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    selectFirst(game, input)
    expect(() => game.update(1)).not.toThrow()
  })
})

// (M2b) — arte por personagem: a cascata drawCharFrame -> procedural -> placeholder
// nunca empresta a arte do artur para outro personagem.
describe('createGame — arte por personagem (M2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renan + store so com arte do artur: cai no drawPlaceholder, nunca drawAnimatedSprite', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore(['char.artur']))
    selectFirst(game, input) // renan (index 0)
    expect(game.player!.char.id).toBe('renan')
    game.render(0)
    expect(spriteDraw.drawAnimatedSprite).not.toHaveBeenCalled()
    expect(renderer.ctx.drawImage).not.toHaveBeenCalled()
    expect(sprites.drawPlaceholder).toHaveBeenCalledTimes(1)
    const charArg = vi.mocked(sprites.drawPlaceholder).mock.calls[0][1]
    expect(charArg.id).toBe('renan')
  })

  it('artur + store com os sheets: desenha via drawCharFrame (ctx.drawImage), sem fallback', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const store = makeStore([
      'char.artur',
      'char.artur.idle',
      'char.artur.corrida',
      'char.artur.pulo',
      'char.artur.queda',
      'char.artur.danificado',
    ])
    const game = createGame(renderer, input, makeLevel(), store)
    selectArtur(game, input)
    expect(game.player!.char.id).toBe('artur')
    game.render(0)
    expect(renderer.ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(spriteDraw.drawAnimatedSprite).not.toHaveBeenCalled()
    expect(sprites.drawPlaceholder).not.toHaveBeenCalled()
  })

  it('render no select com store: card do artur usa a arte real (ctx.drawImage)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore(['char.artur.idle']))
    enterSelect(game, input) // E1: boot em title
    expect(game.state.get()).toBe('select')
    game.render(0)
    expect(renderer.ctx.drawImage).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// (M2 fase B) hurt separado, hitstop, shake, cast, victory, sombra, animator
// ============================================================================

describe('createGame — M2 fase B: updateAnimator recebe hurtTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateAnimator e chamado com p.hurtTimer (e NAO com p.iframes)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    const p = game.player!
    p.hurtTimer = 7
    p.iframes = 50 // valor diferente para flagrar regressao
    vi.clearAllMocks()
    game.update(1)
    const spy = vi.mocked(animator.updateAnimator)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe(p)
    expect(spy.mock.calls[0][2]).toBe(7) // hurtTimer no momento da chamada
    expect(spy.mock.calls[0][3]).toBe(1) // dt
    // tickPlayerTimers decrementa DEPOIS da chamada
    expect(p.hurtTimer).toBe(6)
  })
})

describe('createGame — M2 fase B: hitstop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dano "hit" congela o mundo por HITSTOP_FRAMES updates e depois expira', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([{ x: 2 * TILE + 4, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 3
    p.hearts = 3
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1) // frame do dano -> hitstop armado
    expect(game.state.get()).toBe('playing')
    expect(p.hearts).toBe(2) // o hit conectou
    expect(p.hurtTimer).toBe(HURT_FRAMES - 1) // setado no dano, 1 tick no mesmo frame

    const e = game.enemies[0]
    const ex = e.x
    const px = p.x
    // HITSTOP_FRAMES updates congelados: nada se move.
    for (let i = 0; i < HITSTOP_FRAMES; i++) {
      game.update(1)
      expect(e.x).toBe(ex)
      expect(p.x).toBe(px)
    }
    // Expirou: mundo volta a rodar (inimigo anda).
    game.update(1)
    expect(e.x).not.toBe(ex)
  })
})

describe('createGame — M2 fase B: screen-shake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('apos "hit", beginWorld recebe cam+offset deterministico; expira e volta a (0,0)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([{ x: 2 * TILE + 4, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    p.lives = 3
    p.hearts = 3
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1) // hit -> shakeT = SHAKE_FRAMES (cam fica em (0,0) perto do spawn)
    // G4: com o jump-cut (G1), o arco do knockback mudou e o player caia em cima
    // do tolo (stomp incidental re-armava shakeT=4). Mata o tolo: o teste mede
    // SO o decaimento do shake do dano.
    game.enemies[0].alive = false

    vi.mocked(renderer.beginWorld).mockClear()
    game.render(0)
    const dx = Math.round(Math.sin(SHAKE_FRAMES * 2.7) * SHAKE_PX)
    const dy = Math.round(Math.cos(SHAKE_FRAMES * 1.9) * SHAKE_PX * 0.6)
    expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0) // sanity: offset real
    expect(renderer.beginWorld).toHaveBeenCalledWith(0 + dx, 0 + dy)

    // Consome hitstop + shake; sem offset depois de expirar.
    for (let i = 0; i < HITSTOP_FRAMES + SHAKE_FRAMES; i++) game.update(1)
    vi.mocked(renderer.beginWorld).mockClear()
    game.render(0)
    expect(renderer.beginWorld).toHaveBeenCalledWith(0, 0)
  })

  it('resetToSelect zera shake/hitstop: nova rodada renderiza sem offset', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // Inimigo LONGE do spawn (a nova rodada nao pode tomar dano de novo).
    const level = makeLevel([{ x: 20 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.lives = 3
    p.hearts = 3
    p.iframes = 0
    p.vy = 0
    p.x = 20 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1) // hit -> shakeT/hitstop armados
    for (let i = 0; i < HITSTOP_FRAMES; i++) game.update(1) // consome hitstop
    // Vai ao goal com shake ainda ativo -> win.
    p.x = level.goal.x
    p.y = level.goal.y
    p.vx = 0
    p.vy = 0
    game.update(1)
    expect(game.state.get()).toBe('win')
    // Confirm (delay E1) -> select -> nova rodada. Os 45 frames extras passam
    // no estado WIN (update retorna cedo): shake/hitstop NAO decaem la.
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
    selectFirst(game, input)
    // C4 (camera com easing): a cam converge ao spawn em poucos frames e o
    // clamp em 0 a torna EXATAMENTE (0,0). 5 updates + o do selectFirst = 6
    // updates em playing — ainda MENOS que SHAKE_FRAMES (8): um shake nao
    // resetado ainda produziria offset != 0 aqui (o teste mantem o gume).
    for (let i = 0; i < 5; i++) game.update(1)
    vi.mocked(renderer.beginWorld).mockClear()
    game.render(0)
    expect(renderer.beginWorld).toHaveBeenCalledWith(0, 0)
  })
})

describe('createGame — M2 fase B: cast one-shot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builder (artur): ativar a habilidade dispara triggerOneShot("cast", CAST_FRAMES) uma vez', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectArtur(game, input)
    const spy = vi.mocked(animator.triggerOneShot)
    vi.clearAllMocks()

    game.update(1) // sem apertar: nada
    expect(spy).not.toHaveBeenCalled()

    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe('cast')
    expect(spy.mock.calls[0][2]).toBe(CAST_FRAMES)

    // Reapertar em cooldown NAO redispara.
    game.update(1)
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('dash (dante): dispara na ATIVACAO e nao redispara quando o dash termina', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectDante(game, input)
    const spy = vi.mocked(animator.triggerOneShot)
    vi.clearAllMocks()

    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe('cast')

    // Dash dura dashFrames e ao terminar ARMA cooldown — nao pode redisparar cast.
    for (let i = 0; i < 20; i++) game.update(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('salto visionario (renan): pulo aereo dispara cast (sinal = airJumps consumido)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input) // renan
    const p = game.player!
    // Poe o player no ar (longe do chao).
    p.y = 5 * TILE
    p.vy = 0
    p.onGround = false
    const spy = vi.mocked(animator.triggerOneShot)
    vi.clearAllMocks()

    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe('cast')
    expect(spy.mock.calls[0][2]).toBe(CAST_FRAMES)
  })
})

describe('createGame — M2 fase B: victory one-shot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tocar o goal dispara triggerOneShot("victory", 9999) junto com state win', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.x = level.goal.x
    p.y = level.goal.y
    vi.clearAllMocks()
    game.update(1)
    expect(game.state.get()).toBe('win')
    const spy = vi.mocked(animator.triggerOneShot)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toBe('victory')
    expect(spy.mock.calls[0][2]).toBe(9999)
  })
})

// ============================================================================
// (C3b) blocos '?', heart-orbs, checkpoints, timer do level, variants/atlas
// ============================================================================

// Teleporta o player para baixo do bloco em (col, 5) e sobe contra ele:
// vy=-6 -> apos gravidade -5.2 -> topo entra na row 5 -> fisica zera vy (teto).
function bumpQBlock(
  game: ReturnType<typeof createGame>,
  col: number,
): void {
  const p = game.player!
  p.x = col * TILE
  p.y = 6 * TILE + 2 // 2px abaixo da base do bloco (row 5)
  p.vx = 0
  p.vy = -6
  p.onGround = false
  game.update(1)
}

describe("createGame — blocos '?' (C3b)", () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it("payload 'coin': bump da +8 no medidor e NAO premia duas vezes", () => {
    const level = makeLevel([], [], {
      qBlocks: [{ col: 5, row: 5, payload: 'coin' }],
    })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    expect(game.humanware.meter).toBe(0)

    bumpQBlock(game, 5)
    expect(game.humanware.meter).toBe(8)

    // Bump de novo no MESMO bloco (ja usado): nada muda.
    bumpQBlock(game, 5)
    expect(game.humanware.meter).toBe(8)
  })

  it("payload 'item': restaura 1 coracao com cap no maximo do personagem", () => {
    const level = makeLevel([], [], {
      qBlocks: [
        { col: 5, row: 5, payload: 'item' },
        { col: 8, row: 5, payload: 'item' },
      ],
    })
    const game = createGame(renderer, input, level)
    selectFirst(game, input) // renan: hearts max 3
    const p = game.player!

    p.hearts = 1
    bumpQBlock(game, 5)
    expect(p.hearts).toBe(2)
    // item nao mexe no medidor
    expect(game.humanware.meter).toBe(0)

    // Com hearts no maximo: bump no segundo bloco nao passa do cap.
    p.hearts = p.char.hearts
    bumpQBlock(game, 8)
    expect(p.hearts).toBe(p.char.hearts)
  })

  it("payload 'star': bump da +30 no medidor", () => {
    const level = makeLevel([], [], {
      qBlocks: [{ col: 5, row: 5, payload: 'star' }],
    })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)

    bumpQBlock(game, 5)
    expect(game.humanware.meter).toBe(30)
  })

  it("render: '?' fechado desenha o glifo lime; usado desenha veu escuro", () => {
    const level = makeLevel([], [], {
      qBlocks: [{ col: 5, row: 5, payload: 'coin' }],
    })
    const game = createGame(renderer, input, level) // sem store -> fallback rect
    selectFirst(game, input)

    // Fechado: glifo '?' via ctx.fillText.
    game.render(0)
    const fillText = vi.mocked(renderer.ctx.fillText)
    expect(fillText.mock.calls.some((c) => c[0] === '?')).toBe(true)

    // Usa o bloco e re-renderiza: veu escuro alpha 0.35, sem glifo.
    bumpQBlock(game, 5)
    vi.mocked(renderer.drawRect).mockClear()
    fillText.mockClear()
    game.render(0)
    expect(fillText.mock.calls.some((c) => c[0] === '?')).toBe(false)
    const veil = vi
      .mocked(renderer.drawRect)
      .mock.calls.find(
        (c) =>
          c[0] === 5 * TILE &&
          c[1] === 5 * TILE &&
          c[2] === TILE &&
          c[3] === TILE &&
          c[4] === 'rgba(0,0,0,0.35)',
      )
    expect(veil).toBeDefined()
  })
})

describe('createGame — heart-orbs (C3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('coletar coracao soma +25 no medidor e some (nao re-coleta)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [], { hearts: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!

    // Caixa fixa do heart: 20px centrada na celula (5,8) -> (254..274, 398..418).
    p.x = 250
    p.y = 390
    p.vy = 0
    game.update(1)
    expect(game.humanware.meter).toBe(25)

    // Continua em cima: nao re-coleta.
    game.update(1)
    expect(game.humanware.meter).toBe(25)
  })

  it('render desenha o heart-orb como coracao pixel (varios rects COLOR_OBJETIVO, pulso ~20px)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [], { hearts: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)

    game.render(0)
    // D4: coracao por codigo — varios fillRects magenta dentro da caixa do orb
    // (centro 264,408; caixa fixa 20px com pulso ±2px).
    const rects = vi
      .mocked(renderer.drawRect)
      .mock.calls.filter(
        (c) =>
          c[4] === COLOR_OBJETIVO &&
          (c[0] as number) >= 248 &&
          (c[0] as number) <= 280 &&
          (c[1] as number) >= 392 &&
          (c[1] as number) <= 420,
      )
    expect(rects.length).toBeGreaterThanOrEqual(5)
    // A linha mais larga do coracao tem ~s de largura (20 ± 2 do pulso).
    const maxW = Math.max(...rects.map((c) => c[2] as number))
    expect(maxW).toBeGreaterThanOrEqual(18)
    expect(maxW).toBeLessThanOrEqual(22)
  })
})

describe('createGame — checkpoints (C3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cruzar a coluna do checkpoint muda o respawn apos perder vida', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // Inimigo na col 12 (depois do checkpoint na col 10), longe do spawn.
    const level = makeLevel(
      [{ x: 12 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      [],
      { checkpoints: [10] },
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.lives = 2
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    // Teleporta para o inimigo: o MESMO update cruza o checkpoint (1b) e toma o
    // hit com perda de vida (passo 6) -> respawn no checkpoint, nao no spawn.
    p.x = 12 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    expect(game.state.get()).toBe('playing')
    expect(p.x).toBe(10 * TILE)
    expect(p.y).toBe(level.playerSpawn.y)
  })

  it('resetToSelect re-zera o checkpoint: rodada nova respawna no spawn', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // Inimigo junto ao spawn (para o hit da rodada 2); checkpoint na col 10.
    const level = makeLevel(
      [{ x: 2 * TILE + 4, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      [],
      { checkpoints: [10] },
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!

    // Rodada 1: cruza o checkpoint e vence.
    p.x = 11 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    p.x = level.goal.x
    p.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    confirmResult(game, input) // delay E1
    expect(game.state.get()).toBe('select')

    // Rodada 2: perde vida SEM cruzar o checkpoint -> respawn no spawn original.
    selectFirst(game, input)
    drainHitstop(game)
    const p2 = game.player!
    p2.lives = 2
    p2.hearts = 1
    p2.iframes = 0
    p2.vy = 0
    p2.x = 2 * TILE
    p2.y = 8 * TILE + (TILE - 34)
    game.update(1)
    expect(game.state.get()).toBe('playing')
    expect(p2.x).toBe(level.playerSpawn.x)
  })
})

describe('createGame — timer do level (C3b)', () => {
  it('timer usa level.timeStart (nao TIME_START fixo)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [], { timeStart: 10 })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)

    // 10 / FIXED_DT = 600 updates ate zerar. Na metade ainda esta playing.
    for (let i = 0; i < 300; i++) game.update(1)
    expect(game.state.get()).toBe('playing')

    for (let i = 0; i < 305; i++) game.update(1)
    expect(game.state.get()).toBe('over')
  })
})

describe('createGame — tiles com arte + variants recomputadas (C3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('com store de tiles: chao desenhado via drawSprite (atlas)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(
      renderer,
      input,
      makeLevel(),
      makeStore(['tiles.terra', 'tiles.tijolo']),
    )
    selectFirst(game, input)
    game.render(0)
    const calls = vi.mocked(renderer.drawSprite).mock.calls
    // Celula de chao (0,9) visivel com cam(0,0): dx=0, dy=9*TILE.
    expect(calls.some((c) => c[5] === 0 && c[6] === 9 * TILE)).toBe(true)
  })

  it('builder: bloco temporario desenha via atlas com variant RECOMPUTADA e some ao restaurar', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(
      renderer,
      input,
      level,
      makeStore(['tiles.terra', 'tiles.tijolo']),
    )
    selectArtur(game, input)
    expect(game.player!.char.id).toBe('artur')

    // Antes do builder: nenhum drawSprite na celula (2,8).
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    let calls = vi.mocked(renderer.drawSprite).mock.calls
    expect(calls.some((c) => c[5] === 2 * TILE && c[6] === 8 * TILE)).toBe(false)

    // Ativa o builder: escreve 'block' em (2,8) -> variants recomputadas.
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    game.update(1)
    expect(level.tiles[8][2]).toBe('block')

    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    calls = vi.mocked(renderer.drawSprite).mock.calls
    const blockCall = calls.find((c) => c[5] === 2 * TILE && c[6] === 8 * TILE)
    expect(blockCall).toBeDefined()
    // Variant 4 (vizinho solido SO ao Sul): celula [3,0] do atlas -> sx=144, sy=0.
    // Variants velhas dariam variant 0 -> celula [2,1] (sx=96, sy=48): flagra
    // a falta de recompute.
    expect(blockCall![1]).toBe(144) // sx
    expect(blockCall![2]).toBe(0) // sy

    // Expira o TTL (builderTtl=240): tile restaurado -> sem drawSprite na celula.
    for (let i = 0; i < 245; i++) game.update(1)
    expect(level.tiles[8][2]).toBe('empty')
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    calls = vi.mocked(renderer.drawSprite).mock.calls
    expect(calls.some((c) => c[5] === 2 * TILE && c[6] === 8 * TILE)).toBe(false)
  })
})

describe('createGame — M2 fase B: sombra de contato', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('drawContactShadow e chamado ANTES do sprite (caminho procedural)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel(), makeStore())
    selectArtur(game, input)
    const p = game.player!
    vi.clearAllMocks()
    game.render(0)
    const shadow = vi.mocked(spriteAnim.drawContactShadow)
    expect(shadow).toHaveBeenCalledTimes(1)
    const call = shadow.mock.calls[0]
    // drawContactShadow(r, cx, footY, w, onGround)
    expect(call[1]).toBe(p.x + p.w / 2)
    expect(call[2]).toBe(p.y + p.h)
    expect(call[3]).toBe(p.w)
    expect(call[4]).toBe(p.onGround)
    // Ordem: sombra antes do sprite.
    expect(shadow.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(spriteDraw.drawAnimatedSprite).mock.invocationCallOrder[0],
    )
  })

  it('drawContactShadow tambem no caminho placeholder (sem store)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel()) // sem store
    selectFirst(game, input) // renan, sem arte
    vi.clearAllMocks()
    game.render(0)
    const shadow = vi.mocked(spriteAnim.drawContactShadow)
    expect(shadow).toHaveBeenCalledTimes(1)
    expect(shadow.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sprites.drawPlaceholder).mock.invocationCallOrder[0],
    )
  })
})

// ============================================================================
// (D4) eventos de SFX, clock global, arte de objetos, holograma do builder,
// particulas de evento e vinheta do Humanware
// ============================================================================

// Grava (fillStyle, globalAlpha, args) de cada ctx.fillRect do renderer fake.
function recordFills(
  renderer: Renderer,
): Array<{ style: unknown; alpha: number; args: unknown[] }> {
  const fills: Array<{ style: unknown; alpha: number; args: unknown[] }> = []
  vi.mocked(renderer.ctx.fillRect).mockImplementation((...args: unknown[]) => {
    fills.push({
      style: (renderer.ctx as unknown as { fillStyle: unknown }).fillStyle,
      alpha: renderer.ctx.globalAlpha,
      args,
    })
  })
  return fills
}

describe('createGame — eventos de SFX (D4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it("coleta de moeda empilha 'coin'", () => {
    const level = makeLevel([], [{ x: 5 * TILE, y: 8 * TILE }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    const p = game.player!
    p.x = 5 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    expect(game.events).toContain('coin')
  })

  it("stomp empilha 'stomp'", () => {
    const level = makeLevel([{ x: 6 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    const p = game.player!
    p.x = 6 * TILE
    p.y = 8 * TILE + (TILE - 34) - p.h + 4
    p.vy = 5
    game.update(1)
    expect(game.events).toContain('stomp')
  })

  it("bump no bloco '?' empilha 'qblock'", () => {
    const level = makeLevel([], [], { qBlocks: [{ col: 5, row: 5, payload: 'coin' }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    bumpQBlock(game, 5)
    expect(game.events).toContain('qblock')
  })

  it("coleta de heart-orb empilha 'heart'", () => {
    const level = makeLevel([], [], { hearts: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    const p = game.player!
    p.x = 250
    p.y = 390
    p.vy = 0
    game.update(1)
    expect(game.events).toContain('heart')
  })

  it("cruzar checkpoint empilha 'checkpoint'", () => {
    const level = makeLevel([], [], { checkpoints: [10] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    const p = game.player!
    p.x = 11 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    expect(game.events).toContain('checkpoint')
  })

  it("tocar o goal empilha 'win'", () => {
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    expect(game.events).toContain('win')
  })

  it("dano conectado empilha 'hurt'; uso de habilidade empilha 'cast'", () => {
    const level = makeLevel([{ x: 12 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectArtur(game, input)
    const p = game.player!
    // cast (builder do artur)
    game.events.length = 0
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    expect(game.events).toContain('cast')
    // hurt: teleporta para o inimigo sem i-frames
    game.update(1)
    game.events.length = 0
    p.lives = 3
    p.hearts = 3
    p.iframes = 0
    p.vy = 0
    p.x = 12 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    expect(game.events).toContain('hurt')
  })

  it('fila de eventos limitada a 16 (descarta o excedente)', () => {
    // 20 moedas no MESMO lugar: a coleta de todas em 1 frame estoura o cap.
    const coins = Array.from({ length: 20 }, () => ({ x: 5 * TILE, y: 8 * TILE }))
    const level = makeLevel([], coins)
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.events.length = 0
    const p = game.player!
    p.x = 5 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    expect(game.events.length).toBeLessThanOrEqual(16)
    expect(game.events.filter((e) => e === 'coin')).toHaveLength(16)
  })
})

describe('createGame — clock global e arte de objetos (D4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Acha a chamada de drawSprite da MOEDA (destino 32x32).
  function findMoeda(renderer: Renderer): unknown[] | undefined {
    return vi
      .mocked(renderer.drawSprite)
      .mock.calls.find((c) => c[7] === 32 && c[8] === 32)
  }

  it('moeda anima pelo clock (avanca no playing) e o clock reseta no select', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [{ x: 5 * TILE, y: 8 * TILE }])
    const game = createGame(renderer, input, level, makeStore(['obj.moeda']))
    selectFirst(game, input) // clock=1 (1 update em playing)

    // frame 0 do spin: sx=0
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    let moeda = findMoeda(renderer)
    expect(moeda).toBeDefined()
    expect(moeda![1]).toBe(0) // sx
    // destino: 32x32 centrado no tile da moeda
    expect(moeda![5]).toBe(5 * TILE + TILE / 2 - 16)
    expect(moeda![6]).toBe(8 * TILE + TILE / 2 - 16)

    // +11 updates -> clock=12 -> frame 2 (fps 10) -> sx = 2*64 = 128
    for (let i = 0; i < 11; i++) game.update(1)
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    moeda = findMoeda(renderer)
    expect(moeda![1]).toBe(128)

    // win -> confirm (delay E1) -> select -> nova rodada: clock zerado -> sx=0 de novo
    const p = game.player!
    p.x = level.goal.x
    p.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
    selectFirst(game, input)
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    moeda = findMoeda(renderer)
    expect(moeda![1]).toBe(0)
  })

  it('portal: com store desenha via drawSprite 96x96 com base no chao do tile do goal', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level, makeStore(['obj.portal']))
    selectFirst(game, input)
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    const portal = vi
      .mocked(renderer.drawSprite)
      .mock.calls.find((c) => c[7] === 96 && c[8] === 96)
    expect(portal).toBeDefined()
    // centrado na coluna do goal, base no chao do tile
    expect(portal![5]).toBe(level.goal.x + TILE / 2 - 48)
    expect(portal![6]).toBe(level.goal.y + TILE - 96)
  })

  it('sem store: moeda cai no rect lime e goal no rect magenta (fallback)', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [{ x: 5 * TILE, y: 8 * TILE }])
    const game = createGame(renderer, input, level) // sem store
    selectFirst(game, input)
    vi.mocked(renderer.drawRect).mockClear()
    game.render(0)
    const rects = vi.mocked(renderer.drawRect).mock.calls
    const coinOff = (TILE - 26) / 2
    expect(
      rects.some(
        (c) =>
          c[0] === 5 * TILE + coinOff &&
          c[1] === 8 * TILE + coinOff &&
          c[2] === 26 &&
          c[3] === 26 &&
          c[4] === COLOR_COLETAVEL,
      ),
    ).toBe(true)
    expect(
      rects.some(
        (c) =>
          c[0] === level.goal.x &&
          c[1] === level.goal.y &&
          c[2] === TILE &&
          c[3] === TILE &&
          c[4] === COLOR_OBJETIVO,
      ),
    ).toBe(true)
    expect(renderer.drawSprite).not.toHaveBeenCalled()
  })
})

describe('createGame — holograma do builder (D4)', () => {
  it('fill ciano alpha 0.25 + brackets; pisca 0.3/0.1 nos ultimos 60 frames do TTL', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectArtur(game, input)
    const fills = recordFills(renderer)

    // Ativa o builder (bloco em (2,8)); 1 update extra -> ttl=239.
    input.set('ability', true)
    game.update(1)
    input.set('ability', false)
    game.update(1)
    expect(level.tiles[8][2]).toBe('block')

    fills.length = 0
    game.render(0)
    let holo = fills.filter((f) => f.style === COLOR_TECH)
    expect(holo).toHaveLength(1)
    expect(holo[0].alpha).toBeCloseTo(0.25, 5)
    expect(holo[0].args).toEqual([2 * TILE, 8 * TILE, TILE, TILE])
    // Brackets: 8 linhas 2px COLOR_TECH via drawRect na celula.
    const brackets = vi
      .mocked(renderer.drawRect)
      .mock.calls.filter(
        (c) =>
          c[4] === COLOR_TECH &&
          (c[2] === 2 || c[3] === 2) &&
          (c[0] as number) >= 2 * TILE &&
          (c[0] as number) < 3 * TILE &&
          (c[1] as number) >= 8 * TILE &&
          (c[1] as number) < 9 * TILE,
      )
    expect(brackets.length).toBeGreaterThanOrEqual(8)

    // Avanca ate ttl=60: floor(60/8)=7 (impar) -> alpha 0.3.
    for (let i = 0; i < 179; i++) game.update(1)
    fills.length = 0
    game.render(0)
    holo = fills.filter((f) => f.style === COLOR_TECH)
    expect(holo).toHaveLength(1)
    expect(holo[0].alpha).toBeCloseTo(0.3, 5)

    // +8 updates: ttl=52, floor(52/8)=6 (par) -> alpha 0.1 (piscou).
    for (let i = 0; i < 8; i++) game.update(1)
    fills.length = 0
    game.render(0)
    holo = fills.filter((f) => f.style === COLOR_TECH)
    expect(holo).toHaveLength(1)
    expect(holo[0].alpha).toBeCloseTo(0.1, 5)
  })
})

describe('createGame — particulas de evento (D4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('coin: burst de 8 COLETAVEL no centro do tile da moeda (world)', () => {
    const level = makeLevel([], [{ x: 5 * TILE, y: 8 * TILE }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    vi.mocked(particles.emitBurst).mockClear()
    const p = game.player!
    p.x = 5 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    const call = vi
      .mocked(particles.emitBurst)
      .mock.calls.find((c) => c[3] === 8 && (c[4] as string[])[0] === COLOR_COLETAVEL)
    expect(call).toBeDefined()
    expect(call![1]).toBe(5 * TILE + TILE / 2)
    expect(call![2]).toBe(8 * TILE + TILE / 2)
    expect(call![5]).toBe('world')
  })

  it('stomp: burst de 12 PERIGO no inimigo (world)', () => {
    const level = makeLevel([{ x: 6 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    vi.mocked(particles.emitBurst).mockClear()
    const p = game.player!
    p.x = 6 * TILE
    p.y = 8 * TILE + (TILE - 34) - p.h + 4
    p.vy = 5
    game.update(1)
    const call = vi
      .mocked(particles.emitBurst)
      .mock.calls.find((c) => c[3] === 12 && (c[4] as string[])[0] === COLOR_PERIGO)
    expect(call).toBeDefined()
    expect(call![5]).toBe('world')
  })

  it('land: burst de 5 poeira nos pes quando updateAnimator reporta landed', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    vi.mocked(particles.emitBurst).mockClear()
    vi.mocked(animator.updateAnimator).mockReturnValueOnce({ landed: true })
    game.update(1)
    const p = game.player!
    const call = vi.mocked(particles.emitBurst).mock.calls.find((c) => c[3] === 5)
    expect(call).toBeDefined()
    expect(call![1]).toBe(p.x + p.w / 2)
    expect(call![2]).toBe(p.y + p.h)
    expect(call![5]).toBe('world')
  })

  it("jump: burst de 3 poeira nos pes + evento 'jump'", () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    // Espera o player assentar no chao.
    for (let i = 0; i < 10; i++) game.update(1)
    expect(game.player!.onGround).toBe(true)
    vi.mocked(particles.emitBurst).mockClear()
    game.events.length = 0
    input.set('jump', true)
    game.update(1)
    input.set('jump', false)
    expect(game.events).toContain('jump')
    const call = vi.mocked(particles.emitBurst).mock.calls.find((c) => c[3] === 3)
    expect(call).toBeDefined()
    expect(call![5]).toBe('world')
  })
})

describe('createGame — vinheta do Humanware (D4)', () => {
  it('bordas OBJETIVO (0.15/0.07) + veu escuro 0.06 SO com o Modo ativo', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    // 125 coins (=1000=HW_METER_MAX) para encher o medidor.
    const coins = Array.from({ length: 125 }, (_, i) => ({
      x: (3 + (i % 30)) * TILE,
      y: 8 * TILE,
    }))
    const level = makeLevel([], coins)
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const fills = recordFills(renderer)

    // SEM Modo ativo: nenhuma faixa magenta de vinheta.
    fills.length = 0
    game.render(0)
    expect(fills.filter((f) => f.style === COLOR_OBJETIVO && f.alpha === 0.15)).toHaveLength(0)

    // Enche o medidor e ativa.
    const p = game.player!
    for (const c of level.coins) {
      p.x = c.x
      p.y = c.y
      p.vy = 0
      game.update(1)
    }
    expect(game.humanware.meter).toBe(HW_METER_MAX)
    game.events.length = 0
    input.set('humanware', true)
    game.update(1)
    input.set('humanware', false)
    // D4: ativacao real empilha o SFX 'humanware'.
    expect(game.events).toContain('humanware')

    fills.length = 0
    game.render(0)
    // 4 faixas externas (0.15) + 4 internas (0.07) em COLOR_OBJETIVO + veu '#000' 0.06.
    expect(fills.filter((f) => f.style === COLOR_OBJETIVO && f.alpha === 0.15)).toHaveLength(4)
    expect(fills.filter((f) => f.style === COLOR_OBJETIVO && f.alpha === 0.07)).toHaveLength(4)
    expect(fills.filter((f) => f.style === '#000' && f.alpha === 0.06)).toHaveLength(1)
  })
})

// ============================================================================
// (E1) fluxo de telas: title, pause e resultado win/over com score canonico
// ============================================================================

// Todos os textos desenhados via ctx.fillText desde o ultimo mockClear.
function textsOf(renderer: Renderer): string[] {
  return vi.mocked(renderer.ctx.fillText).mock.calls.map((c) => String(c[0]))
}

describe('createGame — E1: title', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it("jump tambem sai do title para 'select'", () => {
    const game = createGame(renderer, input, makeLevel())
    expect(game.state.get()).toBe('title')
    input.set('jump', true)
    game.update(1)
    expect(game.state.get()).toBe('select')
  })

  it('render do title: wordmark + subtitulo + PRESS ENTER piscando; SEM HUD', () => {
    const game = createGame(renderer, input, makeLevel())
    game.render(0) // uiClock=0 -> (floor(0/30)&1)===0 -> visivel
    let texts = textsOf(renderer)
    expect(texts).toContain('GRAVIDADE ZERO')
    expect(texts).toContain('O JOGO')
    expect(texts).toContain('PRESS ENTER')
    // HUD nao aparece no title.
    expect(texts.some((t) => t.startsWith('TIME'))).toBe(false)
    // Particulas ambiente desenhadas em screen space no title.
    expect(particles.drawParticles).toHaveBeenCalled()

    // 30 frames de title: fase de blink oculta (floor(30/30)&1 === 1).
    for (let i = 0; i < 30; i++) game.update(1)
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    texts = textsOf(renderer)
    expect(texts).toContain('GRAVIDADE ZERO')
    expect(texts).not.toContain('PRESS ENTER')

    // +30 frames: visivel de novo (floor(60/30)&1 === 0).
    for (let i = 0; i < 30; i++) game.update(1)
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    expect(textsOf(renderer)).toContain('PRESS ENTER')
  })
})

describe('createGame — E1: pause', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('ESC alterna playing->paused e congela TUDO (inimigo e player imoveis)', () => {
    const level = makeLevel([{ x: 20 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    expect(game.state.get()).toBe('playing')

    input.set('pause', true)
    game.update(1)
    input.set('pause', false)
    expect(game.state.get()).toBe('paused')

    const e = game.enemies[0]
    const ex = e.x
    const px = game.player!.x
    for (let i = 0; i < 30; i++) game.update(1)
    expect(game.state.get()).toBe('paused')
    expect(e.x).toBe(ex) // mundo congelado
    expect(game.player!.x).toBe(px)
  })

  it('ESC de novo volta ao playing (mundo anda); confirm tambem despausa', () => {
    const level = makeLevel([{ x: 20 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)

    // Pausa.
    input.set('pause', true)
    game.update(1)
    input.set('pause', false)
    game.update(1)
    expect(game.state.get()).toBe('paused')

    // ESC despausa; o mundo volta a andar.
    input.set('pause', true)
    game.update(1)
    input.set('pause', false)
    expect(game.state.get()).toBe('playing')
    const e = game.enemies[0]
    const ex = e.x
    game.update(1)
    expect(e.x).not.toBe(ex)

    // Pausa de novo e despausa com confirm.
    input.set('pause', true)
    game.update(1)
    input.set('pause', false)
    game.update(1)
    expect(game.state.get()).toBe('paused')
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    expect(game.state.get()).toBe('playing')
  })

  it('render do paused: veu 0.6 + titulo PAUSA + lista de controles + HUD mantido', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    input.set('pause', true)
    game.update(1)
    input.set('pause', false)
    expect(game.state.get()).toBe('paused')

    const fills = recordFills(renderer)
    fills.length = 0
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)

    // Veu escuro alpha 0.6 por cima do mundo.
    expect(fills.some((f) => f.style === '#000' && f.alpha === 0.6)).toBe(true)
    const texts = textsOf(renderer)
    expect(texts).toContain('PAUSA')
    expect(texts).toContain('←/→  ANDAR')
    expect(texts).toContain('SHIFT  CORRER')
    expect(texts).toContain('ESPAÇO  PULAR')
    expect(texts).toContain('J  HABILIDADE')
    expect(texts).toContain('H  HUMANWARE (medidor cheio)')
    expect(texts).toContain('ESC  CONTINUAR')
    // HUD se MANTEM no pause (so some em win/over).
    expect(texts.some((t) => t.startsWith('TIME'))).toBe(true)
  })
})

describe('createGame — E1: resultado win (painel + score + delay)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  // Leva o jogo ao win com 2 moedas coletadas e 1 stomp (stats conhecidos).
  function winWithStats(): ReturnType<typeof createGame> {
    const level = makeLevel(
      [{ x: 20 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      [
        { x: 4 * TILE, y: 8 * TILE },
        { x: 5 * TILE, y: 8 * TILE },
      ],
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Stomp no tolo (na posicao ATUAL dele).
    const e = game.enemies[0]
    p.x = e.x
    p.y = e.y - p.h + 4
    p.vy = 5
    game.update(1)
    expect(e.alive).toBe(false)
    // Coleta as 2 moedas.
    for (const c of level.coins) {
      p.x = c.x
      p.y = c.y
      p.vy = 0
      game.update(1)
    }
    // Goal.
    p.x = level.goal.x
    p.y = level.goal.y
    p.vy = 0
    game.update(1)
    expect(game.state.get()).toBe('win')
    return game
  }

  it('painel mostra MOEDAS/TOLOS/TEMPO/SCORE com os valores canonicos (100/200/1000/50s)', () => {
    const game = winWithStats()
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    const texts = textsOf(renderer)
    expect(texts).toContain('ZONA CONCLUÍDA')
    expect(texts).toContain('MOEDAS x2')
    expect(texts).toContain('TOLOS x1')
    const tempoLine = texts.find((t) => /^TEMPO RESTANTE \d+s$/.test(t))
    expect(tempoLine).toBeDefined()
    const tempo = Number(/(\d+)/.exec(tempoLine!)![1])
    expect(tempo).toBeGreaterThan(0)
    const scoreLine = texts.find((t) => /^SCORE \d+$/.test(t))
    expect(scoreLine).toBeDefined()
    const score = Number(/SCORE (\d+)/.exec(scoreLine!)![1])
    // SCORE canonico: 2 moedas x100 + 1 stomp x200 + fase 1000 + tempo x50
    // (RulesConfig §3.8 + §9.6.1/§9.6.4 do spec mestre).
    expect(score).toBe(2 * 100 + 1 * 200 + 1000 + tempo * 50)
    // HUD oculto no win.
    expect(texts.some((t) => t.startsWith('TIME '))).toBe(false)
  })

  it('painel do win tem borda 4px em COLOR_OBJETIVO', () => {
    const game = winWithStats()
    vi.mocked(renderer.drawRect).mockClear()
    game.render(0)
    // Bordas horizontais do painel: 520x4 na cor do resultado.
    const horiz = vi
      .mocked(renderer.drawRect)
      .mock.calls.filter((c) => c[2] === 520 && c[3] === 4 && c[4] === COLOR_OBJETIVO)
    expect(horiz).toHaveLength(2)
  })

  it('ENTER PARA CONTINUAR so aparece apos 45 frames no win', () => {
    const game = winWithStats()
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    expect(textsOf(renderer)).not.toContain('ENTER PARA CONTINUAR')
    for (let i = 0; i < 45; i++) game.update(1)
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    expect(textsOf(renderer)).toContain('ENTER PARA CONTINUAR')
  })

  it('Enter antes de 45f e ignorado (estado segue win); apos 45f volta ao select', () => {
    const game = winWithStats()
    // Frame 1 no estado win: ignorado.
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    game.update(1) // resultTimer=2
    expect(game.state.get()).toBe('win')
    // Ate 43 frames: ainda ignorado.
    for (let i = 0; i < 40; i++) game.update(1) // resultTimer=42
    input.set('confirm', true)
    game.update(1) // resultTimer=43 < 45 -> ignorado
    expect(game.state.get()).toBe('win')
    input.set('confirm', false)
    game.update(1) // resultTimer=44
    // 45: aceita e reseta pro select.
    input.set('confirm', true)
    game.update(1) // resultTimer=45 -> select
    input.set('confirm', false)
    expect(game.state.get()).toBe('select')
  })

  it('resetToSelect posiciona o cursor no inicio canonico (SELECT_START_INDEX)', () => {
    const game = winWithStats()
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
    // Confirm imediato escolhe o personagem do cursor inicial.
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    game.update(1)
    expect(game.state.get()).toBe('playing')
    expect(game.player!.char.id).toBe(SELECT_ORDER[START_INDEX])
  })
})

describe('createGame — E1: resultado over (painel + score parcial + delay)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  // Coleta 1 moeda e morre no tolo (score parcial conhecido = 100, sem bonus).
  function loseWithStats(): ReturnType<typeof createGame> {
    const level = makeLevel(
      [{ x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      [{ x: 6 * TILE, y: 8 * TILE }],
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game) // hit incidental no select arma hitstop
    const p = game.player!
    // Moeda longe do tolo.
    p.x = 6 * TILE
    p.y = 8 * TILE
    p.vy = 0
    game.update(1)
    // Morte: 1 vida, 1 coracao, sem i-frames, overlap lateral no tolo.
    p.lives = 1
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    drainDying(game) // G4: hit letal passa pelo DYING antes do over
    expect(game.state.get()).toBe('over')
    return game
  }

  it('painel GAME OVER com borda PERIGO + stats parciais; HUD oculto', () => {
    const game = loseWithStats()
    vi.mocked(renderer.ctx.fillText).mockClear()
    vi.mocked(renderer.drawRect).mockClear()
    game.render(0)
    const texts = textsOf(renderer)
    expect(texts).toContain('GAME OVER')
    expect(texts).toContain('MOEDAS x1')
    // Score parcial: so 1 moeda x100 (sem bonus de fase/tempo no over).
    expect(texts).toContain('SCORE 100')
    expect(texts.some((t) => t.startsWith('TIME '))).toBe(false) // HUD oculto
    const horiz = vi
      .mocked(renderer.drawRect)
      .mock.calls.filter((c) => c[2] === 520 && c[3] === 4 && c[4] === COLOR_PERIGO)
    expect(horiz).toHaveLength(2)
  })

  it('over ignora Enter antes de 45f; apos o delay volta ao select', () => {
    const game = loseWithStats()
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    game.update(1)
    expect(game.state.get()).toBe('over') // cedo demais
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
  })

  it('stompCount conta stomps da rodada (TOLOS x2 no painel do win)', () => {
    // 2 tolos afastados; stompa os dois e vence.
    const level = makeLevel([
      { x: 18 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
      { x: 24 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
    ])
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    for (const e of game.enemies) {
      p.x = e.x
      p.y = e.y - p.h + 4
      p.vy = 5
      game.update(1)
      expect(e.alive).toBe(false)
    }
    p.x = level.goal.x
    p.y = level.goal.y
    p.vy = 0
    game.update(1)
    expect(game.state.get()).toBe('win')
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    expect(textsOf(renderer)).toContain('TOLOS x2')
  })
})

// ---------------------------------------------------------------------------
// FINAL (revisão): KILL-PLANE — queda no abismo custa 1 vida com respawn no
// checkpoint; sem vidas restantes vira game over.
// ---------------------------------------------------------------------------
describe('createGame — kill-plane (queda no abismo)', () => {
  it('cair abaixo do nivel custa 1 vida e respawna no ultimo checkpoint', () => {
    const { renderer } = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel([], [], { checkpoints: [10] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Cruza o checkpoint da col 10 e depois "cai" abaixo do kill-plane.
    p.x = 11 * TILE
    game.update(1)
    p.y = level.heightPx + TILE + 1
    game.update(1)
    expect(p.lives).toBe(2)
    expect(p.x).toBe(10 * TILE) // respawn no checkpoint
    expect(p.hearts).toBe(p.char.hearts) // coracoes restaurados
    expect(game.state.get()).toBe('playing')
    expect(game.events).toContain('hurt')
  })

  it('cair sem vidas restantes vira game over', () => {
    const { renderer } = makeRenderer()
    const input = new FakeInput()
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    const p = game.player!
    p.lives = 1
    p.y = makeLevel().heightPx + TILE + 1
    game.update(1)
    expect(game.state.get()).toBe('over')
    expect(game.events).toContain('over')
  })
})

// ============================================================================
// (G4) molas, plataformas moveis, dying, skid e progressao por level.next
// ============================================================================

describe('createGame — molas (G4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('aterrissar (vy>0) na metade superior da celula da mola lanca com SPRING_VEL', () => {
    // Mola na celula (col 5, row 8), apoiada no chao da row 9.
    const level = makeLevel([], [], { springs: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    game.events.length = 0
    // Caindo: pes 2px acima do topo da celula; gravidade leva pes a ~390 (<408).
    p.x = 5 * TILE
    p.y = 8 * TILE - p.h + 2
    p.vx = 0
    p.vy = 5
    p.onGround = false
    game.update(1)
    expect(p.vy).toBe(SPRING_VEL)
    // D4/G4: o lancamento soa como 'jump'.
    expect(game.events).toContain('jump')
  })

  it('andar no chao por cima da celula da mola NAO lanca (pes fora da metade superior)', () => {
    const level = makeLevel([], [], { springs: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Em pe no chao (pes na row 9 = 432 > 408): atravessa sem acionar.
    p.x = 5 * TILE
    p.y = 9 * TILE - p.h
    p.vx = 0
    p.vy = 0
    game.update(1)
    expect(p.vy).toBe(0)
    expect(p.onGround).toBe(true)
  })

  it('subindo (vy<0) atraves da celula NAO lanca', () => {
    const level = makeLevel([], [], { springs: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Pes entram na metade superior vindos de baixo, mas subindo.
    p.x = 5 * TILE
    p.y = 8 * TILE + 16 - p.h
    p.vx = 0
    p.vy = -10
    p.onGround = false
    game.update(1)
    expect(p.vy).toBeLessThan(0)
    expect(p.vy).not.toBe(SPRING_VEL)
  })

  it('render desenha a mola (corpo COLOR_TECH 48px de largura na celula)', () => {
    const level = makeLevel([], [], { springs: [{ col: 5, row: 8 }] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    vi.mocked(renderer.drawRect).mockClear()
    game.render(0)
    const body = vi
      .mocked(renderer.drawRect)
      .mock.calls.find(
        (c) =>
          c[4] === COLOR_TECH &&
          c[0] === 5 * TILE &&
          c[2] === TILE &&
          (c[1] as number) >= 8 * TILE &&
          (c[1] as number) < 9 * TILE,
      )
    expect(body).toBeDefined()
    // Corpo apoiado no chao: base em (row+1)*TILE.
    expect((body![1] as number) + (body![3] as number)).toBeCloseTo(9 * TILE, 5)
  })
})

describe('createGame — plataformas moveis (G4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  // Mover horizontal padrao: origem (col 6, row 7), amplitude 3 tiles, 1.2 px/f.
  const MOVER_X = { col: 6, row: 7, axis: 'x' as const, amplitude: 3, speed: 1.2 }

  it('pouso one-way: caindo, os pes cruzam o topo e o player gruda (vy=0, onGround)', () => {
    const level = makeLevel([], [], { movers: [MOVER_X] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Caindo 2px acima do topo do mover (top = 7*TILE), com overlap horizontal.
    p.x = 6 * TILE + 20
    p.y = 7 * TILE - p.h - 2
    p.vx = 0
    p.vy = 5
    p.onGround = false
    game.update(1)
    expect(p.y).toBe(7 * TILE - p.h)
    expect(p.vy).toBe(0)
    expect(p.onGround).toBe(true)
  })

  it('carry: em pe no mover horizontal, o player herda o delta (x acompanha)', () => {
    const level = makeLevel([], [], { movers: [MOVER_X] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    // Pousa primeiro.
    p.x = 6 * TILE + 20
    p.y = 7 * TILE - p.h - 2
    p.vx = 0
    p.vy = 5
    p.onGround = false
    game.update(1)
    expect(p.onGround).toBe(true)
    const x0 = p.x
    // 20 frames em pe (sem input): o seno sobe no inicio do clock -> x cresce.
    for (let i = 0; i < 20; i++) game.update(1)
    expect(p.x).toBeGreaterThan(x0)
    // Pes continuam grudados no topo (top constante: eixo x).
    expect(p.y).toBe(7 * TILE - p.h)
    expect(p.onGround).toBe(true)
  })

  it('carry vertical: mover eixo y desce e o player acompanha o topo', () => {
    const level = makeLevel([], [], {
      movers: [{ col: 6, row: 5, axis: 'y', amplitude: 2, speed: 1.0 }],
    })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.x = 6 * TILE + 20
    p.y = 5 * TILE - p.h - 2
    p.vx = 0
    p.vy = 5
    p.onGround = false
    game.update(1)
    expect(p.onGround).toBe(true)
    const y0 = p.y
    // Seno crescente no inicio: topo desce -> player desce junto, sempre em pe.
    for (let i = 0; i < 20; i++) {
      game.update(1)
      expect(p.onGround).toBe(true)
    }
    expect(p.y).toBeGreaterThan(y0)
  })

  it('one-way: subindo por baixo NAO bloqueia nem pousa', () => {
    const level = makeLevel([], [], { movers: [MOVER_X] })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    const p = game.player!
    p.x = 6 * TILE + 20
    p.y = 7 * TILE + 10
    p.vx = 0
    p.vy = -10
    p.onGround = false
    game.update(1)
    expect(p.vy).toBeLessThan(0)
    expect(p.onGround).toBe(false)
  })

  it('render com atlas: 2 celulas terra variant 14 (sx=144) lado a lado', () => {
    const level = makeLevel([], [], { movers: [MOVER_X] })
    const game = createGame(renderer, input, level, makeStore(['tiles.terra']))
    selectFirst(game, input)
    vi.mocked(renderer.drawSprite).mockClear()
    game.render(0)
    // Recorte do variant 14 ([3,0] no atlas -> sx 144, sy 0), destino TILE x TILE.
    const cells = vi
      .mocked(renderer.drawSprite)
      .mock.calls.filter((c) => c[1] === 144 && c[2] === 0 && c[7] === TILE && c[8] === TILE)
    expect(cells.length).toBeGreaterThanOrEqual(2)
    // Lado a lado: dx separados por exatamente TILE, mesma altura.
    const xs = cells.map((c) => c[5] as number).sort((a, b) => a - b)
    expect(xs[1] - xs[0]).toBe(TILE)
    expect(cells[0][6]).toBe(cells[1][6])
  })

  it('render sem atlas: fallback rect ciano-escuro 96x12 na posicao do mover', () => {
    const level = makeLevel([], [], { movers: [MOVER_X] })
    const game = createGame(renderer, input, level) // sem store
    selectFirst(game, input)
    vi.mocked(renderer.drawRect).mockClear()
    game.render(0)
    const rect = vi
      .mocked(renderer.drawRect)
      .mock.calls.find((c) => c[2] === 2 * TILE && c[3] === 12)
    expect(rect).toBeDefined()
    // Topo na row do mover (origem row 7; offset senoidal so no eixo x).
    expect(rect![1]).toBe(7 * TILE)
  })
})

describe('createGame — DYING (G4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  // Mata o player no tolo da col 2 (1 vida, 1 coracao) e retorna o game.
  function lethalHit(level = makeLevel([
    { x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
    { x: 30 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
  ])): ReturnType<typeof createGame> {
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game)
    const p = game.player!
    p.lives = 1
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1) // frame do hit letal -> entra no DYING
    return game
  }

  it('hit letal dispara o one-shot death(36) e congela o player ignorando input', () => {
    const game = lethalHit()
    expect(game.state.get()).toBe('playing')
    const spy = vi.mocked(animator.triggerOneShot)
    expect(spy.mock.calls.some((c) => c[1] === 'death' && c[2] === 36)).toBe(true)
    const p = game.player!
    const px = p.x
    const py = p.y
    // Input segurado durante o dying: player nao se move.
    input.set('right', true)
    input.set('jump', true)
    for (let i = 0; i < 10; i++) game.update(1)
    input.set('right', false)
    input.set('jump', false)
    expect(p.x).toBe(px)
    expect(p.y).toBe(py)
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
    expect(game.state.get()).toBe('playing')
  })

  it('o mundo continua durante o dying (tolo distante segue patrulhando)', () => {
    const game = lethalHit()
    const walker = game.enemies[1]
    const ex = walker.x
    for (let i = 0; i < 10; i++) game.update(1)
    expect(walker.x).not.toBe(ex)
  })

  it('dying expira em 36 frames -> over (com evento "over" so no fim)', () => {
    const game = lethalHit()
    game.events.length = 0
    for (let i = 0; i < 35; i++) game.update(1)
    expect(game.state.get()).toBe('playing')
    expect(game.events).not.toContain('over')
    game.update(1) // 36o frame
    expect(game.state.get()).toBe('over')
    expect(game.events).toContain('over')
  })

  it('alpha do sprite cai 1.0 -> 0.4 ao longo do dying (0.7 na metade)', () => {
    const level = makeLevel([
      { x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
      { x: 30 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' },
    ])
    const game = createGame(renderer, input, level, makeStore(['char.renan']))
    selectFirst(game, input)
    drainHitstop(game)
    const p = game.player!
    p.lives = 1
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1) // dyingT = 36
    for (let i = 0; i < 18; i++) game.update(1) // dyingT = 18 (metade)
    let alphaAtDraw = -1
    vi.mocked(spriteDraw.drawAnimatedSprite).mockImplementation((r: Renderer) => {
      alphaAtDraw = r.ctx.globalAlpha
    })
    game.render(0)
    expect(alphaAtDraw).toBeCloseTo(0.7, 5)
    // Alpha restaurado depois do draw.
    expect(renderer.ctx.globalAlpha).toBe(1)
    vi.mocked(spriteDraw.drawAnimatedSprite).mockReset()
  })
})

describe('createGame — skid (G4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('correndo acima de WALK_MAX com input oposto dispara triggerOneShot("skid", 8)', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    // Assenta no chao.
    for (let i = 0; i < 10; i++) game.update(1)
    const p = game.player!
    expect(p.onGround).toBe(true)
    const spy = vi.mocked(animator.triggerOneShot)
    vi.clearAllMocks()
    // Correndo para a direita acima de WALK_MAX; vira para a esquerda.
    p.vx = 8
    input.set('left', true)
    game.update(1)
    input.set('left', false)
    expect(spy.mock.calls.some((c) => c[1] === 'skid' && c[2] === 8)).toBe(true)
  })

  it('sem input oposto (desacelerando solto) NAO dispara skid', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    for (let i = 0; i < 10; i++) game.update(1)
    const p = game.player!
    const spy = vi.mocked(animator.triggerOneShot)
    vi.clearAllMocks()
    p.vx = 8 // rapido, mas sem segurar a direcao oposta
    game.update(1)
    expect(spy.mock.calls.some((c) => c[1] === 'skid')).toBe(false)
  })
})

describe('createGame — progressao por level.next (G4)', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('win com next: Enter carrega a proxima fase MANTENDO o personagem (sem select)', () => {
    const level = makeLevel([], [], { next: 'w1-2' })
    const game = createGame(renderer, input, level)
    selectArtur(game, input)
    expect(game.player!.char.id).toBe('artur')
    // Vence.
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    // Enter (apos o delay anti-skip) -> direto pra w1-2, mesmo char.
    confirmResult(game, input)
    expect(game.state.get()).toBe('playing')
    expect(game.player).not.toBeNull()
    expect(game.player!.char.id).toBe('artur')
    // Spawn da W1-2: col 2 row 8 (1 frame de gravidade ja correu no confirm).
    expect(game.player!.x).toBe(2 * TILE)
    expect(game.player!.y).toBeGreaterThanOrEqual(8 * TILE)
    expect(game.player!.y).toBeLessThan(8 * TILE + 2)
    // A zona nova roda sem crash (update + render).
    expect(() => {
      for (let i = 0; i < 10; i++) game.update(1)
      game.render(0)
    }).not.toThrow()
  })

  it('win SEM next: Enter volta ao select (fluxo atual)', () => {
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
  })

  it('over com next NAO progride: Enter volta ao select', () => {
    const level = makeLevel(
      [{ x: 2 * TILE, y: 8 * TILE + (TILE - 34), kind: 'fool' }],
      [],
      { next: 'w1-2' },
    )
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    drainHitstop(game)
    const p = game.player!
    p.lives = 1
    p.hearts = 1
    p.iframes = 0
    p.vy = 0
    p.x = 2 * TILE
    p.y = 8 * TILE + (TILE - 34)
    game.update(1)
    drainDying(game)
    expect(game.state.get()).toBe('over')
    confirmResult(game, input)
    expect(game.state.get()).toBe('select')
  })

  it('rodape do painel de win vira "ENTER PARA PRÓXIMA ZONA" quando ha next', () => {
    const level = makeLevel([], [], { next: 'w1-2' })
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    for (let i = 0; i < 45; i++) game.update(1)
    vi.mocked(renderer.ctx.fillText).mockClear()
    game.render(0)
    const texts = textsOf(renderer)
    expect(texts).toContain('ENTER PARA PRÓXIMA ZONA')
    expect(texts).not.toContain('ENTER PARA CONTINUAR')
  })
})
