# HANDOFF — Gravidade Zero · O Jogo (Gzero)

> **Para um chat/assistente novo (ou pessoa) que vai continuar este projeto.** Leia isto primeiro, depois os specs/planos referenciados. Data do handoff: 2026-06-08. Idioma do usuário: **pt-BR**.

---

## 1. TL;DR

**O que é:** um **platformer 2D** (estilo Mario) de marca da empresa **Gzero / Gravidade Zero**, feito a partir de um artefato público do Claude (jogo japonês "リーフのだいぼうけん", `C:\Users\artur\Downloads\remixed-6e07a45d.html`). Reescrito como projeto **Vite + TypeScript + Canvas 2D**, data-driven, com TDD.

**Estado atual (3 marcos concluídos, pushed):**
- **M0** ✅ — fatia vertical jogável (motor, física, fase, 1 personagem placeholder, goal/win).
- **M1** ✅ — **5 personagens jogáveis** + tela de seleção + superpoder **Humanware** + inimigos "Tolo" + dano/corações/vidas/over.
- **M2a** ✅ — **motor de animação** (procedural) + **arte real animada do Artur** + background parallax de ilhas flutuantes + partículas.

**Próximo: M2b** — gerar a arte dos outros 4 personagens (Renan/Dante/Julio/Einstein) + FX por habilidade. Depois M2c (inimigos/elementos animados) e M2d (backgrounds por mundo + cinematográfico via vídeo).

**Repo privado:** https://github.com/Artur-Antunes-1/super-gzero-world (branch `master`, ~44 commits, conta `Artur-Antunes-1`).
**Diretório local:** `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld` (Windows; bash via Git Bash disponível).

---

## 2. Como rodar / testar / jogar

```bash
npm install
npm run dev        # Vite dev server (porta 5173+; abre na TELA DE SELEÇÃO)
npm run build      # gera dist/ (inclui public/assets)
npm run test       # Vitest (jsdom) — 281 testes unit
npm run test:e2e   # Playwright (build+preview:4173) — fluxo select->andar->win
npx tsc -p tsconfig.json --noEmit   # type-check strict
```
**Controles:** ←/→ andar · Shift correr · Espaço pular · **J** habilidade · **H** Humanware (medidor cheio) · Enter confirmar (seleção / reiniciar). Na seleção: ←/→ navega, Enter/Espaço escolhe.

**Estado de jogo** exposto p/ testes: `window.__GAME_STATE()` → 'select'|'playing'|'win'|'over'.

---

## 3. Arquitetura (módulos)

Tudo em `src/`. Cada arquivo tem responsabilidade única; o motor é data-driven.

**`src/engine/`** (motor, sem deps de game):
- `constants.ts` — TODAS as constantes (física + paleta + Humanware + i-frames). **Fonte única.**
- `state.ts` — `createStateMachine` (GameState: loading/title/select/playing/paused/win/over).
- `loop.ts` — `createLoop` (timestep fixo; **dt em FRAMES**, `step(1)` por passo fixo — ver Gotcha #1).
- `input.ts` — `createInput` (teclado; rastreia **teclas físicas** e.code; `isDown`/`pressed`(edge)/`update`/`attach`/`detach`). Ações: left/right/jump/run/down/ability/humanware/pause/confirm.
- `render.ts` — `createRenderer(canvas)`: `Renderer{ctx,clear,beginWorld,endWorld,drawRect,present}` (interno 960×528).
- `physics.ts` — `Body`, `stepBody`, `collideTiles` (colisão tile AABB, plataforma one-way).
- `camera.ts` — `createCamera`/`followCamera` (clamp).
- `assets.ts` (M2a) — `loadAssets`/`AssetStore`/`ImageAsset`/`chromaKeyPixels` (off-white→transparente no load).
- `animator.ts` (M2a) — **lógica pura**: `classifyAnim`(velocidade→estado), `updateAnimator`, `getTransform`(squash/stretch/bob/lean por estado).
- `parallax.ts` (M2a) — `drawParallax` (camadas, screen space).
- `particles.ts` (M2a) — `ParticleSystem`, `emitAmbient`/`emitBurst`/`updateParticles`/`drawParticles`.
- `spriteDraw.ts` (M2a) — `drawAnimatedSprite` (ancora nos pés, SPRITE_DRAW_H=90, fallback se asset null).

**`src/game/`** (regras do jogo):
- `player.ts` — `Player`(extends Body; +char,facing,coyote,jumpBuffer,lives,hearts,iframes,ability), `createPlayer`, `updatePlayer`, `damagePlayer`/`respawnPlayer`/`tickPlayerTimers`.
- `ability.ts` (M1) — `AbilityState`, `updateAbility` (5 habilidades), helpers (`abilityWorldScale`/`abilityHasShield`/`abilityKillsEnemy`/`abilityBuilderTile`/`drawAbilityFx`…). `ABILITY_PARAMS` fica em `data/characters.ts`.
- `humanware.ts` (M1) — `HumanwareState` + funções puras (`addMeter`/`tryActivate`/`updateHumanware`/`isActive`/`humanwareWorldScale`).
- `enemy.ts` (M1) — `Enemy{kind:'tolo',dir,alive,frozen}`, `spawnEnemies`/`updateEnemy`/`isStomp`/`drawEnemy`.
- `levelParser.ts` — `parseLevel` (ASCII tilemap → ParsedLevel).
- `goal.ts` — `checkGoal`.
- `sprites.ts` — `drawPlaceholder` (fallback quando não há arte real).
- `game.ts` — **`createGame(renderer,input,level,store?)`** — orquestra TUDO: select→playing→win/over, ordem do update, worldScale (Math.min), colisões, Humanware, parallax+sprite animado+partículas no render.

**`src/data/`**: `schema.ts` (tipos), `characters.ts` (5 chars + `ABILITY_PARAMS`), `assets.ts` (`ASSET_MANIFEST`+`SKY_LAYERS`), `levels/world1-zona1.ts`.
**`src/ui/`**: `hud.ts` (`drawHud`: TIME/LIVES/COINS/medidor Humanware/corações), `selectScreen.ts`.
**`src/main.ts`**: boot — preload assets (async), cria tudo, `createLoop().start()`, expõe `__GAME_STATE`.
**`public/assets/`**: arte real (chars/artur.png, bg/sky.png, bg/cosmic.png) servida pelo Vite.
**`tests/`**: `unit/*.test.ts` (26 arquivos, 281 testes) + `e2e/world1.spec.ts`.

---

## 4. Decisões TRAVADAS (não re-litigar sem o usuário)

- **Spec mestre:** `docs/superpowers/specs/2026-06-08-gravidade-zero-game-design.md` — **a §0 ("Cânone") é a FONTE DA VERDADE** (resolve contradições numéricas: Humanware meter=1000/4 segmentos, ganhos 8/60/250/500/25, Modo 300/300f scale 0.35, emc2 0.25, composição via `Math.min`, stats §0.4 dos 5, i-frames 90, etc.).
- **Roster (5 jogáveis):** Renan (Salto Visionário/pulo duplo), Dante (Dash Criativo), Julio (Escudo de Governança), Artur=o usuário (Builder), Einstein=pai do Renan (E=mc² slow-time). Companheiro IA "Renante" = M3+ (só existe no enum, `m1Implemented:false`).
- **Humanware:** medidor de coração/consciência; tecla H ativa o Modo (desacelera mundo a 0.35, congela "Tolos", pausa timer; player corre normal). Tema = doutrina real da Gzero ("IA amplifica, não substitui").
- **Direção de arte (M2, TRAVADA):** pixel art **claro/suave/refinado** como o **artefato original** (NÃO o pixel escuro/neon das 1as amostras). Identidade Gzero via acentos **magenta `#ff0055`/ciano** + portais + membros reais como heróis + mundo de **ilhas flutuantes**. **Dois climas de background coexistem**: céu claro + cósmico escuro (por mundo). Spec: `docs/superpowers/specs/2026-06-08-m2-art-animation-design.md`.
- **Animação = abordagem D (híbrido):** animação **procedural** sobre **arte-base de IA** (1 arte por entidade; motor anima por código) + `nano_banana_pro` p/ backgrounds + vídeo `seedance` p/ cinematográfico. O usuário aprovou a **fluidez** do procedural.
- **Marca Gzero (2 identidades):** site público `gravidadezero.space` = cósmico/regenerativo (fundadores Renan & Dante, "Humanware®", já usa RPG/"Lifecards"); marca de produto "Tech-Noir" sóbria (preto+pink). Dossiê completo: `docs/gzero-site-dossier.md` (lido das 26 páginas do site).

---

## 5. O MÉTODO que funcionou (siga este padrão)

Cada marco seguiu o mesmo fluxo, e ele **funciona muito bem**:

1. **Brainstorming** (skill `superpowers:brainstorming`) — explorar, mostrar opções (inclusive gerar amostras reais no Higgsfield), decidir, aprovar design. NÃO implementar antes de aprovar.
2. **Spec** — documento de design em `docs/superpowers/specs/`.
3. **Plano via Workflow** — autores em paralelo escrevem as tarefas TDD **contra um CONTRATO de interfaces FIXADAS** + **dono único por arquivo**, montagem determinística, e um **agente-crítico** adversarial. 
   - ⚠️ **LIÇÃO CRÍTICA (M1):** para tarefas que **compartilham arquivos**, o contrato DEVE **fixar todas as interfaces internas + atribuir dono único** a cada arquivo. O 1º plano do M1 falhou com **19 conflitos de ownership** (6 tarefas recriando `ability.ts`); o v2 com interfaces fixadas passou. M0 não teve isso porque cada tarefa criava arquivo distinto.
4. **Errata** — inserir no topo do plano uma seção que corrige o que o crítico apontou (prevalece sobre as tarefas). Padrão usado em todos os marcos.
5. **Execução** (skill `superpowers:subagent-driven-development`) — 1 subagente por tarefa, em ordem de dependência, **gate por tarefa = `npm run test`** (tsc/build/e2e total = última tarefa), **revisão em 2 estágios** (compliance de spec → qualidade de código), loop de correção. As revisões pegaram bugs reais em todos os marcos.
6. **Verificação final** + **rodar o jogo + screenshot** (Playwright) pra prova visual.
7. **Commit + push.**

**Ultracode está LIGADO** nesta sessão → usar `Workflow` para tarefas substanciais; otimizar por correção exaustiva, não custo.

---

## 6. Higgsfield (geração de arte) — funcionando

- Conta: workspace **Team "Gzero"** (owner), ~**3.760 créditos**. As operações de conta voltaram a funcionar (estavam falhando antes).
- **Imagem:** modelo `nano_banana_pro` (image-to-image, ótimo p/ transformar foto→estilo preservando rosto). **Vídeo:** `seedance_2_0` (image-to-video).
- **Fluxo de upload (MCP):** `media_upload` (retorna URL pré-assinada) → `curl -X PUT --data-binary @arquivo "<url>"` → `media_confirm(media_id)`. Depois usar `media_id` como `medias:[{value,role:'image'}]` no `generate_image`.
- **Geração é assíncrona:** `generate_image`/`generate_video` retornam jobs `pending` → buscar resultado com `show_generations`. Baixar a `rawUrl` com curl.
- **Pipeline de arte (D):** gerar arte-base (foto do membro + o **atlas original** `.m2-samples/original-atlas.png` como **referência de estilo**) → chroma-key no load (off-white→transparente) → `public/assets/` → o motor anima por código.
- **Prompts que funcionaram** (ver `.m2-samples/` e os specs): personagem = "cute friendly 2D platformer hero, soft refined pixel art like the reference sprite sheet, bright warm palette, clean outline, full body idle, on plain off-white background, small magenta/cyan accent"; background = "bright soft pixel-art floating-island sky kingdom like the reference, pastel sky, clouds, trees, + a subtle Gzero portal glowing magenta/cyan".
- **Referências de estilo** (já no Higgsfield e em `.m2-samples/`): foto do Artur (selfie), `original-atlas.png`, `original-bg.jpg`. Fotos dos membros: Artur em `C:\Users\artur\Área de Trabalho\Artur-Fotos-Avatar` (100 selfies); equipe em `C:\Users\artur\Área de Trabalho\Gzero\Higgsfield\Selfies` (17). Renan/Dante têm presença pública; Einstein (pai do Renan) precisa de foto.

---

## 7. Índice de documentos & assets

- **Specs:** `docs/superpowers/specs/2026-06-08-gravidade-zero-game-design.md` (mestre, §0 cânone) · `…/2026-06-08-m2-art-animation-design.md` (arte/animação M2).
- **Planos:** `docs/superpowers/plans/2026-06-08-gzero-m0-vertical-slice.md` · `…/2026-06-08-gzero-m1.md` · `…/2026-06-08-gzero-m2a.md` (cada um com Errata no topo).
- **Dossiê da empresa:** `docs/gzero-site-dossier.md` (+ `gzero-site-pages.json`) — leitura das 26 páginas de gravidadezero.space.
- **Memória do agente:** `C:\Users\artur\.claude\projects\C--Users-artur--rea-de-Trabalho-Gzero-SuperGzeroWorld\memory\` (`gzero-game-project.md`, `artur-gzero.md`, índice `MEMORY.md`).
- **Scratch de arte M2 (gitignored):** `.m2-samples/` — amostras geradas (`new-artur-v1.png`, `new-bg.png`, `background.png`/cósmico, `artur-video-C.mp4`, `procedural-demo.html`), referências originais, etc.
- **Tokens de marca:** `C:\Users\artur\Área de Trabalho\Gzero\Diretriz_Design_Gzero\` (BRAND.md, tokens.css) e logos SVG em `…\Logo_Gzero_vetores\`.

---

## 8. Próximos passos

1. **M2b** — gerar arte-base dos 4 (Renan/Dante/Julio/Einstein) com o pipeline acima; mapear em `data/assets.ts` (`char.<id>`); o render já usa `char.artur` fixo → generalizar p/ `char.${player.char.id}` com fallback. FX por habilidade (trilha do dash, aura do escudo, bloco do builder, time-warp, modo Humanware) usando partículas/overlays.
2. **M2c** — inimigo "Tolo" com arte animada (patrulha/freeze/stomp/death) + elementos (moedas/portais/plataformas/coletáveis).
3. **M2d** — backgrounds por mundo (parallax, ambos os climas) + cinematográfico (tela de título, retratos animados na seleção via vídeo `seedance`).
4. **Cleanup pendente (chip de tarefa criado):** **downscale** dos 3 PNGs em `public/assets/` (~5 MB cada/~15 MB total, são renders 2k) pro tamanho de sprite/background — enxuga o repo. Sem regressão visual.

---

## 9. Gotchas / convenções (importante)

1. **`dt` é em FRAMES**, não segundos. As constantes de física são por-frame; o loop chama `step(1)` por passo fixo. O **timer da fase** decrementa `dt*FIXED_DT` (segundos) à parte. Não confundir.
2. **Input edge timing:** `pressed(a)` é true por 1 frame; o `game.update` chama `input.update()` **por último** (depois de a lógica ler as edges). No Playwright, `pressed`/confirm precisa de **tecla REAL** (`page.keyboard.press`); `dispatchEvent` sintético funciona para `isDown` (segurar movimento) mas pode não disparar o edge de confirm.
3. **Bug do `Workflow` `args`:** passar `args` como string JSON faz `args.x` virar undefined no script. **Embuta os dados direto no script** (foi o que resolveu nos workflows de leitura/plano).
4. **Windows/Git Bash:** caminhos com acento ("Área de Trabalho") e espaços — sempre aspas. Higgsfield no Node precisa de caminho `C:/...` (não `/c/...`).
5. **favicon 404** no console é benigno (não há favicon; usar o logo "G0" depois).
6. **PNGs grandes** em public/assets inflam o repo — downscale pendente (chip criado).
7. **CRLF warnings** do git no Windows são cosméticos.

---

## 10. Transcrição verbatim desta sessão

A transcrição **bruta** da sessão (todos os turnos, tool calls e resultados) está em:
`C:\Users\artur\.claude\projects\C--Users-artur--rea-de-Trabalho-Gzero-SuperGzeroWorld\f5d20401-c588-4327-87f7-bd3be759de25.jsonl` (~7 MB, 1.422 linhas JSONL).

**Recomendação:** para continuar o projeto, este HANDOFF + os specs/planos/dossiê/memória versionados são **mais úteis e completos** que o JSONL bruto (que é enorme e ruidoso). Se o chat novo quiser mesmo o diálogo verbatim em formato legível, peça — dá pra extrair (mensagens user+assistant, omitindo os blobs gigantes de tool-result) para `docs/SESSION-TRANSCRIPT.md`.
