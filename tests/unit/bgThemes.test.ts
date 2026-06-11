// tests/unit/bgThemes.test.ts
// T3: temas de fundo por fase (BG_THEMES) — prepara o uso do cosmic.
import { describe, it, expect } from 'vitest'
import { ASSET_MANIFEST, BG_THEMES, SKY_LAYERS } from '../../src/data/assets'

describe('BG_THEMES', () => {
  it('tem exatamente os temas sky e cosmic', () => {
    expect(Object.keys(BG_THEMES).sort()).toEqual(['cosmic', 'sky'])
  })

  it('sky = 1 camada bg.sky com factor 0.3', () => {
    expect(BG_THEMES.sky).toEqual([{ key: 'bg.sky', factor: 0.3 }])
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
