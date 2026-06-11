// src/game/enemy.ts
import type { Body } from '../engine/physics'
// isFullSolid/tileAt: fonte única no physics.ts (A2 — duplicatas locais removidas).
// FIX C3a: platform (one-way) CONTA como piso na deteccao de borda — tolos
// sobre plataformas vibravam invertendo dir a cada frame.
import { stepBody, isFullSolid, tileAt } from '../engine/physics'
import type { ParsedLevel } from '../data/schema'
import type { Renderer } from '../engine/render'
import type { AssetStore } from '../engine/assets'
import { frameIndex } from '../engine/spriteAnim'
// Contrato D1: animacoes de objetos/inimigos data-driven (sheet 'char.tolo').
import { OBJECT_ANIMS } from '../data/objects'
import type { Player } from './player'
import {
  ENEMY_SPEED,
  TILE,
  COLOR_VIOLET,
  COLOR_BLUE,
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
  // Limites de patrulha em px (col*TILE), aplicados ao x (borda esquerda).
  patrolMin?: number
  patrolMax?: number
}

// D3: definicoes data-driven por tipo de inimigo (padrao de CHARACTERS).
// Hitbox honesta (pos-playtest 2026-06-11): 42x46 = 1,22x do sprite de 56px
// (antes 38x34). h=46 < TILE: o tolo segue cabendo na celula do spawn.
// color = COLOR_VIOLET (token de perigo; magenta fica para objetivo/marca).
export interface EnemyDef {
  w: number
  h: number
  speed: number
  color: string
  behavior: 'patrol'
}

export const ENEMY_DEFS: Record<'tolo', EnemyDef> = {
  tolo: {
    w: 42,
    h: 46,
    speed: ENEMY_SPEED,
    color: COLOR_VIOLET,
    behavior: 'patrol',
  },
}

// Campos canonicos comuns a todo tolo recem-criado (dimensoes do def).
function baseTolo(x: number, y: number): Enemy {
  const def = ENEMY_DEFS.tolo
  return {
    x,
    y,
    w: def.w,
    h: def.h,
    vx: 0,
    vy: 0,
    onGround: false,
    kind: 'tolo',
    dir: -1,
    alive: true,
    frozen: false,
  }
}

// Cria os inimigos a partir de level.foolSpawns (C3a; patrol em cols -> px).
// Compat: se foolSpawns ausente/vazio, cai no campo legacy level.enemies
// (fool|enemy -> kind 'tolo'). Dimensoes vem de ENEMY_DEFS; dir=-1.
export function spawnEnemies(level: ParsedLevel): Enemy[] {
  const spawns = level.foolSpawns
  if (spawns && spawns.length > 0) {
    return spawns.map((s) => {
      const e = baseTolo(s.col * TILE, s.row * TILE)
      if (s.patrol) {
        e.patrolMin = s.patrol[0] * TILE
        e.patrolMax = s.patrol[1] * TILE
      }
      return e
    })
  }
  return (level.enemies ?? []).map((spawn) => baseTolo(spawn.x, spawn.y))
}

// Atualiza um tolo. dt ja chega escalado pelo mundo (dt*ws) — apenas repassa.
// - !alive ou frozen: nao move (return).
// - senao: define vx = def.speed*dir; integra com stepBody.
//   Inverte dir nos limites de patrulha (se definidos), na iminencia de borda
//   (sem chao a frente) ou ao bater em parede (stepBody zerou vx).
export function updateEnemy(e: Enemy, level: ParsedLevel, dt: number): void {
  if (!e.alive || e.frozen) return

  const def = ENEMY_DEFS[e.kind]

  // Limites de patrulha (px): inverte ao alcancar/passar o limite na direcao atual.
  if (e.patrolMin !== undefined && e.dir < 0 && e.x <= e.patrolMin) {
    e.dir = 1
  } else if (e.patrolMax !== undefined && e.dir > 0 && e.x >= e.patrolMax) {
    e.dir = -1
  }

  // Deteccao de borda ANTES de mover: olha a celula diante dos pes na direcao atual.
  // footRow = linha logo abaixo do corpo (onde deveria haver chao).
  const footRow = Math.floor((e.y + e.h + 0.0001) / TILE)
  // Coluna a frente: borda dianteira do corpo na direcao dir, deslocada um tile.
  const frontEdgeX = e.dir > 0 ? e.x + e.w : e.x
  const aheadCol = Math.floor(frontEdgeX / TILE) + e.dir
  const ahead = tileAt(level, aheadCol, footRow)
  // FIX C3a: platform (one-way) conta como piso — tolos sobre plataformas vibravam.
  if (!isFullSolid(ahead) && ahead !== 'platform') {
    // Sem chao a frente: inverte para nao cair do penhasco.
    e.dir = e.dir === 1 ? -1 : 1
  }

  e.vx = def.speed * e.dir
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

// Desenha o tolo. Com store + sheet 'char.tolo' carregado: frame do sheet
// (OBJECT_ANIMS.tolo) via frameIndex(clock global), ancorado nos PES (base da
// hitbox), flip horizontal por e.dir (como drawCharFrame faz com facing).
// frozen: alpha 0.7 + veu azulado (ciano 0.25) + frame congelado (clock=0).
// Sem store/sheet: fallback nos retangulos (cor do def + detalhe COLOR_INK).
export function drawEnemy(
  r: Renderer,
  e: Enemy,
  store?: AssetStore,
  clock?: number,
): void {
  if (!e.alive) return
  const def = ENEMY_DEFS[e.kind]

  if (store) {
    const anim = OBJECT_ANIMS.tolo
    const sheet = store.get(anim.key)
    if (sheet) {
      // frozen: SEM avanco de frame — clock congelado em 0.
      const t = e.frozen ? 0 : clock ?? 0
      const idx = frameIndex(anim, t)
      const sx = idx * anim.cellW
      // Ancora: centro horizontal da hitbox, base (pes).
      const cx = e.x + e.w / 2
      const footY = e.y + e.h
      const ctx = r.ctx
      ctx.save()
      if (e.frozen) ctx.globalAlpha = 0.7
      ctx.translate(cx, footY)
      ctx.scale(e.dir, 1)
      r.drawSprite(
        sheet.src,
        sx,
        0,
        anim.cellW,
        anim.cellH,
        -anim.drawW / 2,
        -anim.drawH,
        anim.drawW,
        anim.drawH,
      )
      ctx.restore()
      if (e.frozen) {
        // Veu azulado do Modo Humanware por cima do sprite.
        ctx.save()
        ctx.globalAlpha = 0.25
        ctx.fillStyle = COLOR_BLUE
        ctx.fillRect(cx - anim.drawW / 2, footY - anim.drawH, anim.drawW, anim.drawH)
        ctx.restore()
      }
      return
    }
  }

  // Fallback (sem store/sheet): corpo na cor do def + detalhe COLOR_INK.
  r.drawRect(e.x, e.y, e.w, e.h, def.color)
  // Detalhe (faixa de "olhos") em COLOR_INK.
  r.drawRect(e.x + 6, e.y + 8, e.w - 12, 8, COLOR_INK)
  if (e.frozen) {
    // Sobreposicao clara para sinalizar congelamento — usa COLOR_TEXT (E6).
    r.drawRect(e.x, e.y, e.w, 4, COLOR_TEXT)
  }
}
