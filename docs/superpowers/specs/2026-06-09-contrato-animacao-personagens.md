# Contrato de Animação por Personagem — 2026-06-09

_Define o conjunto CANÔNICO de animações de personagem jogável. O Artur estreia o contrato (Fase B da revisão geral); os outros 4 (Renan/Dante/Julio/Einstein) DEVEM ser produzidos exatamente neste formato — mesmas contagens de frames sempre que possível, para reusar timing, testes e pipeline. Prevalece sobre menções anteriores de animação nos specs M2._

## 1. Formato técnico (por personagem)

- **Célula:** 96×96 px · **âncora dos pés:** (48, 92) · **corpo:** ~78 px de altura (declarado como `bodyHpx` no `CharAnimSet`).
- **Escala de desenho: SEMPRE INTEIRA** — `drawH = 96` (1×). Nunca escalar por fator não-inteiro (causa shimmer). Fonte única em `charAnims.ts`.
- **1 PNG horizontal por animação** (frames lado a lado), fundo transparente, em `public/assets/chars/<id>/<anim>.png`.
- **`meta.json`** por personagem (célula, âncora, contagem de frames por sheet) — validado pelo teste de consistência `charAnimsMeta.test.ts` (estende-se a cada personagem novo).
- **Facing:** direita desenhada; esquerda = flip horizontal no engine.

## 2. Estados de animação (AnimState)

### Contínuos (classificados pela física — `classifyAnim`)

| Estado | Sheet | Frames | FPS | Loop | Fallback se ausente |
|---|---|---|---|---|---|
| `idle` | idle.png | 3–6 | 6 | sim | — (obrigatório) |
| `walk` | walk.png OU corrida.png retimada | 4 | 10 | sim | corrida @10fps |
| `run` | corrida.png | 4–6 | 15 | sim | — (obrigatório) |
| `jump` | pulo.png | 3 | 12 | não (clampa no último) | — (obrigatório) |
| `fall` | queda.png | 3–4 | 12 | não | — (obrigatório) |

### One-shots (disparados por evento, expiram por duração; prioridade sobre os contínuos)

| Estado | Sheet | Frames | FPS | Duração | Gatilho | Fallback se ausente |
|---|---|---|---|---|---|---|
| `land` | land.png (opcional) | 2–3 | 15 | ~10f | tocar o chão vindo do ar | squash procedural sobre `idle` |
| `skid` | skid.png (opcional) | 1–2 | 12 | ~8f | inverter direção em `run` | lean procedural sobre `run` |
| `cast` | ataque.png | 4 | 12 | ~18f | usar habilidade (J) | flash procedural sobre `idle` |
| `hurt` | danificado.png | 3 | 8 | ~24f (**separado dos i-frames de 90f**) | tomar dano | — (obrigatório) |
| `victory` | vitoria.png (opcional) | 1–2 | 6 | mantido na tela de vitória | atravessar o portal | frame 2 do pulo, mantido |
| `death` | morte.png (opcional) | 2–3 | 8 | ~30f antes do respawn/over | perder vida/morrer | `hurt` + rotação/fade procedural |

### Regras de exibição (valem para TODOS os personagens, vêm do engine)

- **Overlay procedural sobre o frame** (`getFrameTransform`): respiração sutil no idle, lean na corrida, stretch no pulo, squash no pouso — a "vida" do M2a aplicada POR CIMA do frame-a-frame.
- **Sombra de contato:** elipse escura procedural nos pés (alpha ~0.25), encolhe no ar e some em queda longa.
- **Invulnerabilidade ≠ esconder:** durante i-frames o sprite alterna `globalAlpha` 1.0/0.45 (NUNCA omitir o draw — a animação de dano precisa ser vista).
- **Hitstop ~3f + screen-shake leve (~8f)** ao tomar dano e ao stompar inimigo.

## 3. Mínimo obrigatório por personagem novo

`idle`, `corrida`, `pulo`, `queda`, `danificado`, `ataque/cast` (6 sheets). Os demais são opcionais — os fallbacks procedurais cobrem. **Entrega = sheets + meta.json + entrada em `CHAR_ANIMS` + cores canônicas já em `characters.ts`.**

## 4. Produção dos outros 4 (caminho decidido)

1. **Corpo-base = frames do Artur** (kitbash): mesma silhueta/timing; troca de paleta de roupa pras cores canônicas do personagem via remapeamento de rampa (provado em demo 2026-06-09).
2. **Cabeça/cabelo/acessórios por personagem**, redesenhados pixel a pixel guiados por **referência de identidade** gerada no Higgsfield (`nano_banana_pro`, foto → retrato hi-res; NUNCA pedir pixel art ao Higgsfield).
3. Einstein: cabelo branco + óculos (alto contraste, fácil); Julio/Renan/Dante: conforme fotos.
4. Curadoria com o Artur por contact sheet ANTES de integrar; retoque manual dele em PNG é bem-vindo.
5. PixelLab fica como plano B por personagem e ferramenta principal de cenário/inimigos/objetos.

## 5. Fonte dos frames do Artur

- Sheet original: `C:\Users\artur\Downloads\hf_20260609_024357_facae4a1-deac-4981-a8fd-588b0124f0ae.png` (apresentação; extração via `%TEMP%\gz_build_artur.py`).
- Frames extraídos e curados: `%TEMP%\gz_artur_anim\`.
- Integrados no jogo: `public/assets/chars/artur/{idle,corrida,pulo,queda,danificado,ataque}.png` + `meta.json` (ataque = 4 frames reais do sheet, integrado como `cast` na Fase B).

## 6. Decisões registradas (2026-06-10, pós-revisão adversarial)

- **Hitbox × corpo visual (REVISADA 2026-06-11, pós-playtest do dono):** player agora **38×64** sob corpo de ~78px = **1,22×** — hitbox honesta, pedido do dono no playtest de 2026-06-11 (a antiga 34×42/1,86× deixava a hitbox pequena demais sob o corpo visual). Tolo: **42×46** sob sprite de 56px (mesmo 1,22×). Consequências absorvidas: (1) o validador de alcance usa `PLAYER_H` importado — com h=64 as subidas exigidas FICAM menores e todos os tilemaps canônicos seguem válidos sem alteração; (2) o spawn passou a ser posicionado pelos pés na célula `S` (h=64 > tile 48; o top-left enterrava os pés na célula de baixo e atravessava piso one-way no 1º frame); (3) na W1-1, o vão de 1 tile sob o `B` da col 86 deixou de ser passável por baixo — o caminho canônico vira pular POR CIMA do bloco (apex 4,2 tiles, trivial; documentado em teste).
- **`death` e `skid`:** estados definidos no contrato com fallbacks procedurais já implementados no engine (ONE_SHot_FALLBACK + transforms); os GATILHOS (sub-estado dying de ~30f antes do over; skid na inversão em corrida) ficam como backlog registrado — não bloqueiam os 4 personagens futuros.
- **`victory`:** disparada no goal e transferida para o estado no mesmo frame (fallback = frame de pulo mantido).
