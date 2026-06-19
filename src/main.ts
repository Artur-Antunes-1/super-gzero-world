// src/main.ts — M0/M2a boot: precarrega assets e liga os modulos no jogo.
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { parseLevelById, DEFAULT_LEVEL_ID } from './data/levels'
import { createGame } from './game/game'
import { loadAssets, type AssetStore } from './engine/assets'
import { ASSET_MANIFEST } from './data/assets'
import { COLOR_BG, VIEW_W, VIEW_H } from './engine/constants'
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

// 6. Escala do canvas: PREENCHE a janela mantendo o aspecto 960:528 (letterbox
//    so no eixo que sobra). Sem snap de 0.5 (antes travava em 1.0 numa janela
//    1440x900 e o jogo virava uma caixinha perdida). image-rendering: pixelated
//    segura a escala fracionaria sem borrar. Buffer interno 960x528 NAO muda.
function applyScale(): void {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)
  canvas.style.width = Math.round(VIEW_W * s) + 'px'
  canvas.style.height = Math.round(VIEW_H * s) + 'px'
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
// Garante que as fontes de jogo estejam prontas ANTES do 1o frame (senao o
// canvas desenha texto no fallback monospace). Opcional: se falhar, o jogo
// sobe mesmo assim com o fallback.
async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('16px "Press Start 2P"'),
      document.fonts.load('400 16px "Pixelify Sans"'),
      document.fonts.load('700 16px "Pixelify Sans"'),
    ])
    await document.fonts.ready
  } catch {
    /* fontes sao opcionais; cai no fallback monospace */
  }
}

async function boot(): Promise<void> {
  applyScale()
  const [store] = await Promise.all([loadAssets(ASSET_MANIFEST), loadFonts()])
  startGame(store)
}

boot().catch(async (err: unknown) => {
  // Inesperado (loadAssets nao rejeita): loga e sobe mesmo assim com store vazio.
  console.error('[SuperGzeroWorld] erro inesperado no boot, iniciando com store vazio:', err)
  startGame(await loadAssets({}))
})
