// tests/unit/charAnimsMeta.test.ts
// Consistencia entre meta.json (gerado pelo pipeline de extracao do sheet)
// e os valores copiados a mao em charAnims.ts/assets.ts — mata drift silencioso.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARTUR_ANIMS } from '../../src/data/charAnims'
import { ASSET_MANIFEST } from '../../src/data/assets'

interface ArturMeta {
  cell: [number, number]
  anchorX: number
  anchorY: number
  anims: Record<string, number>
}

const meta: ArturMeta = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/assets/chars/artur/meta.json'), 'utf-8'),
)

// 'char.artur.corrida' -> 'corrida' (nome do sheet = ultima parte do key)
function sheetName(key: string): string {
  const parts = key.split('.')
  return parts[parts.length - 1]!
}

describe('charAnims x meta.json (artur)', () => {
  it('celula bate com meta.cell', () => {
    expect(ARTUR_ANIMS.cellW).toBe(meta.cell[0])
    expect(ARTUR_ANIMS.cellH).toBe(meta.cell[1])
  })

  it('ancora bate com meta.anchorX/anchorY', () => {
    expect(ARTUR_ANIMS.anchorX).toBe(meta.anchorX)
    expect(ARTUR_ANIMS.anchorY).toBe(meta.anchorY)
  })

  it('frames de cada FrameAnim batem com meta.anims do sheet', () => {
    for (const [state, fa] of Object.entries(ARTUR_ANIMS.anims)) {
      const name = sheetName(fa.key)
      expect(meta.anims[name], `estado '${state}' usa sheet '${name}' ausente no meta`).toBeDefined()
      expect(fa.frames, `frames de '${state}' (sheet '${name}')`).toBe(meta.anims[name])
    }
  })

  it('cada key existe no ASSET_MANIFEST com a url do sheet certo', () => {
    for (const [state, fa] of Object.entries(ARTUR_ANIMS.anims)) {
      const entry = ASSET_MANIFEST[fa.key]
      expect(entry, `key '${fa.key}' (estado '${state}') ausente no manifesto`).toBeDefined()
      const expected = '/assets/chars/artur/' + sheetName(fa.key) + '.png'
      expect(entry!.url.endsWith(expected), `url '${entry!.url}' nao termina em '${expected}'`).toBe(true)
    }
  })

  it('nenhum sheet orfao: todo sheet do meta e referenciado por algum FrameAnim', () => {
    const used = new Set(Object.values(ARTUR_ANIMS.anims).map((fa) => sheetName(fa.key)))
    for (const name of Object.keys(meta.anims)) {
      expect(used.has(name), `sheet '${name}' do meta nao e usado por nenhum FrameAnim`).toBe(true)
    }
  })

  it('nenhuma entrada char.artur.* orfa no manifesto: toda key e usada por algum FrameAnim', () => {
    const used = new Set(Object.values(ARTUR_ANIMS.anims).map((fa) => fa.key))
    for (const key of Object.keys(ASSET_MANIFEST)) {
      if (!key.startsWith('char.artur.')) continue
      expect(used.has(key), `key '${key}' do manifesto nao e usada por nenhum FrameAnim`).toBe(true)
    }
  })
})
