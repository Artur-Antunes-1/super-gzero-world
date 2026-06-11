// tests/unit/enemy.test.ts
import { describe, it, expect } from 'vitest'
import {
  ENEMY_SPEED,
  TILE,
  TIME_START,
  COLOR_VIOLET,
  COLOR_BLUE,
  COLOR_INK,
  COLOR_TEXT,
} from '../../src/engine/constants'
import type { ParsedLevel, TileType, CharacterDef } from '../../src/data/schema'
import type { Renderer } from '../../src/engine/render'
import type { AssetStore } from '../../src/engine/assets'
import { frameIndex } from '../../src/engine/spriteAnim'
import { OBJECT_ANIMS } from '../../src/data/objects'
import {
  spawnEnemies,
  updateEnemy,
  isStomp,
  drawEnemy,
  updateEnemyShooting,
  updateProjectile,
  ENEMY_DEFS,
  ENEMY_SHEET_KEYS,
  SHOOT_INTERVAL,
  PROJECTILE_SPEED,
  PROJECTILE_SIZE,
  type Enemy,
  type EnemyKind,
  type Projectile,
} from '../../src/game/enemy'
import { createPlayer, type Player } from '../../src/game/player'

// FoolSpawn defensivo (kind chega via U3; enemy.ts le com ?? 'tolo').
type FoolSpawnT = {
  col: number
  row: number
  patrol?: [number, number]
  kind?: EnemyKind
}

// Constroi um ParsedLevel a partir de um mapa ASCII (mesmo padrao do physics.test.ts).
function makeLevel(
  rows: string[],
  enemies: ParsedLevel['enemies'] = [],
  foolSpawns: FoolSpawnT[] = [],
): ParsedLevel {
  const heightTiles = rows.length
  const widthTiles = Math.max(...rows.map((r) => r.length))
  const tiles: TileType[][] = []
  for (let ty = 0; ty < heightTiles; ty++) {
    const row: TileType[] = []
    for (let tx = 0; tx < widthTiles; tx++) {
      const ch = rows[ty][tx] ?? '.'
      let t: TileType = 'empty'
      if (ch === '#') t = 'ground'
      else if (ch === 'B') t = 'brick'
      else if (ch === '?') t = 'block'
      else if (ch === '=') t = 'platform'
      row.push(t)
    }
    tiles.push(row)
  }
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies,
    qBlocks: [],
    hearts: [],
    checkpoints: [],
    timeStart: TIME_START,
    foolSpawns: foolSpawns as ParsedLevel['foolSpawns'],
    springs: [],
    movers: [],
  }
}

const CHAR: CharacterDef = {
  id: 'test',
  name: 'Test',
  abilityId: 'salto_visionario',
  color: '#fff',
  accent: '#000',
  hearts: 3,
  jumpVelMul: 1,
  walkMul: 1,
  runMul: 1,
  weightMul: 1,
}

describe('spawnEnemies', () => {
  it('consome foolSpawns: col/row -> px, patrol -> patrolMin/Max em px', () => {
    const level = makeLevel(['....', '####'], [], [
      { col: 1, row: 0, patrol: [1, 3] },
      { col: 2, row: 0 },
    ])
    const es = spawnEnemies(level)
    expect(es).toHaveLength(2)
    expect(es[0].x).toBe(1 * TILE)
    expect(es[0].y).toBe(0)
    expect(es[0].patrolMin).toBe(1 * TILE)
    expect(es[0].patrolMax).toBe(3 * TILE)
    // Sem patrol: limites indefinidos.
    expect(es[1].x).toBe(2 * TILE)
    expect(es[1].patrolMin).toBeUndefined()
    expect(es[1].patrolMax).toBeUndefined()
    for (const e of es) {
      expect(e.kind).toBe('tolo')
      expect(e.w).toBe(42)
      expect(e.h).toBe(46)
      expect(e.dir).toBe(-1)
      expect(e.alive).toBe(true)
      expect(e.frozen).toBe(false)
    }
  })

  it('compat legacy: sem foolSpawns, converte level.enemies (fool|enemy) em tolos', () => {
    const level = makeLevel(['....', '####'], [
      { x: 48, y: 0, kind: 'fool' },
      { x: 96, y: 0, kind: 'enemy' },
    ])
    const es = spawnEnemies(level)
    expect(es).toHaveLength(2)
    for (const e of es) {
      expect(e.kind).toBe('tolo')
      expect(e.w).toBe(42)
      expect(e.h).toBe(46)
      expect(e.dir).toBe(-1)
      expect(e.alive).toBe(true)
      expect(e.frozen).toBe(false)
      expect(e.vx).toBe(0)
      expect(e.vy).toBe(0)
      expect(e.onGround).toBe(false)
    }
    expect(es[0].x).toBe(48)
    expect(es[1].x).toBe(96)
  })

  it('foolSpawns tem precedencia: enemies legacy nao duplica tolos', () => {
    const level = makeLevel(
      ['....', '####'],
      [{ x: 48, y: 0, kind: 'fool' }], // espelho legacy do mesmo tolo
      [{ col: 1, row: 0 }],
    )
    const es = spawnEnemies(level)
    expect(es).toHaveLength(1)
    expect(es[0].x).toBe(1 * TILE)
  })
})

describe('updateEnemy patrulha', () => {
  it('anda em ENEMY_SPEED*dir sobre chao continuo', () => {
    // Chao continuo (linha 1). Inimigo sobre a celula (col 2), dir=-1 (esquerda).
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    const x0 = e.x
    updateEnemy(e, level, 1)
    // Andou para a esquerda ~ ENEMY_SPEED (sem parede no caminho).
    expect(e.x).toBeLessThan(x0)
    expect(x0 - e.x).toBeCloseTo(ENEMY_SPEED, 5)
    expect(e.dir).toBe(-1)
  })

  it('inverte dir ao bater em parede (vx zerou no stepBody)', () => {
    // Parede de brick na coluna 2; piso na linha 2. Inimigo encostando indo a direita (dir=1).
    const level = makeLevel(['..B.....', '..B.....', '########'])
    const e: Enemy = {
      // borda direita encostando na parede (x+w bem proximo de 2*TILE)
      x: 2 * TILE - 42 - 0.5, y: 2 * TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
    }
    updateEnemy(e, level, 1)
    // Bateu na parede: stepBody zerou vx -> inverteu para a esquerda.
    expect(e.dir).toBe(-1)
  })

  it('inverte na iminencia de borda (nao cai do penhasco)', () => {
    // Chao so nas colunas 0..2 (linha 1). Coluna 3+ e abismo.
    // Inimigo na col 2 indo a direita (dir=1): a celula diante (col 3) nao tem chao abaixo -> inverte.
    const level = makeLevel(['........', '###.....'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
    }
    updateEnemy(e, level, 1)
    // Deve ter invertido ANTES de andar para o vazio.
    expect(e.dir).toBe(-1)
    // E nao deve ter avancado para alem do tile de chao (sem cair).
    expect(e.x).toBeLessThanOrEqual(2 * TILE + 1)
  })

  it('FIX C3a: platform conta como piso — tolo sobre plataforma nao vibra', () => {
    // Piso de platform (one-way) continuo na linha 1. Antes do fix, a deteccao
    // de borda invertia dir a cada frame (platform nao era "chao").
    const level = makeLevel(['........', '========'])
    const e: Enemy = {
      x: 4 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    const x0 = e.x
    updateEnemy(e, level, 1)
    // Continua andando na mesma direcao, sem inverter.
    expect(e.dir).toBe(-1)
    expect(e.x).toBeLessThan(x0)
    // Segundo frame: segue estavel (sem vibrar).
    updateEnemy(e, level, 1)
    expect(e.dir).toBe(-1)
  })

  it('inverte em borda de plataforma one-way (fim do piso platform)', () => {
    // Plataforma so nas colunas 0..2; col 3+ e vazio.
    const level = makeLevel(['........', '===.....'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
    }
    updateEnemy(e, level, 1)
    expect(e.dir).toBe(-1)
  })

  it('inverte no limite esquerdo de patrulha (patrolMin)', () => {
    const level = makeLevel(['..........', '##########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: false,
      patrolMin: 2 * TILE, patrolMax: 6 * TILE,
    }
    updateEnemy(e, level, 1)
    // Alcancou patrolMin indo a esquerda: inverte e anda para a direita.
    expect(e.dir).toBe(1)
    expect(e.x).toBeGreaterThan(2 * TILE)
  })

  it('inverte no limite direito de patrulha (patrolMax)', () => {
    const level = makeLevel(['..........', '##########'])
    const e: Enemy = {
      x: 6 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
      patrolMin: 2 * TILE, patrolMax: 6 * TILE,
    }
    updateEnemy(e, level, 1)
    // Alcancou patrolMax indo a direita: inverte e anda para a esquerda.
    expect(e.dir).toBe(-1)
    expect(e.x).toBeLessThan(6 * TILE)
  })

  it('dentro dos limites de patrulha, mantem a direcao', () => {
    const level = makeLevel(['..........', '##########'])
    const e: Enemy = {
      x: 4 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: 1, alive: true, frozen: false,
      patrolMin: 2 * TILE, patrolMax: 6 * TILE,
    }
    updateEnemy(e, level, 1)
    expect(e.dir).toBe(1)
    expect(e.x).toBeGreaterThan(4 * TILE)
  })

  it('nao move quando alive=false', () => {
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 9, vy: 9,
      onGround: true, kind: 'tolo', dir: -1, alive: false, frozen: false,
    }
    const x0 = e.x, y0 = e.y
    updateEnemy(e, level, 1)
    expect(e.x).toBe(x0)
    expect(e.y).toBe(y0)
  })

  it('nao move quando frozen=true (Modo Humanware)', () => {
    const level = makeLevel(['........', '########'])
    const e: Enemy = {
      x: 2 * TILE, y: TILE - 46, w: 42, h: 46, vx: 0, vy: 0,
      onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: true,
    }
    const x0 = e.x, y0 = e.y
    updateEnemy(e, level, 1)
    expect(e.x).toBe(x0)
    expect(e.y).toBe(y0)
  })
})

describe('isStomp', () => {
  it('true quando o player cai (vy>0) sobre o topo do tolo', () => {
    const player: Player = createPlayer(CHAR, { x: 0, y: 0 })
    const e: Enemy = {
      x: 100, y: 200, w: 42, h: 46, vx: 0, vy: 0,
      onGround: false, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    // Player descendo, pe acima da metade do tolo, sobreposto em X/Y.
    player.x = 100
    player.y = 200 - player.h + 4 // pe em ~204, abaixo do topo 200 mas acima de 200+23 (h/2)
    player.vy = 6
    expect(isStomp(player, e)).toBe(true)
  })

  it('false em colisao lateral (player subindo / pe baixo demais)', () => {
    const player: Player = createPlayer(CHAR, { x: 0, y: 0 })
    const e: Enemy = {
      x: 100, y: 200, w: 42, h: 46, vx: 0, vy: 0,
      onGround: false, kind: 'tolo', dir: -1, alive: true, frozen: false,
    }
    // Player na mesma altura, vy<=0 (nao descendo) -> nao e stomp.
    player.x = 100
    player.y = 200
    player.vy = -2
    expect(isStomp(player, e)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D3: ENEMY_DEFS data-driven + drawEnemy com sprite do sheet 'char.tolo'.
// ---------------------------------------------------------------------------

describe('ENEMY_DEFS', () => {
  // Hitbox honesta (pos-playtest 2026-06-11): 42x46 = 1,22x do sprite de 56px.
  it('tolo: hitbox honesta 42x46, speed e behavior patrol', () => {
    const def = ENEMY_DEFS.tolo
    expect(def.w).toBe(42)
    expect(def.h).toBe(46)
    expect(def.speed).toBe(ENEMY_SPEED)
    expect(def.behavior).toBe('patrol')
  })

  it('tolo: color = COLOR_VIOLET (token de perigo; magenta e da marca)', () => {
    expect(ENEMY_DEFS.tolo.color).toBe(COLOR_VIOLET)
  })

  it('spawnEnemies usa as dimensoes do def', () => {
    const level: ParsedLevel = makeLevel(['....', '####'], [], [{ col: 1, row: 0 }])
    const es = spawnEnemies(level)
    expect(es[0].w).toBe(ENEMY_DEFS.tolo.w)
    expect(es[0].h).toBe(ENEMY_DEFS.tolo.h)
  })
})

// Renderer falso: registra rects, sprites (com alpha no momento da chamada),
// fillRects do ctx (com alpha+fillStyle) e transforms (translate/scale).
function makeFakeRenderer() {
  const rects: Array<{ x: number; y: number; w: number; h: number; color: string }> = []
  const sprites: Array<{
    src: CanvasImageSource; sx: number; sy: number; sw: number; sh: number
    dx: number; dy: number; dw: number; dh: number; alpha: number
  }> = []
  const fills: Array<{ x: number; y: number; w: number; h: number; alpha: number; fillStyle: string }> = []
  const scales: Array<[number, number]> = []
  const translates: Array<[number, number]> = []
  const stack: Array<{ alpha: number; fillStyle: string }> = []
  const state = { alpha: 1, fillStyle: '' }
  const ctx = {
    get globalAlpha() { return state.alpha },
    set globalAlpha(v: number) { state.alpha = v },
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v },
    save() { stack.push({ alpha: state.alpha, fillStyle: state.fillStyle }) },
    restore() {
      const s = stack.pop()
      if (s) { state.alpha = s.alpha; state.fillStyle = s.fillStyle }
    },
    translate(x: number, y: number) { translates.push([x, y]) },
    scale(x: number, y: number) { scales.push([x, y]) },
    rotate() {},
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ x, y, w, h, alpha: state.alpha, fillStyle: state.fillStyle })
    },
    drawImage() {},
  } as unknown as CanvasRenderingContext2D
  const r: Renderer = {
    ctx,
    clear() {},
    beginWorld() {},
    endWorld() {},
    drawRect(x: number, y: number, w: number, h: number, color: string) {
      rects.push({ x, y, w, h, color })
    },
    drawSprite(
      src: CanvasImageSource,
      sx: number, sy: number, sw: number, sh: number,
      dx: number, dy: number, dw: number, dh: number,
    ) {
      sprites.push({ src, sx, sy, sw, sh, dx, dy, dw, dh, alpha: state.alpha })
    },
    present() {},
  }
  return { r, rects, sprites, fills, scales, translates }
}

const FAKE_SHEET = { fake: 'tolo-sheet' } as unknown as CanvasImageSource

// Store falso: so possui as chaves listadas.
function makeStore(keys: string[]): AssetStore {
  return {
    get(key: string) {
      return keys.includes(key) ? { src: FAKE_SHEET, w: 999, h: 999 } : null
    },
    ready: true,
  }
}

function makeTolo(over: Partial<Enemy> = {}): Enemy {
  return {
    x: 96, y: 200, w: 42, h: 46, vx: 0, vy: 0,
    onGround: true, kind: 'tolo', dir: -1, alive: true, frozen: false,
    ...over,
  }
}

describe('drawEnemy com sprite (store + sheet char.tolo)', () => {
  const anim = OBJECT_ANIMS.tolo

  it('desenha o frame via drawSprite, ancorado nos pes, com flip por dir=-1', () => {
    const { r, sprites, rects, translates, scales } = makeFakeRenderer()
    const e = makeTolo({ dir: -1 })
    drawEnemy(r, e, makeStore([anim.key]), 0)
    // Um sprite desenhado a partir do sheet; nada do fallback de rects.
    expect(sprites).toHaveLength(1)
    expect(rects).toHaveLength(0)
    const s = sprites[0]
    expect(s.src).toBe(FAKE_SHEET)
    // clock=0 -> frame 0 (sx=0); recorte = celula do contrato.
    expect(s.sx).toBe(0)
    expect(s.sy).toBe(0)
    expect(s.sw).toBe(anim.cellW)
    expect(s.sh).toBe(anim.cellH)
    // Destino: drawW/H do contrato, centrado em x e com base nos pes.
    expect(s.dx).toBeCloseTo(-anim.drawW / 2, 5)
    expect(s.dy).toBeCloseTo(-anim.drawH, 5)
    expect(s.dw).toBe(anim.drawW)
    expect(s.dh).toBe(anim.drawH)
    // Ancora nos PES: centro horizontal da hitbox, base da hitbox.
    expect(translates[0]).toEqual([e.x + e.w / 2, e.y + e.h])
    // Flip horizontal por dir (como drawCharFrame faz com facing).
    expect(scales[0]).toEqual([-1, 1])
  })

  it('dir=1 desenha sem flip (scale 1,1)', () => {
    const { r, scales } = makeFakeRenderer()
    drawEnemy(r, makeTolo({ dir: 1 }), makeStore([anim.key]), 0)
    expect(scales[0]).toEqual([1, 1])
  })

  it('anima com o clock global: sx = frameIndex(anim, clock) * cellW', () => {
    const { r, sprites } = makeFakeRenderer()
    // Clock suficiente para avancar pelo menos 1 frame de animacao.
    const clock = Math.ceil(60 / anim.fps)
    drawEnemy(r, makeTolo(), makeStore([anim.key]), clock)
    const expected = frameIndex(anim, clock) * anim.cellW
    expect(sprites[0].sx).toBe(expected)
    if (anim.frames > 1) expect(sprites[0].sx).toBeGreaterThan(0)
  })

  it('sem veu nem alpha quando nao congelado', () => {
    const { r, sprites, fills } = makeFakeRenderer()
    drawEnemy(r, makeTolo(), makeStore([anim.key]), 30)
    expect(sprites[0].alpha).toBe(1)
    expect(fills).toHaveLength(0)
  })

  it('frozen: alpha 0.7 no sprite + veu ciano 0.25 + NAO anima (frame 0)', () => {
    const { r, sprites, fills } = makeFakeRenderer()
    const e = makeTolo({ frozen: true })
    // Clock alto: animaria varios frames se nao estivesse congelado.
    drawEnemy(r, e, makeStore([anim.key]), 1234)
    expect(sprites).toHaveLength(1)
    // Congelado: clock tratado como 0 -> frame 0 (sem avanco).
    expect(sprites[0].sx).toBe(0)
    expect(sprites[0].alpha).toBeCloseTo(0.7, 5)
    // Veu azulado por cima do sprite (ciano, alpha 0.25, area do sprite).
    expect(fills).toHaveLength(1)
    const v = fills[0]
    expect(v.fillStyle).toBe(COLOR_BLUE)
    expect(v.alpha).toBeCloseTo(0.25, 5)
    expect(v.x).toBeCloseTo(e.x + e.w / 2 - anim.drawW / 2, 5)
    expect(v.y).toBeCloseTo(e.y + e.h - anim.drawH, 5)
    expect(v.w).toBe(anim.drawW)
    expect(v.h).toBe(anim.drawH)
  })

  it('store sem o sheet char.tolo -> fallback de retangulos', () => {
    const { r, sprites, rects } = makeFakeRenderer()
    drawEnemy(r, makeTolo(), makeStore([]), 0)
    expect(sprites).toHaveLength(0)
    expect(rects.length).toBeGreaterThan(0)
    expect(rects[0].color).toBe(ENEMY_DEFS.tolo.color)
  })

  it('nao desenha nada quando alive=false', () => {
    const { r, sprites, rects, fills } = makeFakeRenderer()
    drawEnemy(r, makeTolo({ alive: false }), makeStore([anim.key]), 0)
    expect(sprites).toHaveLength(0)
    expect(rects).toHaveLength(0)
    expect(fills).toHaveLength(0)
  })
})

describe('drawEnemy fallback (sem store)', () => {
  it('desenha corpo na cor do def (violet) + faixa de olhos COLOR_INK', () => {
    const { r, rects, sprites } = makeFakeRenderer()
    const e = makeTolo()
    drawEnemy(r, e)
    expect(sprites).toHaveLength(0)
    expect(rects).toHaveLength(2)
    expect(rects[0]).toEqual({ x: e.x, y: e.y, w: e.w, h: e.h, color: COLOR_VIOLET })
    expect(rects[1].color).toBe(COLOR_INK)
  })

  it('frozen adiciona a faixa clara COLOR_TEXT no topo', () => {
    const { r, rects } = makeFakeRenderer()
    const e = makeTolo({ frozen: true })
    drawEnemy(r, e)
    expect(rects).toHaveLength(3)
    expect(rects[2]).toEqual({ x: e.x, y: e.y, w: e.w, h: 4, color: COLOR_TEXT })
  })

  it('nao desenha nada quando alive=false', () => {
    const { r, rects } = makeFakeRenderer()
    drawEnemy(r, makeTolo({ alive: false }))
    expect(rects).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// U2 (2026-06-11): variantes do Tolo + projeteis do atirador.
// ---------------------------------------------------------------------------

describe('ENEMY_DEFS variantes', () => {
  it('tolo_veloz: 42x46, speed 2.3, laranja quente, patrol', () => {
    const def = ENEMY_DEFS.tolo_veloz
    expect(def.w).toBe(42)
    expect(def.h).toBe(46)
    expect(def.speed).toBe(2.3)
    expect(def.color).toBe('#e8731a')
    expect(def.behavior).toBe('patrol')
  })

  it('tolo_atirador: 42x46, speed 0.9, ciano, patrol', () => {
    const def = ENEMY_DEFS.tolo_atirador
    expect(def.w).toBe(42)
    expect(def.h).toBe(46)
    expect(def.speed).toBe(0.9)
    expect(def.color).toBe('#1a9ec9')
    expect(def.behavior).toBe('patrol')
  })

  it('ENEMY_SHEET_KEYS mapeia as 3 kinds para os sheets', () => {
    expect(ENEMY_SHEET_KEYS.tolo).toBe('char.tolo')
    expect(ENEMY_SHEET_KEYS.tolo_veloz).toBe('char.tolo.veloz')
    expect(ENEMY_SHEET_KEYS.tolo_atirador).toBe('char.tolo.atirador')
  })
})

describe('spawnEnemies com kind', () => {
  it('foolSpawn.kind define a kind do inimigo (dimensoes do def)', () => {
    const level = makeLevel(['....', '####'], [], [
      { col: 0, row: 0, kind: 'tolo_veloz' },
      { col: 1, row: 0, kind: 'tolo_atirador' },
      { col: 2, row: 0, kind: 'tolo' },
    ])
    const es = spawnEnemies(level)
    expect(es.map((e) => e.kind)).toEqual(['tolo_veloz', 'tolo_atirador', 'tolo'])
    for (const e of es) {
      expect(e.w).toBe(ENEMY_DEFS[e.kind].w)
      expect(e.h).toBe(ENEMY_DEFS[e.kind].h)
    }
  })

  it('sem kind no spawn: default tolo', () => {
    const level = makeLevel(['....', '####'], [], [{ col: 1, row: 0 }])
    const es = spawnEnemies(level)
    expect(es[0].kind).toBe('tolo')
  })

  it('atirador nasce com shootT=0; demais sem shootT', () => {
    const level = makeLevel(['....', '####'], [], [
      { col: 0, row: 0, kind: 'tolo_atirador' },
      { col: 1, row: 0, kind: 'tolo_veloz' },
    ])
    const es = spawnEnemies(level)
    expect(es[0].shootT).toBe(0)
    expect(es[1].shootT).toBeUndefined()
  })
})

describe('updateEnemy: veloz patrulha mais rapido', () => {
  it('veloz anda 2.3 px/frame contra ENEMY_SPEED do tolo comum', () => {
    const level = makeLevel(['........', '########'])
    const veloz = makeTolo({ kind: 'tolo_veloz', x: 4 * TILE, y: TILE - 46 })
    const comum = makeTolo({ kind: 'tolo', x: 4 * TILE, y: TILE - 46 })
    updateEnemy(veloz, level, 1)
    updateEnemy(comum, level, 1)
    expect(4 * TILE - veloz.x).toBeCloseTo(2.3, 5)
    expect(4 * TILE - comum.x).toBeCloseTo(ENEMY_SPEED, 5)
    expect(4 * TILE - veloz.x).toBeGreaterThan(4 * TILE - comum.x)
  })
})

function makeAtirador(over: Partial<Enemy> = {}): Enemy {
  return makeTolo({ kind: 'tolo_atirador', shootT: 0, ...over })
}

describe('updateEnemyShooting', () => {
  it('atirador cria projetil ao completar SHOOT_INTERVAL frames', () => {
    const e = makeAtirador({ dir: -1 })
    const ps: Projectile[] = []
    // 1 frame antes do intervalo: nada.
    updateEnemyShooting(e, SHOOT_INTERVAL - 1, ps)
    expect(ps).toHaveLength(0)
    // Completa o intervalo: 1 projetil.
    updateEnemyShooting(e, 1, ps)
    expect(ps).toHaveLength(1)
    const p = ps[0]
    expect(p.alive).toBe(true)
    expect(p.w).toBe(PROJECTILE_SIZE)
    expect(p.h).toBe(PROJECTILE_SIZE)
    // dir=-1: sai pela frente esquerda, vx negativo, voa reto (vy 0).
    expect(p.vx).toBeCloseTo(-PROJECTILE_SPEED, 5)
    expect(p.vy).toBe(0)
    expect(p.x).toBeCloseTo(e.x - PROJECTILE_SIZE, 5)
    // "Peito": ~35% da altura, centrado no projetil.
    expect(p.y).toBeCloseTo(e.y + e.h * 0.35 - PROJECTILE_SIZE / 2, 5)
  })

  it('dir=1: projetil sai pela direita com vx positivo', () => {
    const e = makeAtirador({ dir: 1 })
    const ps: Projectile[] = []
    updateEnemyShooting(e, SHOOT_INTERVAL, ps)
    expect(ps).toHaveLength(1)
    expect(ps[0].vx).toBeCloseTo(PROJECTILE_SPEED, 5)
    expect(ps[0].x).toBeCloseTo(e.x + e.w, 5)
  })

  it('intervalo se mantem: 2*SHOOT_INTERVAL frames -> 2 projeteis', () => {
    const e = makeAtirador()
    const ps: Projectile[] = []
    for (let i = 0; i < 2 * SHOOT_INTERVAL; i++) updateEnemyShooting(e, 1, ps)
    expect(ps).toHaveLength(2)
  })

  it('NAO atira quando frozen (Modo Humanware)', () => {
    const e = makeAtirador({ frozen: true })
    const ps: Projectile[] = []
    updateEnemyShooting(e, 5 * SHOOT_INTERVAL, ps)
    expect(ps).toHaveLength(0)
  })

  it('NAO atira quando morto', () => {
    const e = makeAtirador({ alive: false })
    const ps: Projectile[] = []
    updateEnemyShooting(e, 5 * SHOOT_INTERVAL, ps)
    expect(ps).toHaveLength(0)
  })

  it('kinds nao-atiradoras nunca atiram', () => {
    const ps: Projectile[] = []
    updateEnemyShooting(makeTolo({ kind: 'tolo' }), 5 * SHOOT_INTERVAL, ps)
    updateEnemyShooting(makeTolo({ kind: 'tolo_veloz' }), 5 * SHOOT_INTERVAL, ps)
    expect(ps).toHaveLength(0)
  })
})

describe('updateProjectile', () => {
  function makeProj(over: Partial<Projectile> = {}): Projectile {
    return {
      x: 4 * TILE, y: TILE / 2, vx: PROJECTILE_SPEED, vy: 0,
      w: PROJECTILE_SIZE, h: PROJECTILE_SIZE, alive: true,
      ...over,
    }
  }

  it('voa reto: x += vx*dt, y inalterado com vy=0', () => {
    const level = makeLevel(['........', '########'])
    const p = makeProj({ vx: -PROJECTILE_SPEED })
    const x0 = p.x, y0 = p.y
    updateProjectile(p, level, 2)
    expect(p.x).toBeCloseTo(x0 - PROJECTILE_SPEED * 2, 5)
    expect(p.y).toBe(y0)
    expect(p.alive).toBe(true)
  })

  it('morre ao entrar em celula solida (brick)', () => {
    // Parede de brick na coluna 2, linha 0.
    const level = makeLevel(['..B.....', '########'])
    // Centro do projetil entrando na celula (2,0) apos o passo.
    const p = makeProj({ x: 3 * TILE + 2, y: 10, vx: -PROJECTILE_SPEED })
    for (let i = 0; i < 20 && p.alive; i++) updateProjectile(p, level, 1)
    expect(p.alive).toBe(false)
    // Morreu DENTRO da regiao da parede (nao atravessou).
    expect(p.x + p.w / 2).toBeLessThan(3 * TILE)
  })

  it('morre ao sair do mapa pela esquerda', () => {
    const level = makeLevel(['........', '########'])
    const p = makeProj({ x: 2, vx: -PROJECTILE_SPEED })
    for (let i = 0; i < 10 && p.alive; i++) updateProjectile(p, level, 1)
    expect(p.alive).toBe(false)
  })

  it('morre ao sair do mapa pela direita', () => {
    const level = makeLevel(['........', '########'])
    const p = makeProj({ x: level.widthPx - 2, vx: PROJECTILE_SPEED })
    for (let i = 0; i < 10 && p.alive; i++) updateProjectile(p, level, 1)
    expect(p.alive).toBe(false)
  })

  it('projetil morto nao se move', () => {
    const level = makeLevel(['........', '########'])
    const p = makeProj({ alive: false })
    const x0 = p.x
    updateProjectile(p, level, 5)
    expect(p.x).toBe(x0)
  })
})

describe('drawEnemy variantes (sheet por kind + fallback por cor)', () => {
  it('veloz usa o sheet char.tolo.veloz quando carregado', () => {
    const { r, sprites, rects } = makeFakeRenderer()
    const e = makeTolo({ kind: 'tolo_veloz' })
    drawEnemy(r, e, makeStore([ENEMY_SHEET_KEYS.tolo_veloz]), 0)
    expect(sprites).toHaveLength(1)
    expect(rects).toHaveLength(0)
  })

  it('atirador usa o sheet char.tolo.atirador quando carregado', () => {
    const { r, sprites } = makeFakeRenderer()
    const e = makeTolo({ kind: 'tolo_atirador' })
    drawEnemy(r, e, makeStore([ENEMY_SHEET_KEYS.tolo_atirador]), 0)
    expect(sprites).toHaveLength(1)
  })

  it('variante sem sheet no store: fallback por cor do def (nao usa char.tolo)', () => {
    const { r, sprites, rects } = makeFakeRenderer()
    const e = makeTolo({ kind: 'tolo_veloz' })
    // Store so tem o sheet do tolo comum — a variante cai no fallback de cor.
    drawEnemy(r, e, makeStore(['char.tolo']), 0)
    expect(sprites).toHaveLength(0)
    expect(rects.length).toBeGreaterThan(0)
    expect(rects[0].color).toBe('#e8731a')
  })

  it('fallback do atirador usa a cor ciano do def', () => {
    const { r, rects } = makeFakeRenderer()
    drawEnemy(r, makeTolo({ kind: 'tolo_atirador' }))
    expect(rects[0].color).toBe('#1a9ec9')
  })
})
