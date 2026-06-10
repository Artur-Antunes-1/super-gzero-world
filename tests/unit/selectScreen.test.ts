// tests/unit/selectScreen.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSelect,
  updateSelect,
  drawSelect,
  SELECT_START_INDEX,
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

// Char de teste com habilidade nomeada (Fase E2): abilityName/abilityDesc derivados do id.
function makeChar(id: string, abilityId: AbilityId, hearts = 3): CharacterDef {
  return {
    id,
    name: id.toUpperCase(),
    abilityId,
    abilityName: `HAB-${id}`,
    abilityDesc: `desc ${id}`,
    color: COLOR_MAGENTA,
    accent: COLOR_BLUE,
    hearts,
    jumpVelMul: 1,
    walkMul: 1,
    runMul: 1,
    weightMul: 1,
  }
}

// Roster completo (ordem canonica): artur no index 3 = SELECT_START_INDEX.
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

// Renderer stub: grava drawRect (contagem + cores), ctx.fillRect (args),
// fillText, drawImage e os valores atribuidos a globalAlpha.
function makeFakeRenderer(): {
  renderer: Renderer
  rects: number
  rectColors: string[]
  fills: number[][]
  texts: string[]
  images: unknown[][]
  alphas: number[]
} {
  const texts: string[] = []
  const images: unknown[][] = []
  const fills: number[][] = []
  const rectColors: string[] = []
  const alphas: number[] = []
  let rects = 0
  const ctx = {
    save() {},
    restore() {},
    fillRect(...args: number[]) {
      fills.push(args)
    },
    fillText(t: string) {
      texts.push(t)
    },
    drawImage(...args: unknown[]) {
      images.push(args)
    },
    set globalAlpha(v: number) {
      alphas.push(v)
    },
    get globalAlpha() {
      return 1
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
    drawRect(_x: number, _y: number, _w: number, _h: number, color: string) {
      rects++
      rectColors.push(color)
    },
    drawSprite() {},
    present() {},
  }
  return {
    renderer,
    get rects() {
      return rects
    },
    rectColors,
    fills,
    texts,
    images,
    alphas,
  }
}

describe('createSelect', () => {
  it('SELECT_START_INDEX e 3 (cursor inicia no Artur)', () => {
    expect(SELECT_START_INDEX).toBe(3)
  })

  it('inicia com index SELECT_START_INDEX', () => {
    expect(createSelect()).toEqual({ index: SELECT_START_INDEX })
  })
})

describe('updateSelect — navegacao com wrap', () => {
  it('right avanca o index a partir do inicial (3 -> 4)', () => {
    const sel = createSelect()
    const input = new FakeInput()
    tap(sel, input, CHARS5, 'right')
    expect(sel.index).toBe(SELECT_START_INDEX + 1)
  })

  it('left a partir de 0 faz wrap para o ultimo', () => {
    const sel: SelectState = { index: 0 }
    const input = new FakeInput()
    tap(sel, input, CHARS5, 'left')
    expect(sel.index).toBe(CHARS5.length - 1) // 4
  })

  it('right a partir do ultimo faz wrap para 0', () => {
    const sel: SelectState = { index: CHARS5.length - 1 }
    const input = new FakeInput()
    tap(sel, input, CHARS5, 'right')
    expect(sel.index).toBe(0)
  })

  it('sem nenhuma tecla retorna null e nao muda o index inicial', () => {
    const sel = createSelect()
    const input = new FakeInput()
    const out = updateSelect(sel, input, CHARS5)
    input.update()
    expect(out).toBeNull()
    expect(sel.index).toBe(SELECT_START_INDEX)
  })

  it('hold (sem novo edge) nao move o index — usa pressed, nao isDown', () => {
    const sel: SelectState = { index: 0 }
    const input = new FakeInput()
    input.set('right', true)
    expect(updateSelect(sel, input, CHARS5)).toBeNull()
    input.update()
    expect(sel.index).toBe(1)
    // segundo frame com a tecla AINDA segurada: pressed=false, nao avanca
    expect(updateSelect(sel, input, CHARS5)).toBeNull()
    input.update()
    expect(sel.index).toBe(1)
  })
})

describe('updateSelect — confirmacao', () => {
  it('jump retorna o id do char no index atual', () => {
    const sel: SelectState = { index: 1 }
    const input = new FakeInput()
    const out = tap(sel, input, CHARS5, 'jump')
    expect(out).toBe('dante')
  })

  it('confirm retorna o id do char no index atual', () => {
    const sel: SelectState = { index: 2 }
    const input = new FakeInput()
    const out = tap(sel, input, CHARS5, 'confirm')
    expect(out).toBe('julio')
  })

  it('confirmar direto apos createSelect retorna artur (index inicial 3)', () => {
    const sel = createSelect()
    const input = new FakeInput()
    const out = tap(sel, input, CHARS5, 'jump')
    expect(out).toBe('artur')
  })
})

describe('drawSelect — cards e textos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('desenha placeholders (drawRect) + nome e abilityName de cada char; abilityDesc SO no selecionado', () => {
    const fake = makeFakeRenderer()
    const sel = createSelect()
    drawSelect(fake.renderer, sel, CHARS5)
    expect(fake.rects).toBeGreaterThanOrEqual(CHARS5.length)
    for (const c of CHARS5) {
      expect(fake.texts.some((t) => t.includes(c.name))).toBe(true)
      expect(fake.texts.some((t) => t.includes(c.abilityName))).toBe(true)
    }
    // Descricao: aparece APENAS no card selecionado (nas demais colunas o
    // texto excederia a largura do slot e atropelaria os vizinhos).
    for (let i = 0; i < CHARS5.length; i++) {
      const visivel = fake.texts.some((t) => t.includes(CHARS5[i].abilityDesc))
      expect(visivel).toBe(i === sel.index)
    }
    // abilityId snake_case NAO aparece mais na tela.
    for (const c of CHARS5) {
      expect(fake.texts.some((t) => t.includes(c.abilityId))).toBe(false)
    }
  })

  it('paineis usam fundo #1c1c22 com borda #2e2e36 (contraste legivel)', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    expect(fake.rectColors).toContain('#1c1c22')
    expect(fake.rectColors).toContain('#2e2e36')
  })

  it('cards sem CHAR_ANIMS ganham tag EM BREVE (4 de 5) com silhueta alpha 0.45', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    const tags = fake.texts.filter((t) => t === 'EM BREVE')
    expect(tags.length).toBe(4) // todos menos o artur (unico com arte)
    expect(fake.alphas).toContain(0.45) // silhueta padronizada
    expect(fake.alphas).toContain(0.7) // alpha do texto da tag
  })

  it('nao lanca com lista de 1 char (index inicial fora do range)', () => {
    const fake = makeFakeRenderer()
    const sel = createSelect()
    expect(() => drawSelect(fake.renderer, sel, [CHARS5[0]])).not.toThrow()
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

  it('drawImage usa o frame 0 sem clock, altura boxH, centrado no slot e pes na base', () => {
    const fake = makeFakeRenderer()
    const store = makeStore([CHAR_ANIMS['artur'].anims.idle!.key])
    drawSelect(fake.renderer, createSelect(), CHARS5, store)
    const set = CHAR_ANIMS['artur']
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = fake.images[0] as [
      unknown, number, number, number, number, number, number, number, number,
    ]
    // Source rect: frame 0 do sheet (celula inteira) — clock ausente => 0.
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

  it('clock anima o idle do card SELECIONADO (frame muda com clock alto vs 0)', () => {
    const store = makeStore([CHAR_ANIMS['artur'].anims.idle!.key])
    const set = CHAR_ANIMS['artur']

    const fake0 = makeFakeRenderer()
    drawSelect(fake0.renderer, createSelect(), CHARS5, store, 0)
    const sx0 = (fake0.images[0] as number[])[1]
    expect(sx0).toBe(0)

    // idle do artur: 3 frames @ 6fps -> t=10 frames-de-jogo cai no frame 1.
    const fake1 = makeFakeRenderer()
    drawSelect(fake1.renderer, createSelect(), CHARS5, store, 10)
    const sx1 = (fake1.images[0] as number[])[1]
    expect(sx1).toBe(set.cellW)
    expect(sx1).not.toBe(sx0)
  })

  it('card com arte NAO selecionado fica no frame 0 mesmo com clock alto', () => {
    const store = makeStore([CHAR_ANIMS['artur'].anims.idle!.key])
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, { index: 0 }, CHARS5, store, 10)
    const sx = (fake.images[0] as number[])[1]
    expect(sx).toBe(0)
  })

  it('sem store: nenhum drawImage; todos os chars via placeholder', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    expect(fake.images.length).toBe(0)
    expect(vi.mocked(drawPlaceholder)).toHaveBeenCalledTimes(CHARS5.length)
  })

  it('store sem o sheet do idle: card do artur tambem cai no placeholder (sem EM BREVE)', () => {
    const fake = makeFakeRenderer()
    const store = makeStore([])
    drawSelect(fake.renderer, createSelect(), CHARS5, store)
    expect(fake.images.length).toBe(0)
    const ids = vi.mocked(drawPlaceholder).mock.calls.map((c) => c[1].id)
    expect(ids).toContain('artur')
    // artur tem CHAR_ANIMS: nao e EM BREVE, e fallback de asset.
    expect(fake.texts.filter((t) => t === 'EM BREVE').length).toBe(4)
  })
})

describe('drawSelect — painel de detalhe do selecionado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('desenha rotulos VEL e PULO (10px) e as barras de 120px com fundo #26262e', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    expect(fake.texts).toContain('VEL')
    expect(fake.texts).toContain('PULO')
    // Trilho da barra: 2 fundos de 120px de largura.
    const trilhos = fake.fills.filter((f) => f[2] === 120)
    expect(trilhos.length).toBeGreaterThanOrEqual(2)
  })

  it('stats neutros (mul=1.0) normalizam 0.9-1.1 -> 50% = preenchimento 60px', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5) // makeChar: walk/run/jump = 1.0
    const fills60 = fake.fills.filter((f) => f[2] === 60)
    expect(fills60.length).toBeGreaterThanOrEqual(2) // VEL e PULO a 50%
  })

  it('coracoes do char selecionado via fillRect: mais hearts => mais retangulos', () => {
    const chars3 = [...CHARS5]
    chars3[3] = makeChar('artur', 'builder', 3)
    const chars5h = [...CHARS5]
    chars5h[3] = makeChar('artur', 'builder', 5)

    const fakeA = makeFakeRenderer()
    drawSelect(fakeA.renderer, createSelect(), chars3)
    const fakeB = makeFakeRenderer()
    drawSelect(fakeB.renderer, createSelect(), chars5h)

    expect(fakeB.fills.length).toBeGreaterThan(fakeA.fills.length)
  })

  it('painel de detalhe fica na faixa inferior (~y 420-500)', () => {
    const fake = makeFakeRenderer()
    drawSelect(fake.renderer, createSelect(), CHARS5)
    // Todos os fillRect do detalhe (coracoes + barras) estao em y >= 420 e y+h <= 500.
    expect(fake.fills.length).toBeGreaterThan(0)
    for (const f of fake.fills) {
      expect(f[1]).toBeGreaterThanOrEqual(420)
      expect(f[1] + f[3]).toBeLessThanOrEqual(500)
    }
  })

  it('sem char valido no index (lista curta) nao desenha detalhe nem lanca', () => {
    const fake = makeFakeRenderer()
    expect(() => drawSelect(fake.renderer, createSelect(), [CHARS5[0]])).not.toThrow()
    expect(fake.fills.length).toBe(0)
    expect(fake.texts).not.toContain('VEL')
  })
})
