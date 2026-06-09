# Gravidade Zero — O Jogo · M2b: Artur animado pela arte ORIGINAL (frame-a-frame)

_Data: 2026-06-09 · Status: aprovado pelo Artur · Refina a §5 (decomposição M2) do spec de arte/animação._

## 0. Decisão (TRAVADA)

O Artur (usuário) criou um **character sheet pixel-art próprio** do personagem dele. Decisão dele: **usar a criação original**, não re-gerar com IA. Pipeline: **extrair os frames do sheet (cópia fiel dos pixels) → pixelizar pro grid nativo (preservando as cores dele) → animação FRAME-A-FRAME** no jogo.

- **Não** é o procedural do M2a (que deforma 1 arte-base) nem geração por IA (gpt_image_2 suaviza; Recraft é vetor; PixelLab re-cria text-driven). Esses ficam **descartados pros personagens principais**; PixelLab fica reservado pra cenário/tilesets/objetos.
- O motor **procedural do M2a permanece como FALLBACK** (personagens sem sprite-sheet de frames continuam procedural/placeholder).
- **Escopo deste marco = só o Artur.** Os outros 4 (Renan/Dante/Julio/Einstein) = passo seguinte (decisão adiada).

## 1. Pipeline de assets (já executado — Python/PIL)

Fonte: sheet do Artur em upscale 2× (`.m2-samples`/Downloads). Passos (script `gz_build_artur.py`):
1. **Detecção** das bandas de animação por projeção de conteúdo vs fundo (idle/corrida, pulo/queda, ataque/danificado).
2. **Recorte fiel** de cada frame + **flood-fill** das bordas removendo o fundo (preserva brancos internos: olhos, sola).
3. **Pixelização**: downscale LANCZOS pro grid nativo + snap de alpha. **Sem** forçar paleta (quantização adaptativa preserva os tons reais; forçar a paleta-9 do sheet distorce → manchas).
4. **Alinhamento**: escala global (altura do idle → ~78px), âncora **pés na base + centro horizontal** num canvas **96×96**.
5. Saída: **1 sprite-sheet horizontal por animação** (células 96×96, fundo transparente) + `meta.json`.

**Curadoria** (frames mantidos): `idle` 3 (frontal; descarta a vista de costas), `corrida` 4 (perfil), `pulo` 3 (perfil), `queda` 4 (perfil), `danificado` 3 (descarta o frame com faísca solta). `ataque` guardado (Builder não tem ataque tradicional).

## 2. Formato no jogo

- `public/assets/chars/artur/{idle,corrida,pulo,queda,danificado}.png` — sheets horizontais, **célula 96×96**, **transparente** (chromaKey = **false**).
- Âncora dentro da célula: **anchorX=48, anchorY=92** (pés). Personagem ~78px de altura.

## 3. Arquitetura

### 3.1 `src/engine/spriteAnim.ts` (NOVO — dono único; lógica pura + desenho)
```ts
export interface FrameAnim { key: string; frames: number; fps: number; loop: boolean }
export interface CharAnimSet {
  cellW: number; cellH: number; anchorX: number; anchorY: number; drawH: number
  anims: Partial<Record<AnimState, FrameAnim>>   // AnimState de animator.ts
}
// índice do frame: t em frames-de-JOGO; fps em frames-de-ANIMAÇÃO/seg; FIXED_DT=1/60.
export function frameIndex(fa: FrameAnim, t: number): number
  // adv = Math.floor(t * fa.fps * FIXED_DT); loop -> adv % frames ; senão -> min(adv, frames-1)
export function drawCharFrame(
  r: Renderer, store: AssetStore, set: CharAnimSet, state: AnimState, t: number,
  x: number, y: number, facing: 1|-1,
): boolean
  // fa = set.anims[state] ?? set.anims['idle']; sheet = store.get(fa.key); se null -> return false
  // idx = frameIndex(fa,t); sx = idx*cellW; desenha a célula escalada p/ drawH, ancorada (anchorX,anchorY)
  //   nos pés do corpo (x=centro, y=base), espelhada por facing. return true.
```

### 3.2 `src/data/charAnims.ts` (NOVO — dono único)
- `ARTUR_ANIMS: CharAnimSet` com o mapeamento §4.
- `CHAR_ANIMS: Record<string, CharAnimSet> = { artur: ARTUR_ANIMS }` (só Artur por ora).

### 3.3 `src/data/assets.ts` (dono existente — adicionar entries)
- `char.artur.idle|corrida|pulo|queda|danificado` → `{ url: '/assets/chars/artur/<x>.png' }` (chromaKey omitido = false).
- Mantém `char.artur` (arte-base) e os bg.

### 3.4 `src/game/game.ts` (dono existente — integração no render do player)
- Reusa `playerAnim` (state+t do `updateAnimator`, já chamado no update).
- No bloco do player (após `drawAbilityFx`, respeitando o blink de i-frames):
  ```
  const set = CHAR_ANIMS[player.char.id]
  const drewFrame = store && set && drawCharFrame(renderer, store, set, playerAnim.state, playerAnim.t,
                       player.x + player.w/2, player.y + player.h, player.facing)
  if (!drewFrame) { /* fallback M2a: drawAnimatedSprite(char.artur) ou drawPlaceholder */ }
  ```

### 3.5 `src/main.ts` — sem mudança (o manifest já é carregado por `loadAssets`).

## 4. Mapeamento AnimState → animação (Artur)

| AnimState | sheet | frames | fps | loop |
|---|---|---|---|---|
| idle | char.artur.idle | 3 | 6 | sim |
| walk | char.artur.corrida | 4 | 10 | sim |
| run | char.artur.corrida | 4 | 15 | sim |
| jump | char.artur.pulo | 3 | 12 | não (segura o último) |
| fall | char.artur.queda | 4 | 12 | não |
| hurt | char.artur.danificado | 3 | 8 | sim |

## 5. Testes
- `spriteAnim.frameIndex` — unit (loop wrap, clamp do não-loop, dependência de fps/t/FIXED_DT, valores finitos).
- `drawCharFrame` — smoke (jsdom): retorna false e não lança quando o asset falta (fallback); com asset mock, chama `drawImage` no sub-rect certo.
- `game` integração — smoke; **E2E** existente (select → andar → win) continua verde com o Artur frame-a-frame.

## 6. Não-objetivos (deste marco)
- Outros 4 personagens (Renan/Dante/Julio/Einstein) — sem sheet ainda; passo seguinte.
- Habilidade/ataque do Artur com frame dedicado; retratos/telas com a arte; downscale dos PNGs grandes antigos — fora de escopo aqui.
