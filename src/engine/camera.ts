import { VIEW_W, VIEW_H } from './constants'
import type { ParsedLevel } from '../data/schema'

export interface Camera {
  x: number
  y: number
}

export function createCamera(): Camera {
  return { x: 0, y: 0 }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function followCamera(
  cam: Camera,
  target: { x: number; y: number; w: number; h: number },
  level: ParsedLevel
): void {
  const centerX = target.x + target.w / 2
  const centerY = target.y + target.h / 2

  const desiredX = centerX - VIEW_W / 2
  const desiredY = centerY - VIEW_H / 2

  // Limite superior (fim do nivel). Pode ser negativo se o nivel for menor
  // que a viewport; nesse caso o lower bound 0 prevalece no clamp.
  const maxX = level.widthPx - VIEW_W
  const maxY = level.heightPx - VIEW_H

  cam.x = clamp(desiredX, 0, Math.max(0, maxX))
  cam.y = clamp(desiredY, 0, Math.max(0, maxY))
}
