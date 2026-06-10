// src/game/game.ts — M1: integracao select/playing/win/over + worldScale + colisoes (DONO).
import type { Renderer } from '../engine/render'
import type { Input } from '../engine/input'
import type { ParsedLevel, TileType } from '../data/schema'
import { createStateMachine } from '../engine/state'
import { createCamera, followCamera, snapCamera } from '../engine/camera'
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
  SELECT_START_INDEX,
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
  CAST_FRAMES,
  HITSTOP_FRAMES,
  SHAKE_FRAMES,
  SHAKE_PX,
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_INK,
  COLOR_MAGENTA,
  COLOR_LIME,
  COLOR_TEXT,
  COLOR_OBJETIVO,
  COLOR_TECH,
  COLOR_PERIGO,
  COLOR_COLETAVEL,
  HW_METER_MAX,
  VIEW_W,
  VIEW_H,
} from '../engine/constants'

// --- M2a: motor de animacao (consumido, nao recriado) ---
import type { AssetStore } from '../engine/assets'
import {
  createAnimator,
  updateAnimator,
  triggerOneShot,
  getFrameTransform,
} from '../engine/animator'
import {
  createParticles,
  emitAmbient,
  emitBurst,
  updateParticles,
  drawParticles,
  drawParticlesWorld,
} from '../engine/particles'
import { drawParallax } from '../engine/parallax'
import { drawAnimatedSprite } from '../engine/spriteDraw'
import { drawCharFrame, drawContactShadow, frameIndex } from '../engine/spriteAnim'
import { SKY_LAYERS } from '../data/assets'
import { CHAR_ANIMS } from '../data/charAnims'

// --- D4: animacoes de objetos (moeda/portal) — contrato D1 ---
import { OBJECT_ANIMS } from '../data/objects'

// --- C3b: tiles com arte (autotiling) + entidades novas ---
import { TILE_ATLASES } from '../data/tiles'
import { computeTileVariants, drawTile } from '../engine/tilemap'

// C3b: ganhos canônicos do medidor Humanware (spec mestre §0.2; estrela em §6.2.2).
// moeda=8 · stomp=60 (já usado no passo 6) · heart-orb=25 · estrela=30.
const HW_GAIN_COIN = 8
const HW_GAIN_STAR = 30
const HW_GAIN_HEART_ORB = 25

// C3b: lado do heart-orb (quadrado magenta placeholder até a Fase D).
const HEART_SIZE = 20

// E1: SCORE canônico (spec mestre: RulesConfig §3.8 + tabela §9.6.1/§9.6.4).
// moeda=100 · stomp=200 · conclusão de fase=1000 · bônus de tempo=50/s restante.
// (O §6.2.2 é a tabela do MEDIDOR Humanware — moeda 8 / stomp 60 — não é score.)
const SCORE_COIN = 100
const SCORE_STOMP = 200
const SCORE_GOAL = 1000
const SCORE_TIME_PER_SEC = 50

// E1: frames mínimos no resultado (win/over) antes de aceitar Enter (anti-skip).
const RESULT_DELAY_FRAMES = 45

// E1: cursor inicial do select (contrato E2). O ?? 0 cobre a janela de
// integração até o E2 exportar SELECT_START_INDEX.
const SELECT_START = SELECT_START_INDEX ?? 0

// C3b: véu escuro sobre bloco '?' já usado.
const QBLOCK_USED_VEIL = 'rgba(0,0,0,0.35)'

// D4: fila de SFX (contrato D2) — cap; excedente e descartado.
const EVENTS_MAX = 16

// D4: poeira cinza clara (pouso/pulo/pulo duplo).
const DUST_COLOR = '#cfcfd6'

// D4: janela final do TTL do builder em que o holograma pisca.
const BUILDER_BLINK_FRAMES = 60

// D4: coracao pixel desenhado por codigo (2 "lobos" no topo + corpo + ponta
// que estreita — quadrados/linhas via fillRect), centrado em (cx, cy), lado s.
function drawHeartPixel(r: Renderer, cx: number, cy: number, s: number): void {
  const u = s / 7
  const x0 = cx - s / 2
  const y0 = cy - u * 3
  r.drawRect(x0 + u, y0, u * 2, u, COLOR_OBJETIVO)
  r.drawRect(x0 + u * 4, y0, u * 2, u, COLOR_OBJETIVO)
  r.drawRect(x0, y0 + u, u * 7, u * 2, COLOR_OBJETIVO)
  r.drawRect(x0 + u, y0 + u * 3, u * 5, u, COLOR_OBJETIVO)
  r.drawRect(x0 + u * 2, y0 + u * 4, u * 3, u, COLOR_OBJETIVO)
  r.drawRect(x0 + u * 3, y0 + u * 5, u, u, COLOR_OBJETIVO)
}

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
    // (A2) case 'goal' removido: inalcancavel — o parser mapeia G para empty.
    default:
      return COLOR_BG
  }
}

// Lista ordenada dos 5 personagens selecionaveis (ordem canonica do contrato §0.4).
const SELECT_ORDER = ['renan', 'dante', 'julio', 'artur', 'einstein']
function selectableChars(): CharacterDef[] {
  return SELECT_ORDER.map((id) => CHARACTERS[id])
}

// Chave da arte-base procedural por personagem (pre-computada; sem concat por frame).
const CHAR_ART_KEYS: Record<string, string> = {}
for (const id of SELECT_ORDER) CHAR_ART_KEYS[id] = 'char.' + id

export interface Game {
  update(dt: number): void
  render(alpha: number): void
  state: ReturnType<typeof createStateMachine>
  player: Player | null
  enemies: Enemy[]
  // (A2) estado interno do Humanware — contrato com A1 (main.ts le game.humanware).
  humanware: HumanwareState
  // (D4) fila de SFX empilhados no update; o main drena a cada frame (contrato D2).
  events: string[]
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
  // E1: boot inicia no TITLE (Enter/confirm → select).
  const state = createStateMachine('title')
  const cam = createCamera()
  const chars = selectableChars()
  const sel: SelectState = createSelect()

  // --- M2a: animacao do player + sistema de particulas (persistem entre frames) ---
  const playerAnim = createAnimator()
  const ps = createParticles()
  // Rastreia a borda de ativacao do Humanware para emitir 1 burst no frame que ativa.
  let hwWasActive = false
  // M2 fase B: hitstop (mundo congelado por N frames) + screen-shake ao tomar dano.
  let hitstop = 0
  let shakeT = 0

  // C3b: autotiling — variants recomputadas SEMPRE que level.tiles muda
  // (builder escreve/restaura). Indice row-major (row*widthTiles+col).
  let variants = computeTileVariants(level)
  function recomputeVariants(): void {
    variants = computeTileVariants(level)
  }

  // C3b: blocos '?' — mapa 'col,row' -> payload (contrato C3a: level.qBlocks).
  // Fallback ?? []: levels legados (testes antigos) ainda nao tem o campo.
  const qBlockMap = new Map<string, 'coin' | 'item' | 'star'>()
  for (const qb of level.qBlocks ?? []) {
    qBlockMap.set(qb.col + ',' + qb.row, qb.payload)
  }
  let usedQBlocks = new Set<string>()

  // C3b: heart-orbs — caixa fixa HEART_SIZE centrada na celula (colisao estavel;
  // o pulso e so visual).
  interface HeartEnt {
    x: number
    y: number
    active: boolean
  }
  function spawnHearts(): HeartEnt[] {
    return (level.hearts ?? []).map((h) => ({
      x: h.col * TILE + (TILE - HEART_SIZE) / 2,
      y: h.row * TILE + (TILE - HEART_SIZE) / 2,
      active: true,
    }))
  }

  // Mutaveis: recriados no reset.
  let player: Player | null = null
  let hw: HumanwareState = createHumanware()
  let enemies: Enemy[] = spawnEnemies(level)
  // C3b: timer vem do level (fallback TIME_START p/ levels legados de teste).
  let time = level.timeStart ?? TIME_START
  let coins: CoinEntity[] = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
  let coinCount = 0
  let heartEnts: HeartEnt[] = spawnHearts()
  // C3b: checkpoint (px) — respawn volta aqui em vez do spawn.
  let lastCheckpointX = level.playerSpawn.x
  // C3b/D4: relogio GLOBAL de frames (anima objetos e pulso dos heart-orbs).
  // Congela no hitstop; NAO reseta no respawn; reseta ao voltar pro select.
  let clock = 0
  // E1: relogio das telas de UI (blink do title + idle do card do select).
  let uiClock = 0
  // E1: tolos stompados na rodada (painel de resultado + score).
  let stompCount = 0
  // E1: frames decorridos no estado win/over (delay anti-skip do Enter).
  let resultTimer = 0

  // D4: fila de SFX (referencia VIVA exposta em game.events; main drena via splice).
  const events: string[] = []
  function pushEvent(name: string): void {
    if (events.length < EVENTS_MAX) events.push(name)
  }

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
        recomputeVariants() // C3b: tiles mudou
      }
      builderWritten = null
    }
    if (desired) {
      const { col, row } = desired
      const cur = level.tiles[row]?.[col]
      if (cur === 'empty') {
        level.tiles[row][col] = 'block'
        builderWritten = { col, row }
        recomputeVariants() // C3b: tiles mudou
      }
    }
  }

  // Restaura o bloco temporario do Builder quando expira.
  function restoreBuilderTile(): void {
    if (!builderWritten) return
    if (player && abilityBuilderTile(player)) return // ainda ativo
    if (level.tiles[builderWritten.row]?.[builderWritten.col] === 'block') {
      level.tiles[builderWritten.row][builderWritten.col] = 'empty'
      recomputeVariants() // C3b: tiles mudou
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
      recomputeVariants() // C3b: tiles mudou
    }
    builderWritten = null
    player = null
    hw = createHumanware()
    enemies = spawnEnemies(level)
    time = level.timeStart ?? TIME_START
    coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
    coinCount = 0
    // C3b: re-zera blocos '?', heart-orbs, checkpoint e clock.
    usedQBlocks = new Set<string>()
    heartEnts = spawnHearts()
    lastCheckpointX = level.playerSpawn.x
    clock = 0
    // D4: descarta SFX pendentes da rodada anterior.
    events.length = 0
    // Reseta o estado M2a para que uma nova rodada comece limpa.
    hwWasActive = false
    hitstop = 0
    shakeT = 0
    Object.assign(playerAnim, createAnimator())
    ps.particles = []
    ps.ambientAcc = 0
    // E1: zera stats do resultado e o delay anti-skip.
    stompCount = 0
    resultTimer = 0
    // E1: cursor do select volta ao inicial canonico (contrato E2).
    sel.index = SELECT_START
    state.set('select')
  }

  // (A2) update = corpo (updateInner) + input.update() UMA unica vez no fim.
  function update(dt: number): void {
    updateInner(dt)
    input.update()
  }

  function updateInner(dt: number): void {
    // E1: TITLE — particulas ambiente continuam rodando; Enter/confirm (ou jump)
    // leva ao select.
    if (state.is('title')) {
      uiClock += dt
      emitAmbient(ps, VIEW_W, VIEW_H, dt)
      updateParticles(ps, dt)
      if (input.pressed('confirm') || input.pressed('jump')) state.set('select')
      return
    }

    if (state.is('select')) {
      uiClock += dt // E1: anima o idle do card selecionado (drawSelect)
      const picked = updateSelect(sel, input, chars)
      if (picked) {
        player = createPlayer(CHARACTERS[picked], level.playerSpawn)
        enemies = spawnEnemies(level)
        hw = createHumanware()
        time = level.timeStart ?? TIME_START
        coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
        coinCount = 0
        // C3b: rodada nova comeca com blocos '?' fechados e hearts no lugar.
        usedQBlocks = new Set<string>()
        heartEnts = spawnHearts()
        lastCheckpointX = level.playerSpawn.x
        clock = 0
        // E1: stats da rodada nova.
        stompCount = 0
        resultTimer = 0
        // FINAL (revisão): camera corta direto pro spawn (sem sweep da rodada
        // anterior — cam/lookX persistiam entre rodadas).
        snapCamera(cam, player, level)
        state.set('playing')
      }
      return
    }

    // E1: PAUSED — update congelado (nada do mundo avanca); ESC ou confirm despausa.
    if (state.is('paused')) {
      if (input.pressed('pause') || input.pressed('confirm')) state.set('playing')
      return
    }

    if (state.is('playing') && player) {
      // E1: ESC alterna para o pause (vale mesmo durante o hitstop).
      if (input.pressed('pause')) {
        state.set('paused')
        return
      }

      const p = player

      // M2 fase B: HITSTOP — mundo congelado; nada mais atualiza neste frame.
      if (hitstop > 0) {
        hitstop = Math.max(0, hitstop - dt)
        return
      }
      // Shake decai no update normal (fora do hitstop).
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt)

      // C3b: relogio de jogo (congela junto com o hitstop, acima).
      clock += dt

      // §0.6 worldScale: sempre Math.min (nunca multiplicar). Player roda em escala 1.
      const ws = Math.min(humanwareWorldScale(hw), abilityWorldScale(p), 1)

      // C3b: vy ANTES da fisica — deteccao deterministica de batida de cabeca.
      const prevVy = p.vy

      // D4: estado pre-fisica para detectar o PULO REAL (intencao + apto).
      const wasJumpable = p.onGround || p.coyote > 0
      const hadJumpIntent = p.jumpBuffer > 0 || input.pressed('jump')

      // 1) Player: SEMPRE dt (escala 1).
      updatePlayer(p, input, level, dt)

      // FINAL (revisão): KILL-PLANE — queda no abismo custa 1 vida (corações
      // restaurados pelo respawn); sem vidas restantes => game over. Sem isso
      // o player cai para sempre e o jogo trava em 'playing' até o timer.
      if (p.y > level.heightPx + TILE) {
        p.lives -= 1
        if (p.lives <= 0) {
          pushEvent('over')
          resultTimer = 0
          state.set('over')
          return
        }
        pushEvent('hurt')
        respawnPlayer(p, { x: lastCheckpointX, y: level.playerSpawn.y })
        snapCamera(cam, p, level)
        shakeT = SHAKE_FRAMES
      }

      // 1a) D4: pulo real disparou dentro do updatePlayer (buffer consumido,
      // saiu do chao subindo) -> SFX 'jump' + poeira nos pes.
      if (wasJumpable && hadJumpIntent && p.jumpBuffer === 0 && !p.onGround && p.vy < 0) {
        pushEvent('jump')
        emitBurst(ps, p.x + p.w / 2, p.y + p.h, 3, [DUST_COLOR], 'world')
      }

      // 1b) C3b: checkpoint — centro do player cruzou a coluna => avanca o respawn.
      for (const ccol of level.checkpoints ?? []) {
        const cx = ccol * TILE
        if (cx > lastCheckpointX && p.x + p.w / 2 >= cx) {
          lastCheckpointX = cx
          // D4: feedback de checkpoint cruzado.
          pushEvent('checkpoint')
          emitBurst(ps, cx, p.y + p.h / 2, 10, [COLOR_TECH], 'world')
        }
      }

      // 1c) C3b: bloco '?' — vy<0 zerado pela fisica (e nao pousou) = bateu o teto.
      // headRow = celula logo acima da cabeca; tolerancia de ±1 col com overlap
      // horizontal REAL do player contra a celula candidata.
      if (prevVy < 0 && p.vy === 0 && !p.onGround && qBlockMap.size > 0) {
        const headRow = Math.floor((p.y - 1) / TILE)
        const centerCol = Math.floor((p.x + p.w / 2) / TILE)
        for (const dc of [0, -1, 1]) {
          const col = centerCol + dc
          const key = col + ',' + headRow
          const payload = qBlockMap.get(key)
          if (payload === undefined || usedQBlocks.has(key)) continue
          if (p.x < (col + 1) * TILE && p.x + p.w > col * TILE) {
            usedQBlocks.add(key)
            if (payload === 'coin') {
              coinCount++
              addMeter(hw, HW_GAIN_COIN)
            } else if (payload === 'item') {
              // Cogumelo: restaura 1 coracao (cap no maximo do personagem).
              p.hearts = Math.min(p.hearts + 1, p.char.hearts)
            } else {
              addMeter(hw, HW_GAIN_STAR)
            }
            recomputeVariants() // contrato C3b: '?' usado tambem recomputa
            // D4: feedback do bump no '?'.
            pushEvent('qblock')
            emitBurst(
              ps,
              col * TILE + TILE / 2,
              headRow * TILE + TILE / 2,
              6,
              [COLOR_COLETAVEL],
              'world',
            )
            break
          }
        }
      }

      // 2) Habilidade: tempo do player (dt, escala 1).
      // M2 fase B (CAST): detecta ativacao REAL comparando antes/depois — dash liga
      // `active`; salto gasta `airJumps`; escudo/builder/emc2 ARMAM `cooldown`
      // (o fim do dash tambem arma cooldown — excluido via dashEnded).
      const ab = p.ability
      const abBefore = { cooldown: ab.cooldown, active: ab.active, airJumps: ab.airJumps }
      updateAbility(p, input, dt, { level, enemies })
      const dashEnded = abBefore.active && !ab.active
      const casted =
        (!abBefore.active && ab.active) ||
        ab.airJumps > abBefore.airJumps ||
        (ab.cooldown > abBefore.cooldown && !dashEnded)
      if (casted) {
        triggerOneShot(playerAnim, 'cast', CAST_FRAMES)
        pushEvent('cast') // D4: SFX junto do one-shot
      }
      // D4: pulo duplo (airJumps consumido) -> poeira extra nos pes.
      if (ab.airJumps > abBefore.airJumps) {
        emitBurst(ps, p.x + p.w / 2, p.y + p.h, 6, [DUST_COLOR], 'world')
      }

      // 2b) M2a: animacao do player (logica pura, sem render) + particulas ambiente.
      // M2 fase B: 3o arg = hurtTimer (estado 'hurt' curto), NAO os i-frames de 90f.
      const { landed } = updateAnimator(playerAnim, p, p.hurtTimer, dt)
      // D4: pouso -> poeira cinza clara nos pes.
      if (landed) {
        emitBurst(ps, p.x + p.w / 2, p.y + p.h, 5, [DUST_COLOR], 'world')
      }
      emitAmbient(ps, VIEW_W, VIEW_H, dt)
      // Burst no frame em que o Humanware ACABOU de ativar (borda de subida).
      // (A2) Emitido em COORDENADAS DE MUNDO — desenhado por drawParticlesWorld.
      const hwActiveNow = isActive(hw)
      if (hwActiveNow && !hwWasActive) {
        emitBurst(ps, p.x + p.w / 2, p.y - 30, 24, [COLOR_MAGENTA, COLOR_LIME], 'world')
      }
      hwWasActive = hwActiveNow
      // FINAL (revisão): particulas seguem o worldScale — slow-mo do Modo
      // Humanware/emc2 fica perceptivel tambem na poeira/bursts.
      updateParticles(ps, dt * ws)

      // 3) Bloco temporario do Builder -> level.tiles (sem 2o sistema de colisao).
      syncBuilderTile()

      // 4) Gatilho do Humanware (KeyH) + update do estado.
      // D4: ativacao REAL (tryActivate true) empilha o SFX 'humanware'.
      if (input.pressed('humanware') && tryActivate(hw)) pushEvent('humanware')
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
          stompCount++ // E1: conta tolos pro painel de resultado/score
          // D4: feedback do stomp — SFX + burst PERIGO + shake curto (menor que o de dano).
          pushEvent('stomp')
          emitBurst(ps, e.x + e.w / 2, e.y + e.h / 2, 12, [COLOR_PERIGO], 'world')
          shakeT = Math.max(shakeT, 4)
        } else if (abilityKillsEnemy(p) && overlap(p, e)) {
          e.alive = false
        } else if (overlap(p, e)) {
          // E2: captura livesBefore; se result==='hit' && lives<livesBefore => respawnPlayer
          const livesBefore = p.lives
          const result = damagePlayer(p, e.x)
          if (result === 'death') {
            // Sai limpo no frame da morte (input.update() acontece em update()).
            pushEvent('over') // D4
            resultTimer = 0 // E1: arma o delay anti-skip do resultado
            state.set('over'); return
          } else if (result === 'hit') {
            // M2 fase B: dano que conecta congela o mundo e chacoalha a camera.
            pushEvent('hurt') // D4: dano CONECTADO
            hitstop = HITSTOP_FRAMES
            shakeT = SHAKE_FRAMES
            // C3b: respawn no ultimo checkpoint cruzado (y do spawn original).
            if (p.lives < livesBefore) {
              respawnPlayer(p, { x: lastCheckpointX, y: level.playerSpawn.y })
              // FINAL (revisão): corta a camera pro respawn (sem sweep).
              snapCamera(cam, p, level)
            }
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
          addMeter(hw, HW_GAIN_COIN)
          // D4: feedback da coleta — SFX + burst COLETAVEL no centro do tile.
          pushEvent('coin')
          emitBurst(ps, coin.x + TILE / 2, coin.y + TILE / 2, 8, [COLOR_COLETAVEL], 'world')
        }
      }

      // 7b) C3b: heart-orb — AABB com caixa fixa 20px; +25 no medidor e some.
      for (const hEnt of heartEnts) {
        if (!hEnt.active) continue
        if (
          p.x < hEnt.x + HEART_SIZE &&
          pr > hEnt.x &&
          p.y < hEnt.y + HEART_SIZE &&
          pb > hEnt.y
        ) {
          hEnt.active = false
          addMeter(hw, HW_GAIN_HEART_ORB)
          // D4: feedback do heart-orb — SFX + burst OBJETIVO.
          pushEvent('heart')
          emitBurst(
            ps,
            hEnt.x + HEART_SIZE / 2,
            hEnt.y + HEART_SIZE / 2,
            8,
            [COLOR_OBJETIVO],
            'world',
          )
        }
      }

      // 8) Timer: PAUSADO no Modo; 0 -> over.
      if (!isActive(hw)) {
        time = Math.max(0, time - dt * FIXED_DT)
        if (time <= 0) {
          pushEvent('over') // D4
          resultTimer = 0 // E1: arma o delay anti-skip do resultado
          state.set('over')
        }
      }

      // 9) Timers do player (i-frames) + restaurar bloco expirado.
      tickPlayerTimers(p, dt)
      restoreBuilderTile()

      // 10) Camera + goal.
      followCamera(cam, p, level)
      if (state.is('playing') && checkGoal(p, level)) {
        // M2 fase B: pose de vitoria mantida na tela de win (duracao "infinita").
        triggerOneShot(playerAnim, 'victory', 9999)
        // FINAL (revisão): transfere o one-shot pro estado AGORA — updateAnimator
        // nao roda no estado 'win', entao sem isso a pose nunca aparecia.
        updateAnimator(playerAnim, p, 0, dt)
        pushEvent('win') // D4
        resultTimer = 0 // E1: arma o delay anti-skip do resultado
        state.set('win')
      }

      return
    }

    if (state.is('win') || state.is('over')) {
      // E1: delay anti-skip — Enter so conta apos RESULT_DELAY_FRAMES no estado.
      resultTimer += dt
      if (resultTimer >= RESULT_DELAY_FRAMES && input.pressed('confirm')) {
        resetToSelect()
      }
      return
    }

    // Qualquer outro estado: nada a fazer (edges consumidos em update()).
  }

  function render(_alpha: number): void {
    renderer.clear(COLOR_BG)

    // E1: TITLE — wordmark + particulas ambiente em screen space; SEM HUD.
    if (state.is('title')) {
      drawParticles(renderer, ps)
      const ctx = renderer.ctx
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 56px monospace'
      ctx.fillStyle = COLOR_TEXT
      ctx.fillText('GRAVIDADE ZERO', VIEW_W / 2, VIEW_H / 2 - 48)
      ctx.font = 'bold 20px monospace'
      ctx.fillStyle = COLOR_OBJETIVO
      ctx.fillText('O JOGO', VIEW_W / 2, VIEW_H / 2 + 8)
      // Pisca: visivel quando (floor(uiClock/30)&1)===0.
      if ((Math.floor(uiClock / 30) & 1) === 0) {
        ctx.font = 'bold 16px monospace'
        ctx.fillStyle = COLOR_LIME
        ctx.fillText('PRESS ENTER', VIEW_W / 2, VIEW_H / 2 + 88)
      }
      ctx.restore()
      void _alpha
      return
    }

    if (state.is('select')) {
      // E1: uiClock anima o idle do card SELECIONADO (contrato E2).
      drawSelect(renderer, sel, chars, store, uiClock)
      void _alpha
      return
    }

    // M2a: parallax do ceu em SCREEN SPACE, por cima do COLOR_BG, antes do mundo.
    // store pode ser undefined (testes/loading) — drawParallax pula layers sem asset.
    if (store) drawParallax(renderer, SKY_LAYERS, store, cam)

    // M2 fase B: screen-shake deterministico enquanto shakeT>0 (offset na camera).
    // FINAL (revisão): sem shake no pause — shakeT nao decai em 'paused' e o
    // offset constante parecia bug de render.
    let shakeDx = 0
    let shakeDy = 0
    if (shakeT > 0 && !state.is('paused')) {
      shakeDx = Math.round(Math.sin(shakeT * 2.7) * SHAKE_PX)
      shakeDy = Math.round(Math.cos(shakeT * 1.9) * SHAKE_PX * 0.6)
    }
    renderer.beginWorld(cam.x + shakeDx, cam.y + shakeDy)

    // Tiles visiveis.
    const startCol = Math.max(0, Math.floor(cam.x / TILE))
    const endCol = Math.min(level.widthTiles - 1, Math.ceil((cam.x + VIEW_W) / TILE))
    const startRow = Math.max(0, Math.floor(cam.y / TILE))
    const endRow = Math.min(level.heightTiles - 1, Math.ceil((cam.y + VIEW_H) / TILE))
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const t = level.tiles[row][col]
        if (t === 'empty') continue
        // C3b: arte via atlas (autotiling); fallback = rect com tileColor.
        const atlas = TILE_ATLASES[t]
        const variant = variants[row * level.widthTiles + col]
        const drew =
          store !== undefined &&
          atlas !== undefined &&
          drawTile(renderer, store, atlas, variant, col, row)
        if (!drew) {
          renderer.drawRect(col * TILE, row * TILE, TILE, TILE, tileColor(t))
        }
        // C3b: overlay do bloco '?' — glifo lime quando fechado; veu escuro usado.
        const qKey = col + ',' + row
        if (qBlockMap.has(qKey)) {
          if (usedQBlocks.has(qKey)) {
            renderer.drawRect(col * TILE, row * TILE, TILE, TILE, QBLOCK_USED_VEIL)
          } else {
            const ctx = renderer.ctx
            ctx.save()
            ctx.font = 'bold 20px monospace'
            ctx.fillStyle = COLOR_LIME
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('?', col * TILE + TILE / 2, row * TILE + TILE / 2)
            ctx.restore()
          }
        }
      }
    }

    // D4: holograma do bloco temporario do Builder POR CIMA do atlas —
    // fill ciano translucido + 4 cantos em "bracket"; pisca no fim do TTL.
    if (builderWritten) {
      const ttl = player?.ability.builder?.ttl ?? 0
      const alpha =
        ttl <= BUILDER_BLINK_FRAMES
          ? (Math.floor(ttl / 8) & 1) === 1
            ? 0.3
            : 0.1
          : 0.25
      const bx = builderWritten.col * TILE
      const by = builderWritten.row * TILE
      const ctx = renderer.ctx
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = COLOR_TECH
      ctx.fillRect(bx, by, TILE, TILE)
      ctx.restore()
      const L = 10 // comprimento do bracket (linhas de 2px)
      renderer.drawRect(bx, by, L, 2, COLOR_TECH)
      renderer.drawRect(bx, by, 2, L, COLOR_TECH)
      renderer.drawRect(bx + TILE - L, by, L, 2, COLOR_TECH)
      renderer.drawRect(bx + TILE - 2, by, 2, L, COLOR_TECH)
      renderer.drawRect(bx, by + TILE - 2, L, 2, COLOR_TECH)
      renderer.drawRect(bx, by + TILE - L, 2, L, COLOR_TECH)
      renderer.drawRect(bx + TILE - L, by + TILE - 2, L, 2, COLOR_TECH)
      renderer.drawRect(bx + TILE - 2, by + TILE - L, 2, L, COLOR_TECH)
    }

    // Goal: portal animado (96x96, base no chao do tile, centrado na col);
    // fallback = rect magenta (token OBJETIVO) de antes.
    const portalAnim = OBJECT_ANIMS.portal
    const portalSheet = store ? store.get(portalAnim.key) : null
    if (portalSheet) {
      const idx = frameIndex(portalAnim, clock)
      renderer.drawSprite(
        portalSheet.src,
        idx * portalAnim.cellW,
        0,
        portalAnim.cellW,
        portalAnim.cellH,
        level.goal.x + TILE / 2 - portalAnim.drawW / 2,
        level.goal.y + TILE - portalAnim.drawH,
        portalAnim.drawW,
        portalAnim.drawH,
      )
    } else {
      renderer.drawRect(level.goal.x, level.goal.y, TILE, TILE, COLOR_OBJETIVO)
    }

    // Coins ativos: sheet da moeda (32x32 centrado no tile) animado pelo clock;
    // fallback = rect lime (token COLETAVEL) de antes.
    const moedaAnim = OBJECT_ANIMS.moeda
    const moedaSheet = store ? store.get(moedaAnim.key) : null
    const moedaIdx = moedaSheet ? frameIndex(moedaAnim, clock) : 0
    const coinOffset = (TILE - COIN_SIZE) / 2
    for (const coin of coins) {
      if (!coin.active) continue
      if (moedaSheet) {
        renderer.drawSprite(
          moedaSheet.src,
          moedaIdx * moedaAnim.cellW,
          0,
          moedaAnim.cellW,
          moedaAnim.cellH,
          coin.x + TILE / 2 - moedaAnim.drawW / 2,
          coin.y + TILE / 2 - moedaAnim.drawH / 2,
          moedaAnim.drawW,
          moedaAnim.drawH,
        )
      } else {
        renderer.drawRect(
          coin.x + coinOffset,
          coin.y + coinOffset,
          COIN_SIZE,
          COIN_SIZE,
          COLOR_COLETAVEL,
        )
      }
    }

    // D4: heart-orbs — coracao pixel por codigo (COLOR_OBJETIVO) com o pulso
    // senoidal de antes (±2px no clock). Colisao continua na caixa fixa.
    for (const hEnt of heartEnts) {
      if (!hEnt.active) continue
      const s = HEART_SIZE + Math.sin(clock * 0.12) * 2
      drawHeartPixel(renderer, hEnt.x + HEART_SIZE / 2, hEnt.y + HEART_SIZE / 2, s)
    }

    // Inimigos (D3: sheet do Tolo animado pelo clock global; fallback rects).
    for (const e of enemies) {
      if (!e.alive) continue
      drawEnemy(renderer, e, store, clock)
    }

    // FX da habilidade + player.
    if (player) {
      drawAbilityFx(renderer, player)

      // M2 fase B: sombra de contato ANTES do sprite (vale para TODOS os caminhos).
      drawContactShadow(
        renderer,
        player.x + player.w / 2,
        player.y + player.h,
        player.w,
        player.onGround,
      )

      // M2 fase B: i-frames = ALPHA alternado (0.45) — NUNCA pular o draw
      // (a animacao de dano precisa ser vista; contrato §2 regras de exibicao).
      const ctx = renderer.ctx
      const dimmed = player.iframes > 0 && ((player.iframes >> 2) & 1) === 1
      if (dimmed) {
        ctx.save()
        ctx.globalAlpha = 0.45
      }

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
          // M2 fase B: overlay procedural (respiracao/lean/squash) POR CIMA do frame.
          getFrameTransform(playerAnim, player),
        )
      if (!drewFrame) {
        // Fallback M2a: arte procedural DO personagem; sem arte propria, placeholder M1.
        const art = store
          ? store.get(CHAR_ART_KEYS[player.char.id] ?? 'char.' + player.char.id)
          : null
        if (art) {
          drawAnimatedSprite(
            renderer,
            art,
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

      if (dimmed) ctx.restore()
    }

    // (A2) particulas em WORLD SPACE (ex.: burst do Humanware), depois do player.
    drawParticlesWorld(renderer, ps)

    renderer.endWorld()

    // D4: vinheta do Modo Humanware (screen space) — 2 faixas por lado em
    // COLOR_OBJETIVO (alpha 0.15 externa / 0.07 interna) + veu escuro 0.06.
    if (isActive(hw)) {
      const ctx = renderer.ctx
      ctx.save()
      ctx.fillStyle = COLOR_OBJETIVO
      ctx.globalAlpha = 0.15
      ctx.fillRect(0, 0, VIEW_W, 8)
      ctx.fillRect(0, VIEW_H - 8, VIEW_W, 8)
      ctx.fillRect(0, 0, 8, VIEW_H)
      ctx.fillRect(VIEW_W - 8, 0, 8, VIEW_H)
      ctx.globalAlpha = 0.07
      ctx.fillRect(8, 8, VIEW_W - 16, 10)
      ctx.fillRect(8, VIEW_H - 18, VIEW_W - 16, 10)
      ctx.fillRect(8, 8, 10, VIEW_H - 16)
      ctx.fillRect(VIEW_W - 18, 8, 10, VIEW_H - 16)
      ctx.globalAlpha = 0.06
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.restore()
    }

    // D4: veu ciano sutil enquanto o worldScale do emc2 esta ativo.
    if (player && abilityWorldScale(player) < 1) {
      const ctx = renderer.ctx
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.fillStyle = COLOR_TECH
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.restore()
    }

    // M2a: particulas em SCREEN SPACE, por cima do mundo, antes do HUD.
    drawParticles(renderer, ps)

    // HUD em screen space — oculto SOMENTE nos overlays win/over (paused mantem).
    // E1: hwActive/hwReady sao campos OPCIONAIS do contrato E3 (hud.ts).
    if (!state.is('win') && !state.is('over')) {
      drawHud(renderer, {
        // time FRACIONARIO cru: drawHud formata (ceil+pad) e usa a fracao como
        // base deterministica do blink de aviso (<50s) e do hwReady.
        time,
        lives: player ? player.lives : 0,
        coins: coinCount,
        hwMeter: hw.meter,
        hearts: player ? player.hearts : 0,
        // FINAL (revisão): sem maxHearts os coracoes vazios nunca apareciam.
        maxHearts: player ? player.char.hearts : 0,
        hwActive: isActive(hw),
        hwReady: hw.meter >= HW_METER_MAX,
      })
    }

    // E1: overlay de PAUSA — mundo + HUD continuam desenhados por baixo do veu.
    if (state.is('paused')) {
      const ctx = renderer.ctx
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 32px monospace'
      ctx.fillStyle = COLOR_TEXT
      ctx.fillText('PAUSA', VIEW_W / 2, VIEW_H / 2 - 116)
      ctx.font = 'bold 16px monospace'
      const controls = [
        '←/→  ANDAR',
        'SHIFT  CORRER',
        'ESPAÇO  PULAR',
        'J  HABILIDADE',
        'H  HUMANWARE (medidor cheio)',
        'ESC  CONTINUAR',
      ]
      let cy = VIEW_H / 2 - 56
      for (const line of controls) {
        ctx.fillText(line, VIEW_W / 2, cy)
        cy += 28
      }
      ctx.restore()
    }

    // E1: painel de RESULTADO (win/over). A frase de marca que vivia aqui SAIU
    // da vitoria de zona — reservada para o final do jogo (spec §9.7,
    // Consciencia Unificada).
    if (state.is('win') || state.is('over')) {
      const ctx = renderer.ctx
      const won = state.is('win')
      const accent = won ? COLOR_OBJETIVO : COLOR_PERIGO
      ctx.save()
      // Veu escuro 0.7.
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.globalAlpha = 1

      // Painel central com borda 4px na cor do resultado.
      const pw = 520
      const ph = 320
      const px = (VIEW_W - pw) / 2
      const py = (VIEW_H - ph) / 2
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(px, py, pw, ph)
      renderer.drawRect(px, py, pw, 4, accent)
      renderer.drawRect(px, py + ph - 4, pw, 4, accent)
      renderer.drawRect(px, py, 4, ph, accent)
      renderer.drawRect(px + pw - 4, py, 4, ph, accent)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 32px monospace'
      ctx.fillStyle = accent
      ctx.fillText(won ? 'ZONA CONCLUÍDA' : 'GAME OVER', VIEW_W / 2, py + 52)

      // Stats + SCORE canonico (moeda 100 · stomp 200 · fase 1000 · 50/s).
      const timeLeft = Math.ceil(time)
      const baseScore = coinCount * SCORE_COIN + stompCount * SCORE_STOMP
      const lines = won
        ? [
            `MOEDAS x${coinCount}`,
            `TOLOS x${stompCount}`,
            `TEMPO RESTANTE ${timeLeft}s`,
            `SCORE ${baseScore + SCORE_GOAL + timeLeft * SCORE_TIME_PER_SEC}`,
          ]
        : [`MOEDAS x${coinCount}`, `SCORE ${baseScore}`]
      ctx.font = 'bold 16px monospace'
      ctx.fillStyle = COLOR_TEXT
      let ly = py + 116
      for (const line of lines) {
        ctx.fillText(line, VIEW_W / 2, ly)
        ly += 32
      }

      // Enter so APARECE (e so funciona, ver update) apos o delay anti-skip.
      if (resultTimer >= RESULT_DELAY_FRAMES) {
        ctx.font = 'bold 14px monospace'
        ctx.fillStyle = COLOR_LIME
        ctx.fillText('ENTER PARA CONTINUAR', VIEW_W / 2, py + ph - 36)
      }
      ctx.restore()
    }

    void _alpha
  }

  return {
    update,
    render,
    // D4: referencia VIVA da fila de SFX (main drena via splice a cada frame).
    events,
    get state() {
      return state
    },
    get player() {
      return player
    },
    get enemies() {
      return enemies
    },
    get humanware() {
      return hw
    },
  }
}
