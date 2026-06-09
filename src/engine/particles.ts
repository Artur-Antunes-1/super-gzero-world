// src/engine/particles.ts
// Sistema de particulas do M2a (DONO).
// - emitAmbient: poeira de gravidade-zero, sobe devagar, rate-limited + cap.
// - emitBurst: explosao radial (Humanware / FX de habilidade).
// - updateParticles: integracao pura (x+=vx*dt, y+=vy*dt), life-=dt, remove mortas.
// - drawParticles: desenha cada particula via r.drawRect; alpha = life/maxLife
//   atraves de r.ctx.globalAlpha (restaurado para 1 no fim).
import type { Renderer } from './render'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

// E2: ambientAcc e opcional para que literais { particles: [] } ainda compilem.
export interface ParticleSystem {
  particles: Particle[]
  // Contador interno de frames para rate-limit da poeira ambiente (E2: opcional).
  ambientAcc?: number
}

// Limites/ritmo da poeira ambiente.
const AMBIENT_CAP = 60 // maximo de particulas de poeira simultaneas
const AMBIENT_EVERY = 6 // emite ~1 poeira a cada 6 unidades de dt acumuladas
const AMBIENT_COLOR = '#f7f3f6' // poeira clara discreta

export function createParticles(): ParticleSystem {
  return { particles: [], ambientAcc: 0 }
}

export function emitAmbient(ps: ParticleSystem, w: number, h: number, dt: number): void {
  // Rate-limit por acumulo de dt: so emite ao cruzar o limiar.
  const acc = (ps.ambientAcc ?? 0) + dt
  ps.ambientAcc = acc
  if (acc < AMBIENT_EVERY) return
  ps.ambientAcc = acc - AMBIENT_EVERY

  // Respeita o cap: nao emite se ja estiver no limite.
  if (ps.particles.length >= AMBIENT_CAP) return

  const maxLife = 180 + Math.random() * 120 // ~3-5s a 60fps
  ps.particles.push({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.15, // deriva horizontal minima
    vy: -(0.12 + Math.random() * 0.25), // sobe devagar (gravidade-zero)
    life: maxLife,
    maxLife,
    color: AMBIENT_COLOR,
    size: 1 + Math.floor(Math.random() * 2), // 1-2 px
  })
}

export function emitBurst(
  ps: ParticleSystem,
  x: number,
  y: number,
  n: number,
  colors: string[],
): void {
  const palette = colors.length > 0 ? colors : ['#ffffff']
  for (let i = 0; i < n; i++) {
    // Distribui radialmente ao redor do circulo, com leve jitter.
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3
    const speed = 1.8 + Math.random() * 2.2
    const maxLife = 22 + Math.random() * 16
    ps.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      color: palette[i % palette.length],
      size: 2 + Math.floor(Math.random() * 3), // 2-4 px
    })
  }
}

export function updateParticles(ps: ParticleSystem, dt: number): void {
  const out: Particle[] = []
  for (const p of ps.particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    if (p.life > 0) out.push(p)
  }
  ps.particles = out
}

export function drawParticles(r: Renderer, ps: ParticleSystem): void {
  const ctx = r.ctx
  for (const p of ps.particles) {
    const a = p.maxLife > 0 ? p.life / p.maxLife : 0
    ctx.globalAlpha = Math.max(0, Math.min(1, a))
    // Centra o quadradinho na posicao da particula.
    const half = p.size / 2
    r.drawRect(p.x - half, p.y - half, p.size, p.size, p.color)
  }
  // Restaura para nao vazar alpha para o resto do frame.
  ctx.globalAlpha = 1
}
