// tests/unit/input.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createInput, type Input, type InputAction } from '../../src/engine/input'

// Tipo estendido local para ter acesso a detach nos testes.
type InputWithDetach = Input & { detach(target: Window | HTMLElement): void }

function key(type: 'keydown' | 'keyup', code: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
}

describe('createInput', () => {
  let input: InputWithDetach

  beforeEach(() => {
    input = createInput() as InputWithDetach
    input.attach(window)
  })

  afterEach(() => {
    // Remove os listeners para não acumular entre testes.
    input.detach(window)
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
    const local = createInput() as InputWithDetach
    local.attach(el)
    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }))
    expect(local.isDown('right')).toBe(true)
    local.detach(el)
  })

  it('teclas não mapeadas são ignoradas', () => {
    const actions: InputAction[] = ['left', 'right', 'jump', 'run', 'down']
    key('keydown', 'KeyZ')
    for (const a of actions) {
      expect(input.isDown(a)).toBe(false)
    }
  })

  // --- Regressão: teclas alias compartilhadas ---

  it('manter ArrowRight + KeyD: soltar um nao cancela right', () => {
    key('keydown', 'ArrowRight')
    key('keydown', 'KeyD')
    // Soltar apenas uma das teclas não deve cancelar a ação.
    key('keyup', 'ArrowRight')
    expect(input.isDown('right')).toBe(true)
    // Soltar a segunda tecla deve cancelar.
    key('keyup', 'KeyD')
    expect(input.isDown('right')).toBe(false)
  })

  it('manter ShiftLeft + ShiftRight: soltar um nao cancela run', () => {
    key('keydown', 'ShiftLeft')
    key('keydown', 'ShiftRight')
    // Soltar apenas ShiftLeft não deve cancelar run.
    key('keyup', 'ShiftLeft')
    expect(input.isDown('run')).toBe(true)
    // Soltar ShiftRight cancela.
    key('keyup', 'ShiftRight')
    expect(input.isDown('run')).toBe(false)
  })

  it('segunda tecla alias mantida não re-dispara pressed', () => {
    key('keydown', 'ArrowRight')
    expect(input.pressed('right')).toBe(true)
    input.update()
    // Apertar KeyD enquanto ArrowRight ainda está mantido não deve gerar novo edge.
    key('keydown', 'KeyD')
    expect(input.pressed('right')).toBe(false)
  })

  // --- Regressão: attach duplo ---

  it('attach duas vezes nao duplica listeners', () => {
    // input já está attached em beforeEach; um segundo attach deve ser ignorado.
    input.attach(window)

    key('keydown', 'ArrowRight')
    // pressed deve ser true exatamente uma vez (edge simples), não duplicado.
    expect(input.pressed('right')).toBe(true)
    // isDown também deve ser true apenas uma vez (sem estado duplicado).
    expect(input.isDown('right')).toBe(true)

    input.update()
    // Após update o edge some — se houvesse duplicata ele poderia reaparecer.
    expect(input.pressed('right')).toBe(false)
  })
})
