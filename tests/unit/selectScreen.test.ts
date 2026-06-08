// tests/unit/selectScreen.test.ts
import { describe, it, expect } from 'vitest'
import {
  createSelect,
  updateSelect,
  drawSelect,
  type SelectState,
} from '../../src/ui/selectScreen'
import type { Input, InputAction } from '../../src/engine/input'
import type { CharacterDef, AbilityId } from '../../src/data/schema'
import type { Renderer } from '../../src/engine/render'
import { COLOR_MAGENTA, COLOR_BLUE } from '../../src/engine/constants'

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

// Renderer stub: grava chamadas drawRect e captura ctx.fillText/font.
function makeFakeRenderer(): { renderer: Renderer; rects: number; texts: string[] } {
  const texts: string[] = []
  let rects = 0
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    fillText(t: string) {
      texts.push(t)
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
