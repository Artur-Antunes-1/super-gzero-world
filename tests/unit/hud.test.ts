// tests/unit/hud.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawHud } from '../../src/ui/hud'
import { HW_METER_MAX, COLOR_LIME, COLOR_MAGENTA } from '../../src/engine/constants'
import type { Renderer } from '../../src/engine/render'

// ctx stub: jsdom nao desenha; registramos as chamadas relevantes.
function makeCtxStub() {
  return {
    canvas: { width: 960, height: 528 },
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
    fillStyle: '' as string,
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }
}

// Renderer falso: drawRect e um spy independente para contar os segmentos.
function makeRenderer(ctx: ReturnType<typeof makeCtxStub>): Renderer {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    present: vi.fn(),
  }
}

// Conta segmentos "cheios" do medidor: drawRect chamado com a cor de preenchimento
// (COLOR_LIME) usada para os segmentos ativos. O HUD desenha 4 trilhos (vazios) +
// N preenchidos (lime), onde N = round(hwMeter/HW_METER_MAX * 4).
function countFilledSegments(r: Renderer): number {
  const calls = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls
  return calls.filter((c) => c[4] === COLOR_LIME).length
}

// Conta coracoes "cheios": drawRect com a cor de coracao (COLOR_MAGENTA).
function countFilledHearts(r: Renderer): number {
  const calls = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls
  return calls.filter((c) => c[4] === COLOR_MAGENTA).length
}

describe('drawHud — medidor Humanware (4 segmentos) + coracoes', () => {
  it('medidor vazio (hwMeter=0): 0 segmentos cheios, mas 4 trilhos desenhados', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 3, coins: 0, hwMeter: 0, hearts: 3 })
    expect(countFilledSegments(r)).toBe(0)
    // Sempre desenha os 4 trilhos vazios (cor != COLOR_LIME).
    const total = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls.length
    expect(total).toBeGreaterThanOrEqual(4)
  })

  it('medidor cheio (hwMeter=HW_METER_MAX): 4 segmentos cheios', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 3, coins: 0, hwMeter: HW_METER_MAX, hearts: 3 })
    expect(countFilledSegments(r)).toBe(4)
  })

  it('medidor pela metade (hwMeter=500): 2 segmentos cheios', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 3, coins: 0, hwMeter: 500, hearts: 3 })
    expect(countFilledSegments(r)).toBe(2)
  })

  it('medidor a 1 segmento (hwMeter=250): 1 segmento cheio', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 3, coins: 0, hwMeter: 250, hearts: 3 })
    expect(countFilledSegments(r)).toBe(1)
  })

  it('desenha N coracoes cheios conforme hearts', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 3, coins: 0, hwMeter: 0, hearts: 4 })
    expect(countFilledHearts(r)).toBe(4)
  })

  it('hearts=0 nao desenha nenhum coracao cheio', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 250, lives: 1, coins: 0, hwMeter: 0, hearts: 0 })
    expect(countFilledHearts(r)).toBe(0)
  })

  it('continua desenhando TIME/LIVES/COINS via fillText', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { time: 7, lives: 3, coins: 5, hwMeter: 0, hearts: 3 })
    const texts = ctx.fillText.mock.calls.map((c) => String(c[0]))
    expect(texts.some((t) => t.startsWith('TIME'))).toBe(true)
    expect(texts.some((t) => t.startsWith('LIVES'))).toBe(true)
    expect(texts.some((t) => t.startsWith('COINS'))).toBe(true)
  })
})
