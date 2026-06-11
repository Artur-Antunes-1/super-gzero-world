// src/main.ts — M0/M2a boot: precarrega assets e liga os modulos no jogo.
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { parseLevelById, DEFAULT_LEVEL_ID } from './data/levels'
import { createGame } from './game/game'
import { loadAssets, type AssetStore } from './engine/assets'
import { ASSET_MANIFEST } from './data/assets'
import { COLOR_BG } from './engine/constants'
import { createAudio } from './engine/audio'

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

// 3b. Audio procedural (D2): cria o bus e desbloqueia o contexto a cada
//     keydown (autoplay policy; resume() em contexto rodando e no-op —
//     listener persistente cobre suspensoes do iOS/Safari pos-unlock).
const audio = createAudio()
window.addEventListener('keydown', () => audio.unlock())

// 4. Selecao de fase via URL: /?level=<id>. Id desconhecido (ou ausente)
//    cai no DEFAULT_LEVEL_ID — parseLevelById re-parseia FRESCO (contrato C3a).
const levelId = new URLSearchParams(location.search).get('level')
const level = parseLevelById(levelId ?? DEFAULT_LEVEL_ID)

// 5. Pinta o fundo enquanto os assets carregam (evita flash branco).
renderer.clear(COLOR_BG)

// 6. Escala FRACIONARIA do canvas: passos de 0.5 a partir de 1x para encher
//    a janela (image-rendering: pixelated segura o meio-passo sem borrar).
//    Janelas menores que 1x usam a escala crua para caber. Margem de 16px
//    por lado (innerW-32 / innerH-32) pra respirar. Buffer 960x528 NAO muda.
function applyScale(): void {
  const raw = Math.min((window.innerWidth - 32) / 960, (window.innerHeight - 32) / 528)
  // >=1: trava em meios-passos (1, 1.5, 2, ...); <1: cru, com piso anti-degenerado.
  const s = raw >= 1 ? Math.floor(raw * 2) / 2 : Math.max(0.25, raw)
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

  // Cria e inicia o loop de timestep fixo. O step envolve game.update para
  // drenar os SFX enfileirados no frame (contrato D4: game.events) e tocar
  // cada um no bus de audio.
  const loop = createLoop((dt) => {
    game.update(dt)
    for (const e of game.events.splice(0)) audio.play(e)
  }, game.render.bind(game))
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
