# Gravidade Zero — O Jogo · M2: Arte & Animação — Documento de Design

_Data: 2026-06-08 · Status: aprovado (direção validada com amostras reais) · Refina a §11 do spec principal._

## 0. Contexto

O M0 (fatia jogável) e o M1 (5 personagens + Humanware + inimigos + dano) usam **sprites placeholder desenhados em código**. O M2 substitui isso por **arte real animada**, com backgrounds, elementos e efeitos. Direção validada gerando amostras reais no Higgsfield (custo ~40 créditos; saldo Team ~3.760).

## 1. Direção de arte (TRAVADA)

- **Estilo:** **pixel art claro, suave e refinado** — referência = o artefato original ("リーフのだいぼうけん", atlas/bg extraídos em `.m2-samples/original-atlas.png` / `original-bg.jpg`). Contorno limpo, cel-shading suave, paleta clara/quente, proporções amigáveis (levemente chibi). **NÃO** o pixel escuro/neon das primeiras amostras.
- **Identidade Gzero:** acentos **magenta `#ff0055` / ciano** na roupa e nos efeitos; **portais** flutuantes; os **membros reais** como heróis (gerados a partir das fotos). Mundo de **ilhas flutuantes** = casa perfeita com a lore "Gravidade Zero" (sem peso).
- **Backgrounds:** **dois climas aprovados, coexistem** — (a) **céu claro** (ilhas flutuantes pastel, nuvens, cerejeiras, torre) e (b) **cósmico escuro** (espaço, nebulosa, plataformas neon). Cada mundo escolhe seu clima → variedade. Amostras: `.m2-samples/new-bg.png` (claro) e `background.png` (escuro).
- **Personagem validado:** `.m2-samples/new-artur-v1.png` (e `v2`) — Artur reconhecível, estilo suave, acento Gzero, fundo off-white p/ recorte.

## 2. Abordagem de animação (D — híbrido)

A "fluidez" aprovada vem de **animação procedural** sobre **arte-base de IA** (não frame-a-frame):
- **Gameplay:** Higgsfield gera **1 arte-base por entidade**; o **motor anima por código** (squash/stretch, bob, lean, rotação, secondary motion) → animações completas e consistentes, escala bem.
- **Backgrounds/elementos:** `nano_banana_pro` (com foto/atlas como referência de estilo).
- **Cinematográfico (M2d):** `seedance` vídeo (tela de título, retratos animados na seleção, loops de fundo).

## 3. Arquitetura do motor (módulos novos, dono único cada)

- `src/engine/assets.ts` — carregador assíncrono de imagens + cache + **chroma-key** (off-white → transparente, em canvas no load) + tipo `AssetManifest`.
- `src/engine/animator.ts` — **lógica pura**: classifica o estado de animação (a partir de velocidade/onGround) e produz um **transform procedural** `{scaleX, scaleY, rotation, offsetY}` por estado (idle/walk/run/jump/fall/hurt/ability). Testável sem render.
- `src/engine/parallax.ts` — camadas de background com fator de scroll por camada (usa `cam.x/cam.y`).
- `src/engine/particles.ts` — emissor (ambiente: poeira de gravidade-zero; burst: Humanware/FX).
- Integração: trocar `drawPlaceholder` por `drawAnimatedSprite(renderer, animator, sprite, x, y, w, h, facing)`; desenhar parallax atrás do mundo; partículas nos FX.

## 4. Pipeline de arte (Higgsfield → jogo)

1. Gerar arte-base (`nano_banana_pro` + foto de referência + atlas original como referência de estilo).
2. **Processar:** recorte/chroma-key (off-white→transparente) **no load via canvas** (sem dependência externa) + resize pro tamanho de sprite.
3. Guardar em `public/assets/` (Vite serve por URL) e listar num **manifest** (`src/data/assets.ts`).
4. O motor **anima por código** (sem sprite-sheet pro gameplay).
5. Backgrounds → 1+ camadas parallax. Vídeo só pro cinematográfico (M2d).

## 5. Decomposição (cada sub-marco = spec→plano→execução próprio)

- **M2a — Motor de Animação + Fatia Vertical (Artur)** ← **próximo plano.** Construir assets/animator/parallax/particles e plugar **1 personagem real (Artur) + um background** no jogo, trocando os placeholders. Prova o D in-game.
- **M2b** — outros 4 personagens (Renan/Dante/Julio/Einstein) + FX por habilidade (trilha do dash, aura do escudo, bloco do builder, time-warp, modo Humanware).
- **M2c** — inimigos (Tolo animado) + elementos (moedas/portais/plataformas/coletáveis) com arte real.
- **M2d** — backgrounds por mundo (parallax, ambos os climas) + cinematográfico (título, retratos animados na seleção via vídeo).

## 6. Testes

- `animator` e `parallax` = **lógica pura** → testes unitários (estado/velocidade → transform; offset de camada).
- `assets` (chroma-key/cache) e `particles` → smoke (jsdom/canvas mock).
- `game` integração → smoke; **verificação visual via screenshot** (rodar o jogo, como no M0).

## 7. Assets já gerados (em `.m2-samples/`, scratch ignorado pelo git)

`new-artur-v1.png` / `new-artur-v2.png` (Artur estilo final), `new-bg.png` (céu claro), `background.png` (cósmico escuro), `original-atlas.png` / `original-bg.jpg` (referências de estilo), `artur-video-C.mp4` (amostra cinematográfica), `procedural-demo.html` (demo do D). O M2a vai **processar e mover** os escolhidos para `public/assets/`.

## Riscos / decisões em aberto

- **Chroma-key vs. transparência nativa:** começamos com chroma-key no load (off-white→transparente); se a borda ficar suja, geramos com fundo chroma puro (verde/magenta) ou usamos um modelo com alpha.
- **Tamanho do sprite / pixel-snap:** definir o tamanho-alvo do sprite no M2a (ex.: altura ~96px) e se aplica pixel-snap no downscale.
- **Multi-parte (rig) vs. sprite único:** M2a usa **sprite único + transform** (o que o demo provou); rig multi-parte fica para depois se precisar de mais expressividade.
