// src/engine/assets.ts
// DONO Task 1 (M2a): loader de imagens + chroma-key.
// Folha do grafo: depende apenas das APIs do DOM (Image, canvas).

export interface ImageAsset {
  src: CanvasImageSource
  w: number
  h: number
}

export interface AssetEntry {
  url: string
  chromaKey?: boolean
}

export interface AssetStore {
  get(key: string): ImageAsset | null
  readonly ready: boolean
}

// Limiares do contrato: off-white = luma>=235 E (max-min)<=18.
const LUMA_MIN = 235
const SPREAD_MAX = 18

// Funcao PURA e testavel: percorre RGBA in-place, zera o alpha onde off-white.
export function chromaKeyPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // luma perceptual (Rec. 601)
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    const max = r > g ? (r > b ? r : b) : g > b ? g : b
    const min = r < g ? (r < b ? r : b) : g < b ? g : b
    if (luma >= LUMA_MIN && max - min <= SPREAD_MAX) {
      data[i + 3] = 0 // transparente
    }
  }
}

// Carrega UMA entrada. Se chromaKey, desenha num canvas offscreen e torna os
// pixels off-white transparentes; ImageAsset.src = esse canvas. Senao, src = a Image.
export function loadImage(entry: AssetEntry): Promise<ImageAsset> {
  return new Promise<ImageAsset>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height

      if (!entry.chromaKey) {
        resolve({ src: img, w, h })
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Sem canvas 2d (ambiente sem suporte): usa a Image crua como fallback.
        resolve({ src: img, w, h })
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      chromaKeyPixels(imageData.data)
      ctx.putImageData(imageData, 0, 0)
      resolve({ src: canvas, w, h })
    }
    img.onerror = () => reject(new Error(`loadImage: falha ao carregar ${entry.url}`))
    img.src = entry.url
  })
}

// Carrega todas as entradas em paralelo, cacheia por chave. get retorna null se
// faltar; ready=true apos todas resolverem.
export async function loadAssets(
  manifest: Record<string, AssetEntry>,
): Promise<AssetStore> {
  const cache = new Map<string, ImageAsset>()
  let ready = false

  const keys = Object.keys(manifest)
  await Promise.all(
    keys.map(async (key) => {
      const asset = await loadImage(manifest[key])
      cache.set(key, asset)
    }),
  )
  ready = true

  return {
    get(key: string): ImageAsset | null {
      return cache.get(key) ?? null
    },
    get ready(): boolean {
      return ready
    },
  }
}
