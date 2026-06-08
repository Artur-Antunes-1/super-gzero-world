// src/engine/input.ts
export type InputAction =
  | 'left'
  | 'right'
  | 'jump'
  | 'run'
  | 'down'
  | 'ability'
  | 'humanware'
  | 'pause'
  | 'confirm'

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
  KeyJ: 'ability',
  KeyH: 'humanware',
  Escape: 'pause',
  Enter: 'confirm',
}

// Teclas que causam scroll da página — só para estas chamamos preventDefault.
// INALTERADO no M1: as novas teclas (KeyJ/KeyH/Escape/Enter) não fazem scroll.
const SCROLLING_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

interface InputWithDetach extends Input {
  detach(target: Window | HTMLElement): void
}

export function createInput(): InputWithDetach {
  // Estado mantido por tecla FÍSICA (KeyboardEvent.code), não por ação.
  const heldKeys = new Set<string>()
  const pressedEdges = new Set<InputAction>()

  // Retorna true se alguma tecla atualmente mantida mapeia para a ação `a`.
  function isDown(a: InputAction): boolean {
    for (const code of heldKeys) {
      if (KEY_MAP[code] === a) return true
    }
    return false
  }

  function onKeyDown(e: KeyboardEvent): void {
    const action = KEY_MAP[e.code]
    if (action === undefined) return

    // Registra edge só se a ação NÃO estava ativa antes desta tecla.
    // Isso cobre: auto-repeat do SO, segunda tecla alias enquanto a outra está mantida.
    const wasDown = isDown(action)
    heldKeys.add(e.code)
    if (!wasDown) {
      pressedEdges.add(action)
    }

    // Evita scroll da página apenas para as teclas que disparam scroll.
    if (SCROLLING_KEYS.has(e.code)) {
      e.preventDefault()
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    // Remove apenas a tecla física — não toca nas ações.
    // isDown recalcula automaticamente a partir das teclas restantes.
    heldKeys.delete(e.code)
  }

  // Guard de duplo attach: armazena pares (target, handlers) já registrados.
  const attached = new Map<
    Window | HTMLElement,
    { down: EventListener; up: EventListener }
  >()

  return {
    isDown,
    pressed(a: InputAction): boolean {
      return pressedEdges.has(a)
    },
    update(): void {
      // Consome os edges deste frame; pressed só vale até o próximo update.
      pressedEdges.clear()
    },
    attach(target: Window | HTMLElement): void {
      // Não adiciona listeners duplicados ao mesmo target.
      if (attached.has(target)) return

      const boundDown = onKeyDown as EventListener
      const boundUp = onKeyUp as EventListener
      target.addEventListener('keydown', boundDown)
      target.addEventListener('keyup', boundUp)
      attached.set(target, { down: boundDown, up: boundUp })
    },
    detach(target: Window | HTMLElement): void {
      const handlers = attached.get(target)
      if (!handlers) return
      target.removeEventListener('keydown', handlers.down)
      target.removeEventListener('keyup', handlers.up)
      attached.delete(target)
    },
  }
}
