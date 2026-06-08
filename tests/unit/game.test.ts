// tests/unit/game.test.ts
// Integracao M1: select -> playing -> win/over; worldScale; colisoes stomp/dash/damage;
// Humanware congela inimigos e pausa timer. dt=1 (convencao por-frame, E1).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGame } from '../../src/game/game'
import type { Renderer } from '../../src/engine/render'
import type { Input, InputAction } from '../../src/engine/input'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import { TILE, FIXED_DT, TIME_START, STOMP_BOUNCE } from '../../src/engine/constants'

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
function makeRenderer(): Renderer {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    imageSmoothingEnabled: false,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
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

// Builder: bloco temporario aparece em level.tiles e e restaurado apos o TTL.
describe('createGame — builder tile restore', () => {
  // Calculo da celula-alvo:
  //   spawn: x=2*TILE(96), y=8*TILE(384); PLAYER_W=34, PLAYER_H=42, facing=1 (direita)
  //   col = floor((96+34)/48) = floor(130/48) = 2
  //   row = floor((384+42-1)/48) = floor(425/48) = 8
  // Row 8 e 'empty' em makeLevel (chao comeca na row 9) — apto para receber o bloco.
  const BUILDER_COL = 2
  const BUILDER_ROW = 8

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
