// tests/unit/input.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createInput, type Input, type InputAction } from '../../src/engine/input'

function key(type: 'keydown' | 'keyup', code: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
}

describe('createInput', () => {
  let input: Input

  beforeEach(() => {
    input = createInput()
    input.attach(window)
  })

  afterEach(() => {
    // garante que nenhum estado vaze entre testes: solta tudo e zera edges
    key('keyup', 'ArrowLeft')
    key('keyup', 'ArrowRight')
    key('keyup', 'ArrowUp')
    key('keyup', 'ArrowDown')
    key('keyup', 'Space')
    key('keyup', 'ShiftLeft')
    key('keyup', 'KeyA')
    key('keyup', 'KeyD')
    key('keyup', 'KeyW')
    key('keyup', 'KeyS')
    input.update()
  })

  it('mapeia ArrowRight e KeyD para "right"', () => {
    key('keydown', 'ArrowRight')
    expect(input.isDown('right')).toBe(true)
    key('keyup', 'ArrowRight')
    expect(input.isDown('right')).toBe(false)

    key('keydown', 'KeyD')
    expect(input.isDown('right')).toBe(true)
  })

  it('mapeia ArrowLeft e KeyA para "left"', () => {
    key('keydown', 'ArrowLeft')
    expect(input.isDown('left')).toBe(true)
    key('keyup', 'ArrowLeft')
    expect(input.isDown('left')).toBe(false)

    key('keydown', 'KeyA')
    expect(input.isDown('left')).toBe(true)
  })

  it('mapeia Space, ArrowUp e KeyW para "jump"', () => {
    key('keydown', 'Space')
    expect(input.isDown('jump')).toBe(true)
    key('keyup', 'Space')
    expect(input.isDown('jump')).toBe(false)

    key('keydown', 'ArrowUp')
    expect(input.isDown('jump')).toBe(true)
    key('keyup', 'ArrowUp')
    expect(input.isDown('jump')).toBe(false)

    key('keydown', 'KeyW')
    expect(input.isDown('jump')).toBe(true)
  })

  it('mapeia ShiftLeft/ShiftRight para "run"', () => {
    key('keydown', 'ShiftLeft')
    expect(input.isDown('run')).toBe(true)
    key('keyup', 'ShiftLeft')
    expect(input.isDown('run')).toBe(false)

    key('keydown', 'ShiftRight')
    expect(input.isDown('run')).toBe(true)
  })

  it('mapeia ArrowDown e KeyS para "down"', () => {
    key('keydown', 'ArrowDown')
    expect(input.isDown('down')).toBe(true)
    key('keyup', 'ArrowDown')
    expect(input.isDown('down')).toBe(false)

    key('keydown', 'KeyS')
    expect(input.isDown('down')).toBe(true)
  })

  it('pressed é verdadeiro só no frame do update após a tecla cair', () => {
    // tecla caiu mas update ainda não rodou: pressed deve ser true no PRIMEIRO update
    key('keydown', 'Space')
    // antes do update, o edge ainda está "fresco"
    expect(input.pressed('jump')).toBe(true)
    // sem soltar a tecla, o próximo update consome o edge
    input.update()
    expect(input.pressed('jump')).toBe(false)
    // ainda mantida: isDown continua true
    expect(input.isDown('jump')).toBe(true)
  })

  it('pressed dispara de novo só após keyup + keydown (não enquanto mantida)', () => {
    key('keydown', 'ArrowRight')
    expect(input.pressed('right')).toBe(true)
    input.update()
    expect(input.pressed('right')).toBe(false)

    // segurar e dar update várias vezes: nunca re-dispara
    input.update()
    input.update()
    expect(input.pressed('right')).toBe(false)

    // soltar e apertar de novo: novo edge
    key('keyup', 'ArrowRight')
    input.update()
    key('keydown', 'ArrowRight')
    expect(input.pressed('right')).toBe(true)
  })

  it('keydown repetido (auto-repeat do SO) não re-dispara pressed sem update', () => {
    key('keydown', 'KeyW')
    expect(input.pressed('jump')).toBe(true)
    // auto-repeat: vários keydown seguidos da MESMA tecla mantida
    key('keydown', 'KeyW')
    key('keydown', 'KeyW')
    input.update()
    expect(input.pressed('jump')).toBe(false)
  })

  it('aceita HTMLElement como target em attach', () => {
    const el = document.createElement('div')
    const local = createInput()
    local.attach(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }))
    expect(local.isDown('right')).toBe(true)
  })

  it('teclas não mapeadas são ignoradas', () => {
    const actions: InputAction[] = ['left', 'right', 'jump', 'run', 'down']
    key('keydown', 'KeyZ')
    for (const a of actions) {
      expect(input.isDown(a)).toBe(false)
    }
  })
})
