// Tamanho do tile (px) e viewport interno do canvas
export const TILE = 48
export const VIEW_W = 960
export const VIEW_H = 528

// Timestep fixo do loop
export const FIXED_DT = 1 / 60
export const MAX_SUBSTEPS = 5

// Fisica
export const GRAVITY = 0.8
export const MAX_FALL = 17
export const WALK_ACCEL = 0.7
export const RUN_ACCEL = 0.95
export const WALK_MAX = 4.6
export const RUN_MAX = 7.3
export const GROUND_DECEL = 0.6
export const AIR_DECEL = 0.18
// Errata de fisica (2026-06-11, playtest): -15.4 (apex 148px) tornava o level
// design do §8.3 inalcancavel. -18.0 => apex continuo ~202px (4,2 tiles).
export const JUMP_VEL = -18.0
// Jump-cut (pulo variavel): soltar o pulo na subida corta vy para este valor.
export const JUMP_CUT_VY = -6
// Mola ('^' na legenda): impulso vertical ~6 tiles.
export const SPRING_VEL = -22
export const COYOTE_FRAMES = 7
export const JUMP_BUFFER_FRAMES = 8

// Combate / movimento (alguns usados so a partir do M1)
export const STOMP_BOUNCE = -11.5
export const ENEMY_SPEED = 1.25
export const IFRAME_FRAMES = 90
export const KNOCKBACK_VX = 4.5
export const KNOCKBACK_VY = -8

// FX de combate / animacao (M2 fase B) — duracoes em FRAMES
export const HURT_FRAMES = 24 // estado visual 'hurt' (separado dos i-frames de 90f)
export const LAND_FRAMES = 10 // one-shot de pouso
export const CAST_FRAMES = 18 // one-shot de uso de habilidade
export const HITSTOP_FRAMES = 3 // mundo congelado ao tomar dano
export const SHAKE_FRAMES = 8 // duracao do screen-shake
export const SHAKE_PX = 3 // amplitude do shake (px)

// Dimensoes de entidades
export const PLAYER_W = 34
export const PLAYER_H = 42
export const COIN_SIZE = 26

// Sessao / progressao
export const TIME_START = 250
export const START_LIVES = 3

// Humanware (declarados agora, usados no M1)
export const HW_TIME_SCALE = 0.35
export const HW_METER_MAX = 1000

// Paleta (strings hex)
export const COLOR_BG = '#09090b'
export const COLOR_SURFACE = '#121216'
export const COLOR_INK = '#050505'
export const COLOR_MAGENTA = '#ff0055'
export const COLOR_MAGENTA2 = '#e802cf'
export const COLOR_BLUE = '#0099ff'
export const COLOR_LIME = '#cdf140'
export const COLOR_VIOLET = '#7112ff'
export const COLOR_TEXT = '#f7f3f6'

// Tokens SEMANTICOS de cor (Fase D) — a arte nova segue estes aliases.
export const COLOR_OBJETIVO = COLOR_MAGENTA // marca / objetivo / destaque
export const COLOR_TECH = COLOR_BLUE // habilidades / builder / Humanware (ciano)
export const COLOR_PERIGO = COLOR_VIOLET // inimigos / dano
export const COLOR_COLETAVEL = COLOR_LIME // exclusivo de coletaveis
