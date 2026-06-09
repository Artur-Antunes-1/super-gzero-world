// src/engine/animator.ts
// Logica PURA de animacao procedural (abordagem D do M2a): classifica o estado a
// partir do corpo + i-frames e produz transforms deterministicas por estado/tempo.
// SEM render aqui — spriteDraw.ts consome getTransform; game.ts chama updateAnimator.
import { WALK_MAX } from './constants'
import type { Body } from './physics'

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'hurt'

export interface Animator {
  state: AnimState
  // t = frames acumulados no estado atual (a base temporal da "fluidez")
  t: number
}

export function createAnimator(): Animator {
  return { state: 'idle', t: 0 }
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

// s=classifyAnim(...); se mudou o estado, zera t; senao acumula dt.
export function updateAnimator(
  an: Animator,
  body: AnimBody,
  iframes: number,
  dt: number,
): void {
  const s = classifyAnim(body, iframes)
  if (s !== an.state) {
    an.state = s
    an.t = 0
  } else {
    an.t += dt
  }
}

export interface SpriteTransform {
  scaleX: number
  scaleY: number
  rotation: number
  offsetY: number
}

// Transforms deterministicos por estado/t (a "fluidez").
// O param body nao e usado pelos transforms do contrato (eles dependem so de
// state/t); prefixado com _ para satisfazer noUnusedParameters mantendo a
// assinatura publica getTransform(an, body) do contrato.
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
    case 'hurt':
      // flat: (1,1,0,0) — o pisca dos i-frames fica no draw, nao aqui
      return { scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 }
  }
}
