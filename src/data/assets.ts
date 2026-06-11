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
  // M2b: sprite-sheets de animacao do Artur (PNG ja transparente -> sem chromaKey).
  'char.artur.idle': { url: '/assets/chars/artur/idle.png' },
  'char.artur.corrida': { url: '/assets/chars/artur/corrida.png' },
  'char.artur.pulo': { url: '/assets/chars/artur/pulo.png' },
  'char.artur.queda': { url: '/assets/chars/artur/queda.png' },
  'char.artur.danificado': { url: '/assets/chars/artur/danificado.png' },
  'char.artur.ataque': { url: '/assets/chars/artur/ataque.png' },
  // G3: poses extras do sheet original (vitoria = coleta/comemoracao; skid = vista 3/4).
  'char.artur.vitoria': { url: '/assets/chars/artur/vitoria.png' },
  'char.artur.skid': { url: '/assets/chars/artur/skid.png' },
  'bg.sky': { url: '/assets/bg/sky.png' },
  'bg.cosmic': { url: '/assets/bg/cosmic.png' },
  // C2: atlases de tiles Wang (PixelLab) ja transparentes -> sem chromaKey.
  'tiles.terra': { url: '/assets/tiles/terra.png' },
  'tiles.tijolo': { url: '/assets/tiles/tijolo.png' },
  // D1: sheets de objetos (moeda/portal) e do Tolo — PNGs com alpha.
  'obj.moeda': { url: '/assets/objects/moeda.png' },
  'obj.portal': { url: '/assets/objects/portal.png' },
  'char.tolo': { url: '/assets/chars/tolo/walk.png' },
  'char.tolo.idle': { url: '/assets/chars/tolo/idle.png' },
}

/**
 * T3: temas de fundo por fase. Lookup tema -> camadas de parallax.
 * O game ainda consome SKY_LAYERS direto; a fiacao por LevelDef.bgTheme
 * entra na frente H3 (ver comentario em schema.ts).
 */
export const BG_THEMES: Record<'sky' | 'cosmic', ParallaxLayer[]> = {
  // TODO: mid-islands layer entra quando o asset chegar (factor 0.55).
  sky: [{ key: 'bg.sky', factor: 0.3 }],
  cosmic: [{ key: 'bg.cosmic', factor: 0.25 }],
}

/** Compat M2a: mesmo array do tema 'sky' (game.ts importa este export). */
export const SKY_LAYERS: ParallaxLayer[] = BG_THEMES.sky
