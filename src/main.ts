// src/main.ts — M0/M2a boot: precarrega assets e liga os modulos no jogo.
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { parseLevelById, DEFAULT_LEVEL_ID } from './data/levels'
import { createGame } from './game/game'
import { loadAssets, type AssetStore } from './engine/assets'
import { ASSET_MANIFEST } from './data/assets'
import { COLOR_BG } from './engine/constants'

// 1. Canvas
const canvasEl = document.getElementById('game') as HTMLCanvasElement | null
if (!canvasEl) {
  throw new Error('canvas#game não encontrado')
}
// const ja estreitado: closures (applyScale) enxergam HTMLCanvasElement.
const canvas: HTMLCanvasElement = canvasEl

// 2. Renderer (sets canvas.width/height internally)
const renderer = createRenderer(canvas)

// 3. Input — attach to window so keyboard events are captured everywhere
const input = createInput()
input.attach(window)

// 4. Selecao de fase via URL: /?level=<id>. Id desconhecido (ou ausente)
//    cai no DEFAULT_LEVEL_ID — parseLevelById re-parseia FRESCO (contrato C3a).
const levelId = new URLSearchParams(location.search).get('level')
const level = parseLevelById(levelId ?? DEFAULT_LEVEL_ID)

// 5. Pinta o fundo enquanto os assets carregam (evita flash branco).
renderer.clear(COLOR_BG)

// 6. Escala INTEIRA do canvas (pixel-perfect): so o tamanho CSS muda em
//    multiplos inteiros; o buffer interno 960x528 NAO muda.
function applyScale(): void {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / 960, window.innerHeight / 528)))
  canvas.style.width = (960 * s) + 'px'
  canvas.style.height = (528 * s) + 'px'
}
window.addEventListener('resize', applyScale)

// 7. Cria o jogo + probes E2E + loop (usado no boot normal e no fallback).
function startGame(store: AssetStore): void {
  // Maquina de estados comeca em 'select' — definido por createGame.
  const game = createGame(renderer, input, level, store)

  // Probes E2E
  ;(window as any).__GAME_STATE = () => game.state.get()
  ;(window as any).__GAME = () => ({
    state: game.state.get(),
    lives: game.player?.lives ?? null,
    hearts: game.player?.hearts ?? null,
    hwMeter: game.humanware.meter,
    hwActive: game.humanware.modeTimer > 0,
    playerX: game.player?.x ?? null,
  })

  // Cria e inicia o loop de timestep fixo.
  const loop = createLoop(game.update.bind(game), game.render.bind(game))
  loop.start()
}

// 8. Precarrega arte (chroma-key no load), depois cria e inicia o jogo.
//    loadAssets NUNCA rejeita: falhas isoladas viram warns e o jogo sobe
//    com store parcial (get() retorna null para o que faltou).
async function boot(): Promise<void> {
  applyScale()
  const store = await loadAssets(ASSET_MANIFEST)
  startGame(store)
}

boot().catch(async (err: unknown) => {
  // Inesperado (loadAssets nao rejeita): loga e sobe mesmo assim com store vazio.
  console.error('[SuperGzeroWorld] erro inesperado no boot, iniciando com store vazio:', err)
  startGame(await loadAssets({}))
})
