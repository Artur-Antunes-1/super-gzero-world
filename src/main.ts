// Boot mínimo do M0 (Task 1). VIEW_W=960, VIEW_H=528, COLOR_BG='#09090b' (CONTRATO).
// Renderer/constants completos chegam nas próximas tasks.
const VIEW_W = 960
const VIEW_H = 528
const COLOR_BG = '#09090b'

const canvas = document.getElementById('game') as HTMLCanvasElement | null
if (!canvas) {
  throw new Error('canvas#game não encontrado')
}

canvas.width = VIEW_W
canvas.height = VIEW_H

const ctx = canvas.getContext('2d')
if (!ctx) {
  throw new Error('contexto 2D indisponível')
}

ctx.imageSmoothingEnabled = false
ctx.fillStyle = COLOR_BG
ctx.fillRect(0, 0, VIEW_W, VIEW_H)
