// src/game/game.ts — M1: integracao select/playing/win/over + worldScale + colisoes (DONO).
import type { Renderer } from '../engine/render'
import type { Input } from '../engine/input'
import type { ParsedLevel, TileType } from '../data/schema'
import { createStateMachine } from '../engine/state'
import { createCamera, followCamera } from '../engine/camera'
import {
  createPlayer,
  updatePlayer,
  damagePlayer,
  respawnPlayer,
  tickPlayerTimers,
  type Player,
} from './player'
import { checkGoal } from './goal'
import { drawPlaceholder } from './sprites'
import { drawHud } from '../ui/hud'
import { CHARACTERS } from '../data/characters'
import type { CharacterDef } from '../data/schema'
// E1: import from ../ui/selectScreen (NOT ./selectScreen)
import {
  createSelect,
  updateSelect,
  drawSelect,
  type SelectState,
} from '../ui/selectScreen'
import {
  updateAbility,
  abilityWorldScale,
  abilityKillsEnemy,
  abilityBuilderTile,
  drawAbilityFx,
} from './ability'
import {
  spawnEnemies,
  updateEnemy,
  isStomp,
  drawEnemy,
  type Enemy,
} from './enemy'
import {
  createHumanware,
  addMeter,
  tryActivate,
  updateHumanware,
  isActive,
  humanwareWorldScale,
  type HumanwareState,
} from './humanware'
import {
  TILE,
  FIXED_DT,
  TIME_START,
  COIN_SIZE,
  STOMP_BOUNCE,
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_INK,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_TEXT,
  VIEW_W,
  VIEW_H,
} from '../engine/constants'

// --- M2a: motor de animacao (consumido, nao recriado) ---
import type { AssetStore } from '../engine/assets'
import { createAnimator, updateAnimator } from '../engine/animator'
import {
  createParticles,
  emitAmbient,
  emitBurst,
  updateParticles,
  drawParticles,
} from '../engine/particles'
import { drawParallax } from '../engine/parallax'
import { drawAnimatedSprite } from '../engine/spriteDraw'
import { drawCharFrame } from '../engine/spriteAnim'
import { SKY_LAYERS } from '../data/assets'
import { CHAR_ANIMS } from '../data/charAnims'

// Cor por tipo de tile (world space).
function tileColor(t: TileType): string {
  switch (t) {
    case 'ground':
      return COLOR_SURFACE
    case 'brick':
      return COLOR_INK
    case 'block':
      return COLOR_SURFACE
    case 'platform':
      return '#2a2a32'
    case 'goal':
      return COLOR_MAGENTA
    default:
      return COLOR_BG
  }
}

// Lista ordenada dos 5 personagens selecionaveis (ordem canonica do contrato §0.4).
const SELECT_ORDER = ['renan', 'dante', 'julio', 'artur', 'einstein']
function selectableChars(): CharacterDef[] {
  return SELECT_ORDER.map((id) => CHARACTERS[id])
}

export interface Game {
  update(dt: number): void
  render(alpha: number): void
  state: ReturnType<typeof createStateMachine>
  player: Player | null
  enemies: Enemy[]
}

interface CoinEntity {
  x: number
  y: number
  active: boolean
}

export function createGame(
  renderer: Renderer,
  input: Input,
  level: ParsedLevel,
  store?: AssetStore,
): Game {
  const state = createStateMachine('select')
  const cam = createCamera()
  const chars = selectableChars()
  const sel: SelectState = createSelect()

  // --- M2a: animacao do player + sistema de particulas (persistem entre frames) ---
  const playerAnim = createAnimator()
  const ps = createParticles()
  // Rastreia a borda de ativacao do Humanware para emitir 1 burst no frame que ativa.
  let hwWasActive = false

  // Mutaveis: recriados no reset.
  let player: Player | null = null
  let hw: HumanwareState = createHumanware()
  let enemies: Enemy[] = spawnEnemies(level)
  let time = TIME_START
  let coins: CoinEntity[] = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
  let coinCount = 0

  // Celula do bloco temporario do Builder atualmente escrita em level.tiles (ou null).
  // Mecanismo canonico (contrato §builder): UMA unica referencia; escreve 'block' somente
  // se era 'empty'; restaura 'empty' ao sair. Sem segundo sistema de colisao.
  let builderWritten: { col: number; row: number } | null = null

  // Escreve/atualiza o bloco temporario do Builder em level.tiles.
  function syncBuilderTile(): void {
    const desired = player ? abilityBuilderTile(player) : null
    // Se a celula desejada mudou (ou sumiu), restaura a anterior primeiro.
    if (
      builderWritten &&
      (!desired ||
        desired.col !== builderWritten.col ||
        desired.row !== builderWritten.row)
    ) {
      if (level.tiles[builderWritten.row]?.[builderWritten.col] === 'block') {
        level.tiles[builderWritten.row][builderWritten.col] = 'empty'
      }
      builderWritten = null
    }
    if (desired) {
      const { col, row } = desired
      const cur = level.tiles[row]?.[col]
      if (cur === 'empty') {
        level.tiles[row][col] = 'block'
        builderWritten = { col, row }
      }
    }
  }

  // Restaura o bloco temporario do Builder quando expira.
  function restoreBuilderTile(): void {
    if (!builderWritten) return
    if (player && abilityBuilderTile(player)) return // ainda ativo
    if (level.tiles[builderWritten.row]?.[builderWritten.col] === 'block') {
      level.tiles[builderWritten.row][builderWritten.col] = 'empty'
    }
    builderWritten = null
  }

  // AABB overlap player x inimigo.
  function overlap(p: Player, e: Enemy): boolean {
    return (
      p.x < e.x + e.w &&
      p.x + p.w > e.x &&
      p.y < e.y + e.h &&
      p.y + p.h > e.y
    )
  }

  function resetToSelect(): void {
    // Restaura qualquer bloco temporario antes de descartar o player.
    if (builderWritten && level.tiles[builderWritten.row]?.[builderWritten.col] === 'block') {
      level.tiles[builderWritten.row][builderWritten.col] = 'empty'
    }
    builderWritten = null
    player = null
    hw = createHumanware()
    enemies = spawnEnemies(level)
    time = TIME_START
    coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
    coinCount = 0
    // Reseta o estado M2a para que uma nova rodada comece limpa.
    hwWasActive = false
    Object.assign(playerAnim, createAnimator())
    ps.particles = []
    ps.ambientAcc = 0
    // Reseta o cursor do select para o primeiro personagem em uma nova rodada.
    sel.index = 0
    state.set('select')
  }

  function update(dt: number): void {
    if (state.is('select')) {
      const picked = updateSelect(sel, input, chars)
      if (picked) {
        player = createPlayer(CHARACTERS[picked], level.playerSpawn)
        enemies = spawnEnemies(level)
        hw = createHumanware()
        time = TIME_START
        coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
        coinCount = 0
        state.set('playing')
      }
      input.update()
      return
    }

    if (state.is('playing') && player) {
      const p = player

      // §0.6 worldScale: sempre Math.min (nunca multiplicar). Player roda em escala 1.
      const ws = Math.min(humanwareWorldScale(hw), abilityWorldScale(p), 1)

      // 1) Player: SEMPRE dt (escala 1).
      updatePlayer(p, input, level, dt)

      // 2) Habilidade: tempo do player (dt, escala 1).
      updateAbility(p, input, dt, { level, enemies })

      // 2b) M2a: animacao do player (logica pura, sem render) + particulas ambiente.
      updateAnimator(playerAnim, p, p.iframes, dt)
      emitAmbient(ps, VIEW_W, VIEW_H, dt)
      // Burst no frame em que o Humanware ACABOU de ativar (borda de subida).
      // Usa coordenadas de TELA (screen space) para consistencia com drawParticles.
      const hwActiveNow = isActive(hw)
      if (hwActiveNow && !hwWasActive) {
        emitBurst(ps, p.x - cam.x, (p.y - 30) - cam.y, 24, [COLOR_MAGENTA, COLOR_LIME])
      }
      hwWasActive = hwActiveNow
      updateParticles(ps, dt)

      // 3) Bloco temporario do Builder -> level.tiles (sem 2o sistema de colisao).
      syncBuilderTile()

      // 4) Gatilho do Humanware (KeyH) + update do estado.
      if (input.pressed('humanware')) tryActivate(hw)
      updateHumanware(hw, dt)

      // 5) Inimigos: mundo desacelera (dt*ws); congelam no Modo.
      const modeActive = isActive(hw)
      for (const e of enemies) {
        e.frozen = modeActive
        updateEnemy(e, level, dt * ws)
      }

      // 6) Colisao player x inimigos.
      for (const e of enemies) {
        if (!e.alive) continue
        if (isStomp(p, e)) {
          e.alive = false
          p.vy = STOMP_BOUNCE
          addMeter(hw, 60)
        } else if (abilityKillsEnemy(p) && overlap(p, e)) {
          e.alive = false
        } else if (overlap(p, e)) {
          // E2: captura livesBefore; se result==='hit' && lives<livesBefore => respawnPlayer
          const livesBefore = p.lives
          const result = damagePlayer(p, e.x)
          if (result === 'death') {
            // Sai limpo no frame da morte: input consumido uma vez, sem continuar o frame.
            state.set('over'); input.update(); return
          } else if (result === 'hit' && p.lives < livesBefore) {
            respawnPlayer(p, level.playerSpawn)
          }
        }
      }

      // 7) Coin pickup -> +8 no medidor.
      const pr = p.x + p.w
      const pb = p.y + p.h
      for (const coin of coins) {
        if (!coin.active) continue
        const cr = coin.x + COIN_SIZE
        const cb = coin.y + COIN_SIZE
        if (p.x < cr && pr > coin.x && p.y < cb && pb > coin.y) {
          coin.active = false
          coinCount++
          addMeter(hw, 8)
        }
      }

      // 8) Timer: PAUSADO no Modo; 0 -> over.
      if (!isActive(hw)) {
        time = Math.max(0, time - dt * FIXED_DT)
        if (time <= 0) state.set('over')
      }

      // 9) Timers do player (i-frames) + restaurar bloco expirado.
      tickPlayerTimers(p, dt)
      restoreBuilderTile()

      // 10) Camera + goal.
      followCamera(cam, p, level)
      if (state.is('playing') && checkGoal(p, level)) {
        state.set('win')
      }

      input.update()
      return
    }

    if (state.is('win') || state.is('over')) {
      if (input.pressed('confirm')) {
        resetToSelect()
      }
      input.update()
      return
    }

    // Qualquer outro estado: consome edges.
    input.update()
  }

  function render(_alpha: number): void {
    renderer.clear(COLOR_BG)

    if (state.is('select')) {
      drawSelect(renderer, sel, chars)
      void _alpha
      return
    }

    // M2a: parallax do ceu em SCREEN SPACE, por cima do COLOR_BG, antes do mundo.
    // store pode ser undefined (testes/loading) — drawParallax pula layers sem asset.
    if (store) drawParallax(renderer, SKY_LAYERS, store, cam)

    renderer.beginWorld(cam.x, cam.y)

    // Tiles visiveis.
    const startCol = Math.max(0, Math.floor(cam.x / TILE))
    const endCol = Math.min(level.widthTiles - 1, Math.ceil((cam.x + VIEW_W) / TILE))
    const startRow = Math.max(0, Math.floor(cam.y / TILE))
    const endRow = Math.min(level.heightTiles - 1, Math.ceil((cam.y + VIEW_H) / TILE))
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const t = level.tiles[row][col]
        if (t === 'empty') continue
        renderer.drawRect(col * TILE, row * TILE, TILE, TILE, tileColor(t))
      }
    }

    // Goal (coordenada: o parser mapeia 'G' para tile vazio, desenhamos aqui).
    renderer.drawRect(level.goal.x, level.goal.y, TILE, TILE, COLOR_MAGENTA)

    // Coins ativos.
    const coinOffset = (TILE - COIN_SIZE) / 2
    for (const coin of coins) {
      if (!coin.active) continue
      renderer.drawRect(
        coin.x + coinOffset,
        coin.y + coinOffset,
        COIN_SIZE,
        COIN_SIZE,
        COLOR_LIME,
      )
    }

    // Inimigos.
    for (const e of enemies) {
      if (!e.alive) continue
      drawEnemy(renderer, e)
    }

    // FX da habilidade + player.
    if (player) {
      drawAbilityFx(renderer, player)

      // M2a: pisca de i-frames — pula o desenho do sprite em frames alternados.
      const blink = player.iframes > 0 && ((player.iframes >> 2) & 1) === 1
      if (!blink) {
        // M2b: frame-a-frame com a arte ORIGINAL do personagem (Artur), se houver.
        const set = CHAR_ANIMS[player.char.id]
        const drewFrame =
          store !== undefined &&
          set !== undefined &&
          drawCharFrame(
            renderer,
            store,
            set,
            playerAnim.state,
            playerAnim.t,
            player.x + player.w / 2,
            player.y + player.h,
            player.facing,
          )
        if (!drewFrame) {
          // Fallback M2a: arte-base procedural; senao placeholder M1.
          const artur = store ? store.get('char.artur') : null
          if (artur) {
            drawAnimatedSprite(
              renderer,
              artur,
              playerAnim,
              player.x + player.w / 2,
              player.y + player.h,
              player.w,
              player.h,
              player.facing,
              player,
            )
          } else {
            drawPlaceholder(
              renderer,
              player.char,
              player.x,
              player.y,
              player.w,
              player.h,
              player.facing,
            )
          }
        }
      }
    }

    renderer.endWorld()

    // M2a: particulas em SCREEN SPACE, por cima do mundo, antes do HUD.
    drawParticles(renderer, ps)

    // HUD em screen space (hwMeter do Humanware; hearts/lives do player).
    // Task 9 vai estender drawHud com hearts; por agora usa a assinatura M0 + hwMeter.
    drawHud(renderer, {
      time: Math.ceil(time),
      lives: player ? player.lives : 0,
      coins: coinCount,
      hwMeter: hw.meter,
      hearts: player ? player.hearts : 0,
    })

    // Overlays win/over.
    if (state.is('win') || state.is('over')) {
      const ctx = renderer.ctx
      ctx.save()
      ctx.fillStyle = 'rgba(9,9,11,0.88)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (state.is('win')) {
        ctx.font = 'bold 22px monospace'
        ctx.fillStyle = COLOR_MAGENTA
        ctx.fillText('VOCE TAMBEM ACREDITA QUE PODEMOS', VIEW_W / 2, VIEW_H / 2 - 24)
        ctx.fillText('MUDAR O MUNDO? BORA JUNTOS.', VIEW_W / 2, VIEW_H / 2 + 12)
        ctx.fillStyle = COLOR_TEXT
        ctx.font = '14px monospace'
        ctx.fillText('ENTER PARA VOLTAR -- GRAVIDADE ZERO', VIEW_W / 2, VIEW_H / 2 + 56)
      } else {
        ctx.font = 'bold 28px monospace'
        ctx.fillStyle = COLOR_MAGENTA
        ctx.fillText('GAME OVER', VIEW_W / 2, VIEW_H / 2 - 12)
        ctx.fillStyle = COLOR_TEXT
        ctx.font = '14px monospace'
        ctx.fillText('ENTER PARA RECOMECAR', VIEW_W / 2, VIEW_H / 2 + 32)
      }
      ctx.restore()
    }

    void _alpha
  }

  return {
    update,
    render,
    get state() {
      return state
    },
    get player() {
      return player
    },
    get enemies() {
      return enemies
    },
  }
}
