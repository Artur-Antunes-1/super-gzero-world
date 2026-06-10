import { describe, it, expect } from 'vitest'
import { createCamera, followCamera } from '../../src/engine/camera'
import type { Camera } from '../../src/engine/camera'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import type { ParsedLevel } from '../../src/data/schema'

// NOTA (C4): a camera agora tem suavizacao (15%/frame), deadzone horizontal
// (±96px), lookahead com easing (ate 80px, 10%/frame) e snapping vertical.
// Os testes antigos de clamp esperavam convergencia em 1 frame; foram
// adaptados para rodar varios frames ate convergir (documentado aqui).

// Nivel minimo: a camera so le widthPx/heightPx. Campos extras do contrato
// novo (qBlocks etc.) podem ou nao existir no schema; cast tolera ambos.
function makeLevel(widthPx: number, heightPx: number): ParsedLevel {
  return {
    widthTiles: Math.ceil(widthPx / 48),
    heightTiles: Math.ceil(heightPx / 48),
    widthPx,
    heightPx,
    tiles: [],
    playerSpawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies: [],
    qBlocks: [],
    hearts: [],
    checkpoints: [],
    timeStart: 300,
    foolSpawns: [],
  } as unknown as ParsedLevel
}

// Roda followCamera por N frames (convergencia da suavizacao exponencial).
function settle(
  cam: Camera,
  target: Parameters<typeof followCamera>[1],
  level: ParsedLevel,
  frames = 400
): void {
  for (let i = 0; i < frames; i++) followCamera(cam, target, level)
}

describe('createCamera', () => {
  it('comeca em (0,0) com lookahead zerado', () => {
    const cam = createCamera()
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
    expect(cam.lookX ?? 0).toBe(0)
  })
})

describe('followCamera — clamp aos limites do nivel (multi-frame)', () => {
  it('faz clamp em 0 no canto superior-esquerdo (nunca negativo)', () => {
    const cam = createCamera()
    const level = makeLevel(4000, 2000)
    // objeto minimo {x,y,w,h}: campos extras devem ter defaults seguros
    const target = { x: 0, y: 0, w: 34, h: 42 }
    settle(cam, target, level)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })

  it('faz clamp no fim do nivel no canto inferior-direito', () => {
    const cam = createCamera()
    const level = makeLevel(4000, 2000)
    const target = { x: level.widthPx, y: level.heightPx, w: 34, h: 42 }
    settle(cam, target, level)
    expect(cam.x).toBe(level.widthPx - VIEW_W) // 4000 - 960 = 3040
    expect(cam.y).toBe(level.heightPx - VIEW_H) // 2000 - 528 = 1472
  })

  it('nivel menor que a viewport: lower bound 0 vence', () => {
    const cam = createCamera()
    const level = makeLevel(500, 300)
    const target = { x: 250, y: 150, w: 34, h: 42 }
    settle(cam, target, level)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })
})

describe('followCamera — deadzone horizontal (~96px)', () => {
  const level = makeLevel(4000, 2000)

  it('nao move quando o foco esta no centro da view', () => {
    const cam = createCamera()
    cam.x = 500
    cam.lookX = 80 // lookahead pre-convergido (facing 1 mantem em 80)
    // centro da view = 500 + 480 = 980; foco = centerX + 80 = 980 → x = 883
    const target = { x: 883, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    for (let i = 0; i < 50; i++) followCamera(cam, target, level)
    expect(cam.x).toBe(500)
  })

  it('nao move com o foco exatamente na borda da deadzone (+96)', () => {
    const cam = createCamera()
    cam.x = 500
    cam.lookX = 80
    // foco = (979 + 17) + 80 = 1076 = 980 + 96 (borda exata, nao excede)
    const target = { x: 979, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    for (let i = 0; i < 50; i++) followCamera(cam, target, level)
    expect(cam.x).toBe(500)
  })

  it('move para a direita quando o foco passa da borda direita', () => {
    const cam = createCamera()
    cam.x = 500
    cam.lookX = 80
    // foco = (980.5 + 17) + 80 = 1077.5 > 1076
    const target = { x: 980.5, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    followCamera(cam, target, level)
    expect(cam.x).toBeGreaterThan(500)
  })

  it('move para a esquerda quando o foco passa da borda esquerda', () => {
    const cam = createCamera()
    cam.x = 500
    cam.lookX = 80
    // foco = (700 + 17) + 80 = 797 < 980 - 96 = 884
    const target = { x: 700, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    followCamera(cam, target, level)
    expect(cam.x).toBeLessThan(500)
  })

  it('converge para a borda da deadzone (alvo a direita, lookX pre-convergido)', () => {
    const cam = createCamera()
    cam.lookX = 80
    // foco = 1017 + 80 = 1097; convergencia: cam.x = 1097 - 96 - 480 = 521
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: true }
    settle(cam, target, level)
    expect(cam.x).toBeCloseTo(1097 - 96 - VIEW_W / 2, 6)
  })

  it('converge para a borda esquerda quando vem de tras (facing -1)', () => {
    const cam = createCamera()
    cam.x = 1000
    cam.lookX = -80
    // foco = 1017 - 80 = 937; convergencia: cam.x = 937 + 96 - 480 = 553
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: -1 as const, onGround: true }
    settle(cam, target, level)
    expect(cam.x).toBeCloseTo(937 + 96 - VIEW_W / 2, 6)
  })
})

describe('followCamera — lookahead com easing (10%/frame, ate 80px)', () => {
  const level = makeLevel(4000, 2000)

  it('apos 1 frame lookX avanca 10% do desejado (facing 1 → 8)', () => {
    const cam = createCamera()
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: true }
    followCamera(cam, target, level)
    expect(cam.lookX).toBe(8)
  })

  it('facing -1 → lookX negativo (-8 apos 1 frame)', () => {
    const cam = createCamera()
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: -1 as const, onGround: true }
    followCamera(cam, target, level)
    expect(cam.lookX).toBe(-8)
  })

  it('lookX converge para 80 na direcao do facing', () => {
    const cam = createCamera()
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: true }
    settle(cam, target, level)
    expect(cam.lookX).toBeCloseTo(80, 6)
  })

  it('facing 1 estaciona a camera mais a direita que facing -1', () => {
    const camR = createCamera()
    const camL = createCamera()
    const base = { x: 1000, y: 800, w: 34, h: 42, onGround: true }
    settle(camR, { ...base, facing: 1 as const }, level)
    settle(camL, { ...base, facing: -1 as const }, level)
    expect(camR.x).toBeGreaterThan(camL.x)
    // invariante: em repouso o foco fica dentro da deadzone (±96)
    const focusR = 1017 + 80
    const focusL = 1017 - 80
    expect(Math.abs(focusR - (camR.x + VIEW_W / 2))).toBeLessThanOrEqual(96 + 1e-6)
    expect(Math.abs(focusL - (camL.x + VIEW_W / 2))).toBeLessThanOrEqual(96 + 1e-6)
  })
})

describe('followCamera — vertical (segue no chao OU |delta| > 120)', () => {
  const level = makeLevel(4000, 2000)

  it('no chao: converge para centralizar o alvo verticalmente', () => {
    const cam = createCamera()
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: true }
    settle(cam, target, level)
    // centerY = 821; desejado = 821 - 264 = 557
    expect(cam.y).toBeCloseTo(821 - VIEW_H / 2, 6)
  })

  it('no ar com delta pequeno (≤120): camera nao segue (platform snapping)', () => {
    const cam = createCamera()
    cam.y = 500
    // centerY = 821; centro da view = 500 + 264 = 764; delta = 57 ≤ 120
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    for (let i = 0; i < 50; i++) followCamera(cam, target, level)
    expect(cam.y).toBe(500)
  })

  it('no ar com delta grande (>120): segue ate o delta voltar para ≤120', () => {
    const cam = createCamera()
    // centerY = 821; delta inicial = 821 - 264 = 557 > 120 → segue
    const target = { x: 1000, y: 800, w: 34, h: 42, facing: 1 as const, onGround: false }
    settle(cam, target, level)
    expect(cam.y).toBeGreaterThan(0)
    const delta = Math.abs(821 - (cam.y + VIEW_H / 2))
    expect(delta).toBeLessThanOrEqual(120 + 1e-6)
  })
})

describe('followCamera — determinismo', () => {
  it('duas execucoes identicas produzem estados identicos', () => {
    const level = makeLevel(4000, 2000)
    const a = createCamera()
    const b = createCamera()
    const target = { x: 1234, y: 567, w: 34, h: 42, facing: -1 as const, onGround: true }
    for (let i = 0; i < 50; i++) {
      followCamera(a, target, level)
      followCamera(b, target, level)
    }
    expect(a.x).toBe(b.x)
    expect(a.y).toBe(b.y)
    expect(a.lookX).toBe(b.lookX)
  })
})
