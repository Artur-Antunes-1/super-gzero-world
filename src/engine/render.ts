import { VIEW_W, VIEW_H } from './constants'

export interface Renderer {
  ctx: CanvasRenderingContext2D
  clear(color: string): void
  beginWorld(camX: number, camY: number): void
  endWorld(): void
  drawRect(x: number, y: number, w: number, h: number, color: string): void
  present(): void
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  // Canvas interno fixo 960x528 (espaco logico do jogo).
  canvas.width = VIEW_W
  canvas.height = VIEW_H

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('createRenderer: contexto 2d indisponivel')
  }

  // Pixel art: sem suavizacao entre pixels.
  ctx.imageSmoothingEnabled = false

  return {
    ctx,

    clear(color: string): void {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    },

    beginWorld(camX: number, camY: number): void {
      ctx.save()
      // Arredondamos para o pixel mais proximo para manter bordes crisp em pixel art.
      ctx.translate(-Math.round(camX), -Math.round(camY))
    },

    endWorld(): void {
      ctx.restore()
    },

    drawRect(x: number, y: number, w: number, h: number, color: string): void {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    },

    present(): void {
      // No-op: desenhamos direto no canvas visivel (modo imediato do Canvas 2D).
      // Reservado para futuros backends com double-buffering ou offscreen canvas.
    },
  }
}
