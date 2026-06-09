// src/data/assets.ts
// DONO Task 5 (M2a): manifesto de assets + camadas de parallax do mundo 1.
// Importa tipos de seus modulos donos; NAO os recria.
import type { AssetEntry } from '../engine/assets'
import type { ParallaxLayer } from '../engine/parallax'

/**
 * Manifesto de assets do M2a. Vite serve public/ na raiz, entao
 * public/assets/x.png -> /assets/x.png (dev e build/preview).
 * Apenas o personagem usa chromaKey (off-white -> transparente);
 * os backgrounds cobrem 960x528 inteiros e nao recortam.
 */
export const ASSET_MANIFEST: Record<string, AssetEntry> = {
  'char.artur': { url: '/assets/chars/artur.png', chromaKey: true },
  'bg.sky': { url: '/assets/bg/sky.png' },
  'bg.cosmic': { url: '/assets/bg/cosmic.png' },
}

/**
 * Camadas de parallax do mundo 1 (ceu claro). 1 camada no M2a;
 * bg.cosmic fica no manifesto para uso futuro.
 */
export const SKY_LAYERS: ParallaxLayer[] = [{ key: 'bg.sky', factor: 0.3 }]
