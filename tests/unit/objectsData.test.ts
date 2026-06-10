// tests/unit/objectsData.test.ts
// D1: dados de animacao de objetos (moeda, portal, tolo) + integridade
// dos sheets em public/ (dimensoes lidas direto do header PNG).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OBJECT_ANIMS, type ObjectAnim } from '../../src/data/objects'
import { ASSET_MANIFEST } from '../../src/data/assets'

const ANIMS: Array<[string, ObjectAnim]> = Object.entries(OBJECT_ANIMS)

/** Le largura/altura do IHDR de um PNG (bytes 16..24), sem decodificar. */
function pngSize(relUrl: string): { w: number; h: number } {
  const buf = readFileSync(join(__dirname, '../../public', relUrl))
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

describe('OBJECT_ANIMS', () => {
  it('tem exatamente as 4 animacoes do contrato', () => {
    expect(Object.keys(OBJECT_ANIMS).sort()).toEqual(
      ['moeda', 'portal', 'tolo', 'toloIdle'].sort(),
    )
  })

  it('todas tem frames > 0, fps > 0 e celulas/draw positivos', () => {
    for (const [, fa] of ANIMS) {
      expect(fa.frames).toBeGreaterThan(0)
      expect(fa.fps).toBeGreaterThan(0)
      expect(fa.cellW).toBeGreaterThan(0)
      expect(fa.cellH).toBeGreaterThan(0)
      expect(fa.drawW).toBeGreaterThan(0)
      expect(fa.drawH).toBeGreaterThan(0)
    }
  })

  it('moeda: 6 frames 64x64 a 10fps loop, desenha 32x32', () => {
    expect(OBJECT_ANIMS.moeda).toEqual({
      key: 'obj.moeda',
      frames: 6,
      fps: 10,
      loop: true,
      cellW: 64,
      cellH: 64,
      drawW: 32,
      drawH: 32,
    })
  })

  it('portal: 7 frames 128x128 a 8fps loop, desenha 96x96 (2 tiles)', () => {
    expect(OBJECT_ANIMS.portal).toEqual({
      key: 'obj.portal',
      frames: 7,
      fps: 8,
      loop: true,
      cellW: 128,
      cellH: 128,
      drawW: 96,
      drawH: 96,
    })
  })

  it('tolo: walk 8 frames / idle 4 frames, celula 92, desenha 56', () => {
    expect(OBJECT_ANIMS.tolo).toEqual({
      key: 'char.tolo',
      frames: 8,
      fps: 10,
      loop: true,
      cellW: 92,
      cellH: 92,
      drawW: 56,
      drawH: 56,
    })
    expect(OBJECT_ANIMS.toloIdle).toEqual({
      key: 'char.tolo.idle',
      frames: 4,
      fps: 10,
      loop: true,
      cellW: 92,
      cellH: 92,
      drawW: 56,
      drawH: 56,
    })
  })

  it('cada key existe no ASSET_MANIFEST', () => {
    for (const [, fa] of ANIMS) {
      expect(ASSET_MANIFEST[fa.key], fa.key).toBeDefined()
    }
  })

  it('sheets em public/ batem com frames x celula (header PNG)', () => {
    for (const [name, fa] of ANIMS) {
      const { w, h } = pngSize(ASSET_MANIFEST[fa.key].url)
      expect(w, `${name}: largura do sheet`).toBe(fa.frames * fa.cellW)
      expect(h, `${name}: altura do sheet`).toBe(fa.cellH)
    }
  })
})
