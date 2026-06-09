// src/main.ts — M0/M2a boot: precarrega assets e liga os modulos no jogo.
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { parseLevel } from './game/levelParser'
import { world1Zona1 } from './data/levels/world1-zona1'
import { createGame } from './game/game'
import { loadAssets } from './engine/assets'
import { ASSET_MANIFEST } from './data/assets'
import { COLOR_BG } from './engine/constants'

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

// 5. Pinta o fundo enquanto os assets carregam (evita flash branco).
renderer.clear(COLOR_BG)

// 6. Precarrega arte (chroma-key no load), depois cria e inicia o jogo.
//    O preload e async; ate la, o canvas mostra COLOR_BG.
async function boot(): Promise<void> {
  const store = await loadAssets(ASSET_MANIFEST)

  // Cria o jogo (maquina de estados comeca em 'select' — definido por createGame).
  const game = createGame(renderer, input, level, store)

  // Expose game state for E2E probe
  ;(window as any).__GAME_STATE = () => game.state.get()

  // Cria e inicia o loop de timestep fixo.
  const loop = createLoop(game.update.bind(game), game.render.bind(game))
  loop.start()
}

boot().catch((err: unknown) => {
  console.error('[SuperGzeroWorld] falha ao carregar assets, iniciando sem arte (fallback placeholder):', err)
  const game = createGame(renderer, input, level) // sem store -> drawPlaceholder
  ;(window as any).__GAME_STATE = () => game.state.get()
  createLoop(game.update.bind(game), game.render.bind(game)).start()
})
