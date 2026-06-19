// tests/unit/bgThemes.test.ts
// T3: temas de fundo por fase (BG_THEMES) — prepara o uso do cosmic.
import { describe, it, expect } from 'vitest'
import { ASSET_MANIFEST, BG_THEMES, SKY_LAYERS } from '../../src/data/assets'

describe('BG_THEMES', () => {
  it('tem os temas legados (sky/cosmic) + multi-estilo (pixel/scifi/cartoon)', () => {
    expect(Object.keys(BG_THEMES).sort()).toEqual([
      'cartoon',
      'cosmic',
      'pixel',
      'scifi',
      'sky',
    ])
  })

  it('multi-estilo: cada estilo = 1 camada com seu fundo', () => {
    expect(BG_THEMES.pixel).toEqual([{ key: 'bg.lvlA', factor: 0.2 }])
    expect(BG_THEMES.scifi).toEqual([{ key: 'bg.lvlB', factor: 0.18 }])
    expect(BG_THEMES.cartoon).toEqual([{ key: 'bg.lvlC', factor: 0.2 }])
  })

  it('sky = 2 camadas back-to-front: ceu (0.3) e ilhas mid (0.55)', () => {
    expect(BG_THEMES.sky).toEqual([
      { key: 'bg.sky', factor: 0.3 },
      { key: 'bg.mid', factor: 0.55 },
    ])
  })

  it('sky tem a camada bg.mid DEPOIS da bg.sky (desenha por cima)', () => {
    const keys = BG_THEMES.sky.map((l) => l.key)
    expect(keys.indexOf('bg.mid')).toBeGreaterThan(keys.indexOf('bg.sky'))
  })

  it('cosmic = 1 camada bg.cosmic com factor 0.25', () => {
    expect(BG_THEMES.cosmic).toEqual([{ key: 'bg.cosmic', factor: 0.25 }])
  })

  it('toda key de camada existe no ASSET_MANIFEST', () => {
    for (const layers of Object.values(BG_THEMES)) {
      for (const layer of layers) {
        expect(ASSET_MANIFEST[layer.key]).toBeDefined()
      }
    }
  })

  it('SKY_LAYERS e a MESMA referencia de BG_THEMES.sky (compat)', () => {
    expect(SKY_LAYERS).toBe(BG_THEMES.sky)
  })
})
