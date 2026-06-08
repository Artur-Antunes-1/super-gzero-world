export type GameState =
  | 'loading'
  | 'title'
  | 'select'
  | 'playing'
  | 'paused'
  | 'win'
  | 'over'

export function createStateMachine(initial: GameState): {
  get(): GameState
  set(s: GameState): void
  is(s: GameState): boolean
} {
  let current: GameState = initial

  return {
    get(): GameState {
      return current
    },
    set(s: GameState): void {
      current = s
    },
    is(s: GameState): boolean {
      return current === s
    },
  }
}
