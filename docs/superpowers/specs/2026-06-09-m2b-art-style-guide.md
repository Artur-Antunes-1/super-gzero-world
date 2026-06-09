# M2b — Style Guide do Artur (pixel art 16-bit)

_Data: 2026-06-09 · Decidido com o Artur a partir da análise objetiva da arte original dele (paleta + proporção). Trava o estilo de TODA geração de sprite (método chongdashu) — sem isso, cada geração "inventa" um estilo diferente._

## Estilo
- **Pixel art 16-bit (era SNES)**: cel-shading limpo (**2–3 tons por material**), **contorno escuro fechado**, **SEM anti-aliasing, SEM blur, SEM gradiente, SEM smoothing**.
- Hard pixel edges; tudo "snapado" ao grid de pixels (grid de referência 1024 na geração).

## Proporção
- **Chibi heróico**, ~**2,5 cabeças** de altura, razão altura/largura **≈ 1.9** (cabeça grande, corpo compacto). Igual à arte original do Artur.

## Resolução / formato
- Personagem **~64px de altura lógica**; frame **256×256** (método chongdashu, headroom p/ ação); pixel lógico ~4px. Downscale pro jogo depois.
- Spritesheet por animação = grid **2×5 (10 frames)** de 256px → 512×1280.

## Paleta fixa (16 cores)
- **Escuros** (cabelo / roupa / outline): `#050505` (outline) · `#0E0E0F` · `#191818` · `#262526` · `#353737` · `#424140`
- **Pele**: `#FEE3AE` (luz) · `#F1BC80` · `#C19E7C` · `#9F654C` (sombra)
- **Acentos Gzero (canônicos do jogo)**: `#FF0055` magenta · `#2CB6D6` ciano (ciano pode alinhar ao `#0099ff` do código)
- **Neutros**: `#EDEDED` · `#FFFFFF` (olhos / sola)

## Personagem (Artur)
- Jovem, cabelo **preto** bagunçado, sobrancelhas grossas, pele clara, magro.
- Roupa **toda preta** (camiseta + calça), tênis pretos; **acento magenta num ombro + ciano no outro**.

## Vista / direção
- **Lateral** (platformer). Âncora de identidade frontal; locomoção/ação em perfil. **Facing direita gerado; esquerda = flip horizontal**.

## Fundo / recorte
- Fundo **chroma sólido** (cor única, distinta do personagem) → removido por **flood-fill por frame** (preserva brancos internos: olhos, sola). Normalização: **center-X fixo + bottom-Y fixo (pés no mesmo pixel)**.

## Pipeline (método chongdashu — ai-game-spritesheets)
1. Âncora de identidade 1024 (foto/sheet + **grid ref** + **swatch da paleta**) → controla a identidade.
2. Por animação: canvas-grid 2×5 + âncora → `gpt_image_2` gera a folha (retry 2–3×).
3. Recortar por detecção de blobs (não confiar nas células) → flood-fill por frame → normalizar → contact sheet → curar/reordenar frames bons.
4. Montar sheet final → plugar no motor frame-a-frame (`spriteAnim.ts`).
