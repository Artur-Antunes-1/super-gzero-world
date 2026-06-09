// tests/unit/selectScreen.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSelect,
  updateSelect,
  drawSelect,
  type SelectState,
} from '../../src/ui/selectScreen'
import type { Input, InputAction } from '../../src/engine/input'
import type { CharacterDef, AbilityId } from '../../src/data/schema'
import type { Renderer } from '../../src/engine/render'
import type { AssetStore, ImageAsset } from '../../src/engine/assets'
import { CHAR_ANIMS } from '../../src/data/charAnims'
import { drawPlaceholder } from '../../src/game/sprites'
import { COLOR_MAGENTA, COLOR_BLUE, VIEW_W, VIEW_H } from '../../src/engine/constants'

// Espiona drawPlaceholder preservando o comportamento real (drawRect continua contando).
vi.mock('../../src/game/sprites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/game/sprites')>()
  return { ...actual, drawPlaceholder: vi.fn(actual.drawPlaceholder) }
})

// FakeInput canonico (mesmo padrao do player.test.ts): edge = down agora e nao no frame anterior.
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
    /* no-op nos testes */
  }
}

// Dispara um edge (pressionar -> ler -> soltar) sem persistir hold.
function tap(sel: SelectState, input: FakeInput, chars: CharacterDef[], a: InputAction): string | null {
  input.set(a, true)
  const out = updateSelect(sel, input, chars)
  input.update()
  input.set(a, false)
  input.update()
  return out
}

// 3 chars de teste suficientes para exercitar wrap (index 0..2).
function makeChar(id: string, abilityId: AbilityId): CharacterDef {
  return {
    id,
    name: id.toUpperCase(),
    abilityId,
    color: COLOR_MAGENTA,
    accent: COLOR_BLUE,
    hearts: 3,
    jumpVelMul: 1,
    walkMul: 1,
    runMul: 1,
    weightMul: 1,
  }
}

const CHARS: CharacterDef[] = [
  makeChar('renan', 'salto_visionario'),
  makeChar('dante', 'dash_criativo'),
  makeChar('julio', 'escudo_governanca'),
]

// Roster completo (ordem canonica) para os testes de arte real no card.
const CHARS5: CharacterDef[] = [
  makeChar('renan', 'salto_visionario'),
  makeChar('dante', 'dash_criativo'),
  makeChar('julio', 'escudo_governanca'),
  makeChar('artur', 'builder'),
  makeChar('einstein', 'emc2'),
]

// AssetStore fake: get() devolve um ImageAsset para as chaves listadas; null caso contrario.
function makeStore(keys: string[]): AssetStore {
  const asset: ImageAsset = { src: {} as unknown as CanvasImageSource, w: 288, h: 96 }
  return {
    get: (key: string) => (keys.includes(key) ? asset : null),
    ready: true,
  }
}

// Renderer stub: grava chamadas drawRect, drawImage e captura ctx.fillText/font.
function makeFakeRenderer(): {
  renderer: Renderer
  rects: number
  texts: string[]
  images: unknown[][]
} {
  const texts: string[] = []
  const images: unknown[][] = []
  let rects = 0
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    fillText(t: string) {
      texts.push(t)
    },
    drawImage(...args: unknown[]) {
      images.push(args)
    },
    set fillStyle(_v: string) {},
    get fillStyle() {
      return ''
    },
    set font(_v: string) {},
    get font() {
      return ''
    },
    set textAlign(_v: string) {},
    get textAlign() {
      return ''
    },
    set textBaseline(_v: string) {},
    get textBaseline() {
      return ''
    },
  } as unknown as CanvasRenderingContext2D
  const renderer: Renderer = {
    ctx,
    clear() {},
    beginWorld() {},
    endWorld() {},
    drawRect() {
      rects++
    },
    present() {},
  }
  return {
    renderer,
    get rects() {
      return rects
    },
    texts,
    images,
  }
}

describe('createSelect', () => {
  it('inicia com index 0', () => {
    expect(createSelect()).toEqual({ index: 0 })
  })
})

describe('updateSelect — navegacao com wrap', () => {
  it('right avanca o index', () => {
    const sel = createSelect()
    const input = new FakeInput()
    tap(sel, input, CHARS, 'right')
    expect(sel.index).toBe(1)
  })

  it('left a partir de 0 faz wrap para o ultimo', () => {
    const sel = createSelect()
    const input = new FakeInput()
    tap(sel, input, CHARS, 'left')
    expect(sel.index).toBe(CHARS.length - 1) // 2
  })

  it('right a partir do ultimo faz wrap para 0', () => {
    const sel: SelectState = { index: CHARS.length - 1 }
    const input = new FakeInput()
    tap(sel, input, CHARS, 'right')
    expect(sel.index).toBe(0)
  })

  it('sem nenhuma tecla retorna null e nao muda index', () => {
    const sel = createSelect()
    const input = new FakeInput()
    const out = updateSelect(sel, input, CHARS)
    input.update()
    expect(out).toBeNull()
    expect(sel.index).toBe(0)
  })

  it('hold (sem novo edge) nao move o index — usa pressed, nao isDown', () => {
    const sel = createSelect()
    const input = new FakeInput()
    input.set('right', true)
    expect(updateSelect(sel, input, CHARS)).toBeNull()
    input.update()
    expect(sel.index).toBe(1)
    // segundo frame com a tecla AINDA segurada: pressed=false, nao avanca
    expect(updateSelect(sel, input, CHARS)).toBeNull()
    input.update()
    expect(sel.index).toBe(1)
  })
})

describe('updateSelect — confirmacao', () => {
  it('jump retorna o id do char no index atual', () => {
    const sel: SelectState = { index: 1 }
    const input = new FakeInput()
    const out = tap(sel, input, CHARS, 'jump')
    expect(out).toBe('dante')
  })

  it('confirm retorna o id do char no index atual', () => {
    const sel: SelectState = { index: 2 }
    const input = new FakeInput()
    const out = tap(sel, input, CHARS, 'confirm')
    expect(out).toBe('julio')
  })

  it('confirmar no index 0 retorna o primeiro id', () => {
    const sel = createSelect()
    const input = new FakeInput()
    const out = tap(sel, input, CHARS, 'jump')
    expect(out).toBe('renan')
  })
})

describe('drawSelect', () => {
  it('desenha um placeholder por char (drawRect chamado) e os nomes + habilidades', () => {
    const fake = makeFakeRenderer()
    const sel = createSelect()
    drawSelect(fake.renderer, sel, CHARS)
    // drawPlaceholder usa drawRect varias vezes por char -> ao menos 1 por char.
    expect(fake.rects).toBeGreaterThanOrEqual(CHARS.length)
    // Nome de cada char aparece em algum fillText.
    for (const c of CHARS) {
      expect(fake.texts.some((t) => t.includes(c.name))).toBe(true)
    }
    // Habilidade de cada char aparece em algum fillText.
    for (const c of CHARS) {
      expect(fake.texts.some((t) => t.includes(c.abilityId))).toBe(true)
    }
  })

  it('nao lanca com lista de 1 char', () => {
    const fake = makeFakeRenderer()
    const sel = createSelect()
    expect(() => drawSelect(fake.renderer, sel, [CHARS[0]])).not.toThrow()
  })
})

describe('drawSelect — arte real no card (M2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('com store + idle do artur: drawImage no card do artur; outros 4 via placeholder', () => {
    const fake = makeFakeRenderer()
    const store = makeStore([CHAR_ANIMS['artur'].anims.idle!.key])
    drawSelect(fake.renderer, createSelect(), CHARS5, store)
    expect(fake.images.length).toBe(1)
    const ids = vi.mocked(drawPlaceholder).mock.calls.map((c) => c[1].id)
    expect(ids).not.toContain('artur')
    for (const id of ['renan', 'dante', 'julio', 'einstein']) {
      expect(ids).toContain(id)
    }
  })

  it('drawImage usa o frame 0 do sheet, altura boxH, centrado no slot e pes na base', () => {
    const fake = makeFakeRenderer()
    const store = makeStore([CHAR_ANIMS['artur'].anims.idle!.key])
    drawSelect(fake.renderer, createSelect(), CHARS5, store)
    const set = CHAR_ANIMS['artur']
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = fake.images[0] as [
      unknown, number, number, number, number, number, number, number, number,
    ]
    // Source rect: frame 0 do sheet (celula inteira).
    expect(sx).toBe(0)
    expect(sy).toBe(0)
    expect(sw).toBe(set.cellW)
    expect(sh).toBe(set.cellH)
    // Destino: artur no slot index 3 de 5; caixa 92px; pes (anchorY) na base da caixa.
    const boxH = 92
    const marginX = 80
    const slotW = (VIEW_W - marginX * 2) / CHARS5.length
    const cx = marginX + slotW * (3 + 0.5)
    const boxTop = VIEW_H / 2 - boxH / 2
    const scale = boxH / set.cellH
    expect(dh).toBe(boxH)
    expect(dw).toBeCloseTo(set.cellW * scale)
    expect(dx + dw / 2).toBeCloseTo(cx)
    expect(dy + set.anchorY * scale).toBeCloseTo(boxTop + boxH)
  })

  it('sem store: nenhum drawImage; todos os chars via placeholder', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    expect(fake.images.length).toBe(0)
    expect(vi.mocked(drawPlaceholder)).toHaveBeenCalledTimes(CHARS5.length)
  })

  it('store sem o sheet do idle: card do artur tambem cai no placeholder', () => {
    const fake = makeFakeRenderer()
    const store = makeStore([])
    drawSelect(fake.renderer, createSelect(), CHARS5, store)
    expect(fake.images.length).toBe(0)
    const ids = vi.mocked(drawPlaceholder).mock.calls.map((c) => c[1].id)
    expect(ids).toContain('artur')
  })
})
