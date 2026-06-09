// tests/unit/particles.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createParticles,
  emitAmbient,
  emitBurst,
  updateParticles,
  drawParticles,
  type ParticleSystem,
  type Particle,
} from '../../src/engine/particles'
import type { Renderer } from '../../src/engine/render'
import { COLOR_MAGENTA, COLOR_LIME } from '../../src/engine/constants'

describe('createParticles', () => {
  it('comeca com lista de particulas vazia', () => {
    const ps = createParticles()
    expect(ps.particles).toEqual([])
  })

  it('inicializa ambientAcc como 0', () => {
    const ps = createParticles()
    expect(ps.ambientAcc).toBe(0)
  })
})

describe('emitBurst', () => {
  it('adiciona exatamente n particulas', () => {
    const ps = createParticles()
    emitBurst(ps, 100, 50, 24, [COLOR_MAGENTA, COLOR_LIME])
    expect(ps.particles.length).toBe(24)
  })

  it('todas nascem na origem (x,y) dada', () => {
    const ps = createParticles()
    emitBurst(ps, 100, 50, 8, [COLOR_MAGENTA])
    for (const p of ps.particles) {
      expect(p.x).toBe(100)
      expect(p.y).toBe(50)
    }
  })

  it('usa apenas cores da paleta passada e produz velocidades radiais finitas', () => {
    const ps = createParticles()
    const colors = [COLOR_MAGENTA, COLOR_LIME]
    emitBurst(ps, 0, 0, 16, colors)
    for (const p of ps.particles) {
      expect(colors).toContain(p.color)
      expect(Number.isFinite(p.vx)).toBe(true)
      expect(Number.isFinite(p.vy)).toBe(true)
      expect(p.maxLife).toBeGreaterThan(0)
      expect(p.life).toBe(p.maxLife)
      expect(p.size).toBeGreaterThan(0)
    }
    // radial: pelo menos uma com vx>0 e uma com vx<0 (n=16 cobre o circulo)
    expect(ps.particles.some((p) => p.vx > 0)).toBe(true)
    expect(ps.particles.some((p) => p.vx < 0)).toBe(true)
  })

  it('emitBurst com cores vazias e seguro (fallback de cor), ainda adiciona n', () => {
    const ps = createParticles()
    emitBurst(ps, 0, 0, 5, [])
    expect(ps.particles.length).toBe(5)
    for (const p of ps.particles) expect(typeof p.color).toBe('string')
  })
})

describe('updateParticles', () => {
  it('integra posicao: x+=vx*dt, y+=vy*dt', () => {
    const ps = createParticles()
    ps.particles.push({ x: 10, y: 20, vx: 4, vy: -2, life: 60, maxLife: 60, color: '#fff', size: 3 })
    updateParticles(ps, 1)
    expect(ps.particles[0].x).toBeCloseTo(14, 5)
    expect(ps.particles[0].y).toBeCloseTo(18, 5)
  })

  it('escala o passo por dt (dt=0.5 move metade)', () => {
    const ps = createParticles()
    ps.particles.push({ x: 0, y: 0, vx: 10, vy: 10, life: 60, maxLife: 60, color: '#fff', size: 3 })
    updateParticles(ps, 0.5)
    expect(ps.particles[0].x).toBeCloseTo(5, 5)
    expect(ps.particles[0].y).toBeCloseTo(5, 5)
  })

  it('decrementa life em dt', () => {
    const ps = createParticles()
    ps.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 10, maxLife: 10, color: '#fff', size: 3 })
    updateParticles(ps, 3)
    expect(ps.particles[0].life).toBeCloseTo(7, 5)
  })

  it('remove particulas com life<=0', () => {
    const ps = createParticles()
    ps.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 2, maxLife: 10, color: '#fff', size: 3 })
    ps.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 9, maxLife: 10, color: '#fff', size: 3 })
    updateParticles(ps, 2) // primeira chega a 0 -> removida; segunda fica em 7
    expect(ps.particles.length).toBe(1)
    expect(ps.particles[0].life).toBeCloseTo(7, 5)
  })

  it('com lista vazia nao lanca', () => {
    const ps = createParticles()
    expect(() => updateParticles(ps, 1)).not.toThrow()
    expect(ps.particles.length).toBe(0)
  })
})

describe('emitAmbient', () => {
  it('e rate-limited: 1 chamada nao adiciona mais de 1 particula', () => {
    const ps = createParticles()
    emitAmbient(ps, 960, 528, 1)
    expect(ps.particles.length).toBeLessThanOrEqual(1)
  })

  it('ao longo de muitas chamadas chega a emitir poeira (lista cresce)', () => {
    const ps = createParticles()
    for (let i = 0; i < 40; i++) emitAmbient(ps, 960, 528, 1)
    expect(ps.particles.length).toBeGreaterThan(0)
  })

  it('respeita o cap (~60): nunca passa de 60 mesmo apos muitas chamadas', () => {
    const ps = createParticles()
    for (let i = 0; i < 5000; i++) emitAmbient(ps, 960, 528, 1)
    expect(ps.particles.length).toBeLessThanOrEqual(60)
  })

  it('poeira nasce dentro da area e sobe (vy<=0)', () => {
    const ps = createParticles()
    for (let i = 0; i < 5000; i++) emitAmbient(ps, 960, 528, 1)
    expect(ps.particles.length).toBeGreaterThan(0)
    for (const p of ps.particles) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(960)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(528)
      expect(p.vy).toBeLessThanOrEqual(0) // gravidade-zero: sobe devagar
      expect(p.maxLife).toBeGreaterThan(0)
    }
  })
})

function makeCtxStub() {
  return { globalAlpha: 1 as number }
}
function makeRenderer(ctx: ReturnType<typeof makeCtxStub>): Renderer {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    clear: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    drawRect: vi.fn(),
    present: vi.fn(),
  }
}

describe('drawParticles', () => {
  let ctx: ReturnType<typeof makeCtxStub>
  let r: Renderer
  beforeEach(() => {
    ctx = makeCtxStub()
    r = makeRenderer(ctx)
  })

  it('desenha um drawRect por particula', () => {
    const ps = createParticles()
    emitBurst(ps, 50, 50, 7, [COLOR_MAGENTA])
    drawParticles(r, ps)
    expect((r.drawRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(7)
  })

  it('lista vazia: nenhum drawRect', () => {
    const ps = createParticles()
    drawParticles(r, ps)
    expect((r.drawRect as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('restaura globalAlpha para 1 ao terminar', () => {
    const ps = createParticles()
    ps.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 5, maxLife: 10, color: COLOR_LIME, size: 3 })
    drawParticles(r, ps)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('passa a cor da particula como 5o argumento de drawRect', () => {
    const ps = createParticles()
    ps.particles.push({ x: 12, y: 34, vx: 0, vy: 0, life: 5, maxLife: 10, color: COLOR_MAGENTA, size: 4 })
    drawParticles(r, ps)
    const call = (r.drawRect as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[4]).toBe(COLOR_MAGENTA)
  })

  it('ajusta globalAlpha = life/maxLife durante o desenho de cada particula', () => {
    const ps = createParticles()
    ps.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 5, maxLife: 10, color: COLOR_LIME, size: 3 })
    const seen: number[] = []
    ;(r.drawRect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      seen.push(ctx.globalAlpha)
    })
    drawParticles(r, ps)
    expect(seen[0]).toBeCloseTo(0.5, 5) // 5/10
    expect(ctx.globalAlpha).toBe(1) // restaurado no fim
  })
})

// Suprime aviso de import de tipo nao usado diretamente.
void (null as unknown as ParticleSystem)
void (null as unknown as Particle)
