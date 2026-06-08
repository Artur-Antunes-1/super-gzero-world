// src/main.ts — M0 boot: wires all modules into a playable game.
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { parseLevel } from './game/levelParser'
import { world1Zona1 } from './data/levels/world1-zona1'
import { createGame } from './game/game'

// 1. Canvas
const canvas = document.getElementById('game') as HTMLCanvasElement | null
if (!canvas) {
  throw new Error('canvas#game não encontrado')
}

// 2. Renderer (sets canvas.width/height internally)
const renderer = createRenderer(canvas)

// 3. Input — attach to window so keyboard events are captured everywhere
const input = createInput()
input.attach(window)

// 4. Parse the level data
const level = parseLevel(world1Zona1)

// 5. Create the game object (state machine starts in 'playing')
const game = createGame(renderer, input, level)

// 6. Expose game state for E2E probe
;(window as any).__GAME_STATE = () => game.state.get()

// 7. Create and start the fixed-timestep loop
const loop = createLoop(game.update.bind(game), game.render.bind(game))
loop.start()
