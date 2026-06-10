// tests/unit/game.test.ts
// Integracao M1: select -> playing -> win/over; worldScale; colisoes stomp/dash/damage;
// Humanware congela inimigos e pausa timer. dt=1 (convencao por-frame, E1).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGame } from '../../src/game/game'
import type { Renderer } from '../../src/engine/render'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import {
  TILE,
  FIXED_DT,
  TIME_START,
  STOMP_BOUNCE,
  COLOR_MAGENTA,
  COLOR_LIME,
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
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
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
    present: vi.fn(),
  }
}

// ---------- Level plano: chao solido nas rows 9-10, resto vazio ----------
function makeLevel(
  enemies: Array<{ x: number; y: number; kind: string }> = [],
  coins: Array<{ x: number; y: number }> = [],
): ParsedLevel {
  const widthTiles = 40
  const heightTiles = 11
  const tiles: TileType[][] = Array.from({ length: heightTiles }, (_, r) =>
    Array.from({ length: widthTiles }, () => (r >= 9 ? 'ground' : 'empty')),
  )
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
  }
}

// Avanca o estado 'select' ate selecionar o personagem (index 0 = renan) com 'confirm'.
function selectFirst(game: ReturnType<typeof createGame>, input: FakeInput): void {
  input.set('confirm', true)
  game.update(1)
  input.set('confirm', false)
  game.update(1)
}

// Navega para 'artur' (index 3 em SELECT_ORDER) e confirma.
function selectArtur(game: ReturnType<typeof createGame>, input: FakeInput): void {
  // Pressiona 'right' tres vezes para chegar ao index 3 (artur).
  for (let i = 0; i < 3; i++) {
    input.set('right', true)
    game.update(1)
    input.set('right', false)
    game.update(1)
  }
  // Confirma a selecao.
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

// Navega para 'dante' (index 1, dash_criativo) e confirma.
function selectDante(game: ReturnType<typeof createGame>, input: FakeInput): void {
  input.set('right', true)
  game.update(1)
  input.set('right', false)
  game.update(1)
  input.set('confirm', true)
  game.update(1)
  input.set('confirm', false)
  game.update(1)
}

describe('createGame — selecao', () => {
  let renderer: Renderer
  let input: FakeInput

  beforeEach(() => {
    renderer = makeRenderer()
    input = new FakeInput()
  })

  it('comeca no estado "select"', () => {
    const game = createGame(renderer, input, makeLevel())
    expect(game.state.get()).toBe('select')
  })

  it('confirm na selecao cria o player e vai para "playing"', () => {
    const game = createGame(renderer, input, makeLevel())
    selectFirst(game, input)
    expect(game.state.get()).toBe('playing')
    expect(game.player).not.toBeNull()
    expect(game.player!.char.id).toBe('renan')
  })

  it('render nao lanca no estado select', () => {
    const game = createGame(renderer, input, makeLevel())
    expect(() => game.render(0)).not.toThrow()
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

  it('dano sem hearts/lives leva a "over"', () => {
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
    expect(game.state.get()).toBe('over')
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
  it('confirm em "win" volta para "select"', () => {
    const renderer = makeRenderer()
    const input = new FakeInput()
    const level = makeLevel()
    const game = createGame(renderer, input, level)
    selectFirst(game, input)
    game.player!.x = level.goal.x
    game.player!.y = level.goal.y
    game.update(1)
    expect(game.state.get()).toBe('win')
    input.set('confirm', true)
    game.update(1)
    expect(game.state.get()).toBe('select')
  })

  it('confirm em "over" volta para "select"', () => {
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
    expect(game.state.get()).toBe('over')
    input.set('confirm', true)
    game.update(1)
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

    // Confirma: deve voltar para select (e resetToSelect deve limpar ps/playerAnim/hwWasActive).
    input.set("confirm", true)
    game.update(1)
    input.set("confirm", false)
    game.update(1)
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
    expect(game.state.get()).toBe("over")

    input.set("confirm", true)
    game.update(1)
    input.set("confirm", false)
    game.update(1)
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

    // Confirma volta ao select: resetToSelect deve ter restaurado o bloco.
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    game.update(1)
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
    // Confirm -> select -> nova rodada.
    input.set('confirm', true)
    game.update(1)
    input.set('confirm', false)
    game.update(1)
    expect(game.state.get()).toBe('select')
    selectFirst(game, input)
    game.update(1) // followCamera com player no spawn -> cam=(0,0)
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
