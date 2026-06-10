# Revisão Geral do Projeto — 2026-06-09

_Método: 6 revisores especializados em paralelo (arquitetura/engine · código do jogo · game design/conteúdo · direção de arte (UI Designer) · UX/game-feel (UX Researcher) · testes/infra) + síntese com deduplicação e priorização. Evidência: leitura integral do código + screenshots reais do jogo em `docs/evidence/`. Framework de crítica de design aplicado (primeira impressão, usabilidade, hierarquia, consistência, acessibilidade)._

_Prioridade declarada pelo dono (Artur): 1º completar o boneco dele, 2º mapa/tiles, 3º elementos do jogo, 4º UI/UX — outros 4 personagens DEPOIS. Sem limitações de escopo (specs, arquitetura, até outline de botão)._

---

## Diagnóstico geral

O motor está sólido e bem testado (timestep fixo com clamp, física por eixo, 311 testes unitários, fallback de assets em cascata), mas **a experiência percebida está muito atrás da engenharia**: tiles e elementos ainda são retângulos chapados sobre um background profissional, não há um único som, e a única fase é um greybox de 40 colunas vencível em ~6s sem nenhuma decisão de jogador.

**O boneco do Artur "parece ruim" por causas técnicas baratas, não pela arte**: escala não-inteira (drawH=110 sobre célula 96 → shimmer), walk reusando o sheet de corrida (foot-slide), blink de i-frames escondendo a animação de dano e hitbox de 42px sob um corpo de ~89px.

Maiores ganhos imediatos: (a) meia sessão de **destraves de engine** (assets allSettled, boot que não pendura, canvas escalado, partículas world-space) que protege toda a arte que vai entrar; (b) o pacote **"Artur completo"** (maioria itens S); (c) **tileset real + a fase W1-1**, que já está desenhada batida-a-batida no spec mestre §8.3 — é execução, não design. A mecânica-assinatura **Humanware está matematicamente inativável** na fase atual (máx. 144/1000) e sem assinatura visual — resolve junto com a fase nova. **Deploy e CI estão em zero apesar de prontos para ligar** (vercel.json pronto, Playwright CI-aware): 1 sessão dá URL pública + gates automáticos, em paralelo às frentes de arte. **Juice barato** (emitBurst nos eventos, SFX procedurais WebAudio) transforma a percepção de protótipo para jogo com pouquíssimo código novo.

A convergência entre os 6 revisores é altíssima nos temas Artur/tiles/Humanware/telas, o que valida a ordem de prioridade declarada do dono.

---

## Convergências (apontadas por 2+ revisores)

1. Escala não-inteira do sprite do Artur (drawH=110 sobre célula 96) entorta o pixel art e gera shimmer — _game-codigo, game-design, arte_
2. Set de animações do Artur incompleto: walk reusa corrida (foot-slide); faltam habilidade/morte/vitória — _arquitetura, game-codigo, game-design, arte_
3. Hitbox 34×42 sob corpo visual de ~89px (>2x) desalinha colisão e leitura — _game-codigo, game-design, arte_
4. Blink de i-frames esconde a animação 'danificado'; estado hurt sequestra os 90 frames — _game-design, ux_
5. Tiles escuros chapados (#121216/#2a2a32) ilegíveis sobre o céu claro; engine sem suporte a tileset/atlas — _arquitetura, game-codigo, game-design, arte_
6. Uma única fase hardcoded sem registry/progressão; win volta ao select — _arquitetura, game-codigo, game-design_
7. Humanware sem assinatura visual, medidor enganoso (mostra cheio entre 875–999) e **inativável na fase atual (máx 144/1000)** — _game-codigo, game-design, ux_
8. Zero áudio no projeto inteiro — _arquitetura, game-design, ux_
9. Zero FX nos eventos de gameplay (emitBurst usado 1 única vez); partículas presas em screen-space — _ux, game-design, arquitetura_
10. Goal = retângulo magenta liso (cânone pede portal); colisão semântica de cores: magenta = objetivo/inimigo/vida/cursor; lime = moeda E bloco do builder — _game-codigo, game-design, arte_
11. Pause mapeado no input mas morto (Esc não faz nada) — _todos os 5_
12. Sem title screen: boot cai direto na seleção — _game-codigo, game-design, ux_
13. Canvas fixo 960×528 sem escala ao viewport (janelinha em 1080p+) — _arquitetura, ux, infra_
14. Seleção expõe ids internos snake_case ('salto_visionario'); retrato do Artur estático/menor que os placeholders — _game-codigo, game-design, ux, arte_
15. Telas win/over sem stats/placar; frase da marca "queimada" na vitória de fase — _game-codigo, game-design, ux, arte_
16. Checkpoints inexistentes (respawn sempre no spawn inicial) — _game-codigo, game-design_
17. FX de habilidades ausentes/ilegíveis (dash e pulo duplo sem FX; builder/emc2 confusos) — _game-codigo, game-design_
18. Favicon/meta ausentes (404 no console); title da aba inconsistente com a marca — _ux, infra_
19. input.update() repetido em vários pontos de saída do update (risco de vazar edges) — _arquitetura, game-codigo_
20. HUD confuso: medidor Humanware sem rótulo/quase invisível; dupla economia vidas/corações na mesma cor — _ux, arte_

---

## Frentes priorizadas

### F1 — Destraves de engine & assets · prioridade 1 · tamanho S

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P0 | loadAssets tudo-ou-nada (Promise.all, assets.ts:84-89): 1 PNG quebrado derruba TODA a arte | Promise.allSettled cacheando os que resolveram + log por chave; remover caminho 'sem store' do main.ts | S |
| P1 | loadImage pode pendurar o boot se getImageData lançar (assets.ts:64-67) — tela preta sem fallback | try/catch resolvendo com a Image crua; opcional timeout ~10s por asset | S |
| P1 | Canvas fixo 960×528 px CSS: minúsculo em 1080p+/4K | Upscale por inteiro via CSS no resize (scale = max(1, floor(min(innerW/960, innerH/528)))); buffer intocado; image-rendering: pixelated | S |
| P1 | Partículas só em screen-space: 'grudam' na tela quando a câmera move — inviabiliza juice world-space | Campo space: 'world'\|'screen' na Particle; desenhar 'world' dentro de beginWorld/endWorld | S |
| P2 | input.update() em 4 pontos de saída; código morto (abilityIFramesOnHit, case 'goal'); isFullSolid/tileAt duplicados | update() UMA vez no fim; remover mortos; exportar helpers de physics.ts | S |

### F2 — Artur completo · prioridade 2 · tamanho M

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P0 | Escala não-inteira drawH=110/célula 96 (1,146x): shimmer, arte 'suja'; acoplamento frágil com SPRITE_DRAW_H=90 | Travar escala inteira (drawH=96 imediato); fonte única TARGET_BODY_H em constants.ts + bodyHpx por CharAnimSet | S |
| P0 | Animações incompletas: walk=corrida com fps menor, 'ataque' extraído e não mapeado, sem habilidade/morte/vitória/turn, idle 3f | Mapear 'ataque' como cast do Builder (one-shot no J); walk dedicado; pose de vitória no overlay win; morte 20-30f; idle 4-6f; frames novos via pipeline do style guide com frames reais como âncora | M |
| P0 | Animator sem one-shots (land/skid/ability) nem eventos; drawCharFrame ignora SpriteTransform (squash/stretch do M2a se perde) | Estados one-shot com expiração + hooks onEnter/onFrame (partículas/SFX); transform leve sobre o frame (squash ao pousar, lean na corrida) | M |
| P0 | Hurt sequestra a animação por 90f enquanto o blink esconde o sprite — dano invisível | Separar hurtTimer (~20-25f) dos iframes (90); invulnerabilidade = globalAlpha 1.0/0.45; hitstop ~3f + screen-shake no dano | S |
| P0 | Corpo ~89px com hitbox de 42px: inimigo 'acerta o joelho', moedas atravessam o peito | Subir hitbox p/ ~40×80 OU reduzir corpo p/ ~60-72px (1,4x padrão); decidir JUNTO com o redesign da W1-1; registrar no spec | M |
| P1 | Sem sombra de contato: Artur parece flutuar sobre o bg claro | Elipse escura procedural (alpha ~0.25) no pé, encolhendo no ar (~20 linhas) | S |

### F3 — Infra & deploy (paralelizável) · prioridade 3 · tamanho S

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P0 | Jogo não deployado (vercel.json pronto, sem projeto) | vercel link no time gravidadezero + Git no dashboard: produção em push + preview por branch | S |
| P0 | Sem CI (.github/ inexistente); playwright já é CI-aware | ci.yml: node 22 + tsc + vitest + build + e2e chromium + report em falha | S |
| P1 | Typecheck nunca roda fora do editor (build = só vite build) | Script typecheck + build = "tsc --noEmit && vite build" + passo no CI | S |
| P1 | index.html sem favicon (404 sempre)/meta/OG; title inconsistente com a marca | G0_favcon_Vector.svg → public/favicon.svg + metas; alinhar title | S |
| P1 | Sem README/LICENSE — repo vitrine abre 'pelado' | README ~30 linhas: screenshot, pitch, controles, quickstart, links | S |
| P1 | e2e: 1 spec caminho-feliz; dano/over, Humanware, habilidades e reset sem gate | Probe __GAME() rico {state,lives,hearts,hwMeter,...}; specs damage-over/humanware/reset | M |
| P2 | version 0.0.0, sem engines; sem Prettier; bgs sem otimização final | 0.3.0 + tag por marco; engines node>=20; Prettier no CI; oxipng nos bgs | S |

### F4 — Tileset & mapa (fase W1-1 de verdade) · prioridade 4 · tamanho L

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P0 | Tiles = retângulos escuros chapados sobre céu pastel: leem como buracos pretos; contradizem a direção 'pixel claro/suave' | Paliativo (1h): re-tint claro + borda 3px no topo. Definitivo: tileset via PixelLab create_sidescroller_tileset em 16px escalado ×3 nearest p/ TILE=48; validar contact sheet contra o style guide ANTES de integrar | M |
| P0 | Engine sem tiles: Renderer só drawRect; sem atlas/autotiling/animação; desenho de imagem fura abstração via r.ctx | src/engine/tilemap.ts: Renderer.drawSprite + TileAtlas + autotiling bitmask 4-bit no parseLevel + tiles animados por clock global + camada decoração | L |
| P0 | Fase única = greybox plano de 40 colunas, vencível em ~6s, zero decisões, habilidades sem uso motivado | Implementar a W1-1 'O Primeiro Passo Leve' do spec §8.3 (144 colunas, 7 seções, tilemap pronto nas linhas 4022-4108 do spec) — é execução, não design | L |
| P0 | Humanware inativável: máx 144/1000 na fase atual | W1-1 nova com economia ≥1000 (~38 moedas + stomps + heart-orbs); e2e 'encher→ativar→congelar' como gate | M |
| P1 | Sem registry de fases; Builder MUTA level.tiles in-place (risco de vazamento entre rodadas) | Registry + loadLevel(id) que RE-PARSEIA (tiles frescos); win→próxima zona; ponto natural p/ parallax/música/atlas POR MUNDO; validateLevel() | M |
| P1 | Faltam tiles/entidades do cânone p/ a W1-1: bloco '?', heart-orb, checkpoint, spike inerte E invisível | Onda 1: '?' com payload, heart-orb, checkpoint por coluna, spike com dano + desenho; onda 2 (W1-2): mola, plataforma móvel | M |
| P1 | Câmera dura 1:1 com clamp: trancos verticais que pioram com arte real | Deadzone ~2 tiles + lookahead ~80px + follow vertical só onGround + lerp 0.15 | S |
| P1 | Parallax 1 camada; bg.cosmic carregado e NUNCA usado; clear preto cria massa escura embaixo | level.bgLayers por mundo (céu claro 3 camadas 0.05/0.3/0.55; mundo 2 = cosmic) + cor de clear por mundo | M |

### F5 — Elementos do jogo · prioridade 5 · tamanho L

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P1 | Goal = retângulo magenta idêntico a tile, mesma cor de inimigo/vidas/cursor; cânone pede Portal | Portal animado 48×96 (anel magenta + núcleo ciano, 4f @8fps + partículas sugadas); quick win: inimigo → COLOR_VIOLET | M |
| P1 | Moeda (lime 26px) e bloco do builder (lime 48px): MESMA cor, significados opostos; bloco some sem aviso | Moeda: spin dourado 4-6f; builder: holograma CIANO com brackets, piscando nos últimos ~60f do TTL | S |
| P1 | Tolo = retângulo magenta: zero ameaça; vibra no lugar sobre 'platform' (borda não conta one-way como piso) | Sprite do Tolo no style guide (walk 2-4f + morte 2f + congelado azulado) — cobaia do pipeline de arte; fix da vibração: aceitar 'platform' na checagem de piso | M |
| P1 | Inimigos hardcoded 'tolo': sem hp/dano/comportamento por tipo — chefes M3 sem onde plugar | ENEMY_DEFS data-driven (padrão CHARACTERS) com behavior 'patrol'\|'shooter'\|'boss' | M |
| P1 | FX de habilidade ausentes: dash e pulo duplo SEM FX; escudo = 4 barras 2px (cânone: arco 160°); emc2 = faixa 2px | Dash: after-images; pulo duplo: poeira nos pés; emc2: tint global; escudo: arco frontal 160° com fade | M |
| P1 | Acentos da marca sem regra: 4 significados por cor | Token-system semântico: MAGENTA = marca/objetivo · CIANO = tecnologia/habilidades · VIOLET = inimigos · LIME = colecionáveis | S |
| P2 | Só o player anima: moedas/goal/inimigos estáticos | AnimInstance leve {set,state,t} + clock global — drawCharFrame já é genérico | M |

### F6 — Juice & áudio · prioridade 6 · tamanho M

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P0 | Zero FX nos eventos: emitBurst usado 1 vez no jogo todo | Ligar aos eventos existentes (~6 call sites): moeda 8 lime, stomp 12, aterrissagem 4-6 poeira, pulo 3 — alavanca mais barata de game-feel | S |
| P1 | Zero áudio: sem SFX nem música (~50% do game-feel percebido) | src/engine/audio.ts WebAudio procedural (§12 do spec, sem assets): unlock no 1º input, fila de eventos drenada pelo main — lógica pura, testes intactos | M |
| P1 | Humanware sem assinatura visual; HW_MODE_FRAMES=300 vs 360 do cânone; slow-mo invisível | Vinheta magenta + escurecimento leve no Modo; meter vira barra de duração; 360f; updateParticles(ps, dt*ws) | M |
| P2 | render(alpha) descarta interpolação: judder em 120/144Hz | prevX/prevY no Body + prev na Camera; lerp no render (Math.round mantém crisp) | M |

### F7 — HUD & telas · prioridade 7 · tamanho M

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P1 | Seleção expõe snake_case como habilidade; sem descrição/stats | abilityName + abilityDesc no CharacterDef; painel de detalhe com corações em ícones + barras de stats | S |
| P1 | Cursor inicia no placeholder; retrato do Artur estático e menor; cards contraste ~1,1:1; 4 retângulos leem como bug | Cursor inicia no Artur; idle ANIMADO no card selecionado; retrato escalado por bodyHpx; painéis #1c1c22 + borda; silhuetas + tag 'EM BREVE' | S |
| P1 | BUG: medidor mostra 4/4 cheio com meter 875-999 (Math.round) mas H exige 1000 | Math.floor + 4º segmento só com meter ≥ MAX; rótulo 'HUMANWARE [H]'; estado PRONTO piscando | S |
| P1 | LIVES magenta + corações magenta no mesmo canto; medidor invisível; sem hierarquia | Corações com forma própria; vidas = ícone ×3; mini-sprites 16px ×2; slots do medidor com outline ciano | S |
| P1 | Win/over texto cru; sem stats/score do cânone; frase da marca queimada na vitória de fase | Tela 'ZONA CONCLUÍDA': moedas/tempo/rank + score (+100/+200/+1000 + bônus); confete; frase da marca SÓ no final do jogo; delay ~45f | M |
| P1 | Esc morto; J/H/Shift nunca comunicadas | Estado 'paused' (padrão win/over) com overlay = tela de controles; completar dica da seleção | S |
| P2 | Sem title screen nem loading visual | Estado 'title' com wordmark + 'PRESS ENTER' + partículas; 'loading' com progresso N/total | M |
| P2 | Timer corta pro game over sem aviso | TIME<50: magenta piscando; <10: rápido (+tick quando houver áudio) | S |

### F8 — Engine & arquitetura (backlog) · prioridade 8 · tamanho M

| Sev | Item | Proposta | Esforço |
|---|---|---|---|
| P2 | game.update monolítico ~120 linhas/estado; state machine sem transições/hooks | Tabela Record<GameState,{update,render}> + onEnter por estado (refactor mecânico, testes seguram) | M |
| P2 | Renderer sem drawSprite/drawText: 6 arquivos furam via r.ctx | drawSprite nasce na F4; migração gradual dos call-sites | S |
| P2 | Input só teclado (sem Gamepad API) | Poll de getGamepads() dentro de isDown/pressed — nada fora de input.ts muda | M |
| P2 | 'char.artur' estático com chroma-key ainda carrega no boot (superseded) | Remover do manifesto ou rebaixar a fallback documentado | S |

---

## Recomendação de execução

1. **F1 (destraves)** — meia sessão; protege tudo que vem depois.
2. **F2 (Artur completo)** — a prioridade 1 do dono; maioria S, dois M.
3. **F3 (infra/deploy)** — paralelizável a qualquer momento; URL pública + CI em 1 sessão.
4. **F4 (tileset & W1-1)** — o maior salto visual; a fase já está desenhada no spec §8.3.
5. **F5 → F6 → F7** — elementos, juice/áudio, HUD/telas.
6. **Outros 4 personagens** — DEPOIS, pipeline já discutido (kitbash do corpo-base + Higgsfield p/ identidade, PixelLab como plano B).

---

## Decisões pós-execução (2026-06-10, após revisão adversarial das Fases A-E)

1. **Kill-plane implementado** (HIGH da revisão): queda no abismo custa 1 vida + respawn no checkpoint (game over sem vidas). Antes, cair no gap da W1-1 soft-lockava até o timer.
2. **Câmera com snap** (HIGH): `snapCamera` corta a câmera no início de rodada e em respawns — cam/lookX não vazam mais entre rodadas.
3. **Humanware no currículo** (HIGH de compliance — decisão): a economia da W1-1 segue o cânone §8.3 (máx ~387/1000) e o **Modo pleno entra no currículo em W1-2/W1-3** (spec §8.2). O item da F4 que pedia economia ≥1000 na W1-1 fica **supersedido**; o gate automatizado da mecânica vive na fase de teste **`?level=hw-test`** (130 moedas; e2e encher→ativar).
4. **Hitbox 34×42 mantida** (MEDIUM — decisão): generosidade pró-jogador; registrada no contrato de animação §6.
5. Aplicados também: pose de vitória visível, maxHearts no HUD (corações vazios), partículas em slow-mo (dt·ws), guard de áudio suspenso + unlock persistente, shake zerado no pause.
6. **Backlog registrado** (não bloqueante): animação de morte (sub-estado dying ~30f), gatilho do skid, spike com dano+desenho (ou rejeitar '^' no validateLevel), drenagem visual do medidor durante o Modo, bump do '?' via `ceil` exato do stepBody, grace de stomp no mesmo frame, blink do TIME baseado em clock (congela com timer pausado), pulos condicionais no e2e da zona1.
