// tests/unit/assetsManifest.test.ts
import { describe, it, expect } from 'vitest'
import { ASSET_MANIFEST, SKY_LAYERS } from '../../src/data/assets'

describe('ASSET_MANIFEST', () => {
  it('tem exatamente as 3 chaves do M2a', () => {
    expect(Object.keys(ASSET_MANIFEST).sort()).toEqual(
      ['bg.cosmic', 'bg.sky', 'char.artur'].sort(),
    )
  })

  it('aponta para as URLs servidas a partir de /assets', () => {
    expect(ASSET_MANIFEST['char.artur'].url).toBe('/assets/chars/artur.png')
    expect(ASSET_MANIFEST['bg.sky'].url).toBe('/assets/bg/sky.png')
    expect(ASSET_MANIFEST['bg.cosmic'].url).toBe('/assets/bg/cosmic.png')
  })

  it('chroma-key so no personagem (off-white -> transparente)', () => {
    expect(ASSET_MANIFEST['char.artur'].chromaKey).toBe(true)
    // backgrounds nao recortam (cobrem 960x528)
    expect(ASSET_MANIFEST['bg.sky'].chromaKey).toBeUndefined()
    expect(ASSET_MANIFEST['bg.cosmic'].chromaKey).toBeUndefined()
  })
})

describe('SKY_LAYERS', () => {
  it('M2a = mundo 1 com 1 camada de ceu (factor 0.3)', () => {
    expect(SKY_LAYERS).toEqual([{ key: 'bg.sky', factor: 0.3 }])
  })
})
