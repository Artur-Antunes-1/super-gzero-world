import { GRAVITY, MAX_FALL, TILE } from './constants'
import type { ParsedLevel, TileType } from '../data/schema'

export interface Body {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  onGround: boolean
}

// Tiles sólidos por todos os lados.
// Deliberadamente exclui 'spike' e 'goal': esses tipos disparam eventos de jogo
// (dano / vitória), não paredes físicas, e são tratados pelo loop de lógica, não aqui.
// Exportado: fonte única (enemy.ts importa daqui — A2).
export function isFullSolid(t: TileType): boolean {
  return t === 'ground' || t === 'brick' || t === 'block'
}

// Lê o tile em coordenadas de grade; fora dos limites => 'empty'.
// Exportado: fonte única (enemy.ts importa daqui — A2).
export function tileAt(level: ParsedLevel, tx: number, ty: number): TileType {
  if (tx < 0 || ty < 0 || tx >= level.widthTiles || ty >= level.heightTiles) {
    return 'empty'
  }
  return level.tiles[ty][tx]
}

// C3b: célula sólida que zerou vy<0 (batida de cabeça) no passo de física.
export interface CeilHit {
  col: number
  row: number
}

// Aplica gravidade (até MAX_FALL) e integra posição pela velocidade.
// dt está em frames (E1: convenção por-frame). Em runtime dt=1; testes usam dt=1.
// gravityScale escala só a aceleração (weightMul do personagem); MAX_FALL não escala.
// Retorna { ceil }: célula sólida que zerou vy<0 nesta chamada, ou null.
export function stepBody(
  body: Body,
  level: ParsedLevel,
  dt: number,
  gravityScale = 1,
): { ceil: CeilHit | null } {
  body.vy = Math.min(body.vy + GRAVITY * gravityScale * dt, MAX_FALL)
  body.x += body.vx * dt
  resolveAxisX(body, level)
  body.onGround = false
  body.y += body.vy * dt
  const ceil = resolveAxisY(body, level)
  return { ceil }
}

// Resolve colisão contra tiles sólidos: primeiro eixo X, depois eixo Y.
// Para cada eixo, varre apenas as células sobrepostas pela AABB do corpo.
// Nota: assume que `vy` reflete o deslocamento que produziu a sobreposição atual —
// usado pelo teste de platform one-way (`prevBottom`) para distinguir descida de subida.
export function collideTiles(body: Body, level: ParsedLevel): void {
  body.onGround = false
  resolveAxisX(body, level)
  resolveAxisY(body, level)
}

function resolveAxisX(body: Body, level: ParsedLevel): void {
  const top = body.y
  const bottom = body.y + body.h
  const tyStart = Math.floor(top / TILE)
  const tyEnd = Math.floor((bottom - 0.0001) / TILE)

  if (body.vx > 0) {
    const right = body.x + body.w
    const tx = Math.floor((right - 0.0001) / TILE)
    for (let ty = tyStart; ty <= tyEnd; ty++) {
      if (isFullSolid(tileAt(level, tx, ty))) {
        body.x = tx * TILE - body.w
        body.vx = 0
        break
      }
    }
  } else if (body.vx < 0) {
    const left = body.x
    const tx = Math.floor(left / TILE)
    for (let ty = tyStart; ty <= tyEnd; ty++) {
      if (isFullSolid(tileAt(level, tx, ty))) {
        body.x = (tx + 1) * TILE
        body.vx = 0
        break
      }
    }
  }
}

// Retorna a célula que zerou vy<0 (teto), ou null nos demais casos.
function resolveAxisY(body: Body, level: ParsedLevel): CeilHit | null {
  const left = body.x
  const right = body.x + body.w
  const txStart = Math.floor(left / TILE)
  const txEnd = Math.floor((right - 0.0001) / TILE)

  if (body.vy > 0) {
    // Descendo: bloqueia em sólidos e em platform vinda de cima.
    const bottom = body.y + body.h
    const prevBottom = bottom - body.vy
    const ty = Math.floor((bottom - 0.0001) / TILE)
    const tileTop = ty * TILE
    for (let tx = txStart; tx <= txEnd; tx++) {
      const t = tileAt(level, tx, ty)
      const platformBlocks = t === 'platform' && prevBottom <= tileTop
      if (isFullSolid(t) || platformBlocks) {
        body.y = tileTop - body.h
        body.vy = 0
        body.onGround = true
        break
      }
    }
  } else if (body.vy < 0) {
    // Subindo: só sólidos por todos os lados (platform é one-way).
    const topEdge = body.y
    const ty = Math.floor(topEdge / TILE)
    for (let tx = txStart; tx <= txEnd; tx++) {
      if (isFullSolid(tileAt(level, tx, ty))) {
        body.y = (ty + 1) * TILE
        body.vy = 0
        return { col: tx, row: ty }
      }
    }
  }
  return null
}
