import { describe, it, expect } from 'vitest'
import { createCamera, followCamera } from '../../src/engine/camera'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import type { ParsedLevel } from '../../src/data/schema'

// Nivel grande o suficiente para haver folga de clamp em ambos os eixos.
// Apenas widthPx/heightPx importam para a camera; o resto e preenchido minimamente.
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
  }
}

describe('createCamera', () => {
  it('comeca em (0,0)', () => {
    const cam = createCamera()
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })
})

describe('followCamera', () => {
  it('centra o alvo na viewport quando ha folga em ambos os lados', () => {
    const cam = createCamera()
    const level = makeLevel(4000, 2000)
    // centro do alvo = (1000 + 34/2, 800 + 42/2) = (1017, 821)
    const target = { x: 1000, y: 800, w: 34, h: 42 }
    followCamera(cam, target, level)
    expect(cam.x).toBe(1000 + 34 / 2 - VIEW_W / 2) // 1017 - 480 = 537
    expect(cam.y).toBe(800 + 42 / 2 - VIEW_H / 2) // 821 - 264 = 557
  })

  it('faz clamp em 0 quando o alvo esta no canto superior-esquerdo (nunca negativo)', () => {
    const cam = createCamera()
    const level = makeLevel(4000, 2000)
    const target = { x: 0, y: 0, w: 34, h: 42 }
    followCamera(cam, target, level)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })

  it('faz clamp no fim do nivel quando o alvo esta no canto inferior-direito (nunca alem do fim)', () => {
    const cam = createCamera()
    const level = makeLevel(4000, 2000)
    const target = { x: level.widthPx, y: level.heightPx, w: 34, h: 42 }
    followCamera(cam, target, level)
    expect(cam.x).toBe(level.widthPx - VIEW_W) // 4000 - 960 = 3040
    expect(cam.y).toBe(level.heightPx - VIEW_H) // 2000 - 528 = 1472
  })

  it('quando o nivel e menor que a viewport, o limite inferior vence (cam fica em 0)', () => {
    const cam = createCamera()
    // largura 500 < VIEW_W 960  e  altura 300 < VIEW_H 528
    const level = makeLevel(500, 300)
    const target = { x: 250, y: 150, w: 34, h: 42 }
    followCamera(cam, target, level)
    // max do clamp seria negativo (500-960=-460); o lower bound 0 prevalece
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
  })
})
