// tests/unit/sprites.test.ts
import { describe, it, expect } from 'vitest'
import { drawPlaceholder } from '../../src/game/sprites'
import { CHARACTERS } from '../../src/data/characters'
import type { Renderer } from '../../src/engine/render'

interface RectCall {
  x: number
  y: number
  w: number
  h: number
  color: string
}

// FakeRenderer: implements exactly the Renderer interface from the CONTRATO.
class FakeRenderer implements Renderer {
  rects: RectCall[] = []
  // ctx is not used by drawPlaceholder; stub satisfies the type in test runtime
  ctx = {} as CanvasRenderingContext2D
  clear(_color: string): void {}
  beginWorld(_camX: number, _camY: number): void {}
  endWorld(): void {}
  drawRect(x: number, y: number, w: number, h: number, color: string): void {
    this.rects.push({ x, y, w, h, color })
  }
  present(): void {}
}

describe('drawPlaceholder', () => {
  const char = CHARACTERS['renan']
  const X = 100
  const Y = 200
  const W = 34
  const H = 42

  it('desenha o corpo na cor do char, faixa accent e olho (>= 3 retangulos)', () => {
    const r = new FakeRenderer()
    drawPlaceholder(r, char, X, Y, W, H, 1)
    expect(r.rects.length).toBeGreaterThanOrEqual(3)
    // body: first rect, char color, covers the full area
    const body = r.rects[0]
    expect(body.color).toBe(char.color)
    expect(body.x).toBe(X)
    expect(body.y).toBe(Y)
    expect(body.w).toBe(W)
    expect(body.h).toBe(H)
    // at least one rect uses the accent color (the stripe)
    expect(r.rects.some((rc) => rc.color === char.accent)).toBe(true)
  })

  it('coloca o olho no lado direito quando facing=1', () => {
    const r = new FakeRenderer()
    drawPlaceholder(r, char, X, Y, W, H, 1)
    const centerX = X + W / 2
    // last rect drawn is the eye
    const eye = r.rects[r.rects.length - 1]
    expect(eye.x).toBeGreaterThanOrEqual(centerX)
  })

  it('coloca o olho no lado esquerdo quando facing=-1', () => {
    const r = new FakeRenderer()
    drawPlaceholder(r, char, X, Y, W, H, -1)
    const centerX = X + W / 2
    const eye = r.rects[r.rects.length - 1]
    expect(eye.x + eye.w).toBeLessThanOrEqual(centerX)
  })
})
