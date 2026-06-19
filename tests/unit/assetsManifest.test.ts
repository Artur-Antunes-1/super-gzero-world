// tests/unit/assetsManifest.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASSET_MANIFEST, SKY_LAYERS } from '../../src/data/assets'

/** Le largura/altura do IHDR de um PNG (bytes 16..24), sem decodificar. */
function pngSize(relUrl: string): { w: number; h: number } {
  const buf = readFileSync(join(__dirname, '../../public', relUrl))
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('ASSET_MANIFEST', () => {
  it('tem as chaves do M2a + sheets do Artur (M2b) + tiles (C2) + objetos (D1) + arte curada (U1)', () => {
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
        // U-HF: land dedicado; ataque/skid sairam (sem pose no sheet novo)
        'char.artur.land',
        'char.artur.vitoria',
        'tiles.terra',
        'tiles.tijolo',
        'obj.moeda',
        'obj.portal',
        'char.tolo',
        'char.tolo.idle',
        // U4 (contrato U2): sheets das variantes do Tolo
        'char.tolo.veloz',
        'char.tolo.atirador',
        // U1: arte curada — title, parallax mid, flag, spike, props, retrato
        'bg.title',
        'bg.mid',
        'obj.flag',
        'tile.spike',
        'prop.arvore',
        'prop.cristal',
        'ui.retrato.artur',
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
    // U-HF: land dedicado; victory = poses de queda (bracos erguidos)
    expect(ASSET_MANIFEST['char.artur.land'].url).toBe(
      '/assets/chars/artur/land.png',
    )
    expect(ASSET_MANIFEST['char.artur.vitoria'].url).toBe(
      '/assets/chars/artur/vitoria.png',
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
    // U4 (contrato U2): variantes do Tolo
    expect(ASSET_MANIFEST['char.tolo.veloz'].url).toBe(
      '/assets/chars/tolo/walk-veloz.png',
    )
    expect(ASSET_MANIFEST['char.tolo.atirador'].url).toBe(
      '/assets/chars/tolo/walk-atirador.png',
    )
    // U1: arte curada
    expect(ASSET_MANIFEST['bg.title'].url).toBe('/assets/bg/title.png')
    expect(ASSET_MANIFEST['bg.mid'].url).toBe('/assets/bg/mid.png')
    expect(ASSET_MANIFEST['obj.flag'].url).toBe('/assets/objects/flag.png')
    expect(ASSET_MANIFEST['tile.spike'].url).toBe('/assets/tiles/spike.png')
    expect(ASSET_MANIFEST['prop.arvore'].url).toBe('/assets/props/arvore.png')
    expect(ASSET_MANIFEST['prop.cristal'].url).toBe('/assets/props/cristal.png')
    expect(ASSET_MANIFEST['ui.retrato.artur'].url).toBe(
      '/assets/ui/retrato-artur.png',
    )
  })

  it('chroma-key so na arte-base; demais PNGs ja sao transparentes (sem chromaKey)', () => {
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
      // U-HF: land + victory (poses de queda) ja vem com alpha
      'char.artur.land',
      'char.artur.vitoria',
      // C2: atlases de tiles tambem ja vem com alpha
      'tiles.terra',
      'tiles.tijolo',
      // D1: sheets de objetos e do Tolo tambem ja vem com alpha
      'obj.moeda',
      'obj.portal',
      'char.tolo',
      'char.tolo.idle',
      // U4 (contrato U2): variantes do Tolo tambem ja vem com alpha
      'char.tolo.veloz',
      'char.tolo.atirador',
      // U1: arte curada ja vem pronta (alpha onde precisa)
      'bg.title',
      'bg.mid',
      'obj.flag',
      'tile.spike',
      'prop.arvore',
      'prop.cristal',
      'ui.retrato.artur',
    ]) {
      expect(ASSET_MANIFEST[k].chromaKey).toBeUndefined()
    }
  })
})

describe('PNGs da arte curada (U1) em public/ — dimensoes do IHDR', () => {
  it.each([
    ['bg.title', 960, 528],
    ['bg.mid', 946, 224],
    ['obj.flag', 96, 96],
    ['tile.spike', 48, 24],
    ['prop.arvore', 64, 96],
    ['prop.cristal', 48, 80],
    ['ui.retrato.artur', 96, 96],
  ])('%s tem %ix%i', (key, w, h) => {
    const size = pngSize(ASSET_MANIFEST[key].url)
    expect(size).toEqual({ w, h })
  })
})

describe('SKY_LAYERS', () => {
  it('U1 = mundo 1 com ceu (0.3) + ilhas mid (0.55), back-to-front', () => {
    expect(SKY_LAYERS).toEqual([
      { key: 'bg.sky', factor: 0.3 },
      { key: 'bg.mid', factor: 0.55 },
    ])
  })
})
