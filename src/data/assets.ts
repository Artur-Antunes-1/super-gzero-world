// src/data/assets.ts
// DONO Task 5 (M2a): manifesto de assets + camadas de parallax do mundo 1.
// Importa tipos de seus modulos donos; NAO os recria.
import type { AssetEntry } from '../engine/assets'
import type { ParallaxLayer } from '../engine/parallax'
import type { BgTheme } from './schema'

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
  // U-HF: pouso dedicado (crouch) do sheet novo. victory = poses de queda.
  'char.artur.land': { url: '/assets/chars/artur/land.png' },
  'char.artur.vitoria': { url: '/assets/chars/artur/vitoria.png' },
  'bg.sky': { url: '/assets/bg/sky.png' },
  'bg.cosmic': { url: '/assets/bg/cosmic.png' },
  // U1: arte curada (Higgsfield) — title screen + camada mid do parallax.
  'bg.title': { url: '/assets/bg/title.png' },
  'bg.mid': { url: '/assets/bg/mid.png' },
  // MULTI-ESTILO (Higgsfield gpt_image_2): 1 fundo por estilo, 1 estilo por fase.
  'bg.lvlA': { url: '/assets/bg/lvl-a.png' }, // estilo A: pixel-art (ceu/ilhas)
  'bg.lvlB': { url: '/assets/bg/lvl-b.png' }, // estilo B: sci-fi neon (estacao)
  'bg.lvlC': { url: '/assets/bg/lvl-c.png' }, // estilo C: cartoon vibrante
  // C2: atlases de tiles Wang (PixelLab) ja transparentes -> sem chromaKey.
  'tiles.terra': { url: '/assets/tiles/terra.png' },
  'tiles.tijolo': { url: '/assets/tiles/tijolo.png' },
  // D1: sheets de objetos (moeda/portal) e do Tolo — PNGs com alpha.
  'obj.moeda': { url: '/assets/objects/moeda.png' },
  'obj.portal': { url: '/assets/objects/portal.png' },
  'char.tolo': { url: '/assets/chars/tolo/walk.png' },
  'char.tolo.idle': { url: '/assets/chars/tolo/idle.png' },
  // U4 (pedido do U2): sheets das variantes do Tolo (PNGs com alpha).
  'char.tolo.veloz': { url: '/assets/chars/tolo/walk-veloz.png' },
  'char.tolo.atirador': { url: '/assets/chars/tolo/walk-atirador.png' },
  // U1: bandeira de checkpoint (sheet 2 frames 48x96), espinho, props e retrato.
  'obj.flag': { url: '/assets/objects/flag.png' },
  'tile.spike': { url: '/assets/tiles/spike.png' },
  'prop.arvore': { url: '/assets/props/arvore.png' },
  'prop.cristal': { url: '/assets/props/cristal.png' },
  'ui.retrato.artur': { url: '/assets/ui/retrato-artur.png' },
}

/**
 * T3: temas de fundo por fase. Lookup tema -> camadas de parallax.
 * O game ainda consome SKY_LAYERS direto; a fiacao por LevelDef.bgTheme
 * entra na frente H3 (ver comentario em schema.ts).
 */
export const BG_THEMES: Record<BgTheme, ParallaxLayer[]> = {
  // U1: camada mid (ilhas flutuantes) por cima do ceu — ordem back-to-front.
  sky: [
    { key: 'bg.sky', factor: 0.3 },
    { key: 'bg.mid', factor: 0.55 },
  ],
  cosmic: [{ key: 'bg.cosmic', factor: 0.25 }],
  // MULTI-ESTILO: 1 cena por estilo (fundo distante, factor baixo).
  pixel: [{ key: 'bg.lvlA', factor: 0.2 }],
  scifi: [{ key: 'bg.lvlB', factor: 0.18 }],
  cartoon: [{ key: 'bg.lvlC', factor: 0.2 }],
}

/** Compat M2a: mesmo array do tema 'sky' (game.ts importa este export). */
export const SKY_LAYERS: ParallaxLayer[] = BG_THEMES.sky
