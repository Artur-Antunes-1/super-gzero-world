import { describe, it, expect } from 'vitest'
import { GRAVITY, MAX_FALL, TILE, JUMP_VEL } from '../../src/engine/constants'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import { stepBody, collideTiles, isFullSolid, tileAt, type Body } from '../../src/engine/physics'

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

// Errata de fisica (2026-06-11): JUMP_VEL -18.0. Apex CONTINUO 18^2/1.6 ≈ 202px
// (4,2 tiles); a simulacao DISCRETA (gravidade antes da integracao) da ~193.6px.
describe('pulo recalibrado — apex por simulacao de stepBody', () => {
  // Sobe com vy0 ate o apex em level vazio; retorna a subida total em px.
  function simulateApex(vy0: number, gravityScale = 1): number {
    const level = makeLevel(Array(12).fill('....'))
    const body = makeBody({ x: 24, y: 480, vx: 0, vy: vy0 })
    const startY = body.y
    let minY = startY
    let guard = 0
    while (body.vy < 0 && guard < 100) {
      stepBody(body, level, 1, gravityScale)
      if (body.y < minY) minY = body.y
      guard++
    }
    return startY - minY
  }

  it('JUMP_VEL base: apex >= 4 tiles (~193.6px discreto; ~202px continuo)', () => {
    const apex = simulateApex(JUMP_VEL)
    expect(apex).toBeGreaterThanOrEqual(4 * TILE) // >= 192px
    expect(apex).toBeLessThan(4.3 * TILE) // sanidade (< 206.4px)
    expect(apex).toBeCloseTo(193.6, 1)
  })

  it('pior saltador (jumpVelMul 0.94, Einstein): apex ~170px — alcanca moedas row 4 (150px)', () => {
    const apex = simulateApex(JUMP_VEL * 0.94)
    expect(apex).toBeGreaterThan(150) // exigencia das moedas row 4
    expect(apex).toBeLessThan(180)
    expect(apex).toBeCloseTo(170.5, 1) // = piso usado por REACH_MAX (170)
  })

  it('melhor saltador (Renan: jumpVelMul 1.06, weightMul 0.96): apex ~227px', () => {
    const apex = simulateApex(JUMP_VEL * 1.06, 0.96)
    expect(apex).toBeGreaterThan(220)
    expect(apex).toBeLessThan(235)
  })
})

describe('stepBody — gravityScale (weightMul)', () => {
  it('sem 4º argumento: comportamento idêntico a gravityScale=1', () => {
    const level = makeLevel(['....', '....', '....'])
    const a = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })
    const b = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    stepBody(a, level, 1)
    stepBody(b, level, 1, 1)

    expect(a.vy).toBeCloseTo(b.vy, 10)
    expect(a.y).toBeCloseTo(b.y, 10)
  })

  it('gravityScale 1.08: vy cresce 8% mais por passo (antes do clamp)', () => {
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    stepBody(body, level, 1, 1.08)

    expect(body.vy).toBeCloseTo(GRAVITY * 1.08, 5)
  })

  it('gravityScale 0.96: vy cresce 4% menos por passo', () => {
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    stepBody(body, level, 1, 0.96)

    expect(body.vy).toBeCloseTo(GRAVITY * 0.96, 5)
  })

  it('MAX_FALL não escala: gravityScale 1.08 satura no mesmo teto', () => {
    const level = makeLevel(['....', '....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    for (let i = 0; i < 1000; i++) stepBody(body, level, 1, 1.08)

    expect(body.vy).toBeCloseTo(MAX_FALL, 5)
  })
})

// C3b: stepBody retorna { ceil } — célula sólida que zerou vy<0 (batida de cabeça).
describe('stepBody — retorno { ceil } (C3b)', () => {
  it('subindo contra tile sólido: retorna a célula que zerou vy', () => {
    // Blocks na linha 0; corpo logo abaixo subindo.
    const level = makeLevel(['???', '...'])
    // x=TILE: corpo (w=16) cobre só a coluna 1. y=50, vy=-6 -> apos gravidade
    // vy=-5.2, topo em 44.8 (linha 0) -> colide e encosta em y=TILE.
    const body = makeBody({ x: TILE, y: 50, w: 16, h: 16, vx: 0, vy: -6 })

    const ret = stepBody(body, level, 1)

    expect(body.vy).toBe(0)
    expect(body.y).toBeCloseTo(TILE, 5)
    expect(ret.ceil).toEqual({ col: 1, row: 0 })
  })

  it('queda livre: ceil é null', () => {
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    const ret = stepBody(body, level, 1)

    expect(ret.ceil).toBeNull()
  })

  it('pousando no chão (vy>0 zerado): ceil é null', () => {
    const level = makeLevel(['....', '....', '####'])
    const body = makeBody({ x: 24, y: 90, w: 16, h: 16, vx: 0, vy: 6 })

    const ret = stepBody(body, level, 1)

    expect(body.onGround).toBe(true)
    expect(body.vy).toBe(0)
    expect(ret.ceil).toBeNull()
  })

  it('subindo sem teto por perto: ceil é null mesmo com vy<0', () => {
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 100, w: 16, h: 16, vx: 0, vy: -8 })

    const ret = stepBody(body, level, 1)

    expect(body.vy).toBeLessThan(0)
    expect(ret.ceil).toBeNull()
  })
})

// A2: isFullSolid e tileAt agora exportados (fonte única; enemy.ts importa daqui).
describe('isFullSolid (exportado)', () => {
  it('true para ground/brick/block', () => {
    expect(isFullSolid('ground')).toBe(true)
    expect(isFullSolid('brick')).toBe(true)
    expect(isFullSolid('block')).toBe(true)
  })

  it('false para empty/platform/spike/goal', () => {
    expect(isFullSolid('empty')).toBe(false)
    expect(isFullSolid('platform')).toBe(false)
    expect(isFullSolid('spike')).toBe(false)
    expect(isFullSolid('goal')).toBe(false)
  })
})

describe('tileAt (exportado)', () => {
  it('le o tile em coordenadas de grade', () => {
    const level = makeLevel(['.B', '##'])
    expect(tileAt(level, 0, 0)).toBe('empty')
    expect(tileAt(level, 1, 0)).toBe('brick')
    expect(tileAt(level, 0, 1)).toBe('ground')
  })

  it("fora dos limites => 'empty' (nas 4 direcoes)", () => {
    const level = makeLevel(['##', '##'])
    expect(tileAt(level, -1, 0)).toBe('empty')
    expect(tileAt(level, 0, -1)).toBe('empty')
    expect(tileAt(level, 2, 0)).toBe('empty')
    expect(tileAt(level, 0, 2)).toBe('empty')
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

describe('novos testes de cobertura / endurecimento (TDD)', () => {
  it('colisao a esquerda: corpo movendo para a esquerda para flush contra parede', () => {
    // Brick na coluna 1 (x de TILE a 2*TILE). Corpo à direita, movendo para a esquerda,
    // com a borda esquerda dentro do tile de brick (sobreposição real na borda leading).
    // Layout (3 colunas): '.B.' — brick na coluna 1
    const level = makeLevel(['.B.', '.B.', '.B.'])
    // Corpo: w=16, posicionado com left DENTRO do brick (x=TILE+4 → left=52, dentro col 1)
    const body = makeBody({ x: TILE + 4, y: TILE, w: 16, h: 16, vx: -3, vy: 0 })

    collideTiles(body, level)

    // A borda esquerda deve ficar em 2*TILE (borda direita do brick na coluna 1)
    expect(body.x).toBeCloseTo(2 * TILE, 5)
    expect(body.vx).toBe(0)
    // Sem sobreposição: x >= 2*TILE
    expect(body.x).toBeGreaterThanOrEqual(2 * TILE)
  })

  it('parede grossa: duas colunas solidas adjacentes, movendo a esquerda nao teleporta', () => {
    // Duas colunas sólidas adjacentes (cols 1 e 2). Corpo começa à direita delas
    // e move para a esquerda em vários passos. Deve parar contra a coluna 2 (mais à direita)
    // e nunca saltar para a direita nem atravessar.
    //
    // Layout (5 colunas): '..BB.' — bricks nas colunas 2 e 3
    const level = makeLevel(['..BB.', '..BB.', '..BB.'])
    // Corpo começa com a borda esquerda em 4*TILE (coluna 4), movendo para a esquerda
    const body = makeBody({ x: 4 * TILE, y: TILE, w: 16, h: 16, vx: -5, vy: 0 })
    const startX = body.x

    // Vários passos de integração
    for (let i = 0; i < 20; i++) {
      body.x += body.vx
      collideTiles(body, level)
    }

    // Deve pousar flush contra a borda direita das colunas sólidas (col 3 = 4*TILE)
    // e nunca ter passado para a esquerda disso nem voltado para além do ponto de partida
    expect(body.x).toBeCloseTo(4 * TILE, 5)
    expect(body.vx).toBe(0)
    // Nunca deve ter ido além do ponto de partida para a direita
    expect(body.x).toBeLessThanOrEqual(startX)
    // Nunca deve ter atravessado a parede (borda esquerda >= borda direita da col 3)
    expect(body.x).toBeGreaterThanOrEqual(4 * TILE)
  })

  it('colisao com teto: corpo subindo (vy<0) para contra tile solido acima', () => {
    // Block na linha 0 (y de 0 a TILE). Corpo na linha 1 subindo com vy < 0.
    // Layout (2 linhas): primeira linha com block, segunda vazia.
    const level = makeLevel(['???', '...'])
    // Corpo com topo sobreposto ao block acima
    const body = makeBody({ x: TILE, y: TILE - 4, w: 16, h: 16, vx: 0, vy: -6 })

    collideTiles(body, level)

    // Após resolução, o topo do corpo deve estar em TILE (borda inferior do tile 0)
    expect(body.y).toBeCloseTo(TILE, 5)
    expect(body.vy).toBe(0)
    // Sem sobreposição para cima
    expect(body.y).toBeGreaterThanOrEqual(TILE)
  })

  it('cair para fora do mundo (borda inferior/direita) nao quebra', () => {
    // Nível pequeno de 2x2 tiles. Corpo posicionado além da borda direita/inferior.
    const level = makeLevel(['..', '..'])
    // Corpo além da borda direita e inferior do nível — fora dos limites
    const body = makeBody({
      x: level.widthPx + 10,
      y: level.heightPx + 10,
      w: 16,
      h: 16,
      vx: 5,
      vy: 10,
    })
    const xBefore = body.x
    const yBefore = body.y

    // Não deve lançar exceção; tiles fora dos limites são tratados como empty
    expect(() => collideTiles(body, level)).not.toThrow()
    expect(() => stepBody(body, level, 1)).not.toThrow()

    // Corpo continua se movendo / caindo (sem snap para dentro do nível)
    expect(body.x).toBeGreaterThanOrEqual(xBefore)
  })

  it('corpo parado (vx=0,vy=0) sobre o chao permanece em repouso', () => {
    // Chão na linha 2. Corpo repousando exatamente sobre o chão.
    // Após um stepBody: gravidade puxa, depois resolução encosta de volta — onGround=true, sem jitter.
    const level = makeLevel(['....', '....', '####'])
    // Topo do chão = 2*TILE. Corpo com pé exatamente no chão.
    const body = makeBody({ x: TILE, y: 2 * TILE - 16, w: 16, h: 16, vx: 0, vy: 0 })

    stepBody(body, level, 1)

    // Após um passo: gravidade integra vy, depois pousa de volta no chão
    expect(body.onGround).toBe(true)
    expect(body.vy).toBe(0)
    // Pé exatamente no topo do chão
    expect(body.y + body.h).toBeCloseTo(2 * TILE, 5)
    // Sem jitter: x não deve ter mudado
    expect(body.x).toBeCloseTo(TILE, 5)
  })
})
