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
export const JUMP_VEL = -15.4
export const COYOTE_FRAMES = 7
export const JUMP_BUFFER_FRAMES = 8

// Combate / movimento (alguns usados so a partir do M1)
export const STOMP_BOUNCE = -11.5
export const ENEMY_SPEED = 1.25

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
