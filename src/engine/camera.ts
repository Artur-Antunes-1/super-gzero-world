import { VIEW_W, VIEW_H } from './constants'
import type { ParsedLevel } from '../data/schema'

export interface Camera {
  x: number
  y: number
  /** estado interno do lookahead horizontal (px), com easing */
  lookX?: number
}

/** Alvo da camera: Player na pratica; campos extras lidos com defaults. */
export interface CameraTarget {
  x: number
  y: number
  w: number
  h: number
  vx?: number
  facing?: 1 | -1
  onGround?: boolean
}

// Tuning da camera (por frame fixo; jogo chama followCamera todo frame).
export const CAM_DEADZONE_X = 96 // meia-faixa horizontal em volta do centro
export const CAM_LOOKAHEAD_X = 80 // deslocamento maximo na direcao do facing
export const CAM_LOOK_EASE = 0.1 // easing do lookahead (10%/frame)
export const CAM_EASE = 0.15 // suavizacao final da posicao (15%/frame)
export const CAM_SNAP_Y = 120 // no ar, so segue se |delta| passar disso

export function createCamera(): Camera {
  return { x: 0, y: 0, lookX: 0 }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function followCamera(
  cam: Camera,
  target: CameraTarget,
  level: ParsedLevel
): void {
  // Leitura defensiva: objetos minimos {x,y,w,h} continuam funcionando.
  const facing = target.facing ?? 1
  const onGround = target.onGround ?? true

  const centerX = target.x + target.w / 2
  const centerY = target.y + target.h / 2

  // Lookahead: aproxima 10%/frame do deslocamento desejado (ate 80px).
  const prevLook = cam.lookX ?? 0
  const look = prevLook + (CAM_LOOKAHEAD_X * facing - prevLook) * CAM_LOOK_EASE
  cam.lookX = look

  const focusX = centerX + look

  // Deadzone horizontal: so move quando o foco sai da faixa de ±96px
  // em volta do centro da view; desejado encosta o foco na borda.
  const viewCenterX = cam.x + VIEW_W / 2
  let desiredX = cam.x
  if (focusX > viewCenterX + CAM_DEADZONE_X) {
    desiredX = focusX - CAM_DEADZONE_X - VIEW_W / 2
  } else if (focusX < viewCenterX - CAM_DEADZONE_X) {
    desiredX = focusX + CAM_DEADZONE_X - VIEW_W / 2
  }

  // Vertical: segue so no chao OU se o delta estourar 120px (platform
  // snapping — pulos curtos nao balancam a camera).
  const deltaY = centerY - (cam.y + VIEW_H / 2)
  let desiredY = cam.y
  if (onGround || Math.abs(deltaY) > CAM_SNAP_Y) {
    desiredY = centerY - VIEW_H / 2
  }

  // Suavizacao final + clamp aos limites do nivel. Limite superior pode
  // ser negativo se o nivel for menor que a viewport; o 0 prevalece.
  const maxX = level.widthPx - VIEW_W
  const maxY = level.heightPx - VIEW_H
  cam.x = clamp(cam.x + (desiredX - cam.x) * CAM_EASE, 0, Math.max(0, maxX))
  cam.y = clamp(cam.y + (desiredY - cam.y) * CAM_EASE, 0, Math.max(0, maxY))
}
