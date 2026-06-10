// tests/unit/assetsManifest.test.ts
import { describe, it, expect } from 'vitest'
import { ASSET_MANIFEST, SKY_LAYERS } from '../../src/data/assets'

describe('ASSET_MANIFEST', () => {
  it('tem as chaves do M2a + sheets do Artur (M2b) + tiles (C2) + objetos (D1)', () => {
    expect(Object.keys(ASSET_MANIFEST).sort()).toEqual(
      [
        'bg.cosmic',
        'bg.sky',
        'char.artur',
        'char.artur.idle',
        'char.artur.corrida',
        'char.artur.pulo',
        'char.artur.queda',
        'char.artur.danificado',
        'char.artur.ataque',
        'tiles.terra',
        'tiles.tijolo',
        'obj.moeda',
        'obj.portal',
        'char.tolo',
        'char.tolo.idle',
      ].sort(),
    )
  })

  it('aponta para as URLs servidas a partir de /assets', () => {
    expect(ASSET_MANIFEST['char.artur'].url).toBe('/assets/chars/artur.png')
    expect(ASSET_MANIFEST['bg.sky'].url).toBe('/assets/bg/sky.png')
    expect(ASSET_MANIFEST['bg.cosmic'].url).toBe('/assets/bg/cosmic.png')
    expect(ASSET_MANIFEST['char.artur.corrida'].url).toBe(
      '/assets/chars/artur/corrida.png',
    )
    expect(ASSET_MANIFEST['char.artur.ataque'].url).toBe(
      '/assets/chars/artur/ataque.png',
    )
    expect(ASSET_MANIFEST['tiles.terra'].url).toBe('/assets/tiles/terra.png')
    expect(ASSET_MANIFEST['tiles.tijolo'].url).toBe('/assets/tiles/tijolo.png')
    // D1: objetos e Tolo
    expect(ASSET_MANIFEST['obj.moeda'].url).toBe('/assets/objects/moeda.png')
    expect(ASSET_MANIFEST['obj.portal'].url).toBe('/assets/objects/portal.png')
    expect(ASSET_MANIFEST['char.tolo'].url).toBe('/assets/chars/tolo/walk.png')
    expect(ASSET_MANIFEST['char.tolo.idle'].url).toBe(
      '/assets/chars/tolo/idle.png',
    )
  })

  it('chroma-key so na arte-base; sheets M2b ja sao transparentes (sem chromaKey)', () => {
    expect(ASSET_MANIFEST['char.artur'].chromaKey).toBe(true)
    // backgrounds nao recortam (cobrem 960x528)
    expect(ASSET_MANIFEST['bg.sky'].chromaKey).toBeUndefined()
    expect(ASSET_MANIFEST['bg.cosmic'].chromaKey).toBeUndefined()
    // M2b: PNGs ja vem com alpha -> nao precisam de chroma-key
    for (const k of [
      'char.artur.idle',
      'char.artur.corrida',
      'char.artur.pulo',
      'char.artur.queda',
      'char.artur.danificado',
      'char.artur.ataque',
      // C2: atlases de tiles tambem ja vem com alpha
      'tiles.terra',
      'tiles.tijolo',
      // D1: sheets de objetos e do Tolo tambem ja vem com alpha
      'obj.moeda',
      'obj.portal',
      'char.tolo',
      'char.tolo.idle',
    ]) {
      expect(ASSET_MANIFEST[k].chromaKey).toBeUndefined()
    }
  })
})

describe('SKY_LAYERS', () => {
  it('M2a = mundo 1 com 1 camada de ceu (factor 0.3)', () => {
    expect(SKY_LAYERS).toEqual([{ key: 'bg.sky', factor: 0.3 }])
  })
})
