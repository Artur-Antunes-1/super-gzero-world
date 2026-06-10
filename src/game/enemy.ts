// src/game/enemy.ts
import type { Body } from '../engine/physics'
// isFullSolid/tileAt: fonte única no physics.ts (A2 — duplicatas locais removidas).
// Nota: platform e one-way e NAO conta como piso para deteccao de borda do tolo.
import { stepBody, isFullSolid, tileAt } from '../engine/physics'
import type { ParsedLevel } from '../data/schema'
import type { Renderer } from '../engine/render'
import type { Player } from './player'
import {
  ENEMY_SPEED,
  TILE,
  COLOR_MAGENTA2,
  COLOR_INK,
  COLOR_TEXT,
} from '../engine/constants'

// Inimigo "Tolo": patrulha horizontal sobre o chao, inverte em parede/borda,
// pode ser pisado (stomp) ou congelado pelo Modo Humanware.
export interface Enemy extends Body {
  kind: 'tolo'
  dir: 1 | -1
  alive: boolean
  frozen: boolean
}

// Cria os inimigos a partir de level.enemies. fool|enemy -> Enemy kind 'tolo'.
// Dimensoes/flags canonicas: w=38, h=34, dir=-1, alive=true, frozen=false.
export function spawnEnemies(level: ParsedLevel): Enemy[] {
  return level.enemies.map((spawn) => ({
    x: spawn.x,
    y: spawn.y,
    w: 38,
    h: 34,
    vx: 0,
    vy: 0,
    onGround: false,
    kind: 'tolo' as const,
    dir: -1 as const,
    alive: true,
    frozen: false,
  }))
}

// Atualiza um tolo. dt ja chega escalado pelo mundo (dt*ws) — apenas repassa.
// - !alive ou frozen: nao move (return).
// - senao: define vx = ENEMY_SPEED*dir; integra com stepBody.
//   Inverte dir quando bate em parede (stepBody zerou vx) OU quando a proxima
//   celula a frente, na linha dos pes, nao tem chao solido abaixo (iminencia de borda).
export function updateEnemy(e: Enemy, level: ParsedLevel, dt: number): void {
  if (!e.alive || e.frozen) return

  // Deteccao de borda ANTES de mover: olha a celula diante dos pes na direcao atual.
  // footRow = linha logo abaixo do corpo (onde deveria haver chao).
  const footRow = Math.floor((e.y + e.h + 0.0001) / TILE)
  // Coluna a frente: borda dianteira do corpo na direcao dir, deslocada um tile.
  const frontEdgeX = e.dir > 0 ? e.x + e.w : e.x
  const aheadCol = Math.floor(frontEdgeX / TILE) + e.dir
  if (!isFullSolid(tileAt(level, aheadCol, footRow))) {
    // Sem chao a frente: inverte para nao cair do penhasco.
    e.dir = e.dir === 1 ? -1 : 1
  }

  e.vx = ENEMY_SPEED * e.dir
  stepBody(e, level, dt)

  // Bateu em parede solida: stepBody zerou vx. Inverte direcao.
  if (e.vx === 0) {
    e.dir = e.dir === 1 ? -1 : 1
  }
}

// Stomp: player descendo (vy>0) com os pes acima da metade superior do tolo,
// e com sobreposicao AABB. Usa apenas campos do Body base do Player.
export function isStomp(player: Player, e: Enemy): boolean {
  if (player.vy <= 0) return false
  const playerFoot = player.y + player.h
  if (playerFoot > e.y + e.h * 0.5) return false
  const overlapX = player.x < e.x + e.w && player.x + player.w > e.x
  const overlapY = player.y < e.y + e.h && player.y + player.h > e.y
  return overlapX && overlapY
}

// Placeholder em codigo: corpo COLOR_MAGENTA2 + detalhe COLOR_INK.
// Congelado (Modo Humanware): tom mais claro sobreposto via COLOR_TEXT (E6 — importado).
export function drawEnemy(r: Renderer, e: Enemy): void {
  if (!e.alive) return
  r.drawRect(e.x, e.y, e.w, e.h, COLOR_MAGENTA2)
  // Detalhe (faixa de "olhos") em COLOR_INK.
  r.drawRect(e.x + 6, e.y + 8, e.w - 12, 8, COLOR_INK)
  if (e.frozen) {
    // Sobreposicao clara para sinalizar congelamento — usa COLOR_TEXT (E6).
    r.drawRect(e.x, e.y, e.w, 4, COLOR_TEXT)
  }
}
