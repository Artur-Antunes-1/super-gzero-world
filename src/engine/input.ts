// src/engine/input.ts
export type InputAction = 'left' | 'right' | 'jump' | 'run' | 'down'

export interface Input {
  isDown(a: InputAction): boolean
  pressed(a: InputAction): boolean
  update(): void
  attach(target: Window | HTMLElement): void
}

// Mapeia KeyboardEvent.code (físico, independente de layout) -> ação.
const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  ArrowDown: 'down',
  KeyS: 'down',
}

export function createInput(): Input {
  const down = new Set<InputAction>()
  const pressedEdges = new Set<InputAction>()

  function onKeyDown(e: KeyboardEvent): void {
    const action = KEY_MAP[e.code]
    if (action === undefined) return
    // Só registra edge "pressed" se a ação ainda não estava mantida.
    // Isso filtra auto-repeat do SO e keydowns redundantes.
    if (!down.has(action)) {
      down.add(action)
      pressedEdges.add(action)
    }
    // Evita scroll da página com Space/setas durante o jogo.
    if (typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    const action = KEY_MAP[e.code]
    if (action === undefined) return
    down.delete(action)
  }

  return {
    isDown(a: InputAction): boolean {
      return down.has(a)
    },
    pressed(a: InputAction): boolean {
      return pressedEdges.has(a)
    },
    update(): void {
      // Consome os edges deste frame; pressed só vale até o próximo update.
      pressedEdges.clear()
    },
    attach(target: Window | HTMLElement): void {
      target.addEventListener('keydown', onKeyDown as EventListener)
      target.addEventListener('keyup', onKeyUp as EventListener)
    },
  }
}
