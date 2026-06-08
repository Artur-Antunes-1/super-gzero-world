import { describe, it, expect } from 'vitest'
import { GRAVITY, MAX_FALL, TILE } from '../../src/engine/constants'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import { stepBody, collideTiles, type Body } from '../../src/engine/physics'

// Constrói um ParsedLevel mínimo a partir de um mapa ASCII só com os tiles
// que esta task exercita: '#'=ground, 'B'=brick, '?'=block, '='=platform, '.'/' '=empty.
function makeLevel(rows: string[]): ParsedLevel {
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
    enemies: [],
  }
}

function makeBody(over: Partial<Body> = {}): Body {
  return {
    x: 0,
    y: 0,
    w: 16,
    h: 16,
    vx: 0,
    vy: 0,
    onGround: false,
    ...over,
  }
}

describe('stepBody (gravidade + integração)', () => {
  it('(a) acelera por GRAVITY em queda livre', () => {
    // Level vazio: sem tiles sólidos sob o corpo.
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    stepBody(body, level, 1)

    // Um passo: vy passa de 0 para GRAVITY; y integra a nova vy.
    expect(body.vy).toBeCloseTo(GRAVITY, 5)
    expect(body.y).toBeCloseTo(GRAVITY, 5)
  })

  it('(a) satura a velocidade de queda em MAX_FALL', () => {
    const level = makeLevel(['....', '....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    // Muitos passos: deve saturar e nunca passar de MAX_FALL.
    for (let i = 0; i < 1000; i++) stepBody(body, level, 1)

    expect(body.vy).toBeCloseTo(MAX_FALL, 5)
  })

  it('(a) integra vx no eixo X', () => {
    const level = makeLevel(['....', '....'])
    const body = makeBody({ x: 0, y: 0, vx: 3, vy: 0 })

    stepBody(body, level, 1)

    expect(body.x).toBeCloseTo(3, 5)
  })
})

describe('collideTiles (resolve X depois Y contra tiles sólidos)', () => {
  it('(b) para o corpo sobre o chão e marca onGround sem afundar', () => {
    // Chão na linha 2 (y de 96 a 144). Corpo de 16px caindo, sobreposto ao chão.
    const level = makeLevel(['....', '....', '####'])
    const body = makeBody({ x: 24, y: 90, w: 16, h: 16, vx: 0, vy: 6 })

    collideTiles(body, level)

    // Topo do chão = 2 * TILE = 96. O corpo deve ficar com o pé exatamente em 96.
    expect(body.y + body.h).toBeCloseTo(96, 5)
    expect(body.vy).toBe(0)
    expect(body.onGround).toBe(true)
  })

  it('(c) colisão horizontal contra brick zera vx e encosta no tile', () => {
    // Brick na coluna 2 (x de 96 a 144). Corpo indo para a direita, sobreposto.
    const level = makeLevel(['..B.', '..B.', '..B.'])
    const body = makeBody({ x: 88, y: 24, w: 16, h: 16, vx: 5, vy: 0 })

    collideTiles(body, level)

    // Lado esquerdo do brick = 2 * TILE = 96. Direita do corpo deve parar em 96.
    expect(body.x + body.w).toBeCloseTo(96, 5)
    expect(body.vx).toBe(0)
  })

  it('(d) platform é sólida quando o corpo desce vindo de cima', () => {
    // Platform na linha 2 (topo em y=96). Corpo logo acima descendo.
    const level = makeLevel(['....', '....', '===='])
    const body = makeBody({ x: 24, y: 86, w: 16, h: 16, vx: 0, vy: 6 })

    collideTiles(body, level)

    expect(body.y + body.h).toBeCloseTo(96, 5)
    expect(body.vy).toBe(0)
    expect(body.onGround).toBe(true)
  })

  it('(d) platform NÃO bloqueia quando o corpo já a atravessou (sobe / dentro)', () => {
    // Corpo já com o pé abaixo do topo da platform: não deve ser empurrado para cima.
    const level = makeLevel(['....', '....', '===='])
    const body = makeBody({ x: 24, y: 100, w: 16, h: 16, vx: 0, vy: -4 })

    collideTiles(body, level)

    // Subindo e já dentro: a platform é one-way, então não colide.
    expect(body.vy).toBe(-4)
    expect(body.onGround).toBe(false)
  })
})
