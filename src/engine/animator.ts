// src/engine/animator.ts
// Logica PURA de animacao: classifica o estado a partir do corpo, gerencia
// one-shots por evento (land/skid/cast/victory) e produz transforms
// deterministicos POR CIMA dos frames (contrato 2026-06-09).
// SEM render aqui — spriteDraw/spriteAnim consomem; game.ts chama updateAnimator.
import { WALK_MAX } from './constants'
import type { Body } from './physics'

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'hurt'
  | 'land'
  | 'skid'
  | 'cast'
  | 'victory'

export interface Animator {
  state: AnimState
  // t = frames acumulados no estado atual (a base temporal da "fluidez")
  t: number
  // One-shot ativo (prioridade sobre os continuos enquanto oneShotT<oneShotDur)
  oneShot: AnimState | null
  // frames acumulados dentro do one-shot
  oneShotT: number
  // duracao total do one-shot (frames)
  oneShotDur: number
  // onGround do frame anterior — detecta a borda de pouso (landed)
  prevOnGround: boolean
}

export function createAnimator(): Animator {
  return {
    state: 'idle',
    t: 0,
    oneShot: null,
    oneShotT: 0,
    oneShotDur: 0,
    prevOnGround: true,
  }
}

// Dispara um one-shot por evento (ex.: 'cast' ao usar habilidade).
export function triggerOneShot(an: Animator, state: AnimState, durFrames: number): void {
  an.oneShot = state
  an.oneShotT = 0
  an.oneShotDur = durFrames
}

// Subconjunto estrutural de Body suficiente para classificar/transformar.
// Aceita qualquer Body (e portanto Player, que extends Body).
type AnimBody = Pick<Body, 'vx' | 'vy' | 'onGround'>

// Regras do contrato (ordem de prioridade importa):
//  iframes>0 -> 'hurt'
//  !onGround && vy<0 -> 'jump'
//  !onGround && vy>=0 -> 'fall'
//  |vx| > WALK_MAX+0.3 -> 'run'
//  |vx| > 0.3 -> 'walk'
//  senao -> 'idle'
export function classifyAnim(body: AnimBody, iframes: number): AnimState {
  if (iframes > 0) return 'hurt'
  if (!body.onGround) return body.vy < 0 ? 'jump' : 'fall'
  const speed = Math.abs(body.vx)
  if (speed > WALK_MAX + 0.3) return 'run'
  if (speed > 0.3) return 'walk'
  return 'idle'
}

// One-shot ativo = setado e ainda dentro da duracao.
function oneShotActive(an: Animator): boolean {
  return an.oneShot !== null && an.oneShotT < an.oneShotDur
}

/**
 * Avanca o animator 1 passo. Prioridade: hurt > one-shot > classifyAnim.
 * `hurtFrames` (RENOMEADO de iframes): >0 -> estado 'hurt' (separado dos
 * i-frames de invulnerabilidade). Retorna o evento de pouso para o game
 * (poeira/SFX/squash).
 */
export function updateAnimator(
  an: Animator,
  body: AnimBody,
  hurtFrames: number,
  dt: number,
): { landed: boolean } {
  // Borda de pouso: estava no ar e agora toca o chao.
  const landed = !an.prevOnGround && body.onGround
  an.prevOnGround = body.onGround

  // Pouso auto-dispara 'land' (10 = LAND_FRAMES em constants.ts; literal aqui
  // pois constants.ts tem outro dono nesta frente).
  if (landed && !oneShotActive(an) && hurtFrames <= 0) {
    triggerOneShot(an, 'land', 10)
  }

  let s: AnimState
  if (hurtFrames > 0) {
    // hurt cancela qualquer one-shot em andamento
    an.oneShot = null
    s = 'hurt'
  } else if (oneShotActive(an)) {
    s = an.oneShot as AnimState
    an.oneShotT += dt
  } else {
    if (an.oneShot !== null) an.oneShot = null // one-shot expirou
    // hurt agora vem do parametro, nao de iframes -> classifica sem hurt
    s = classifyAnim(body, 0)
  }

  // t acumula no estado; zera na troca (mesma regra de sempre).
  if (s !== an.state) {
    an.state = s
    an.t = 0
  } else {
    an.t += dt
  }
  return { landed }
}

export interface SpriteTransform {
  scaleX: number
  scaleY: number
  rotation: number
  offsetY: number
}

const IDENTITY_TF: SpriteTransform = { scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 }

// sign sem depender de Math.sign retornar -0 (queremos so -1|0|1)
function sgn(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0
}

/**
 * Transform SUTIL por estado, aplicado POR CIMA do frame-a-frame (os frames
 * carregam a arte; isto so da vida). 100% deterministico em an.t/oneShotT.
 */
export function getFrameTransform(an: Animator, body: AnimBody): SpriteTransform {
  const t = an.t
  switch (an.state) {
    case 'idle': {
      // respiracao: scaleY 1 +/- 0.015 senoidal
      return { scaleX: 1, scaleY: 1 + Math.sin(t * 0.06) * 0.015, rotation: 0, offsetY: 0 }
    }
    case 'walk': {
      // lean na direcao do movimento + bob de 1px
      return {
        scaleX: 1,
        scaleY: 1,
        rotation: sgn(body.vx) * 0.04,
        offsetY: -Math.abs(Math.sin(t * 0.18)),
      }
    }
    case 'run': {
      // mesmo lean/bob do walk, bob um pouco mais rapido
      return {
        scaleX: 1,
        scaleY: 1,
        rotation: sgn(body.vx) * 0.04,
        offsetY: -Math.abs(Math.sin(t * 0.25)),
      }
    }
    case 'jump':
      // stretch leve subindo
      return { scaleX: 0.97, scaleY: 1.04, rotation: 0, offsetY: 0 }
    case 'fall':
      // stretch um pouco maior caindo
      return { scaleX: 0.96, scaleY: 1.06, rotation: 0, offsetY: 0 }
    case 'land': {
      // squash 0.86/1.12 -> identidade, interpolado pelo progresso do one-shot
      const k = an.oneShotDur > 0 ? Math.min(1, Math.max(0, an.oneShotT / an.oneShotDur)) : 1
      return {
        scaleX: 1.12 + (1 - 1.12) * k,
        scaleY: 0.86 + (1 - 0.86) * k,
        rotation: 0,
        offsetY: 0,
      }
    }
    case 'skid':
      // inclina CONTRA a direcao do movimento (freada)
      return { scaleX: 1, scaleY: 1, rotation: -0.08 * sgn(body.vx), offsetY: 0 }
    case 'cast':
      // alongamento horizontal breve durante o cast
      return { scaleX: 1.05, scaleY: 1, rotation: 0, offsetY: 0 }
    case 'hurt':
    case 'victory':
      // identidade: o pisca dos i-frames/pose de vitoria ficam no draw
      return { ...IDENTITY_TF }
  }
}

// Transforms ANTIGOS do M2a (procedural puro, sem frames) — spriteDraw.ts ainda
// consome como fallback quando nao ha sheets. Mais exagerados que os do
// getFrameTransform porque aqui o transform e a unica fonte de movimento.
export function getTransform(an: Animator, _body: AnimBody): SpriteTransform {
  const t = an.t
  switch (an.state) {
    case 'idle': {
      // respiracao: scaleY 1+sin(t*0.06)*0.03, scaleX inverso, offsetY=sin(t*0.06)*2
      const b = Math.sin(t * 0.06)
      return {
        scaleX: 1 - b * 0.02,
        scaleY: 1 + b * 0.03,
        rotation: 0,
        offsetY: b * 2,
      }
    }
    case 'walk': {
      // bob: offsetY=-abs(sin(t*0.18))*3, scaleX 1+sin*0.04, rotation sin*0.04
      const p = t * 0.18
      const s = Math.sin(p)
      return {
        scaleX: 1 + s * 0.04,
        scaleY: 1,
        rotation: s * 0.04,
        offsetY: -Math.abs(s) * 3,
      }
    }
    case 'run': {
      // bob/lean mais fortes + rotation sin(t*0.28)*0.06
      const s = Math.sin(t * 0.18)
      return {
        scaleX: 1.04 + s * 0.05,
        scaleY: 1,
        rotation: Math.sin(t * 0.28) * 0.06,
        offsetY: -Math.abs(s) * 5,
      }
    }
    case 'jump':
      // stretch: scaleY 1.15, scaleX 0.9
      return { scaleX: 0.9, scaleY: 1.15, rotation: 0, offsetY: 0 }
    case 'fall':
      // squash leve: scaleY 1.08, scaleX 0.96
      return { scaleX: 0.96, scaleY: 1.08, rotation: 0, offsetY: 0 }
    default:
      // hurt + estados novos (land/skid/cast/victory): identidade no procedural
      return { ...IDENTITY_TF }
  }
}
