import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import { createRenderer } from '../../src/engine/render'

// ctx stub: jsdom nao desenha, entao registramos as chamadas.
function makeCtxStub() {
  return {
    canvas: { width: VIEW_W, height: VIEW_H },
    imageSmoothingEnabled: true, // createRenderer deve forcar p/ false
    fillStyle: '' as string,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }
}

// canvas falso: getContext('2d') devolve o ctx stub.
function makeCanvasStub(ctx: ReturnType<typeof makeCtxStub>) {
  return {
    width: VIEW_W,
    height: VIEW_H,
    getContext: vi.fn((kind: string) => (kind === '2d' ? ctx : null)),
  } as unknown as HTMLCanvasElement
}

describe('createRenderer', () => {
  let ctx: ReturnType<typeof makeCtxStub>
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    ctx = makeCtxStub()
    canvas = makeCanvasStub(ctx)
  })

  it('expoe o ctx e desliga o smoothing', () => {
    const r = createRenderer(canvas)
    expect(r.ctx).toBe(ctx)
    expect(ctx.imageSmoothingEnabled).toBe(false)
  })

  it('clear preenche o canvas inteiro 960x528 com a cor dada', () => {
    const r = createRenderer(canvas)
    r.clear('#09090b')
    expect(ctx.fillStyle).toBe('#09090b')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, VIEW_W, VIEW_H)
  })

  it('beginWorld faz save + translate(-camX, -camY) e endWorld faz restore', () => {
    const r = createRenderer(canvas)
    r.beginWorld(120, 30)
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.translate).toHaveBeenCalledWith(-120, -30)
    expect(ctx.restore).not.toHaveBeenCalled()
    r.endWorld()
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('beginWorld arredonda camX e camY fracionarios para manter pixels crisp', () => {
    const r = createRenderer(canvas)
    r.beginWorld(120.7, 30.4)
    expect(ctx.translate).toHaveBeenCalledWith(-121, -30)
  })

  it('drawRect repassa x,y,w,h e cor para fillRect', () => {
    const r = createRenderer(canvas)
    r.drawRect(10, 20, 30, 40, '#ff0055')
    expect(ctx.fillStyle).toBe('#ff0055')
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 30, 40)
  })

  it('present existe e nao lanca (no-op no canvas direto)', () => {
    const r = createRenderer(canvas)
    expect(() => r.present()).not.toThrow()
  })

  it('lanca se getContext nao devolver um contexto 2d', () => {
    const broken = {
      width: VIEW_W,
      height: VIEW_H,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement
    expect(() => createRenderer(broken)).toThrow()
  })
})
