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
  updateEnemyShooting,
  updateProjectile,
  isStomp,
  drawEnemy,
  type Enemy,
  type Projectile,
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
  SPRING_VEL,
  WALK_MAX,
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
// U4: temas de fundo data-driven por level.bgTheme (BG_THEMES.sky === SKY_LAYERS).
import { BG_THEMES } from '../data/assets'
import { CHAR_ANIMS } from '../data/charAnims'

// --- D4: animacoes de objetos (moeda/portal) — contrato D1 ---
import { OBJECT_ANIMS } from '../data/objects'

// --- C3b: tiles com arte (autotiling) + entidades novas ---
import { TILE_ATLASES } from '../data/tiles'
import { computeTileVariants, drawTile } from '../engine/tilemap'

// --- G4: progressao por level.next (registry re-parseia FRESCO) ---
import { parseLevelById } from '../data/levels'

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

// G4: morte com corpo presente — frames do subestado DYING (hit LETAL).
const DYING_FRAMES = 36
// G4: one-shot de freada (skid) ao inverter a direcao em alta velocidade.
const SKID_FRAMES = 8
// G4: mola — caixa 48x24 apoiada no chao da celula; compressao visual ~10f.
const SPRING_H = 24
const SPRING_SQUASH_FRAMES = 10
// G4: plataforma movel — 2 tiles de largura; corpo fino (one-way pelo topo).
const MOVER_W = TILE * 2
const MOVER_H = 12
const MOVER_FALLBACK_COLOR = '#0b5e75' // ciano-escuro (sem atlas)

// U4: espinho — hazard de CONTATO na metade INFERIOR da celula (sprite 48x24).
const SPIKE_H = 24
// U4 (spec §8.3, pseudo-codigo do gauntlet): Modo Humanware turbina o pulo em
// +18% — aplicado AQUI no game (p.vy *= 1.18 no frame do pulo), sem tocar
// player.ts (o jumpVelBonus do spec vira multiplicador pos-updatePlayer).
const HW_JUMP_BOOST = 1.18
// U4: lifecard — cartao dourado 24x32; colisao em caixa FIXA (pulso so visual).
const LIFECARD_W = 24
const LIFECARD_H = 32
const LIFECARD_GOLD = '#f6c945'
const HW_GAIN_LIFECARD = 500
const SCORE_LIFECARD = 5000
// U4: frase de marca da Gzero — saiu da vitoria de zona na Fase E1 e volta
// SOMENTE na vitoria SEM level.next (fim do fluxo; spec §9.7/§15).
const BRAND_PHRASE_1 = '"Você também acredita que podemos'
const BRAND_PHRASE_2 = 'mudar o mundo? Bora juntos."'

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
  initialLevel: ParsedLevel,
  store?: AssetStore,
): Game {
  // G4: level e MUTAVEL — a progressao por level.next troca a fase em jogo.
  let level: ParsedLevel = initialLevel
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
  let usedQBlocks = new Set<string>()

  // G4: mola viva — squashT anima a compressao do acionamento (~10f).
  interface SpringEnt {
    col: number
    row: number
    squashT: number
  }
  let springEnts: SpringEnt[] = []

  // G4: plataforma movel kinematica one-way — pos = origem + sin(fase)*amp;
  // dx/dy = delta do frame (player "em pe" herda; ver passo 1e do update).
  interface MoverEnt {
    originX: number
    originY: number
    axis: 'x' | 'y'
    ampPx: number
    speed: number
    x: number
    y: number
    dx: number
    dy: number
    prevOffset: number
  }
  let moverEnts: MoverEnt[] = []

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

  // U4: lifecards — caixa fixa 24x32 centrada na celula (como os heart-orbs).
  interface LifecardEnt {
    x: number
    y: number
    active: boolean
  }
  function spawnLifecards(): LifecardEnt[] {
    return (level.lifecards ?? []).map((l) => ({
      x: l.col * TILE + (TILE - LIFECARD_W) / 2,
      y: l.row * TILE + (TILE - LIFECARD_H) / 2,
      active: true,
    }))
  }

  // U4: bandeiras de checkpoint — base no CHAO da coluna (primeira celula
  // solida/platform varrendo de cima para baixo).
  interface FlagEnt {
    col: number
    baseY: number
  }
  function computeFlags(): FlagEnt[] {
    return (level.checkpoints ?? []).map((ccol) => {
      let baseY = level.heightPx
      for (let row = 0; row < level.heightTiles; row++) {
        const t = level.tiles[row]?.[ccol]
        if (t === 'ground' || t === 'brick' || t === 'block' || t === 'platform') {
          baseY = row * TILE
          break
        }
      }
      return { col: ccol, baseY }
    })
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
  // U4: lifecards + bandeiras de checkpoint + projeteis do tolo_atirador.
  let lifecardEnts: LifecardEnt[] = spawnLifecards()
  let flagEnts: FlagEnt[] = computeFlags()
  let projectiles: Projectile[] = []
  // C3b: checkpoint (px) — respawn volta aqui em vez do spawn.
  let lastCheckpointX = level.playerSpawn.x
  // C3b/D4: relogio GLOBAL de frames (anima objetos e pulso dos heart-orbs).
  // Congela no hitstop; NAO reseta no respawn; reseta ao voltar pro select.
  let clock = 0
  // G4: subestado DYING — >0 = morte em curso (player congelado, mundo segue).
  let dyingT = 0

  // G4: (re)constroi TODO o estado derivado do level atual — usado no confirm
  // do select, no resetToSelect e na progressao por level.next.
  function initLevelState(): void {
    variants = computeTileVariants(level)
    qBlockMap.clear()
    for (const qb of level.qBlocks ?? []) {
      qBlockMap.set(qb.col + ',' + qb.row, qb.payload)
    }
    usedQBlocks = new Set<string>()
    enemies = spawnEnemies(level)
    coins = level.coins.map((c) => ({ x: c.x, y: c.y, active: true }))
    heartEnts = spawnHearts()
    // U4: lifecards/bandeiras re-derivados do level; projeteis zerados.
    lifecardEnts = spawnLifecards()
    flagEnts = computeFlags()
    projectiles = []
    lastCheckpointX = level.playerSpawn.x
    springEnts = (level.springs ?? []).map((s) => ({
      col: s.col,
      row: s.row,
      squashT: 0,
    }))
    moverEnts = (level.movers ?? []).map((m) => ({
      originX: m.col * TILE,
      originY: m.row * TILE,
      axis: m.axis,
      ampPx: m.amplitude * TILE,
      speed: m.speed,
      x: m.col * TILE,
      y: m.row * TILE,
      dx: 0,
      dy: 0,
      prevOffset: 0,
    }))
    clock = 0
    dyingT = 0
  }
  initLevelState()

  // G4: avanca os movers pelo clock e deriva o delta do frame (dx/dy).
  function updateMovers(): void {
    for (const m of moverEnts) {
      const offset = Math.sin(clock * m.speed * 0.02) * m.ampPx
      const d = offset - m.prevOffset
      m.prevOffset = offset
      if (m.axis === 'x') {
        m.dx = d
        m.dy = 0
        m.x = m.originX + offset
      } else {
        m.dx = 0
        m.dy = d
        m.y = m.originY + offset
      }
    }
  }
  // E1: relogio das telas de UI (blink do title + idle do card do select).
  let uiClock = 0
  // E1: tolos stompados na rodada (painel de resultado + score).
  let stompCount = 0
  // U4: bonus de score acumulado por lifecards coletadas na rodada (+5000 cada).
  let lifecardBonus = 0
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
    time = level.timeStart ?? TIME_START
    coinCount = 0
    // G4: re-zera TODO o estado derivado do level (inclui '?', hearts,
    // checkpoint, molas, movers, clock e dyingT).
    initLevelState()
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
    lifecardBonus = 0
    resultTimer = 0
    // E1: cursor do select volta ao inicial canonico (contrato E2).
    sel.index = SELECT_START
    state.set('select')
  }

  // U4: dano CONECTADO de uma fonte em fromX (tolo, espinho ou projetil) —
  // caminho UNICO de dano (i-frames respeitados dentro do damagePlayer).
  // Retorna true se o hit foi LETAL (entrou no DYING; caller deve dar return).
  function applyHit(p: Player, fromX: number): boolean {
    const livesBefore = p.lives
    const result = damagePlayer(p, fromX)
    if (result === 'death') {
      // G4: DYING — corpo presente ~36f (fisica congelada, mundo segue);
      // o 'over' (evento + estado) so dispara quando dyingT expira.
      dyingT = DYING_FRAMES
      p.vx = 0
      p.vy = 0
      p.hurtTimer = 0 // 'hurt' cancelaria o one-shot de morte
      triggerOneShot(playerAnim, 'death', DYING_FRAMES)
      pushEvent('hurt') // o hit letal ainda soa como dano
      return true
    }
    if (result === 'hit') {
      // M2 fase B: dano que conecta congela o mundo e chacoalha a camera.
      pushEvent('hurt')
      hitstop = HITSTOP_FRAMES
      shakeT = SHAKE_FRAMES
      // C3b: respawn no ultimo checkpoint cruzado (y do spawn original).
      if (p.lives < livesBefore) {
        respawnPlayer(p, { x: lastCheckpointX, y: level.playerSpawn.y })
        // FINAL (revisão): corta a camera pro respawn (sem sweep).
        snapCamera(cam, p, level)
      }
    }
    return false
  }

  // G4: PROGRESSAO — carrega a fase `id` mantendo o MESMO personagem, sem
  // voltar pro select. O level antigo e descartado inteiro (parse fresco),
  // entao o bloco do builder nao precisa ser restaurado.
  function startNextZone(id: string): void {
    const char = player!.char
    builderWritten = null
    level = parseLevelById(id)
    initLevelState()
    player = createPlayer(char, level.playerSpawn)
    // hw NAO reseta: o medidor Humanware atravessa zonas (curriculo W1-2/W1-3).
    time = level.timeStart ?? TIME_START
    coinCount = 0
    stompCount = 0
    lifecardBonus = 0
    resultTimer = 0
    // Estado M2a/M2b zerado: pose de vitoria nao vaza pra zona nova.
    hwWasActive = false
    hitstop = 0
    shakeT = 0
    Object.assign(playerAnim, createAnimator())
    ps.particles = []
    ps.ambientAcc = 0
    events.length = 0
    snapCamera(cam, player, level)
    state.set('playing')
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
        hw = createHumanware()
        time = level.timeStart ?? TIME_START
        coinCount = 0
        // G4: rodada nova re-deriva tudo do level ('?', hearts, molas, movers).
        initLevelState()
        // E1: stats da rodada nova.
        stompCount = 0
        lifecardBonus = 0
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

      // G4: movers avancam pelo clock ANTES do player (delta do frame pronto).
      updateMovers()

      // G4: subestado DYING — player congelado (sem input/fisica), mundo segue;
      // ao expirar -> 'over'. Kill-plane/timer continuam instantaneos.
      if (dyingT > 0) {
        dyingT = Math.max(0, dyingT - dt)
        // Animator avanca o one-shot 'death' (hurtFrames=0: nao cancelar).
        updateAnimator(playerAnim, p, 0, dt)
        emitAmbient(ps, VIEW_W, VIEW_H, dt)
        updateParticles(ps, dt)
        // Inimigos seguem patrulhando (mundo vivo atras do corpo).
        const wsDying = Math.min(humanwareWorldScale(hw), 1)
        const frozen = isActive(hw)
        for (const e of enemies) {
          e.frozen = frozen
          updateEnemy(e, level, dt * wsDying)
        }
        updateHumanware(hw, dt)
        if (dyingT <= 0) {
          pushEvent('over')
          resultTimer = 0
          state.set('over')
        }
        return
      }

      // §0.6 worldScale: sempre Math.min (nunca multiplicar). Player roda em escala 1.
      const ws = Math.min(humanwareWorldScale(hw), abilityWorldScale(p), 1)

      // C3b: vy ANTES da fisica — deteccao deterministica de batida de cabeca.
      const prevVy = p.vy
      // G4: y ANTES da fisica — pouso one-way nos movers (pes cruzaram o topo).
      const prevPlayerY = p.y

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
        // U4 (§8.3): pulo TURBINADO — Modo Humanware ativo da +18% no impulso.
        if (isActive(hw)) p.vy *= HW_JUMP_BOOST
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

      // 1d) G4: MOLAS — pes do player aterrissando (vy>0) na metade superior
      // da celula da mola, com overlap horizontal real -> lanca (SPRING_VEL).
      // Tolos NAO acionam molas (so o player passa por aqui).
      for (const s of springEnts) {
        if (s.squashT > 0) s.squashT = Math.max(0, s.squashT - dt)
        const cellX = s.col * TILE
        const cellTop = s.row * TILE
        const feet = p.y + p.h
        if (
          p.vy > 0 &&
          feet >= cellTop &&
          feet <= cellTop + TILE / 2 &&
          p.x < cellX + TILE &&
          p.x + p.w > cellX
        ) {
          p.vy = SPRING_VEL
          // Mola da o quique PLENO sem segurar pulo: janela em que o jump-cut
          // nao se aplica (~ate vy chegar naturalmente a JUMP_CUT_VY: 16/0.8).
          p.noCutT = 20
          s.squashT = SPRING_SQUASH_FRAMES
          pushEvent('jump')
          emitBurst(ps, p.x + p.w / 2, feet, 8, [DUST_COLOR], 'world')
        }
      }

      // 1e) G4: PLATAFORMAS MOVEIS — one-way pelo topo + carry do delta.
      for (const m of moverEnts) {
        const top = m.y
        const topPrev = top - m.dy
        if (p.x >= m.x + MOVER_W || p.x + p.w <= m.x) continue // sem overlap X
        if (p.vy < 0) continue // one-way: subindo atravessa livre
        const feet = p.y + p.h
        const feetPrev = prevPlayerY + p.h
        // Em pe = pes grudados no topo no fim do frame ANTERIOR (snap exato).
        const wasStanding = Math.abs(feetPrev - topPrev) <= 1
        // Pouso = os pes cruzaram o topo NESTE frame, caindo.
        const crossed = feetPrev <= topPrev && feet >= top
        // Banda de tolerancia (mover descendo mais rapido que a gravidade).
        const inBand = feet >= top - 4 && feet <= top + 2
        if (!wasStanding && !crossed && !inBand) continue
        if (wasStanding) p.x += m.dx // carry: herda o delta horizontal
        p.y = top - p.h
        p.vy = 0
        p.onGround = true
      }

      // 1f) G4: SKID — correndo acima de WALK_MAX com input na direcao OPOSTA
      // ao movimento, no chao e sem one-shot ativo -> freada (8f).
      if (
        p.onGround &&
        Math.abs(p.vx) > WALK_MAX &&
        playerAnim.oneShot === null &&
        ((p.vx > 0 && input.isDown('left') && !input.isDown('right')) ||
          (p.vx < 0 && input.isDown('right') && !input.isDown('left')))
      ) {
        triggerOneShot(playerAnim, 'skid', SKID_FRAMES)
      }

      // 1g) U4: ESPINHOS — hazard de contato na metade INFERIOR da celula
      // 'spike' (sprite 48x24). damagePlayer respeita os i-frames; knockback
      // pela direcao (centro da celula como fonte); letal -> DYING.
      {
        const c0 = Math.max(0, Math.floor(p.x / TILE))
        const c1 = Math.min(level.widthTiles - 1, Math.floor((p.x + p.w) / TILE))
        const r0 = Math.max(0, Math.floor(p.y / TILE))
        const r1 = Math.min(level.heightTiles - 1, Math.floor((p.y + p.h) / TILE))
        let spiked = false
        for (let row = r0; row <= r1 && !spiked; row++) {
          for (let col = c0; col <= c1; col++) {
            if (level.tiles[row][col] !== 'spike') continue
            const sx = col * TILE
            const sy = row * TILE + TILE - SPIKE_H
            if (
              p.x < sx + TILE &&
              p.x + p.w > sx &&
              p.y < sy + SPIKE_H &&
              p.y + p.h > sy
            ) {
              if (applyHit(p, sx + TILE / 2)) return
              spiked = true // 1 tentativa por frame (i-frames cobrem o resto)
              break
            }
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

      // 5b) U4: tiros do tolo_atirador + voo dos projeteis (contrato U2).
      // O Modo Humanware CONGELA os projeteis (nao atualiza nada); fora dele
      // seguem o worldScale dos inimigos (dt*ws).
      if (!modeActive) {
        for (const e of enemies) {
          if (e.alive) updateEnemyShooting(e, dt * ws, projectiles)
        }
        for (const proj of projectiles) {
          updateProjectile(proj, level, dt * ws)
        }
      }
      // Colisao projetil x player: AABB; o projetil MORRE no contato (mesmo
      // com i-frames ativos — a ferramenta nao atravessa o corpo).
      for (const proj of projectiles) {
        if (!proj.alive) continue
        if (
          p.x < proj.x + proj.w &&
          p.x + p.w > proj.x &&
          p.y < proj.y + proj.h &&
          p.y + p.h > proj.y
        ) {
          proj.alive = false
          if (applyHit(p, proj.x + proj.w / 2)) return
        }
      }
      // Compacta a lista (projeteis mortos em solido/fora do mapa/no hit).
      if (projectiles.some((proj) => !proj.alive)) {
        projectiles = projectiles.filter((proj) => proj.alive)
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
          // U4: caminho UNICO de dano (applyHit) — mesmo fluxo do espinho e
          // do projetil (DYING no letal; hitstop/shake/respawn no 'hit').
          if (applyHit(p, e.x)) return
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

      // 7c) U4: LIFECARD — +500 no medidor, +5000 no score (lifecardBonus) e
      // burst EPICO de 24 particulas OBJETIVO+COLETAVEL; SFX 'heart'.
      for (const lc of lifecardEnts) {
        if (!lc.active) continue
        if (
          p.x < lc.x + LIFECARD_W &&
          pr > lc.x &&
          p.y < lc.y + LIFECARD_H &&
          pb > lc.y
        ) {
          lc.active = false
          addMeter(hw, HW_GAIN_LIFECARD)
          lifecardBonus += SCORE_LIFECARD
          pushEvent('heart')
          emitBurst(
            ps,
            lc.x + LIFECARD_W / 2,
            lc.y + LIFECARD_H / 2,
            24,
            [COLOR_OBJETIVO, COLOR_COLETAVEL],
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
        // G4: vitoria com level.next -> proxima zona com o MESMO personagem;
        // sem next (ou game over) -> fluxo atual (select).
        if (state.is('win') && level.next !== undefined && player) {
          startNextZone(level.next)
        } else {
          resetToSelect()
        }
      }
      return
    }

    // Qualquer outro estado: nada a fazer (edges consumidos em update()).
  }

  function render(_alpha: number): void {
    renderer.clear(COLOR_BG)

    // E1: TITLE — wordmark + particulas ambiente em screen space; SEM HUD.
    if (state.is('title')) {
      const ctx = renderer.ctx
      // U4: arte curada do title (bg.title 960x528) atras do wordmark, com
      // veu escuro alpha 0.25 por cima para manter a legibilidade do texto.
      const bgTitle = store ? store.get('bg.title') : null
      if (bgTitle) {
        renderer.drawSprite(
          bgTitle.src,
          0,
          0,
          bgTitle.w,
          bgTitle.h,
          0,
          0,
          VIEW_W,
          VIEW_H,
        )
        ctx.save()
        ctx.globalAlpha = 0.25
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, VIEW_W, VIEW_H)
        ctx.restore()
      }
      drawParticles(renderer, ps)
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const tcx = VIEW_W / 2
      // Wordmark em Press Start 2P (2 linhas) com sombra magenta da marca.
      ctx.font = '44px "Press Start 2P", "Pixelify Sans", monospace'
      const wordmark = (t: string, y: number): void => {
        ctx.fillStyle = COLOR_OBJETIVO
        ctx.fillText(t, tcx + 4, y + 4)
        ctx.fillStyle = COLOR_TEXT
        ctx.fillText(t, tcx, y)
      }
      wordmark('GRAVIDADE', VIEW_H / 2 - 66)
      wordmark('ZERO', VIEW_H / 2 - 10)
      ctx.font = '15px "Press Start 2P", "Pixelify Sans", monospace'
      ctx.fillStyle = COLOR_OBJETIVO
      ctx.fillText('O  J O G O', tcx, VIEW_H / 2 + 36)
      // Pisca: visivel quando (floor(uiClock/30)&1)===0.
      if ((Math.floor(uiClock / 30) & 1) === 0) {
        ctx.font = 'bold 20px "Pixelify Sans", monospace'
        ctx.fillStyle = COLOR_LIME
        ctx.fillText('PRESS ENTER', tcx, VIEW_H / 2 + 96)
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

    // M2a: parallax em SCREEN SPACE, por cima do COLOR_BG, antes do mundo.
    // U4: camadas do TEMA do level (BG_THEMES[level.bgTheme]; default 'sky' —
    // mesma referencia do SKY_LAYERS legado). store pode ser undefined.
    if (store) drawParallax(renderer, BG_THEMES[level.bgTheme ?? 'sky'], store, cam)

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

    // U4: DECOR data-driven (props 'prop.arvore'/'prop.cristal') ATRAS dos
    // tiles — base no chao da celula, centrado na coluna; sem colisao.
    if (store) {
      for (const d of level.decor ?? []) {
        const img = store.get(d.key)
        if (!img) continue
        renderer.drawSprite(
          img.src,
          0,
          0,
          img.w,
          img.h,
          d.col * TILE + TILE / 2 - img.w / 2,
          (d.row + 1) * TILE - img.h,
          img.w,
          img.h,
        )
      }
    }

    // Tiles visiveis.
    const startCol = Math.max(0, Math.floor(cam.x / TILE))
    const endCol = Math.min(level.widthTiles - 1, Math.ceil((cam.x + VIEW_W) / TILE))
    const startRow = Math.max(0, Math.floor(cam.y / TILE))
    const endRow = Math.min(level.heightTiles - 1, Math.ceil((cam.y + VIEW_H) / TILE))
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const t = level.tiles[row][col]
        if (t === 'empty') continue
        // U4: ESPINHO — sprite 48x24 apoiado na metade de BAIXO da celula;
        // fallback = 3 triangulos em COLOR_PERIGO. Nao passa pelo atlas.
        if (t === 'spike') {
          const spikeImg = store ? store.get('tile.spike') : null
          const spikeY = row * TILE + TILE - SPIKE_H
          if (spikeImg) {
            renderer.drawSprite(
              spikeImg.src,
              0,
              0,
              spikeImg.w,
              spikeImg.h,
              col * TILE,
              spikeY,
              TILE,
              SPIKE_H,
            )
          } else {
            const ctx = renderer.ctx
            ctx.save()
            ctx.fillStyle = COLOR_PERIGO
            ctx.beginPath()
            for (let i = 0; i < 3; i++) {
              const bx = col * TILE + i * 16
              ctx.moveTo(bx, row * TILE + TILE)
              ctx.lineTo(bx + 8, spikeY)
              ctx.lineTo(bx + 16, row * TILE + TILE)
            }
            ctx.fill()
            ctx.restore()
          }
          continue
        }
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
            ctx.font = 'bold 20px "Pixelify Sans", monospace'
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

    // G4: MOLAS — caixa 48x24 apoiada no chao da celula; corpo COLOR_TECH com
    // topo claro; squash senoidal leve pelo clock + compressao no acionamento.
    for (const s of springEnts) {
      const x = s.col * TILE
      const baseY = (s.row + 1) * TILE
      const wob = Math.sin(clock * 0.15) * 1.5
      const press = s.squashT > 0 ? (s.squashT / SPRING_SQUASH_FRAMES) * 9 : 0
      const h = Math.max(8, SPRING_H - press + wob)
      renderer.drawRect(x, baseY - h, TILE, h, COLOR_TECH)
      renderer.drawRect(x, baseY - h, TILE, 4, COLOR_TEXT)
    }

    // G4: PLATAFORMAS MOVEIS — 2 celulas do atlas terra variant 14 lado a lado
    // (drawTile nao serve: a celula esta fora do grid); fallback rect ciano-escuro.
    const terraSet = TILE_ATLASES.ground
    const terraImg = store && terraSet ? store.get(terraSet.assetKey) : null
    for (const m of moverEnts) {
      if (terraImg && terraSet) {
        const cell = terraSet.cells[14]
        const sx = cell[0] * terraSet.tile
        const sy = cell[1] * terraSet.tile
        renderer.drawSprite(
          terraImg.src, sx, sy, terraSet.tile, terraSet.tile,
          m.x, m.y, TILE, TILE,
        )
        renderer.drawSprite(
          terraImg.src, sx, sy, terraSet.tile, terraSet.tile,
          m.x + TILE, m.y, TILE, TILE,
        )
      } else {
        renderer.drawRect(m.x, m.y, MOVER_W, MOVER_H, MOVER_FALLBACK_COLOR)
      }
    }

    // U4: BANDEIRAS de checkpoint — flag 48x96 (2 frames @3fps pelo clock)
    // com base no chao da coluna; fallback mastro+bandeirola. Checkpoint JA
    // CRUZADO (lastCheckpointX avancou ate ele) ganha tint magenta alpha 0.3.
    const flagAnim = OBJECT_ANIMS.flag
    const flagSheet = store ? store.get(flagAnim.key) : null
    for (const f of flagEnts) {
      const fx = f.col * TILE
      const fy = f.baseY - flagAnim.drawH
      if (flagSheet) {
        const fIdx = frameIndex(flagAnim, clock)
        renderer.drawSprite(
          flagSheet.src,
          fIdx * flagAnim.cellW,
          0,
          flagAnim.cellW,
          flagAnim.cellH,
          fx,
          fy,
          flagAnim.drawW,
          flagAnim.drawH,
        )
      } else {
        renderer.drawRect(fx + 22, fy, 4, flagAnim.drawH, COLOR_TEXT)
        renderer.drawRect(fx + 26, fy + 10, 18, 12, COLOR_TECH)
      }
      if (fx <= lastCheckpointX && fx > level.playerSpawn.x) {
        const ctx = renderer.ctx
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.fillStyle = COLOR_OBJETIVO
        ctx.fillRect(fx, fy, flagAnim.drawW, flagAnim.drawH)
        ctx.restore()
      }
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

    // U4: LIFECARDS — cartao dourado 24x32 pulsando com brilho (clock).
    for (const lc of lifecardEnts) {
      if (!lc.active) continue
      const ctx = renderer.ctx
      const pulse = Math.sin(clock * 0.1) * 2
      const lw = LIFECARD_W + pulse
      const lh = LIFECARD_H + pulse
      const lcx = lc.x + LIFECARD_W / 2
      const lcy = lc.y + LIFECARD_H / 2
      ctx.save()
      ctx.fillStyle = LIFECARD_GOLD
      ctx.globalAlpha = 0.25 // brilho externo
      ctx.fillRect(lcx - lw / 2 - 4, lcy - lh / 2 - 4, lw + 8, lh + 8)
      ctx.globalAlpha = 1
      ctx.fillRect(lcx - lw / 2, lcy - lh / 2, lw, lh) // corpo do cartao
      ctx.fillStyle = COLOR_BG
      ctx.fillRect(lcx - lw / 2 + 3, lcy - lh / 2 + 3, lw - 6, lh - 6) // moldura
      ctx.fillStyle = LIFECARD_GOLD
      ctx.fillRect(lcx - 4, lcy - 6, 8, 12) // "retrato" central
      ctx.restore()
    }

    // Inimigos (D3: sheet do Tolo animado pelo clock global; fallback rects).
    for (const e of enemies) {
      if (!e.alive) continue
      drawEnemy(renderer, e, store, clock)
    }

    // U4: PROJETEIS — "ferramenta" 12x12 em COLOR_PERIGO girando pelo clock.
    for (const proj of projectiles) {
      if (!proj.alive) continue
      const ctx = renderer.ctx
      ctx.save()
      ctx.translate(proj.x + proj.w / 2, proj.y + proj.h / 2)
      ctx.rotate(clock * 0.3)
      ctx.fillStyle = COLOR_PERIGO
      ctx.fillRect(-proj.w / 2, -proj.h / 2, proj.w, proj.h)
      // "boca" da chave: entalhe escuro no topo.
      ctx.fillStyle = COLOR_INK
      ctx.fillRect(-2, -proj.h / 2, 4, 5)
      ctx.restore()
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
      // G4: durante o DYING o alpha cai 1.0 -> 0.4 (sem pisca de i-frames).
      const ctx = renderer.ctx
      const dying = dyingT > 0
      const dimmed =
        !dying && player.iframes > 0 && ((player.iframes >> 2) & 1) === 1
      if (dimmed) {
        ctx.save()
        ctx.globalAlpha = 0.45
      } else if (dying) {
        ctx.save()
        ctx.globalAlpha = 0.4 + 0.6 * (dyingT / DYING_FRAMES)
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

      if (dimmed || dying) ctx.restore()
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
      ctx.font = 'bold 32px "Pixelify Sans", monospace'
      ctx.fillStyle = COLOR_TEXT
      ctx.fillText('PAUSA', VIEW_W / 2, VIEW_H / 2 - 116)
      ctx.font = 'bold 16px "Pixelify Sans", monospace'
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

    // E1: painel de RESULTADO (win/over). A frase de marca SAIU da vitoria de
    // zona comum — U4: ela volta APENAS na vitoria sem level.next (fim do
    // fluxo; spec §9.7, Consciencia Unificada).
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
      ctx.font = 'bold 32px "Pixelify Sans", monospace'
      ctx.fillStyle = accent
      ctx.fillText(won ? 'ZONA CONCLUÍDA' : 'GAME OVER', VIEW_W / 2, py + 52)

      // Stats + SCORE canonico (moeda 100 · stomp 200 · fase 1000 · 50/s).
      // U4: lifecardBonus (+5000 por lifecard) entra no score dos dois paineis.
      const timeLeft = Math.ceil(time)
      const baseScore =
        coinCount * SCORE_COIN + stompCount * SCORE_STOMP + lifecardBonus
      const lines = won
        ? [
            `MOEDAS x${coinCount}`,
            `TOLOS x${stompCount}`,
            `TEMPO RESTANTE ${timeLeft}s`,
            `SCORE ${baseScore + SCORE_GOAL + timeLeft * SCORE_TIME_PER_SEC}`,
          ]
        : [`MOEDAS x${coinCount}`, `SCORE ${baseScore}`]
      ctx.font = 'bold 16px "Pixelify Sans", monospace'
      ctx.fillStyle = COLOR_TEXT
      let ly = py + 116
      for (const line of lines) {
        ctx.fillText(line, VIEW_W / 2, ly)
        ly += 32
      }

      // U4: vitoria SEM next = fim do fluxo — frase de marca da Gzero
      // (reservada na Fase E1 para o final; spec §9.7/§15).
      if (won && level.next === undefined) {
        ctx.font = 'italic bold 15px "Pixelify Sans", monospace'
        ctx.fillStyle = COLOR_OBJETIVO
        ctx.fillText(BRAND_PHRASE_1, VIEW_W / 2, py + ph - 88)
        ctx.fillText(BRAND_PHRASE_2, VIEW_W / 2, py + ph - 66)
      }

      // Enter so APARECE (e so funciona, ver update) apos o delay anti-skip.
      // G4: com level.next na vitoria, o rodape anuncia a PROXIMA ZONA.
      if (resultTimer >= RESULT_DELAY_FRAMES) {
        ctx.font = 'bold 14px "Pixelify Sans", monospace'
        ctx.fillStyle = COLOR_LIME
        ctx.fillText(
          won && level.next !== undefined
            ? 'ENTER PARA PRÓXIMA ZONA'
            : 'ENTER PARA CONTINUAR',
          VIEW_W / 2,
          py + ph - 36,
        )
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
