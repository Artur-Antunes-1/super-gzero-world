// tests/unit/hud.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drawHud, COIN_GOLD, HEART_EMPTY, COLOR_LABEL } from '../../src/ui/hud'
import {
  HW_METER_MAX,
  COLOR_LIME,
  COLOR_SURFACE,
  COLOR_OBJETIVO,
  COLOR_TECH,
  COLOR_TEXT,
} from '../../src/engine/constants'
import type { Renderer } from '../../src/engine/render'

// Registro de cada fillRect com snapshot de fillStyle/globalAlpha no momento da chamada.
interface RectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
  alpha: number
}

interface TextCall {
  text: string
  x: number
  y: number
  fillStyle: string
  font: string
}

// ctx stub: jsdom nao desenha; capturamos chamadas com estado de estilo.
function makeCtxStub() {
  const rects: RectCall[] = []
  const texts: TextCall[] = []
  const fills: string[] = [] // fillStyle no momento de cada ctx.fill() (moeda)
  const stub = {
    canvas: { width: 960, height: 528 },
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    fillStyle: '' as string,
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(() => {
      fills.push(String(stub.fillStyle))
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      rects.push({ x, y, w, h, fillStyle: String(stub.fillStyle), alpha: stub.globalAlpha })
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      texts.push({ text: String(text), x, y, fillStyle: String(stub.fillStyle), font: stub.font })
    }),
    rects,
    texts,
    fills,
  }
  return stub
}

// Renderer falso: drawRect e um spy independente (medidor usa r.drawRect).
function makeRenderer(ctx: ReturnType<typeof makeCtxStub>): Renderer {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    drawSprite: vi.fn(),
    present: vi.fn(),
  }
}

// Conta segmentos do medidor desenhados via r.drawRect com a cor dada.
function countMeterRects(r: Renderer, color: string): number {
  const calls = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls
  return calls.filter((c) => c[4] === color).length
}

// Coracoes cheios: fillRects em COLOR_OBJETIVO (4 rects por coracao).
function filledHeartRects(ctx: ReturnType<typeof makeCtxStub>): RectCall[] {
  return ctx.rects.filter((c) => c.fillStyle === COLOR_OBJETIVO)
}

// Coracoes vazios: fillRects em HEART_EMPTY com alpha 0.25.
function emptyHeartRects(ctx: ReturnType<typeof makeCtxStub>): RectCall[] {
  return ctx.rects.filter((c) => c.fillStyle === HEART_EMPTY && c.alpha === 0.25)
}

// Texto do timer: unico texto de 3 digitos do HUD.
function timerTexts(ctx: ReturnType<typeof makeCtxStub>): TextCall[] {
  return ctx.texts.filter((t) => /^\d{3}$/.test(t.text))
}

// Dados base validos; testes sobrescrevem o que interessa.
function baseData() {
  return { time: 200, lives: 3, coins: 5, hwMeter: 0, hearts: 3 }
}

describe('drawHud — medidor Humanware (floor fix)', () => {
  it('hwMeter=875: 3 segmentos (floor, nao round) — bug da revisao', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hwMeter: 875 })
    expect(countMeterRects(r, COLOR_LIME)).toBe(3)
  })

  it('hwMeter=999: ainda 3 segmentos (4º so com meter >= max)', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hwMeter: 999 })
    expect(countMeterRects(r, COLOR_LIME)).toBe(3)
  })

  it('hwMeter=HW_METER_MAX (1000): 4 segmentos cheios', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hwMeter: HW_METER_MAX })
    expect(countMeterRects(r, COLOR_LIME)).toBe(4)
  })

  it('hwMeter=0: 0 cheios, mas 4 trilhos (COLOR_SURFACE) sempre', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hwMeter: 0 })
    expect(countMeterRects(r, COLOR_LIME)).toBe(0)
    expect(countMeterRects(r, COLOR_SURFACE)).toBe(4)
  })

  it('hwMeter=250 → 1 segmento; 500 → 2', () => {
    const c1 = makeCtxStub()
    const r1 = makeRenderer(c1)
    drawHud(r1, { ...baseData(), hwMeter: 250 })
    expect(countMeterRects(r1, COLOR_LIME)).toBe(1)

    const c2 = makeCtxStub()
    const r2 = makeRenderer(c2)
    drawHud(r2, { ...baseData(), hwMeter: 500 })
    expect(countMeterRects(r2, COLOR_LIME)).toBe(2)
  })
})

describe('drawHud — hwReady (blink) e hwActive (solido)', () => {
  it('hwReady: blink em COLOR_OBJETIVO quando floor(trunc(time*60)/16) e par', () => {
    // time=200 → 12000 frames → 12000/16 = 750 (par) → COLOR_OBJETIVO.
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 200, hwMeter: HW_METER_MAX, hwReady: true })
    expect(countMeterRects(r, COLOR_OBJETIVO)).toBe(4)
    expect(countMeterRects(r, COLOR_TECH)).toBe(0)
    expect(countMeterRects(r, COLOR_LIME)).toBe(0)
  })

  it('hwReady: alterna para COLOR_TECH quando a fase de 16 frames e impar', () => {
    // time=200.3 → trunc(12018)/16 = 751 (impar) → COLOR_TECH.
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 200.3, hwMeter: HW_METER_MAX, hwReady: true })
    expect(countMeterRects(r, COLOR_TECH)).toBe(4)
    expect(countMeterRects(r, COLOR_OBJETIVO)).toBe(0)
  })

  it('hwActive: segmentos em COLOR_TECH solido, proporcional ao meter drenando', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hwMeter: 600, hwActive: true })
    // floor(600/1000*4) = 2 segmentos, todos COLOR_TECH.
    expect(countMeterRects(r, COLOR_TECH)).toBe(2)
    expect(countMeterRects(r, COLOR_LIME)).toBe(0)
  })

  it('hwActive tem precedencia sobre hwReady (sem blink durante o modo)', () => {
    // time=200 daria blink OBJETIVO se ready prevalecesse.
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 200, hwMeter: HW_METER_MAX, hwActive: true, hwReady: true })
    expect(countMeterRects(r, COLOR_TECH)).toBe(4)
    expect(countMeterRects(r, COLOR_OBJETIVO)).toBe(0)
  })

  it('rotulo HUMANWARE [H] em 10px monospace acima do medidor', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, baseData())
    const label = ctx.texts.find((t) => t.text === 'HUMANWARE [H]')
    expect(label).toBeDefined()
    expect(label!.font).toContain('10px')
    expect(label!.fillStyle).toBe(COLOR_LABEL)
  })
})

describe('drawHud — coracoes com forma (2 lobos + corpo + ponta)', () => {
  it('hearts=3, maxHearts=5: 12 fillRects cheios + 8 vazios (alpha 0.25)', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hearts: 3, maxHearts: 5 })
    expect(filledHeartRects(ctx).length).toBe(12) // 3 coracoes x 4 rects
    expect(emptyHeartRects(ctx).length).toBe(8) // 2 coracoes x 4 rects
  })

  it('hearts=0, maxHearts=3: nenhum cheio, 12 rects vazios', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hearts: 0, maxHearts: 3 })
    expect(filledHeartRects(ctx).length).toBe(0)
    expect(emptyHeartRects(ctx).length).toBe(12)
  })

  it('maxHearts ausente: default = hearts (so cheios, sem vazios)', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hearts: 4 })
    expect(filledHeartRects(ctx).length).toBe(16)
    expect(emptyHeartRects(ctx).length).toBe(0)
  })

  it('forma do coracao: 2 lobos no topo, corpo largo, ponta abaixo', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), hearts: 1, maxHearts: 1 })
    const rects = filledHeartRects(ctx)
    expect(rects.length).toBe(4)
    const minY = Math.min(...rects.map((c) => c.y))
    const lobes = rects.filter((c) => c.y === minY)
    expect(lobes.length).toBe(2) // 2 lobos na mesma linha do topo
    const body = rects.find((c) => c.y > minY && c.w >= 10)
    expect(body).toBeDefined() // corpo mais largo
    const tip = rects.find((c) => c.y > body!.y)
    expect(tip).toBeDefined() // ponta abaixo do corpo
    expect(tip!.w).toBeLessThan(body!.w)
  })
})

describe('drawHud — timer com aviso', () => {
  it('time >= 50: numero em COLOR_TEXT, sempre visivel', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 200 })
    const t = timerTexts(ctx)
    expect(t.length).toBe(1)
    expect(t[0].text).toBe('200')
    expect(t[0].fillStyle).toBe(COLOR_TEXT)
    expect(t[0].font).toContain('bold')
  })

  it('time < 50: numero em COLOR_OBJETIVO quando (floor(time*2)&1)===0', () => {
    // 49.2*2 = 98.4 → floor 98 (par) → visivel.
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 49.2 })
    const t = timerTexts(ctx)
    expect(t.length).toBe(1)
    expect(t[0].fillStyle).toBe(COLOR_OBJETIVO)
  })

  it('time < 50: numero some quando (floor(time*2)&1)===1', () => {
    // 49.6*2 = 99.2 → floor 99 (impar) → oculto.
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 49.6 })
    expect(timerTexts(ctx).length).toBe(0)
  })

  it('time < 10: blink rapido usa floor(time*4)', () => {
    // 9.3*4 = 37.2 → floor 37 (impar) → oculto.
    const c1 = makeCtxStub()
    const r1 = makeRenderer(c1)
    drawHud(r1, { ...baseData(), time: 9.3 })
    expect(timerTexts(c1).length).toBe(0)

    // 9.0*4 = 36 (par) → visivel em COLOR_OBJETIVO.
    const c2 = makeCtxStub()
    const r2 = makeRenderer(c2)
    drawHud(r2, { ...baseData(), time: 9 })
    const t = timerTexts(c2)
    expect(t.length).toBe(1)
    expect(t[0].fillStyle).toBe(COLOR_OBJETIVO)
  })

  it('rotulo TIME (10px cinza) permanece mesmo com numero oculto', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), time: 49.6 })
    const label = ctx.texts.find((t) => t.text === 'TIME')
    expect(label).toBeDefined()
    expect(label!.font).toContain('10px')
    expect(label!.fillStyle).toBe(COLOR_LABEL)
  })
})

describe('drawHud — vidas (icone + xN) e moedas (icone dourado)', () => {
  it('LIVES vira retrato 12px COLOR_TEXT + texto xN em 14px', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), lives: 3 })
    const portrait = ctx.rects.find(
      (c) => c.w === 12 && c.h === 12 && c.fillStyle === COLOR_TEXT,
    )
    expect(portrait).toBeDefined()
    const xText = ctx.texts.find((t) => t.text === 'x3')
    expect(xText).toBeDefined()
    expect(xText!.font).toContain('14px')
    expect(ctx.texts.some((t) => t.text.startsWith('LIVES'))).toBe(false)
  })

  it('COINS ganha circulo dourado (arc + fill em #f5c842) antes do numero', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    drawHud(r, { ...baseData(), coins: 7 })
    expect(ctx.arc).toHaveBeenCalled()
    // raio 5 = circulo de 10px.
    const arcCall = ctx.arc.mock.calls[0]
    expect(arcCall[2]).toBe(5)
    expect(ctx.fills).toContain(COIN_GOLD)
    expect(ctx.texts.some((t) => t.text === '07')).toBe(true)
  })
})

describe('drawHud — extremos de layout', () => {
  it('coins=0 e coins=99 desenham padded sem quebrar', () => {
    const c1 = makeCtxStub()
    drawHud(makeRenderer(c1), { ...baseData(), coins: 0 })
    expect(c1.texts.some((t) => t.text === '00')).toBe(true)

    const c2 = makeCtxStub()
    drawHud(makeRenderer(c2), { ...baseData(), coins: 99 })
    expect(c2.texts.some((t) => t.text === '99')).toBe(true)
  })

  it('lives=0, hearts=0, meter=0, time=0: nao lanca e tudo dentro do canvas', () => {
    const ctx = makeCtxStub()
    const r = makeRenderer(ctx)
    expect(() =>
      drawHud(r, { time: 0, lives: 0, coins: 0, hwMeter: 0, hearts: 0 }),
    ).not.toThrow()
    expect(ctx.texts.some((t) => t.text === 'x0')).toBe(true)
    // Nenhum desenho fora do canvas (x dentro de [0, 960]).
    for (const c of ctx.rects) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w).toBeLessThanOrEqual(960)
    }
    const meterCalls = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls
    for (const c of meterCalls) {
      expect(c[0]).toBeGreaterThanOrEqual(0)
      expect(c[0] + c[2]).toBeLessThanOrEqual(960)
    }
  })

  it('hwMeter acima do max e abaixo de 0: clamp em [0,4] segmentos', () => {
    const c1 = makeCtxStub()
    const r1 = makeRenderer(c1)
    drawHud(r1, { ...baseData(), hwMeter: 5000 })
    expect(countMeterRects(r1, COLOR_LIME)).toBe(4)

    const c2 = makeCtxStub()
    const r2 = makeRenderer(c2)
    drawHud(r2, { ...baseData(), hwMeter: -100 })
    expect(countMeterRects(r2, COLOR_LIME)).toBe(0)
  })
})
