// src/engine/parallax.ts
// DONO Task 3 (M2a) / G2: camadas de background com parallax + MIRROR-TILING.
// Renderiza em SCREEN SPACE (chamar ANTES de beginWorld).
//
// Decisao de tiling:
//   - A largura de cada tile (imgW) = img.w * (VIEW_H / img.h), preservando
//     o aspecto natural da imagem ao escalar para a altura total da viewport.
//   - O deslocamento horizontal e ox = -(cam.x * factor), normalizado para
//     (-imgW, 0] via startX (primeira copia toca a borda esquerda).
//   - Copia de tiles de startX ate VIEW_W com passo imgW, garantindo cobertura
//     completa sem buracos mesmo com offsets fracionarios.
//   - Cada drawImage usa a forma de 9 argumentos: src, sx,sy,sw,sh, dx,dy,dw,dh.
//
// MIRROR-TILING (G2): o sky.png nao e loopavel (bordas esq/dir diferem), entao
// tiles de indice IMPAR sao desenhados espelhados na horizontal. A borda
// direita de um tile normal encosta na borda direita do vizinho espelhado ->
// continuidade PERFEITA por construcao, sem costura.
// Paridade ESTAVEL: o indice e ABSOLUTO no mundo da camada (derivado de ox,
// nao da posicao na tela), entao o mesmo tile do mundo mantem sempre a mesma
// orientacao conforme a camera anda.

import { VIEW_W, VIEW_H } from './constants'
import type { Renderer } from './render'
import type { Camera } from './camera'
import type { AssetStore } from './assets'

export interface ParallaxLayer {
  key: string
  /** 0 = fixo (ceu distante); 1 = acompanha o mundo */
  factor: number
}

/**
 * Desenha as camadas de parallax em SCREEN SPACE (chamar ANTES de beginWorld).
 *
 * Para cada layer:
 *   - img = store.get(key). Se null ou degenerado (h<=0), pula sem erro.
 *   - Calcula imgW = img.w * (VIEW_H / img.h) para preservar aspecto.
 *   - Offset ox = -(cam.x * factor); normaliza para [-imgW, 0].
 *   - Desenha tiles horizontalmente ate cobrir VIEW_W.
 *
 * Ordem da lista = back-to-front (primeira camada = mais ao fundo).
 */
export function drawParallax(
  r: Renderer,
  layers: ParallaxLayer[],
  store: AssetStore,
  cam: Camera,
): void {
  const ctx = r.ctx

  for (const layer of layers) {
    const img = store.get(layer.key)
    if (!img) continue // layer ausente -> pula sem desenhar

    // Asset degenerado -> ignora com seguranca para evitar divisao por zero.
    if (!(img.w > 0) || !(img.h > 0)) continue

    // Largura de cada tile: preserva aspecto ao escalar para VIEW_H.
    const imgW = img.w * (VIEW_H / img.h)
    if (!(imgW > 0) || !Number.isFinite(imgW)) continue

    // Deslocamento horizontal: factor 0 => fixo; factor 1 => acompanha o mundo.
    const ox = -(cam.x * layer.factor)

    // Normaliza para (-imgW, 0]: a primeira copia comeca na borda esquerda
    // ou imediatamente antes dela.
    let startX = (((ox % imgW) + imgW) % imgW) - imgW
    // Multiplo exato de imgW: pula o tile 100% fora da tela. Tambem evita o
    // off-by-one de paridade no ponto ox = k*imgW (flip de todos os tiles).
    if (startX <= -imgW) startX += imgW

    // Indice ABSOLUTO do primeiro tile no mundo da camada (= floor(-ox/imgW)).
    // startX - ox e multiplo de imgW por construcao; round mata ruido float.
    let idx = Math.round((startX - ox) / imgW)

    // Repete tiles de startX ate cobrir toda a largura.
    for (let dx = startX; dx < VIEW_W; dx += imgW, idx++) {
      // mirror-tiling: indice impar => espelhado (paridade segura p/ idx < 0)
      if (((idx % 2) + 2) % 2 === 1) {
        ctx.save()
        ctx.translate(dx + imgW, 0) // ancora na borda DIREITA do tile
        ctx.scale(-1, 1) // espelha horizontalmente
        ctx.drawImage(
          img.src,
          0, 0, img.w, img.h, // recorte de origem (imagem inteira)
          0, 0, imgW, VIEW_H, // destino local: [0, imgW] vira [dx+imgW, dx]
        )
        ctx.restore()
      } else {
        ctx.drawImage(
          img.src,
          0, 0, img.w, img.h, // recorte de origem (imagem inteira)
          dx, 0, imgW, VIEW_H, // destino: cobre a altura toda, ancorado no topo
        )
      }
    }
  }
}
