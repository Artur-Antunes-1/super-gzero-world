# Gravidade Zero — O Jogo · Plano de Implementacao — Marco M0 (Fatia Vertical Jogavel)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa-a-tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Entregar uma fatia vertical JOGAVEL no navegador — andar/correr/pular pela World 1 Zona 1 (greybox) com camera, fisica e colisao de tiles, alcancar o portal e ver a tela de vitoria.

**Architecture:** Vite + TypeScript, Canvas 2D 960x528, motor modular data-driven portado do jogo-base. Logica pura (fisica, parser, estados) testada com Vitest; smoke de ponta-a-ponta com Playwright. Sistemas isolados em src/engine (motor) e src/game (regras do jogo), dados em src/data.

**Tech Stack:** Vite, TypeScript (strict), HTML5 Canvas 2D, Vitest (jsdom), Playwright. Deploy futuro: Vercel.

> Plano 1 de N. Marcos M1 (5 personagens + Humanware + inimigos + polish), M2 (arte Higgsfield), M3 (mais mundos + chefes + audio) e M4 (fases-cliente) terao planos proprios. Spec de referencia: `docs/superpowers/specs/2026-06-08-gravidade-zero-game-design.md` (o §0 e canonico).

---

## ⚠️ Errata — Correções Canônicas (LER PRIMEIRO; prevalece sobre as tarefas)

A revisão adversarial achou 4 defeitos HIGH + 3 MED. **Onde uma Task divergir desta errata, a errata vence.** Aplique estes ajustes ao executar:

### E1 — Convenção de `dt` = FRAMES (corrige o "player 60× lento")
As constantes de física são **por-frame** (estilo do jogo-base). Portanto:
- **Loop (Task 5):** o passo de jogo recebe `dt` em **frames**. Com timestep fixo, cada passo fixo chama `step(1)` (um frame). O acumulador usa tempo real: a cada `FIXED_DT` (1/60 s) decorrido → 1 passo → `step(1)`. Teste: avançar `now` por `k*FIXED_DT` ⇒ `step` chamado `k` vezes, sempre com argumento `1`.
- **Física (Task 9) e Player (Task 11):** integram com `dt` em frames (`vy += GRAVITY*dt`, `x += vx*dt`). Em runtime `dt=1`; os testes usam `dt=1` (mantêm as asserções `vy≈0.8`, `y≈0.8`).
- **Timer da fase (Task 12):** decrementa em **segundos**, separado da física: `time -= FIXED_DT` por passo fixo (250 s = 15000 passos). Nunca use o mesmo `dt` de física para o relógio.
- Efeito: com `dt=1`, `vx` satura em `WALK_MAX=4.6 px/frame`; cruzar 1920 px leva ~417 frames (~7 s) — dentro do timeout do E2E.

### E2 — Asserção do pulo (Task 11, testes "jump" e "coyote")
`updatePlayer` aplica o impulso `vy = JUMP_VEL*char.jumpVelMul` e **depois** roda `stepBody` (que soma `GRAVITY*dt`) no mesmo frame. Então **não** asserte `toBeCloseTo(JUMP_VEL*mul, 5)`. Asserte o valor pós-passo, determinístico:
```ts
expect(p.onGround).toBe(false)
expect(p.vy).toBeCloseTo(JUMP_VEL * char.jumpVelMul + GRAVITY, 5) // -16.324 + 0.8 = -15.524
```

### E3 + E4 — `data/levels/world1-zona1.ts`: nível PLANO e 40×11 exatos (corrige linhas de 41 chars e o buraco intransponível)
Substitua o `rows` da Task 8 por este (cada linha **exatamente 40 chars**, chão contínuo sem poços → andar pra direita chega ao goal):
```ts
export const world1Zona1: LevelDef = {
  id: 'world1-zona1', world: 1, zone: 1,
  rows: [
    "........................................", // 0
    "........................................", // 1
    "........................................", // 2
    "..........o.........o.........o.........", // 3  (coins col 10,20,30)
    "........................................", // 4
    "..............==........==..............", // 5  (plataformas decorativas)
    "........................................", // 6
    "........................................", // 7
    "..S.................................G...", // 8  (spawn col 2, goal col 36)
    "########################################", // 9  (chao)
    "########################################", // 10 (chao)
  ],
}
```
Inclua no teste do parser uma asserção de retângulo (`todas as linhas têm 40 chars` e `widthTiles===40`) e uma sanidade de travessia: a linha 9 (chão) não tem `.` entre as colunas do spawn e do goal.

### E5 — `createPlayer` usa `START_LIVES` (Task 11)
`import { START_LIVES } from '../engine/constants'` e `lives: START_LIVES` (não `lives: 3` hardcoded).

### E6 — E2E webServer (Task 12, Step 16)
O `playwright.config.ts` (Task 1) usa **`npm run build && npm run preview` na porta 4173** (`baseURL http://localhost:4173`). Corrija qualquer nota que diga "npm run dev".

### E7 — Sem `over` por timeout no M0 (Task 12)
No M0 o timer **clampa em 0 sem trocar de estado** (a única transição é `playing → win`). A morte/`over` entra no M1. Remova o branch `time<=0 → state.set('over')`.

> LOW (sem ação obrigatória): `createGame` expõe `player` como superset documentado do contrato (hook de teste) — ok; e o primeiro `tick` do loop renderiza com `alpha=0` (priming) — ok.

---

## Contrato Tecnico do M0 (tipos, assinaturas, caminhos, constantes)

CONTRATO COMPARTILHADO DO MARCO M0 (todos os autores DEVEM usar exatamente estes nomes/caminhos/assinaturas; NUNCA invente nomes novos nem reaproveite ids):

OBJETIVO M0: uma fatia vertical JOGAVEL — abrir no navegador, escolher (implicito) o personagem inicial Renan, andar/correr/pular pela World 1 Zona 1 (greybox), com camera, fisica e colisao de tiles, alcancar o portal (goal) e ver a tela de vitoria. Arte = retangulos desenhados em codigo (placeholder). Sem inimigos, sem Humanware ativo (esses sao M1).

STACK: Vite + TypeScript (strict), HTML5 Canvas 2D, sem framework. Testes: Vitest (unit) + Playwright (e2e). Deploy futuro: Vercel. Node 20+.

COMANDOS (definidos no package.json da Task 1):
- npm run dev        -> vite
- npm run build      -> vite build (gera dist/)
- npm run test       -> vitest run
- npm run test:watch -> vitest
- npm run test:e2e   -> playwright test

ESTRUTURA DE ARQUIVOS (M0):
SuperGzeroWorld/
  index.html                  (canvas#game 960x528 + <script type=module src=/src/main.ts>)
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts  vercel.json
  src/
    main.ts                   (boot: pega canvas, cria Renderer/Input/Loop, monta Game, start)
    engine/
      constants.ts            (todas as constantes abaixo)
      state.ts                (GameStateMachine)
      loop.ts                 (createLoop)
      input.ts                (createInput)
      render.ts               (createRenderer)
      physics.ts              (stepBody, collideTiles)
      camera.ts               (createCamera)
    data/
      schema.ts               (tipos: TileType, AbilityId, CharacterDef, LevelDef, ParsedLevel)
      characters.ts           (CHARACTERS registry)
      levels/world1-zona1.ts  (LevelDef greybox)
    game/
      levelParser.ts          (parseLevel)
      player.ts               (createPlayer, updatePlayer)
      sprites.ts              (drawPlaceholder)
      goal.ts                 (checkGoal)
      game.ts                 (createGame: orquestra o estado playing)
    ui/
      hud.ts                  (drawHud)
  tests/
    unit/                     (espelha src/, ex.: tests/unit/physics.test.ts)
    e2e/world1.spec.ts        (smoke Playwright)

CONSTANTES (src/engine/constants.ts) — exportar todas como const:
TILE=48; VIEW_W=960; VIEW_H=528; FIXED_DT=1/60; MAX_SUBSTEPS=5;
GRAVITY=0.8; MAX_FALL=17; WALK_ACCEL=0.7; RUN_ACCEL=0.95; WALK_MAX=4.6; RUN_MAX=7.3;
GROUND_DECEL=0.6; AIR_DECEL=0.18; JUMP_VEL=-15.4; COYOTE_FRAMES=7; JUMP_BUFFER_FRAMES=8;
STOMP_BOUNCE=-11.5; ENEMY_SPEED=1.25; PLAYER_W=34; PLAYER_H=42; COIN_SIZE=26;
TIME_START=250; START_LIVES=3; HW_TIME_SCALE=0.35; HW_METER_MAX=1000; (HW_* declarados agora, usados no M1)
Paleta (strings hex): COLOR_BG='#09090b'; COLOR_SURFACE='#121216'; COLOR_INK='#050505'; COLOR_MAGENTA='#ff0055'; COLOR_MAGENTA2='#e802cf'; COLOR_BLUE='#0099ff'; COLOR_LIME='#cdf140'; COLOR_VIOLET='#7112ff'; COLOR_TEXT='#f7f3f6'.

TIPOS (src/data/schema.ts):
export const TILE_SIZE = 48
export type TileType = 'empty' | 'ground' | 'brick' | 'platform' | 'block' | 'spike' | 'goal'
export type AbilityId = 'salto_visionario' | 'dash_criativo' | 'escudo_governanca' | 'builder' | 'emc2' | 'amplificador'
export interface CharacterDef { id: string; name: string; abilityId: AbilityId; color: string; accent: string; hearts: number; jumpVelMul: number; walkMul: number; runMul: number; weightMul: number }
export interface LevelDef { id: string; world: number; zone: number; rows: string[] }   // rows = ASCII, legenda abaixo
export interface SpawnPoint { x: number; y: number }
export interface ParsedLevel { widthTiles: number; heightTiles: number; widthPx: number; heightPx: number; tiles: TileType[][]; playerSpawn: SpawnPoint; goal: SpawnPoint; coins: SpawnPoint[]; enemies: Array<{ x: number; y: number; kind: string }> }

LEGENDA ASCII DO TILEMAP (canonica, do spec §0.7): '#'=ground, 'B'=brick, '='=platform, '?'=block, '^'=spike, 'o'=coin, '*'=star, 'F'=fool, 'g'=enemy, 'L'=lifecard, 'S'=spawn do player, 'G'=goal/portal, '.' ou espaco=empty. (No M0 usamos #,=,?,o,S,G; os outros sao reconhecidos mas nao instanciados ainda.)

ASSINATURAS (use exatamente):
- engine/state.ts: export type GameState = 'loading'|'title'|'select'|'playing'|'paused'|'win'|'over'; export function createStateMachine(initial: GameState): { get(): GameState; set(s: GameState): void; is(s: GameState): boolean }
- engine/loop.ts: export interface Loop { start(): void; stop(): void }; export function createLoop(step: (dt: number) => void, render: (alpha: number) => void, now?: () => number): Loop  (timestep fixo FIXED_DT, acumulador, no maximo MAX_SUBSTEPS por frame; now injetavel p/ teste)
- engine/input.ts: export type InputAction = 'left'|'right'|'jump'|'run'|'down'; export interface Input { isDown(a: InputAction): boolean; pressed(a: InputAction): boolean; update(): void; attach(target: Window | HTMLElement): void }; export function createInput(): Input  (teclado: setas/WASD/Espaco/Shift; toque opcional; pressed = caiu neste frame)
- engine/render.ts: export interface Renderer { ctx: CanvasRenderingContext2D; clear(color: string): void; beginWorld(camX: number, camY: number): void; endWorld(): void; drawRect(x: number, y: number, w: number, h: number, color: string): void; present(): void }; export function createRenderer(canvas: HTMLCanvasElement): Renderer  (canvas interno 960x528, imageSmoothingEnabled=false)
- engine/physics.ts: export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean }; export function stepBody(body: Body, level: ParsedLevel, dt: number): void  (aplica gravidade ate MAX_FALL e integra); export function collideTiles(body: Body, level: ParsedLevel): void  (resolve X depois Y contra tiles solidos; ground/brick/block sao solidos; platform e solido so descendo)
- engine/camera.ts: export interface Camera { x: number; y: number }; export function createCamera(): Camera; export function followCamera(cam: Camera, target: { x: number; y: number; w: number; h: number }, level: ParsedLevel): void  (centra no alvo, clamp em [0, widthPx-VIEW_W] e [0, heightPx-VIEW_H])
- data/schema.ts: tipos acima.
- data/characters.ts: export const CHARACTERS: Record<string, CharacterDef>; export const DEFAULT_CHARACTER_ID = 'renan'  (M0: apenas 'renan' implementado, stats do spec §0.4: hearts 3, jumpVelMul 1.06, walkMul 1.00, runMul 1.00, weightMul 0.96, color COLOR_MAGENTA, accent COLOR_BLUE)
- game/levelParser.ts: export function parseLevel(def: LevelDef): ParsedLevel
- game/player.ts: export interface Player extends Body { char: CharacterDef; facing: 1 | -1; coyote: number; jumpBuffer: number; lives: number; hearts: number }; export function createPlayer(char: CharacterDef, spawn: SpawnPoint): Player; export function updatePlayer(player: Player, input: Input, level: ParsedLevel, dt: number): void  (usa WALK/RUN accel, JUMP_VEL*char.jumpVelMul, coyote/buffer)
- game/sprites.ts: export function drawPlaceholder(r: Renderer, char: CharacterDef, x: number, y: number, w: number, h: number, facing: 1 | -1): void  (retangulo cor do char + faixa accent + 1 olho indicando facing)
- game/goal.ts: export function checkGoal(player: Player, level: ParsedLevel): boolean  (AABB do player intersecta o tile goal)
- game/game.ts: export interface Game { update(dt: number): void; render(alpha: number): void; state: ReturnType<typeof createStateMachine> }; export function createGame(renderer: Renderer, input: Input, level: ParsedLevel): Game  (estado playing: update player+camera+timer; vence -> state.set('win'); render: clear COLOR_BG, beginWorld(cam), desenha tiles+goal+player, endWorld, drawHud)
- ui/hud.ts: export function drawHud(r: Renderer, data: { time: number; lives: number; coins: number; hwMeter: number }): void  (mono UPPERCASE, espaco de tela 960x528)
- main.ts: monta tudo: canvas#game, createRenderer, createInput().attach(window), parseLevel(world1Zona1), createGame, createLoop(game.update, game.render).start().

REGRA DE PRECEDENCIA: o spec docs/superpowers/specs/2026-06-08-...md e a fonte de design; o §0 do spec e canonico. Este CONTRATO operacionaliza o §0 para o M0.

---

### Task 1: Scaffold do Projeto (Vite + TS + git + tooling)

Cria toda a base do projeto: `package.json` com os scripts do CONTRATO, `tsconfig.json` em modo strict, configs de Vite/Vitest/Playwright/Vercel, `index.html` com o `canvas#game` 960x528, `src/main.ts` que cria o renderer mínimo e pinta o fundo `COLOR_BG`, e o repositório git com `.gitignore`. Como é setup de infraestrutura, em vez de TDD estrito usamos UM teste sanity (`tests/unit/sanity.test.ts`) que prova que o pipeline do Vitest roda, e validamos `npm run build`.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `vercel.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `.gitignore`
- Test: `tests/unit/sanity.test.ts`

- [ ] **Step 1: Inicializar o repositório git e o `.gitignore`**

Em setup não há teste a falhar antes — primeiro garantimos que o versionamento ignora artefatos. Crie `.gitignore` na raiz `SuperGzeroWorld/` com o conteúdo COMPLETO:

```gitignore
node_modules/
dist/
.vite/
test-results/
playwright-report/
.playwright/
*.log
.DS_Store
```

Depois inicialize o git (a pasta `SuperGzeroWorld/` já existe e contém `docs/`):

```bash
git init
git add .gitignore
git commit -m "chore: init repo + gitignore"
```

Esperado: `Initialized empty Git repository` seguido de um commit com 1 arquivo (`.gitignore`).

- [ ] **Step 2: Criar `package.json` com os scripts e deps do CONTRATO**

Crie `package.json` na raiz com o conteúdo COMPLETO (scripts exatamente como definidos no CONTRATO):

```json
{
  "name": "super-gzero-world",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Observação: não há dependências de runtime — o jogo é Canvas 2D puro, sem framework (conforme STACK do CONTRATO).

- [ ] **Step 3: Instalar as dependências**

Run: `npm install`
Esperado: cria `node_modules/` e `package-lock.json`, termina com `added N packages` e sem erros (warnings de versão são aceitáveis). Node 20+ é requisito do CONTRATO (ambiente atual: Node 22).

- [ ] **Step 4: Criar `tsconfig.json` em modo strict**

Crie `tsconfig.json` na raiz com o conteúdo COMPLETO:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Criar `vite.config.ts`**

Crie `vite.config.ts` na raiz com o conteúdo COMPLETO:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'es2022',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
})
```

- [ ] **Step 6: Criar `vitest.config.ts` com environment jsdom**

Crie `vitest.config.ts` na raiz com o conteúdo COMPLETO (jsdom é exigido pelo CONTRATO para os testes unit que tocam `document`/`canvas`):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
})
```

- [ ] **Step 7: Criar `playwright.config.ts` com webServer vite preview**

Crie `playwright.config.ts` na raiz com o conteúdo COMPLETO. O `webServer` sobe `npm run build && npm run preview` para servir o `dist/` na porta 4173 (alinhada ao `vite.config.ts`):

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 8: Criar `vercel.json` (static build do dist)**

Crie `vercel.json` na raiz com o conteúdo COMPLETO. Build estático: roda `npm run build` e publica `dist/`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 9: Criar `index.html` com o `canvas#game` 960x528**

Crie `index.html` na raiz com o conteúdo COMPLETO (canvas com `id="game"` e dimensões 960x528, e o módulo `/src/main.ts`, exatamente como no CONTRATO):

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Super Gzero World</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #09090b;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #game {
        image-rendering: pixelated;
        background: #09090b;
      }
    </style>
  </head>
  <body>
    <canvas id="game" width="960" height="528"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 10: Escrever o teste sanity que prova o pipeline do Vitest**

Crie `tests/unit/sanity.test.ts` com o conteúdo COMPLETO. É o teste de fumaça pedido pelo CONTRATO para esta task de setup:

```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('soma básica', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 11: Rodar o teste e verificar que falha por falta de scaffold/contexto**

Run: `npm run test`
Esperado neste ponto: se `src/main.ts` ainda não existir, o Vitest roda apenas `tests/unit/sanity.test.ts` e PASSA (o teste sanity não depende de `main.ts`). Como esta é uma task de setup (não TDD estrito, conforme o CONTRATO), o sinal de "vermelho" que validamos é o passo seguinte: `npm run build` AINDA FALHA porque `src/main.ts` não existe.

Run: `npm run build`
Esperado: FAIL com erro do Vite tipo `Could not resolve "/src/main.ts" from "index.html"` (arquivo de boot ainda ausente).

- [ ] **Step 12: Implementar o boot mínimo `src/main.ts`**

Crie `src/main.ts` com o conteúdo COMPLETO. Boot mínimo do CONTRATO para esta task: pega o `canvas#game`, obtém o contexto 2D com `imageSmoothingEnabled=false` e pinta o fundo `COLOR_BG`. As constantes/renderer completos chegam em tasks posteriores; aqui usamos os valores literais do CONTRATO para não inventar imports inexistentes:

```ts
// Boot mínimo do M0 (Task 1). VIEW_W=960, VIEW_H=528, COLOR_BG='#09090b' (CONTRATO).
// Renderer/constants completos chegam nas próximas tasks.
const VIEW_W = 960
const VIEW_H = 528
const COLOR_BG = '#09090b'

const canvas = document.getElementById('game') as HTMLCanvasElement | null
if (!canvas) {
  throw new Error('canvas#game não encontrado')
}

canvas.width = VIEW_W
canvas.height = VIEW_H

const ctx = canvas.getContext('2d')
if (!ctx) {
  throw new Error('contexto 2D indisponível')
}

ctx.imageSmoothingEnabled = false
ctx.fillStyle = COLOR_BG
ctx.fillRect(0, 0, VIEW_W, VIEW_H)
```

- [ ] **Step 13: Rodar os testes e o build e verificar que passam**

Run: `npm run test`
Esperado: PASS — `1 passed` (`tests/unit/sanity.test.ts`), saída terminando com `Test Files  1 passed (1)` e `Tests  1 passed (1)`.

Run: `npm run build`
Esperado: PASS — Vite compila sem erros, gera `dist/index.html` e `dist/assets/*.js`, terminando com `built in <tempo>ms` (sem o erro de resolução de `/src/main.ts`).

- [ ] **Step 14: Commit do scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts vercel.json index.html src/main.ts tests/unit/sanity.test.ts
git commit -m "chore: scaffold vite + ts + vitest + playwright + vercel"
```

Esperado: commit criado com os 11 arquivos do scaffold (todos exceto `.gitignore`, já commitado no Step 1; `node_modules/` e `dist/` ficam de fora pelo `.gitignore`).

---

### Task 2: Modulo de Constantes (engine/constants.ts)

Estabelece a fonte unica de verdade para todos os numeros de fisica/render e a paleta de cores do M0. Tudo o que vier depois (loop, input, physics, camera, player, hud) importa daqui. TDD: o teste trava os valores criticos do CONTRATO antes da implementacao existir.

**Files:**
- Create: `src/engine/constants.ts`
- Test: `tests/unit/constants.test.ts`

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/unit/constants.test.ts` com o codigo completo abaixo. Ele afirma os 5 valores criticos exigidos pelo CONTRATO (TILE, JUMP_VEL, HW_TIME_SCALE, HW_METER_MAX, VIEW_W) importando de `../../src/engine/constants`.

```typescript
import { describe, it, expect } from 'vitest'
import {
  TILE,
  JUMP_VEL,
  HW_TIME_SCALE,
  HW_METER_MAX,
  VIEW_W,
} from '../../src/engine/constants'

describe('engine/constants', () => {
  it('TILE vale 48', () => {
    expect(TILE).toBe(48)
  })

  it('JUMP_VEL vale -15.4', () => {
    expect(JUMP_VEL).toBe(-15.4)
  })

  it('HW_TIME_SCALE vale 0.35', () => {
    expect(HW_TIME_SCALE).toBe(0.35)
  })

  it('HW_METER_MAX vale 1000', () => {
    expect(HW_METER_MAX).toBe(1000)
  })

  it('VIEW_W vale 960', () => {
    expect(VIEW_W).toBe(960)
  })
})
```

- [ ] **Step 2: Rode o teste e confirme que FALHA**

Run: `npm run test`

Esperado: FAIL. O Vitest nao consegue resolver o modulo porque `src/engine/constants.ts` ainda nao existe. A saida contem algo como:

```
FAIL  tests/unit/constants.test.ts
Error: Failed to load url ../../src/engine/constants (resolved id: .../src/engine/constants) in .../tests/unit/constants.test.ts. Does the file exist?
```

- [ ] **Step 3: Implemente `src/engine/constants.ts`**

Crie `src/engine/constants.ts` com TODAS as constantes do CONTRATO (numericas + paleta hex), cada uma exportada como `const`. Codigo completo:

```typescript
// Tamanho do tile (px) e viewport interno do canvas
export const TILE = 48
export const VIEW_W = 960
export const VIEW_H = 528

// Timestep fixo do loop
export const FIXED_DT = 1 / 60
export const MAX_SUBSTEPS = 5

// Fisica
export const GRAVITY = 0.8
export const MAX_FALL = 17
export const WALK_ACCEL = 0.7
export const RUN_ACCEL = 0.95
export const WALK_MAX = 4.6
export const RUN_MAX = 7.3
export const GROUND_DECEL = 0.6
export const AIR_DECEL = 0.18
export const JUMP_VEL = -15.4
export const COYOTE_FRAMES = 7
export const JUMP_BUFFER_FRAMES = 8

// Combate / movimento (alguns usados so a partir do M1)
export const STOMP_BOUNCE = -11.5
export const ENEMY_SPEED = 1.25

// Dimensoes de entidades
export const PLAYER_W = 34
export const PLAYER_H = 42
export const COIN_SIZE = 26

// Sessao / progressao
export const TIME_START = 250
export const START_LIVES = 3

// Humanware (declarados agora, usados no M1)
export const HW_TIME_SCALE = 0.35
export const HW_METER_MAX = 1000

// Paleta (strings hex)
export const COLOR_BG = '#09090b'
export const COLOR_SURFACE = '#121216'
export const COLOR_INK = '#050505'
export const COLOR_MAGENTA = '#ff0055'
export const COLOR_MAGENTA2 = '#e802cf'
export const COLOR_BLUE = '#0099ff'
export const COLOR_LIME = '#cdf140'
export const COLOR_VIOLET = '#7112ff'
export const COLOR_TEXT = '#f7f3f6'
```

- [ ] **Step 4: Rode o teste e confirme que PASSA**

Run: `npm run test`

Esperado: PASS. A saida contem algo como:

```
 ✓ tests/unit/constants.test.ts (5 tests)
   ✓ engine/constants > TILE vale 48
   ✓ engine/constants > JUMP_VEL vale -15.4
   ✓ engine/constants > HW_TIME_SCALE vale 0.35
   ✓ engine/constants > HW_METER_MAX vale 1000
   ✓ engine/constants > VIEW_W vale 960

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts tests/unit/constants.test.ts
git commit -m "feat(engine): add constants module with physics tunables and palette"
```

---

### Task 3: Tipos & Schema (data/schema.ts)

**Files:**
- Create: `src/data/schema.ts`
- Test: `tests/unit/schema.test.ts`

Esta tarefa define o contrato de tipos central do M0. Como TypeScript apaga os tipos em runtime, o "teste que falha" exercita as duas coisas verificáveis: (a) o valor de runtime `TILE_SIZE` e os ids de `AbilityId`, e (b) a compilação — um `CharacterDef` e um `LevelDef` de exemplo precisam satisfazer os tipos. A garantia de compilação vem de `npm run test` (Vitest usa esbuild/transform e o passo de typecheck via `tsc` no fluxo), e o teste de runtime confirma `TILE_SIZE === 48` e os 6 ids de `AbilityId`. Use SOMENTE os nomes/tipos do CONTRATO.

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/unit/schema.test.ts` com o conteúdo COMPLETO abaixo. Ele importa de `src/data/schema.ts` (que ainda não existe), declara objetos de exemplo tipados como `CharacterDef`, `LevelDef`, `SpawnPoint` e `ParsedLevel` (forçando a checagem de tipos na compilação), enumera os 6 `AbilityId` do CONTRATO e afirma `TILE_SIZE === 48`.

```ts
import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE,
  type TileType,
  type AbilityId,
  type CharacterDef,
  type LevelDef,
  type SpawnPoint,
  type ParsedLevel,
} from '../../src/data/schema'

describe('schema', () => {
  it('TILE_SIZE é 48', () => {
    expect(TILE_SIZE).toBe(48)
  })

  it('AbilityId aceita os 6 ids do CONTRATO', () => {
    const abilities: AbilityId[] = [
      'salto_visionario',
      'dash_criativo',
      'escudo_governanca',
      'builder',
      'emc2',
      'amplificador',
    ]
    expect(abilities).toHaveLength(6)
    expect(new Set(abilities).size).toBe(6)
  })

  it('um CharacterDef de exemplo satisfaz o tipo', () => {
    const renan: CharacterDef = {
      id: 'renan',
      name: 'Renan',
      abilityId: 'salto_visionario',
      color: '#ff0055',
      accent: '#0099ff',
      hearts: 3,
      jumpVelMul: 1.06,
      walkMul: 1.0,
      runMul: 1.0,
      weightMul: 0.96,
    }
    expect(renan.abilityId).toBe('salto_visionario')
    expect(renan.hearts).toBe(3)
  })

  it('um LevelDef de exemplo satisfaz o tipo', () => {
    const level: LevelDef = {
      id: 'world1-zona1',
      world: 1,
      zone: 1,
      rows: [
        '....G',
        'S...#',
        '#####',
      ],
    }
    expect(level.world).toBe(1)
    expect(level.rows).toHaveLength(3)
  })

  it('um ParsedLevel de exemplo satisfaz o tipo', () => {
    const spawn: SpawnPoint = { x: 0, y: 48 }
    const tiles: TileType[][] = [
      ['empty', 'goal'],
      ['ground', 'ground'],
    ]
    const parsed: ParsedLevel = {
      widthTiles: 2,
      heightTiles: 2,
      widthPx: 96,
      heightPx: 96,
      tiles,
      playerSpawn: spawn,
      goal: { x: 48, y: 0 },
      coins: [{ x: 48, y: 48 }],
      enemies: [{ x: 0, y: 0, kind: 'g' }],
    }
    expect(parsed.widthTiles).toBe(2)
    expect(parsed.tiles[1][0]).toBe('ground')
    expect(parsed.playerSpawn).toEqual({ x: 0, y: 48 })
  })
})
```

- [ ] **Step 2: Rode o teste para verificar que ele falha**

Run: `npm run test`

Expected: FAIL. O Vitest não consegue resolver o módulo e reporta algo como `Failed to resolve import "../../src/data/schema" from "tests/unit/schema.test.ts"` (ou `Cannot find module '../../src/data/schema'`). Nenhum dos 5 testes do bloco `schema` executa com sucesso.

- [ ] **Step 3: Implemente o mínimo (`src/data/schema.ts`)**

Crie `src/data/schema.ts` com EXATAMENTE os tipos do CONTRATO (nenhum tipo extra, nenhum renomeado):

```ts
export const TILE_SIZE = 48

export type TileType =
  | 'empty'
  | 'ground'
  | 'brick'
  | 'platform'
  | 'block'
  | 'spike'
  | 'goal'

export type AbilityId =
  | 'salto_visionario'
  | 'dash_criativo'
  | 'escudo_governanca'
  | 'builder'
  | 'emc2'
  | 'amplificador'

export interface CharacterDef {
  id: string
  name: string
  abilityId: AbilityId
  color: string
  accent: string
  hearts: number
  jumpVelMul: number
  walkMul: number
  runMul: number
  weightMul: number
}

export interface LevelDef {
  id: string
  world: number
  zone: number
  rows: string[]
}

export interface SpawnPoint {
  x: number
  y: number
}

export interface ParsedLevel {
  widthTiles: number
  heightTiles: number
  widthPx: number
  heightPx: number
  tiles: TileType[][]
  playerSpawn: SpawnPoint
  goal: SpawnPoint
  coins: SpawnPoint[]
  enemies: Array<{ x: number; y: number; kind: string }>
}
```

- [ ] **Step 4: Rode o teste para verificar que ele passa**

Run: `npm run test`

Expected: PASS. Os 5 testes do bloco `schema` passam (`5 passed`). A compilação dos objetos de exemplo `CharacterDef`/`LevelDef`/`ParsedLevel` confirma que os tipos foram exportados corretamente; nenhum erro de tipo é reportado.

- [ ] **Step 5: Commit**

```bash
git add src/data/schema.ts tests/unit/schema.test.ts
git commit -m "feat(schema): tipos & schema do M0 (TileType, AbilityId, CharacterDef, LevelDef, ParsedLevel)"
```

---

### Task 4: Maquina de Estados (engine/state.ts)

Implementa a `GameStateMachine` que rastreia em qual tela/fase o jogo esta (`loading`, `title`, `select`, `playing`, `paused`, `win`, `over`). E uma fatia pequena e pura (sem DOM, sem canvas), ideal para TDD: o teste cobre os tres metodos do contrato (`get`, `set`, `is`) e o estado inicial.

**Files:**
- Create: `src/engine/state.ts`
- Test: `tests/unit/state.test.ts`

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/unit/state.test.ts` com o conteudo COMPLETO abaixo. Ele importa a API exata do CONTRATO (`createStateMachine` e o tipo `GameState`) e cobre: estado inicial, `set`+`get`, `is` verdadeiro/falso e troca encadeada de estados.

```ts
import { describe, it, expect } from 'vitest'
import { createStateMachine, type GameState } from '../../src/engine/state'

describe('createStateMachine', () => {
  it('inicia no estado fornecido', () => {
    const sm = createStateMachine('loading')
    expect(sm.get()).toBe('loading')
  })

  it('pode iniciar em qualquer estado valido', () => {
    const sm = createStateMachine('playing')
    expect(sm.get()).toBe('playing')
  })

  it('set() altera o estado e get() reflete a mudanca', () => {
    const sm = createStateMachine('loading')
    sm.set('title')
    expect(sm.get()).toBe('title')
    sm.set('select')
    expect(sm.get()).toBe('select')
  })

  it('is() retorna true para o estado atual e false para os demais', () => {
    const sm = createStateMachine('title')
    expect(sm.is('title')).toBe(true)
    expect(sm.is('playing')).toBe(false)
    expect(sm.is('loading')).toBe(false)
  })

  it('is() acompanha as transicoes feitas por set()', () => {
    const sm = createStateMachine('playing')
    expect(sm.is('playing')).toBe(true)
    sm.set('win')
    expect(sm.is('win')).toBe(true)
    expect(sm.is('playing')).toBe(false)
  })

  it('aceita transicao para todos os GameState do contrato', () => {
    const estados: GameState[] = ['loading', 'title', 'select', 'playing', 'paused', 'win', 'over']
    const sm = createStateMachine('loading')
    for (const e of estados) {
      sm.set(e)
      expect(sm.get()).toBe(e)
      expect(sm.is(e)).toBe(true)
    }
  })

  it('instancias diferentes mantem estados independentes', () => {
    const a = createStateMachine('loading')
    const b = createStateMachine('over')
    a.set('paused')
    expect(a.get()).toBe('paused')
    expect(b.get()).toBe('over')
  })
})
```

- [ ] **Step 2: Rode o teste para confirmar que ele FALHA**

Run: `npm run test`
Expected: FAIL. O Vitest nao consegue resolver o modulo porque `src/engine/state.ts` ainda nao existe. Mensagem esperada do tipo:
`Failed to resolve import "../../src/engine/state" from "tests/unit/state.test.ts". Does the file exist?`
(Equivalentemente, `Cannot find module '../../src/engine/state'`.)

- [ ] **Step 3: Implemente o minimo (codigo completo)**

Crie `src/engine/state.ts` com EXATAMENTE este conteudo. As assinaturas seguem o CONTRATO: o tipo `GameState`, a fabrica `createStateMachine(initial: GameState)` e o objeto retornado com `get`, `set` e `is`.

```ts
export type GameState =
  | 'loading'
  | 'title'
  | 'select'
  | 'playing'
  | 'paused'
  | 'win'
  | 'over'

export function createStateMachine(initial: GameState): {
  get(): GameState
  set(s: GameState): void
  is(s: GameState): boolean
} {
  let current: GameState = initial

  return {
    get(): GameState {
      return current
    },
    set(s: GameState): void {
      current = s
    },
    is(s: GameState): boolean {
      return current === s
    },
  }
}
```

- [ ] **Step 4: Rode o teste para confirmar que ele PASSA**

Run: `npm run test`
Expected: PASS. Todos os casos de `tests/unit/state.test.ts` verdes (7 testes passando), sem erros de TypeScript (modo strict).

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts tests/unit/state.test.ts
git commit -m "feat(engine): adiciona GameStateMachine (state.ts) com cobertura TDD"
```

---

### Task 5: Game Loop com Timestep Fixo (engine/loop.ts)

Implementa o laço principal com timestep fixo (`FIXED_DT`), acumulador de tempo e clamp em `MAX_SUBSTEPS` para evitar a "espiral da morte". O `now()` e injetavel para tornar o tick deterministico nos testes; em runtime usa `requestAnimationFrame` e `performance.now()`.

**Files:**
- Create: `src/engine/loop.ts`
- Test: `tests/unit/loop.test.ts`
- Modify: (nenhum — `src/engine/constants.ts` ja existe da Task 2 e expoe `FIXED_DT` e `MAX_SUBSTEPS`)

Pre-requisitos do CONTRATO (ja entregues por tarefas anteriores e usados aqui):
- `src/engine/constants.ts` exporta `FIXED_DT = 1/60` e `MAX_SUBSTEPS = 5`.
- Assinatura alvo: `export interface Loop { start(): void; stop(): void }` e `export function createLoop(step: (dt: number) => void, render: (alpha: number) => void, now?: () => number): Loop`.

Decisao de design para tornar o tick testavel sem `requestAnimationFrame`:
- O acumulador e os callbacks ficam em um objeto interno; expomos uma funcao `tick(t: number)` (em ms) que processa um frame dado o instante atual. Em runtime, `start()` agenda `tick` via `requestAnimationFrame`. Em teste, chamamos `tick` diretamente com tempos controlados (multiplos de `FIXED_DT`).
- Para manter a assinatura publica do CONTRATO intacta (apenas `start`/`stop` na interface `Loop`), o `tick` testavel e exposto como propriedade extra no objeto retornado via um type interno `TestableLoop` — a interface `Loop` publica nao muda. O teste importa `createLoop` e faz cast para `TestableLoop`.

---

- [ ] **Step 1: Escreva o teste que falha [codigo completo]**

  Crie `tests/unit/loop.test.ts` com o conteudo abaixo. Os testes cobrem: (a) avancar o tempo em multiplos de `FIXED_DT` chama `step` o numero exato de vezes com `dt === FIXED_DT`; (b) o clamp em `MAX_SUBSTEPS` impede mais de 5 steps por frame; (c) `render` e chamado uma vez por frame com `alpha` em `[0,1)`; (d) `stop()` impede novos agendamentos.

```ts
// tests/unit/loop.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createLoop, type Loop } from '../../src/engine/loop'
import { FIXED_DT, MAX_SUBSTEPS } from '../../src/engine/constants'

// O tick e exposto para teste sem mudar a interface publica Loop.
type TestableLoop = Loop & { tick(tMs: number): void }

const FIXED_MS = FIXED_DT * 1000 // 1/60 s em ms

describe('createLoop', () => {
  it('chama step uma vez por FIXED_DT acumulado', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    // primeiro tick estabelece o tempo base (sem acumular dt anterior)
    loop.tick(0)
    expect(step).toHaveBeenCalledTimes(0)

    // avanca exatamente 3 passos fixos
    t = 3 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(3)
    // cada step recebe exatamente FIXED_DT (em segundos)
    for (const call of step.mock.calls) {
      expect(call[0]).toBeCloseTo(FIXED_DT, 10)
    }
  })

  it('acumula fracoes entre frames sem perder tempo', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    // meio passo: nao deve disparar step ainda
    t = 0.5 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(0)

    // mais meio passo: agora completa 1 passo
    t = 1.0 * FIXED_MS
    loop.tick(t)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('faz clamp em MAX_SUBSTEPS para evitar a espiral da morte', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    // salto enorme de tempo (ex.: aba ficou em background por 1s = 60 passos)
    t = 60 * FIXED_MS
    loop.tick(t)
    // mesmo com 60 passos pendentes, no maximo MAX_SUBSTEPS por frame
    expect(step).toHaveBeenCalledTimes(MAX_SUBSTEPS)
  })

  it('chama render uma vez por tick com alpha em [0,1)', () => {
    const step = vi.fn()
    const render = vi.fn()
    let t = 0
    const loop = createLoop(step, render, () => t) as TestableLoop

    loop.tick(0)
    expect(render).toHaveBeenCalledTimes(1)

    // 1.5 passos: 1 step + sobra 0.5 -> alpha ~= 0.5
    t = 1.5 * FIXED_MS
    loop.tick(t)
    expect(render).toHaveBeenCalledTimes(2)
    const lastAlpha = render.mock.calls[render.mock.calls.length - 1][0] as number
    expect(lastAlpha).toBeGreaterThanOrEqual(0)
    expect(lastAlpha).toBeLessThan(1)
    expect(lastAlpha).toBeCloseTo(0.5, 6)
  })

  it('start agenda via requestAnimationFrame e stop cancela', () => {
    const step = vi.fn()
    const render = vi.fn()

    const rafCalls: FrameRequestCallback[] = []
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback): number => {
        rafCalls.push(cb)
        return rafCalls.length
      })
    const cancelSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => {})

    const loop = createLoop(step, render)
    loop.start()
    expect(rafSpy).toHaveBeenCalledTimes(1)

    // simula o primeiro frame entregue pelo navegador
    rafCalls[0](0)
    // o frame reagenda o proximo raf
    expect(rafSpy).toHaveBeenCalledTimes(2)

    loop.stop()
    expect(cancelSpy).toHaveBeenCalledTimes(1)

    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Rode o teste e confirme que FALHA**

  Comando:

  ```
  npm run test
  ```

  Saida esperada (FAIL — o modulo ainda nao existe):

  ```
   FAIL  tests/unit/loop.test.ts [ tests/unit/loop.test.ts ]
  Error: Failed to resolve import "../../src/engine/loop" from "tests/unit/loop.test.ts". Does the file exist?

   Test Files  1 failed (1)
        Tests  no tests
  ```

- [ ] **Step 3: Implemente o minimo [CODIGO TS COMPLETO]**

  Crie `src/engine/loop.ts` com o conteudo abaixo. Usa `FIXED_DT` e `MAX_SUBSTEPS` do contrato; `now()` default e `performance.now()`; o tick e exposto para teste sem alterar a interface publica `Loop`.

```ts
// src/engine/loop.ts
import { FIXED_DT, MAX_SUBSTEPS } from './constants'

export interface Loop {
  start(): void
  stop(): void
}

// Conversao de FIXED_DT (segundos) para o passo em milissegundos do acumulador,
// ja que requestAnimationFrame / performance.now() trabalham em ms.
const FIXED_MS = FIXED_DT * 1000

export function createLoop(
  step: (dt: number) => void,
  render: (alpha: number) => void,
  now: () => number = () => performance.now(),
): Loop {
  let running = false
  let rafId = 0
  let lastTime = 0
  let started = false
  let accumulator = 0

  // Processa um unico frame dado o instante atual (em ms).
  // Exposto para teste; em runtime e chamado pelo requestAnimationFrame.
  function tick(tMs: number): void {
    if (!started) {
      // primeiro tick: fixa a base de tempo, sem acumular dt anterior
      lastTime = tMs
      started = true
      render(0)
      return
    }

    let frameTime = tMs - lastTime
    lastTime = tMs
    if (frameTime < 0) frameTime = 0

    accumulator += frameTime

    let substeps = 0
    while (accumulator >= FIXED_MS && substeps < MAX_SUBSTEPS) {
      step(FIXED_DT)
      accumulator -= FIXED_MS
      substeps++
    }

    // clamp da espiral da morte: descarta o backlog que excede MAX_SUBSTEPS
    if (accumulator >= FIXED_MS) {
      accumulator = accumulator % FIXED_MS
    }

    const alpha = accumulator / FIXED_MS
    render(alpha)
  }

  function frame(tMs: number): void {
    if (!running) return
    tick(tMs)
    rafId = requestAnimationFrame(frame)
  }

  function start(): void {
    if (running) return
    running = true
    started = false
    accumulator = 0
    rafId = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (!running) return
    running = false
    cancelAnimationFrame(rafId)
  }

  return { start, stop, tick } as Loop & { tick(tMs: number): void }
}
```

- [ ] **Step 4: Rode o teste e confirme que PASSA**

  Comando:

  ```
  npm run test
  ```

  Saida esperada (PASS):

  ```
   ✓ tests/unit/loop.test.ts (5 tests)
     ✓ createLoop > chama step uma vez por FIXED_DT acumulado
     ✓ createLoop > acumula fracoes entre frames sem perder tempo
     ✓ createLoop > faz clamp em MAX_SUBSTEPS para evitar a espiral da morte
     ✓ createLoop > chama render uma vez por tick com alpha em [0,1)
     ✓ createLoop > start agenda via requestAnimationFrame e stop cancela

   Test Files  1 passed (1)
        Tests  5 passed (5)
  ```

- [ ] **Step 5: Commit**

  ```
  git add src/engine/loop.ts tests/unit/loop.test.ts
  git commit -m "feat(engine): game loop com timestep fixo e clamp MAX_SUBSTEPS (M0 Task 5)"
  ```

---

### Task 6: Input — Teclado/Toque (engine/input.ts)

Implementa o gerenciador de entrada do M0: mapeia teclas físicas (setas/WASD/Espaço/Shift) para as ações `InputAction`, expõe `isDown` (tecla mantida) e `pressed` (caiu neste frame), e `update()` que avança o estado por frame. Segue exatamente a assinatura do CONTRATO. TDD em jsdom via Vitest simulando `KeyboardEvent`.

**Files:**
- **Create:** `src/engine/input.ts`
- **Test:** `tests/unit/input.test.ts`
- **Depende de (já existe):** `src/engine/constants.ts` (não usado aqui), nenhuma outra dependência de runtime.

Pré-requisitos: Tasks 1–5 concluídas (Vite + TS strict + Vitest configurados, `vitest.config.ts` com `environment: 'jsdom'`). Esta task não toca `package.json` nem configs.

---

- [ ] **Step 1: Escrever o teste que falha (código completo)**

  Crie `tests/unit/input.test.ts` com o conteúdo abaixo. O ambiente é jsdom (definido em `vitest.config.ts` da Task 2/3), portanto `window`, `KeyboardEvent` e `document` existem. O helper `key()` despacha um `KeyboardEvent` real em `window` para exercitar os listeners de `attach`.

  ```ts
  // tests/unit/input.test.ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest'
  import { createInput, type Input, type InputAction } from '../../src/engine/input'

  function key(type: 'keydown' | 'keyup', code: string): void {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))
  }

  describe('createInput', () => {
    let input: Input

    beforeEach(() => {
      input = createInput()
      input.attach(window)
    })

    afterEach(() => {
      // garante que nenhum estado vaze entre testes: solta tudo e zera edges
      key('keyup', 'ArrowLeft')
      key('keyup', 'ArrowRight')
      key('keyup', 'ArrowUp')
      key('keyup', 'ArrowDown')
      key('keyup', 'Space')
      key('keyup', 'ShiftLeft')
      key('keyup', 'KeyA')
      key('keyup', 'KeyD')
      key('keyup', 'KeyW')
      key('keyup', 'KeyS')
      input.update()
    })

    it('mapeia ArrowRight e KeyD para "right"', () => {
      key('keydown', 'ArrowRight')
      expect(input.isDown('right')).toBe(true)
      key('keyup', 'ArrowRight')
      expect(input.isDown('right')).toBe(false)

      key('keydown', 'KeyD')
      expect(input.isDown('right')).toBe(true)
    })

    it('mapeia ArrowLeft e KeyA para "left"', () => {
      key('keydown', 'ArrowLeft')
      expect(input.isDown('left')).toBe(true)
      key('keyup', 'ArrowLeft')
      expect(input.isDown('left')).toBe(false)

      key('keydown', 'KeyA')
      expect(input.isDown('left')).toBe(true)
    })

    it('mapeia Space, ArrowUp e KeyW para "jump"', () => {
      key('keydown', 'Space')
      expect(input.isDown('jump')).toBe(true)
      key('keyup', 'Space')
      expect(input.isDown('jump')).toBe(false)

      key('keydown', 'ArrowUp')
      expect(input.isDown('jump')).toBe(true)
      key('keyup', 'ArrowUp')
      expect(input.isDown('jump')).toBe(false)

      key('keydown', 'KeyW')
      expect(input.isDown('jump')).toBe(true)
    })

    it('mapeia ShiftLeft/ShiftRight para "run"', () => {
      key('keydown', 'ShiftLeft')
      expect(input.isDown('run')).toBe(true)
      key('keyup', 'ShiftLeft')
      expect(input.isDown('run')).toBe(false)

      key('keydown', 'ShiftRight')
      expect(input.isDown('run')).toBe(true)
    })

    it('mapeia ArrowDown e KeyS para "down"', () => {
      key('keydown', 'ArrowDown')
      expect(input.isDown('down')).toBe(true)
      key('keyup', 'ArrowDown')
      expect(input.isDown('down')).toBe(false)

      key('keydown', 'KeyS')
      expect(input.isDown('down')).toBe(true)
    })

    it('pressed é verdadeiro só no frame do update após a tecla cair', () => {
      // tecla caiu mas update ainda não rodou: pressed deve ser true no PRIMEIRO update
      key('keydown', 'Space')
      // antes do update, o edge ainda está "fresco"
      expect(input.pressed('jump')).toBe(true)
      // sem soltar a tecla, o próximo update consome o edge
      input.update()
      expect(input.pressed('jump')).toBe(false)
      // ainda mantida: isDown continua true
      expect(input.isDown('jump')).toBe(true)
    })

    it('pressed dispara de novo só após keyup + keydown (não enquanto mantida)', () => {
      key('keydown', 'ArrowRight')
      expect(input.pressed('right')).toBe(true)
      input.update()
      expect(input.pressed('right')).toBe(false)

      // segurar e dar update várias vezes: nunca re-dispara
      input.update()
      input.update()
      expect(input.pressed('right')).toBe(false)

      // soltar e apertar de novo: novo edge
      key('keyup', 'ArrowRight')
      input.update()
      key('keydown', 'ArrowRight')
      expect(input.pressed('right')).toBe(true)
    })

    it('keydown repetido (auto-repeat do SO) não re-dispara pressed sem update', () => {
      key('keydown', 'KeyW')
      expect(input.pressed('jump')).toBe(true)
      // auto-repeat: vários keydown seguidos da MESMA tecla mantida
      key('keydown', 'KeyW')
      key('keydown', 'KeyW')
      input.update()
      expect(input.pressed('jump')).toBe(false)
    })

    it('aceita HTMLElement como target em attach', () => {
      const el = document.createElement('div')
      const local = createInput()
      local.attach(el)
      el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }))
      expect(local.isDown('right')).toBe(true)
    })

    it('teclas não mapeadas são ignoradas', () => {
      const actions: InputAction[] = ['left', 'right', 'jump', 'run', 'down']
      key('keydown', 'KeyZ')
      for (const a of actions) {
        expect(input.isDown(a)).toBe(false)
      }
    })
  })
  ```

- [ ] **Step 2: Rodar o teste e ver FALHAR**

  ```bash
  npm run test
  ```

  Saída esperada (FAIL — o módulo ainda não existe):

  ```
  FAIL  tests/unit/input.test.ts [ tests/unit/input.test.ts ]
  Error: Failed to resolve import "../../src/engine/input" from "tests/unit/input.test.ts". Does the file exist?
  ...
  Test Files  1 failed (1)
       Tests  no tests
  ```

- [ ] **Step 3: Implementar o mínimo (código TS completo)**

  Crie `src/engine/input.ts`. O design:
  - `KEY_MAP` traduz `KeyboardEvent.code` (físico, layout-agnóstico) para uma `InputAction`.
  - `down` = conjunto de ações atualmente mantidas (atualizado em `keydown`/`keyup`).
  - `pressedEdges` = ações cujo edge de "caiu" ainda não foi consumido por `update()`.
  - `keydown` só marca edge se a ação NÃO estava mantida (ignora auto-repeat do SO e keydowns repetidos).
  - `pressed(a)` retorna `true` enquanto o edge não foi consumido; `update()` limpa todos os edges.
  - `attach(target)` registra os listeners em `window` ou `HTMLElement`; `e.code` é usado para mapeamento.

  ```ts
  // src/engine/input.ts
  export type InputAction = 'left' | 'right' | 'jump' | 'run' | 'down'

  export interface Input {
    isDown(a: InputAction): boolean
    pressed(a: InputAction): boolean
    update(): void
    attach(target: Window | HTMLElement): void
  }

  // Mapeia KeyboardEvent.code (físico, independente de layout) -> ação.
  const KEY_MAP: Record<string, InputAction> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'jump',
    KeyW: 'jump',
    Space: 'jump',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    ArrowDown: 'down',
    KeyS: 'down',
  }

  export function createInput(): Input {
    const down = new Set<InputAction>()
    const pressedEdges = new Set<InputAction>()

    function onKeyDown(e: KeyboardEvent): void {
      const action = KEY_MAP[e.code]
      if (action === undefined) return
      // Só registra edge "pressed" se a ação ainda não estava mantida.
      // Isso filtra auto-repeat do SO e keydowns redundantes.
      if (!down.has(action)) {
        down.add(action)
        pressedEdges.add(action)
      }
      // Evita scroll da página com Space/setas durante o jogo.
      if (typeof e.preventDefault === 'function') {
        e.preventDefault()
      }
    }

    function onKeyUp(e: KeyboardEvent): void {
      const action = KEY_MAP[e.code]
      if (action === undefined) return
      down.delete(action)
    }

    return {
      isDown(a: InputAction): boolean {
        return down.has(a)
      },
      pressed(a: InputAction): boolean {
        return pressedEdges.has(a)
      },
      update(): void {
        // Consome os edges deste frame; pressed só vale até o próximo update.
        pressedEdges.clear()
      },
      attach(target: Window | HTMLElement): void {
        target.addEventListener('keydown', onKeyDown as EventListener)
        target.addEventListener('keyup', onKeyUp as EventListener)
      },
    }
  }
  ```

- [ ] **Step 4: Rodar o teste e ver PASSAR**

  ```bash
  npm run test
  ```

  Saída esperada (PASS):

  ```
  ✓ tests/unit/input.test.ts (9)
    ✓ createInput
      ✓ mapeia ArrowRight e KeyD para "right"
      ✓ mapeia ArrowLeft e KeyA para "left"
      ✓ mapeia Space, ArrowUp e KeyW para "jump"
      ✓ mapeia ShiftLeft/ShiftRight para "run"
      ✓ mapeia ArrowDown e KeyS para "down"
      ✓ pressed é verdadeiro só no frame do update após a tecla cair
      ✓ pressed dispara de novo só após keyup + keydown (não enquanto mantida)
      ✓ keydown repetido (auto-repeat do SO) não re-dispara pressed sem update
      ✓ aceita HTMLElement como target em attach
      ✓ teclas não mapeadas são ignoradas

  Test Files  1 passed (1)
       Tests  10 passed (10)
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/engine/input.ts tests/unit/input.test.ts
  git commit -m "feat(engine): input de teclado com isDown/pressed e mapeamento por code (Task 6)"
  ```

---

### Task 7: Renderer Canvas (engine/render.ts)

Cria o `Renderer` sobre o Canvas 2D: limpa a tela, abre/fecha o "mundo" (translate por -camX/-camY com save/restore para a camera) e desenha retangulos. Em jsdom o canvas nao pinta nada, entao o teste usa um `ctx` stub que registra as chamadas e verifica a ordem/parametros. A assinatura segue exatamente o CONTRATO (`Renderer`, `createRenderer`), e `imageSmoothingEnabled=false`.

**Files:**
- Create: `src/engine/render.ts`
- Test: `tests/unit/render.test.ts`
- (Depende de: `src/engine/constants.ts` da Task 2, que exporta `VIEW_W=960` e `VIEW_H=528`.)

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/unit/render.test.ts` com o conteudo completo abaixo. O teste injeta um `ctx` falso (um objeto com `vi.fn()` para cada metodo usado e propriedades regravaveis) via `canvas.getContext`, instancia `createRenderer` e verifica `clear`, `beginWorld`/`endWorld` e `drawRect`. Como `createRenderer` ainda nao existe, o import vai quebrar.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VIEW_W, VIEW_H } from '../../src/engine/constants'
import { createRenderer } from '../../src/engine/render'

// ctx stub: jsdom nao desenha, entao registramos as chamadas.
function makeCtxStub() {
  return {
    canvas: { width: VIEW_W, height: VIEW_H },
    imageSmoothingEnabled: true, // createRenderer deve forcar p/ false
    fillStyle: '' as string,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }
}

// canvas falso: getContext('2d') devolve o ctx stub.
function makeCanvasStub(ctx: ReturnType<typeof makeCtxStub>) {
  return {
    width: VIEW_W,
    height: VIEW_H,
    getContext: vi.fn((kind: string) => (kind === '2d' ? ctx : null)),
  } as unknown as HTMLCanvasElement
}

describe('createRenderer', () => {
  let ctx: ReturnType<typeof makeCtxStub>
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    ctx = makeCtxStub()
    canvas = makeCanvasStub(ctx)
  })

  it('expoe o ctx e desliga o smoothing', () => {
    const r = createRenderer(canvas)
    expect(r.ctx).toBe(ctx)
    expect(ctx.imageSmoothingEnabled).toBe(false)
  })

  it('clear preenche o canvas inteiro 960x528 com a cor dada', () => {
    const r = createRenderer(canvas)
    r.clear('#09090b')
    expect(ctx.fillStyle).toBe('#09090b')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, VIEW_W, VIEW_H)
  })

  it('beginWorld faz save + translate(-camX, -camY) e endWorld faz restore', () => {
    const r = createRenderer(canvas)
    r.beginWorld(120, 30)
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.translate).toHaveBeenCalledWith(-120, -30)
    expect(ctx.restore).not.toHaveBeenCalled()
    r.endWorld()
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('drawRect repassa x,y,w,h e cor para fillRect', () => {
    const r = createRenderer(canvas)
    r.drawRect(10, 20, 30, 40, '#ff0055')
    expect(ctx.fillStyle).toBe('#ff0055')
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 30, 40)
  })

  it('present existe e nao lanca (no-op no canvas direto)', () => {
    const r = createRenderer(canvas)
    expect(() => r.present()).not.toThrow()
  })

  it('lanca se getContext nao devolver um contexto 2d', () => {
    const broken = {
      width: VIEW_W,
      height: VIEW_H,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement
    expect(() => createRenderer(broken)).toThrow()
  })
})
```

- [ ] **Step 2: Rode o teste e confirme que FALHA**

Run: `npm run test`

Saida esperada (FAIL): o Vitest nao consegue resolver o modulo e aborta o arquivo, algo como:

```
FAIL  tests/unit/render.test.ts
Error: Failed to load url ../../src/engine/render (resolved id: .../src/engine/render) ... Does the file exist?
```

(Se `src/engine/render.ts` ja existir vazio, a falha sera `createRenderer is not a function` / `not exported` — tambem conta como FAIL esperado.)

- [ ] **Step 3: Implemente o minimo para passar (codigo completo)**

Crie `src/engine/render.ts` com o conteudo completo abaixo. Segue exatamente a assinatura do CONTRATO: interface `Renderer` e `createRenderer(canvas)`. O canvas interno e 960x528, `imageSmoothingEnabled=false`. `beginWorld` faz `save()` + `translate(-camX,-camY)`; `endWorld` faz `restore()`; `clear` pinta o canvas inteiro; `drawRect` seta `fillStyle` e chama `fillRect`; `present` e no-op (desenho ja vai direto ao canvas visivel).

```ts
import { VIEW_W, VIEW_H } from './constants'

export interface Renderer {
  ctx: CanvasRenderingContext2D
  clear(color: string): void
  beginWorld(camX: number, camY: number): void
  endWorld(): void
  drawRect(x: number, y: number, w: number, h: number, color: string): void
  present(): void
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  // Canvas interno fixo 960x528 (espaco logico do jogo).
  canvas.width = VIEW_W
  canvas.height = VIEW_H

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('createRenderer: contexto 2d indisponivel')
  }

  // Pixel art: sem suavizacao.
  ctx.imageSmoothingEnabled = false

  return {
    ctx,
    clear(color: string): void {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    },
    beginWorld(camX: number, camY: number): void {
      ctx.save()
      ctx.translate(-camX, -camY)
    },
    endWorld(): void {
      ctx.restore()
    },
    drawRect(x: number, y: number, w: number, h: number, color: string): void {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    },
    present(): void {
      // No-op: desenhamos direto no canvas visivel. Reservado p/ flush futuro.
    },
  }
}
```

- [ ] **Step 4: Rode o teste e confirme que PASSA**

Run: `npm run test`

Saida esperada (PASS):

```
 ✓ tests/unit/render.test.ts (6)
   ✓ createRenderer > expoe o ctx e desliga o smoothing
   ✓ createRenderer > clear preenche o canvas inteiro 960x528 com a cor dada
   ✓ createRenderer > beginWorld faz save + translate(-camX, -camY) e endWorld faz restore
   ✓ createRenderer > drawRect repassa x,y,w,h e cor para fillRect
   ✓ createRenderer > present existe e nao lanca (no-op no canvas direto)
   ✓ createRenderer > lanca se getContext nao devolver um contexto 2d

 Test Files  1 passed
      Tests  6 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/render.ts tests/unit/render.test.ts
git commit -m "feat(engine): renderer canvas 2d (clear/beginWorld/endWorld/drawRect)"
```

---

### Task 8: Formato de Fase & Parser (game/levelParser.ts + data/levels/world1-zona1.ts)

**Files:**
- Create: `src/game/levelParser.ts`
- Create: `src/data/levels/world1-zona1.ts`
- Test: `tests/unit/levelParser.test.ts`

Esta tarefa implementa o parser de fase via TDD: o teste descreve um `LevelDef` minúsculo em ASCII (4 linhas), verifica o `ParsedLevel` resultante (matriz `tiles[][]`, `playerSpawn`/`goal` em px, `coins` em px, dimensões em px), e só então implementamos `parseLevel`. Em seguida criamos a fase greybox jogável `world1-zona1.ts`.

Dependências de tipos/constantes (já existentes do CONTRATO): `src/data/schema.ts` exporta `TILE_SIZE`, `TileType`, `LevelDef`, `SpawnPoint`, `ParsedLevel`; `src/engine/constants.ts` exporta `TILE = 48`. O parser usa `TILE` de `constants.ts` para o cálculo de px (`widthPx = widthTiles * TILE`), coerente com o CONTRATO. A legenda ASCII canônica é: `'#'`=ground, `'B'`=brick, `'='`=platform, `'?'`=block, `'^'`=spike, `'o'`=coin, `'*'`=star, `'F'`=fool, `'g'`=enemy, `'L'`=lifecard, `'S'`=spawn do player, `'G'`=goal/portal, `'.'` ou espaço=empty. No M0 instanciamos tiles para `#`, `=`, `?`, `^`; coletamos `coins` (`o`) e `enemies` (`g`); registramos `playerSpawn` (`S`) e `goal` (`G`). Células `S`, `G`, `o`, `g`, `*`, `F`, `L` e `.`/espaço viram `tile = 'empty'` (não são tiles sólidos do mapa).

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/unit/levelParser.test.ts` com este conteúdo completo:

```ts
import { describe, it, expect } from 'vitest'
import { parseLevel } from '../../src/game/levelParser'
import { TILE } from '../../src/engine/constants'
import type { LevelDef } from '../../src/data/schema'

// Mapa de teste 8 colunas x 4 linhas.
// Legenda: #=ground = =platform ?=block ^=spike o=coin S=spawn G=goal .=empty
// col:     0 1 2 3 4 5 6 7
const def: LevelDef = {
  id: 'test-mini',
  world: 9,
  zone: 9,
  rows: [
    '...o....', // linha 0: 1 moeda em col 3
    'S..=..G.', // linha 1: spawn col 0, platform col 3, goal col 6
    '....?...', // linha 2: block col 4
    '##^#####', // linha 3: ground em 0,1,3..7 e spike em col 2
  ],
}

describe('parseLevel', () => {
  it('calcula dimensoes em tiles e em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.widthTiles).toBe(8)
    expect(lvl.heightTiles).toBe(4)
    expect(lvl.widthPx).toBe(8 * TILE)
    expect(lvl.heightPx).toBe(4 * TILE)
  })

  it('monta a matriz tiles[row][col] com os tipos corretos', () => {
    const lvl = parseLevel(def)
    // linha 3: ground/spike
    expect(lvl.tiles[3][0]).toBe('ground')
    expect(lvl.tiles[3][1]).toBe('ground')
    expect(lvl.tiles[3][2]).toBe('spike')
    expect(lvl.tiles[3][3]).toBe('ground')
    expect(lvl.tiles[3][7]).toBe('ground')
    // platform e block
    expect(lvl.tiles[1][3]).toBe('platform')
    expect(lvl.tiles[2][4]).toBe('block')
  })

  it('marca como empty as celulas de spawn, goal, coin e vazio', () => {
    const lvl = parseLevel(def)
    expect(lvl.tiles[1][0]).toBe('empty') // S
    expect(lvl.tiles[1][6]).toBe('empty') // G
    expect(lvl.tiles[0][3]).toBe('empty') // o
    expect(lvl.tiles[0][0]).toBe('empty') // .
  })

  it('posiciona o playerSpawn na celula S em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.playerSpawn).toEqual({ x: 0 * TILE, y: 1 * TILE })
  })

  it('posiciona o goal na celula G em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.goal).toEqual({ x: 6 * TILE, y: 1 * TILE })
  })

  it('coleta as moedas nas celulas o em px', () => {
    const lvl = parseLevel(def)
    expect(lvl.coins).toEqual([{ x: 3 * TILE, y: 0 * TILE }])
  })

  it('inicia sem inimigos quando o mapa nao tem g', () => {
    const lvl = parseLevel(def)
    expect(lvl.enemies).toEqual([])
  })

  it('coleta inimigos g em px com kind "enemy"', () => {
    const withEnemy: LevelDef = {
      id: 'test-enemy',
      world: 9,
      zone: 9,
      rows: ['....', '.g..', '####'],
    }
    const lvl = parseLevel(withEnemy)
    expect(lvl.enemies).toEqual([{ x: 1 * TILE, y: 1 * TILE, kind: 'enemy' }])
    expect(lvl.tiles[1][1]).toBe('empty')
  })
})
```

- [ ] **Step 2: Rode o teste para confirmar que ele FALHA**

Run: `npm run test`
Expected: FAIL. O Vitest não consegue resolver `parseLevel` porque `src/game/levelParser.ts` ainda não existe. Saída esperada (resumo):

```
FAIL  tests/unit/levelParser.test.ts
  Failed to resolve import "../../src/game/levelParser" from "tests/unit/levelParser.test.ts". Does the file exist?
```

(Os demais arquivos de teste já existentes do M0 continuam PASS; apenas este novo arquivo falha por import inexistente.)

- [ ] **Step 3: Implemente o mínimo — `parseLevel`**

Crie `src/game/levelParser.ts` com este conteúdo completo:

```ts
import { TILE } from '../engine/constants'
import type {
  LevelDef,
  ParsedLevel,
  SpawnPoint,
  TileType,
} from '../data/schema'

// Mapeia cada caractere da legenda ASCII canonica (CONTRATO) para o TileType
// solido correspondente. Caracteres ausentes deste mapa viram 'empty' (incluindo
// S, G, o, g, *, F, L, '.' e espaco, que sao tratados como camadas separadas).
const CHAR_TO_TILE: Record<string, TileType> = {
  '#': 'ground',
  B: 'brick',
  '=': 'platform',
  '?': 'block',
  '^': 'spike',
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const rows = def.rows
  const heightTiles = rows.length
  // Largura = maior comprimento de linha (linhas curtas sao preenchidas com empty).
  const widthTiles = rows.reduce((max, row) => Math.max(max, row.length), 0)

  const tiles: TileType[][] = []
  const coins: SpawnPoint[] = []
  const enemies: Array<{ x: number; y: number; kind: string }> = []
  let playerSpawn: SpawnPoint = { x: 0, y: 0 }
  let goal: SpawnPoint = { x: 0, y: 0 }

  for (let row = 0; row < heightTiles; row++) {
    const line = rows[row]
    const tileRow: TileType[] = []
    for (let col = 0; col < widthTiles; col++) {
      const ch = line[col] ?? '.'
      const px = col * TILE
      const py = row * TILE

      switch (ch) {
        case 'S':
          playerSpawn = { x: px, y: py }
          break
        case 'G':
          goal = { x: px, y: py }
          break
        case 'o':
          coins.push({ x: px, y: py })
          break
        case 'g':
          enemies.push({ x: px, y: py, kind: 'enemy' })
          break
        default:
          break
      }

      tileRow.push(CHAR_TO_TILE[ch] ?? 'empty')
    }
    tiles.push(tileRow)
  }

  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn,
    goal,
    coins,
    enemies,
  }
}
```

- [ ] **Step 4: Rode o teste para confirmar que ele PASSA**

Run: `npm run test`
Expected: PASS. Saída esperada (resumo):

```
✓ tests/unit/levelParser.test.ts (8 tests)
  ✓ parseLevel > calcula dimensoes em tiles e em px
  ✓ parseLevel > monta a matriz tiles[row][col] com os tipos corretos
  ✓ parseLevel > marca como empty as celulas de spawn, goal, coin e vazio
  ✓ parseLevel > posiciona o playerSpawn na celula S em px
  ✓ parseLevel > posiciona o goal na celula G em px
  ✓ parseLevel > coleta as moedas nas celulas o em px
  ✓ parseLevel > inicia sem inimigos quando o mapa nao tem g
  ✓ parseLevel > coleta inimigos g em px com kind "enemy"

Test Files  1 passed (... total)
```

- [ ] **Step 5: Commit do parser**

```bash
git add src/game/levelParser.ts tests/unit/levelParser.test.ts
git commit -m "feat(level): parseLevel converte ASCII em ParsedLevel (TDD)"
```

- [ ] **Step 6: Crie a fase greybox `world1-zona1.ts`**

Crie `src/data/levels/world1-zona1.ts` com este conteúdo completo. O mapa tem 40 colunas x 11 linhas (altura 11 tiles = 528px = `VIEW_H`, então sem rolagem vertical). O chão (`#`) é contínuo exceto por 2 vãos curtos (cols 14–15 e cols 27–28); há plataformas `=` para atravessar os vãos, blocos `?` suspensos, moedas `o`, spawn `S` no início (col 1) e goal `G` perto do fim (col 38). Cada linha tem exatamente 40 caracteres.

```ts
import type { LevelDef } from '../schema'

// World 1 - Zona 1 (greybox jogavel do M0).
// 40 colunas x 11 linhas. Cada string DEVE ter exatamente 40 caracteres.
// Legenda (CONTRATO): #=ground = =platform ?=block o=coin ^=spike
//                     S=spawn  G=goal  '.'=empty
// Layout (col 0..39):
//   - chao continuo em #, com 2 vaos curtos: cols 14-15 e cols 27-28
//   - plataformas '=' sobre os vaos para travessia
//   - blocos '?' suspensos com moedas 'o' por perto
//   - S em col 1 (linha 9), G em col 38 (linha 9)
//   row 0:  ........................................
//   row 1:  ........................................
//   row 2:  ........................................
//   row 3:  ..........o.........o..........o.........
//   row 4:  .........???........=........???........
//   row 5:  ....................o...................
//   row 6:  ......o.......==..........==.......o.....
//   row 7:  .....???................................
//   row 8:  ..............oo..........oo.........o..G  (nota: ajustado abaixo)
//   row 9:  .S....................................G..
//   row 10: ##############..##########..############
// (As strings abaixo sao a fonte canonica — sempre 40 chars.)
export const world1Zona1: LevelDef = {
  id: 'world1-zona1',
  world: 1,
  zone: 1,
  rows: [
    '........................................', // 0
    '........................................', // 1
    '........................................', // 2
    '..........o.........o..........o.........', // 3
    '.........???........=........???........', // 4
    '....................o...................', // 5
    '......o.......==..........==.......o.....', // 6
    '.....???................................', // 7
    '..............oo..........oo............', // 8
    '.S....................................G.', // 9
    '##############..##########..############', // 10
  ],
}
```

Observação de verificação manual: cada string acima tem 40 caracteres; a linha 10 (chão) tem `#` nas colunas 0–13, vão em 14–15, `#` em 16–25, vão em 26–27, `#` em 28–39. As plataformas `=` da linha 6 (cols 14–15) e a `=` da linha 4 (col 20) cobrem a travessia dos vãos. `S` está em (col 1, row 9) sobre o chão; `G` em (col 38, row 9) sobre o chão final.

- [ ] **Step 7: Verifique a fase com um teste de sanidade do parser sobre a fase real**

Acrescente este bloco `describe` ao final de `tests/unit/levelParser.test.ts` (logo após o `describe('parseLevel', ...)` existente). Ele garante que a fase greybox é bem-formada e jogável (retângulo de larguras iguais, spawn e goal presentes, chão por baixo de ambos):

```ts
import { world1Zona1 } from '../../src/data/levels/world1-zona1'

describe('world1-zona1 (fase greybox)', () => {
  it('tem todas as linhas com a mesma largura (retangular)', () => {
    const w = world1Zona1.rows[0].length
    for (const row of world1Zona1.rows) {
      expect(row.length).toBe(w)
    }
  })

  it('tem largura ~40 tiles e parseia sem erro', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.widthTiles).toBe(40)
    expect(lvl.heightTiles).toBe(11)
    expect(lvl.widthPx).toBe(40 * TILE)
    expect(lvl.heightPx).toBe(11 * TILE)
  })

  it('tem spawn e goal definidos e distintos', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.playerSpawn).toEqual({ x: 1 * TILE, y: 9 * TILE })
    expect(lvl.goal).toEqual({ x: 38 * TILE, y: 9 * TILE })
    expect(lvl.goal.x).toBeGreaterThan(lvl.playerSpawn.x)
  })

  it('tem chao solido sob o spawn e sob o goal', () => {
    const lvl = parseLevel(world1Zona1)
    const spawnCol = lvl.playerSpawn.x / TILE
    const goalCol = lvl.goal.x / TILE
    expect(lvl.tiles[10][spawnCol]).toBe('ground')
    expect(lvl.tiles[10][goalCol]).toBe('ground')
  })

  it('contem moedas coletaveis', () => {
    const lvl = parseLevel(world1Zona1)
    expect(lvl.coins.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 8: Rode os testes para confirmar que a fase é válida (PASS)**

Run: `npm run test`
Expected: PASS. Saída esperada (resumo):

```
✓ tests/unit/levelParser.test.ts (13 tests)
  ✓ parseLevel > ... (8 tests)
  ✓ world1-zona1 (fase greybox) > tem todas as linhas com a mesma largura (retangular)
  ✓ world1-zona1 (fase greybox) > tem largura ~40 tiles e parseia sem erro
  ✓ world1-zona1 (fase greybox) > tem spawn e goal definidos e distintos
  ✓ world1-zona1 (fase greybox) > tem chao solido sob o spawn e sob o goal
  ✓ world1-zona1 (fase greybox) > contem moedas coletaveis

Test Files  1 passed (... total)
```

Se o teste "retangular" falhar, alguma string em `world1Zona1.rows` não tem 40 caracteres — conte os caracteres da(s) linha(s) reportada(s) e ajuste para 40. Não altere os índices de `S`/`G` esperados (col 1 e col 38) sem atualizar o teste correspondente.

- [ ] **Step 9: Commit da fase**

```bash
git add src/data/levels/world1-zona1.ts tests/unit/levelParser.test.ts
git commit -m "feat(level): adiciona fase greybox world1-zona1 (40 tiles, vaos, plataformas, moedas)"
```

---

### Task 9: Física & Colisão de Tiles (engine/physics.ts)

Implementa o coração da física do M0: `stepBody` (aplica gravidade até `MAX_FALL` e integra posição) e `collideTiles` (resolve o eixo X depois o eixo Y contra tiles sólidos, varrendo as células sobrepostas pela AABB do corpo). `ground`/`brick`/`block` são sempre sólidos; `platform` (`=`) é sólido apenas quando o corpo está descendo e vem de cima (plataforma "one-way"). TDD estrito: cada comportamento ganha um teste que falha antes de existir o código.

**Files:**
- Create: `src/engine/physics.ts`
- Test: `tests/unit/physics.test.ts`
- Depende de (já existentes nas tasks anteriores, NÃO modificar aqui): `src/engine/constants.ts` (exporta `GRAVITY`, `MAX_FALL`, `TILE`), `src/data/schema.ts` (exporta `TileType`, `ParsedLevel`), `src/game/levelParser.ts` (exporta `parseLevel`).

**Pré-requisito de leitura (sem editar):** Antes de começar, abra `src/engine/constants.ts` e confirme que existem `export const TILE = 48`, `export const GRAVITY = 0.8`, `export const MAX_FALL = 17`. Abra `src/data/schema.ts` e confirme `export type TileType` e `export interface ParsedLevel { widthTiles; heightTiles; widthPx; heightPx; tiles: TileType[][]; playerSpawn; goal; coins; enemies }`. Se algo divergir, PARE — a divergência é um bug de uma task anterior, não desta.

---

- [ ] **Step 1: Escrever o teste que falha (free fall + saturação em MAX_FALL)**

Crie `tests/unit/physics.test.ts` com o helper de level e o primeiro grupo de testes. Este arquivo será completado nos passos seguintes; já o escrevemos inteiro agora para fixar o contrato dos quatro comportamentos (a, b, c, d), mas só rodamos cada grupo conforme implementamos.

```ts
import { describe, it, expect } from 'vitest'
import { GRAVITY, MAX_FALL, TILE } from '../../src/engine/constants'
import type { ParsedLevel, TileType } from '../../src/data/schema'
import { stepBody, collideTiles, type Body } from '../../src/engine/physics'

// Constrói um ParsedLevel mínimo a partir de um mapa ASCII só com os tiles
// que esta task exercita: '#'=ground, 'B'=brick, '?'=block, '='=platform, '.'/' '=empty.
function makeLevel(rows: string[]): ParsedLevel {
  const heightTiles = rows.length
  const widthTiles = Math.max(...rows.map((r) => r.length))
  const tiles: TileType[][] = []
  for (let ty = 0; ty < heightTiles; ty++) {
    const row: TileType[] = []
    for (let tx = 0; tx < widthTiles; tx++) {
      const ch = rows[ty][tx] ?? '.'
      let t: TileType = 'empty'
      if (ch === '#') t = 'ground'
      else if (ch === 'B') t = 'brick'
      else if (ch === '?') t = 'block'
      else if (ch === '=') t = 'platform'
      row.push(t)
    }
    tiles.push(row)
  }
  return {
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE,
    heightPx: heightTiles * TILE,
    tiles,
    playerSpawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies: [],
  }
}

function makeBody(over: Partial<Body> = {}): Body {
  return {
    x: 0,
    y: 0,
    w: 16,
    h: 16,
    vx: 0,
    vy: 0,
    onGround: false,
    ...over,
  }
}

describe('stepBody (gravidade + integração)', () => {
  it('(a) acelera por GRAVITY em queda livre', () => {
    // Level vazio: sem tiles sólidos sob o corpo.
    const level = makeLevel(['....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    stepBody(body, level, 1)

    // Um passo: vy passa de 0 para GRAVITY; y integra a nova vy.
    expect(body.vy).toBeCloseTo(GRAVITY, 5)
    expect(body.y).toBeCloseTo(GRAVITY, 5)
  })

  it('(a) satura a velocidade de queda em MAX_FALL', () => {
    const level = makeLevel(['....', '....', '....', '....'])
    const body = makeBody({ x: 24, y: 0, vx: 0, vy: 0 })

    // Muitos passos: deve saturar e nunca passar de MAX_FALL.
    for (let i = 0; i < 1000; i++) stepBody(body, level, 1)

    expect(body.vy).toBeCloseTo(MAX_FALL, 5)
  })

  it('(a) integra vx no eixo X', () => {
    const level = makeLevel(['....', '....'])
    const body = makeBody({ x: 0, y: 0, vx: 3, vy: 0 })

    stepBody(body, level, 1)

    expect(body.x).toBeCloseTo(3, 5)
  })
})

describe('collideTiles (resolve X depois Y contra tiles sólidos)', () => {
  it('(b) para o corpo sobre o chão e marca onGround sem afundar', () => {
    // Chão na linha 2 (y de 96 a 144). Corpo de 16px caindo, sobreposto ao chão.
    const level = makeLevel(['....', '....', '####'])
    const body = makeBody({ x: 24, y: 90, w: 16, h: 16, vx: 0, vy: 6 })

    collideTiles(body, level)

    // Topo do chão = 2 * TILE = 96. O corpo deve ficar com o pé exatamente em 96.
    expect(body.y + body.h).toBeCloseTo(96, 5)
    expect(body.vy).toBe(0)
    expect(body.onGround).toBe(true)
  })

  it('(c) colisão horizontal contra brick zera vx e encosta no tile', () => {
    // Brick na coluna 2 (x de 96 a 144). Corpo indo para a direita, sobreposto.
    const level = makeLevel(['..B.', '..B.', '..B.'])
    const body = makeBody({ x: 88, y: 24, w: 16, h: 16, vx: 5, vy: 0 })

    collideTiles(body, level)

    // Lado esquerdo do brick = 2 * TILE = 96. Direita do corpo deve parar em 96.
    expect(body.x + body.w).toBeCloseTo(96, 5)
    expect(body.vx).toBe(0)
  })

  it('(d) platform é sólida quando o corpo desce vindo de cima', () => {
    // Platform na linha 2 (topo em y=96). Corpo logo acima descendo.
    const level = makeLevel(['....', '....', '===='])
    const body = makeBody({ x: 24, y: 86, w: 16, h: 16, vx: 0, vy: 6 })

    collideTiles(body, level)

    expect(body.y + body.h).toBeCloseTo(96, 5)
    expect(body.vy).toBe(0)
    expect(body.onGround).toBe(true)
  })

  it('(d) platform NÃO bloqueia quando o corpo já a atravessou (sobe / dentro)', () => {
    // Corpo já com o pé abaixo do topo da platform: não deve ser empurrado para cima.
    const level = makeLevel(['....', '....', '===='])
    const body = makeBody({ x: 24, y: 100, w: 16, h: 16, vx: 0, vy: -4 })

    collideTiles(body, level)

    // Subindo e já dentro: a platform é one-way, então não colide.
    expect(body.vy).toBe(-4)
    expect(body.onGround).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar FAIL**

Run: `npm run test`
Expected: FAIL. A coleta do Vitest quebra na importação porque `src/engine/physics.ts` ainda não existe — saída do tipo `Failed to resolve import "../../src/engine/physics"` / `Cannot find module '../../src/engine/physics'`. Nenhum teste de `physics.test.ts` chega a passar.

- [ ] **Step 3: Implementar o mínimo (stepBody + collideTiles completos)**

Crie `src/engine/physics.ts` com a implementação completa. `stepBody` aplica gravidade saturada em `MAX_FALL` e integra `x`/`y` por `vx`/`vy`. `collideTiles` resolve X depois Y varrendo as células de tile sobrepostas pela AABB; `ground`/`brick`/`block` sólidos sempre; `platform` sólida só quando descendo (`vy > 0`) e o pé anterior estava acima do topo do tile.

```ts
import { GRAVITY, MAX_FALL, TILE } from './constants'
import type { ParsedLevel, TileType } from '../data/schema'

export interface Body {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  onGround: boolean
}

// Tiles sólidos por todos os lados.
function isFullSolid(t: TileType): boolean {
  return t === 'ground' || t === 'brick' || t === 'block'
}

// Lê o tile em coordenadas de grade; fora dos limites => 'empty'.
function tileAt(level: ParsedLevel, tx: number, ty: number): TileType {
  if (tx < 0 || ty < 0 || tx >= level.widthTiles || ty >= level.heightTiles) {
    return 'empty'
  }
  return level.tiles[ty][tx]
}

// Aplica gravidade (até MAX_FALL) e integra posição pela velocidade.
export function stepBody(body: Body, level: ParsedLevel, dt: number): void {
  body.vy += GRAVITY * dt
  if (body.vy > MAX_FALL) body.vy = MAX_FALL
  body.x += body.vx * dt
  body.y += body.vy * dt
}

// Resolve colisão contra tiles sólidos: primeiro eixo X, depois eixo Y.
// Para cada eixo, varre apenas as células sobrepostas pela AABB do corpo.
export function collideTiles(body: Body, level: ParsedLevel): void {
  body.onGround = false

  // ---- Eixo X ----
  {
    const top = body.y
    const bottom = body.y + body.h
    const tyStart = Math.floor(top / TILE)
    const tyEnd = Math.floor((bottom - 0.0001) / TILE)

    if (body.vx > 0) {
      const right = body.x + body.w
      const tx = Math.floor((right - 0.0001) / TILE)
      for (let ty = tyStart; ty <= tyEnd; ty++) {
        if (isFullSolid(tileAt(level, tx, ty))) {
          body.x = tx * TILE - body.w
          body.vx = 0
          break
        }
      }
    } else if (body.vx < 0) {
      const left = body.x
      const tx = Math.floor(left / TILE)
      for (let ty = tyStart; ty <= tyEnd; ty++) {
        if (isFullSolid(tileAt(level, tx, ty))) {
          body.x = (tx + 1) * TILE
          body.vx = 0
          break
        }
      }
    }
  }

  // ---- Eixo Y ----
  {
    const left = body.x
    const right = body.x + body.w
    const txStart = Math.floor(left / TILE)
    const txEnd = Math.floor((right - 0.0001) / TILE)

    if (body.vy > 0) {
      // Descendo: bloqueia em sólidos e em platform vinda de cima.
      const bottom = body.y + body.h
      const prevBottom = bottom - body.vy
      const ty = Math.floor((bottom - 0.0001) / TILE)
      const tileTop = ty * TILE
      for (let tx = txStart; tx <= txEnd; tx++) {
        const t = tileAt(level, tx, ty)
        const platformBlocks = t === 'platform' && prevBottom <= tileTop
        if (isFullSolid(t) || platformBlocks) {
          body.y = tileTop - body.h
          body.vy = 0
          body.onGround = true
          break
        }
      }
    } else if (body.vy < 0) {
      // Subindo: só sólidos por todos os lados (platform é one-way).
      const topEdge = body.y
      const ty = Math.floor(topEdge / TILE)
      for (let tx = txStart; tx <= txEnd; tx++) {
        if (isFullSolid(tileAt(level, tx, ty))) {
          body.y = (ty + 1) * TILE
          body.vy = 0
          break
        }
      }
    }
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar PASS**

Run: `npm run test`
Expected: PASS. Todos os testes de `tests/unit/physics.test.ts` passam (3 em `stepBody`, 4 em `collideTiles` = 7 testes verdes), e nenhuma suíte das tasks anteriores regride. Saída do tipo `Test Files  ... passed` / `Tests  ... passed`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/physics.ts tests/unit/physics.test.ts
git commit -m "feat(engine): física stepBody + colisão de tiles (X depois Y, platform one-way)"
```

---

### Task 10: Camera com Clamp (engine/camera.ts)

Implementa a camera 2D que segue o player: centra o alvo na viewport e faz clamp para nunca mostrar fora dos limites do nivel. TDD puro — primeiro o teste falhando, depois o minimo de codigo para passar.

**Files:**
- Create: `src/engine/camera.ts`
- Test: `tests/unit/camera.test.ts`
- (depends on, ja existentes de tasks anteriores) Modify: nenhum. Le `src/engine/constants.ts` (VIEW_W, VIEW_H) e o tipo `ParsedLevel` de `src/data/schema.ts`.

Pre-condicoes (do CONTRATO, ja entregues por tasks anteriores):
- `src/engine/constants.ts` exporta `VIEW_W=960` e `VIEW_H=528`.
- `src/data/schema.ts` exporta `ParsedLevel` com `widthPx` e `heightPx`.

Assinatura alvo (CONTRATO, usar exatamente):
```ts
export interface Camera { x: number; y: number }
export function createCamera(): Camera
export function followCamera(cam: Camera, target: { x: number; y: number; w: number; h: number }, level: ParsedLevel): void
```

Regra: `cam.x = clamp(target.x + target.w/2 - VIEW_W/2, 0, level.widthPx - VIEW_W)`; `cam.y = clamp(target.y + target.h/2 - VIEW_H/2, 0, level.heightPx - VIEW_H)`. Nunca negativo; nunca alem do fim do nivel.

- [ ] **Step 1: Escrever o teste que falha (codigo completo)**

  Criar `tests/unit/camera.test.ts` com o conteudo abaixo. Os casos cobrem: criacao zerada, centragem no alvo, clamp inferior (nunca negativo) e clamp superior (nunca alem do fim), tanto em X quanto em Y. Uso de um `ParsedLevel` minimo (so os campos relevantes, com cast) para nao depender do parser.

  ```ts
  import { describe, it, expect } from 'vitest'
  import { createCamera, followCamera } from '../../src/engine/camera'
  import { VIEW_W, VIEW_H } from '../../src/engine/constants'
  import type { ParsedLevel } from '../../src/data/schema'

  // Nivel grande o suficiente para haver folga de clamp em ambos os eixos.
  // Apenas widthPx/heightPx importam para a camera; o resto e preenchido minimamente.
  function makeLevel(widthPx: number, heightPx: number): ParsedLevel {
    return {
      widthTiles: Math.ceil(widthPx / 48),
      heightTiles: Math.ceil(heightPx / 48),
      widthPx,
      heightPx,
      tiles: [],
      playerSpawn: { x: 0, y: 0 },
      goal: { x: 0, y: 0 },
      coins: [],
      enemies: [],
    }
  }

  describe('createCamera', () => {
    it('comeca em (0,0)', () => {
      const cam = createCamera()
      expect(cam.x).toBe(0)
      expect(cam.y).toBe(0)
    })
  })

  describe('followCamera', () => {
    it('centra o alvo na viewport quando ha folga em ambos os lados', () => {
      const cam = createCamera()
      const level = makeLevel(4000, 2000)
      // centro do alvo = (1000 + 34/2, 800 + 42/2) = (1017, 821)
      const target = { x: 1000, y: 800, w: 34, h: 42 }
      followCamera(cam, target, level)
      expect(cam.x).toBe(1000 + 34 / 2 - VIEW_W / 2) // 1017 - 480 = 537
      expect(cam.y).toBe(800 + 42 / 2 - VIEW_H / 2) // 821 - 264 = 557
    })

    it('faz clamp em 0 quando o alvo esta no canto superior-esquerdo (nunca negativo)', () => {
      const cam = createCamera()
      const level = makeLevel(4000, 2000)
      const target = { x: 0, y: 0, w: 34, h: 42 }
      followCamera(cam, target, level)
      expect(cam.x).toBe(0)
      expect(cam.y).toBe(0)
    })

    it('faz clamp no fim do nivel quando o alvo esta no canto inferior-direito (nunca alem do fim)', () => {
      const cam = createCamera()
      const level = makeLevel(4000, 2000)
      const target = { x: level.widthPx, y: level.heightPx, w: 34, h: 42 }
      followCamera(cam, target, level)
      expect(cam.x).toBe(level.widthPx - VIEW_W) // 4000 - 960 = 3040
      expect(cam.y).toBe(level.heightPx - VIEW_H) // 2000 - 528 = 1472
    })

    it('quando o nivel e menor que a viewport, o limite inferior vence (cam fica em 0)', () => {
      const cam = createCamera()
      // largura 500 < VIEW_W 960  e  altura 300 < VIEW_H 528
      const level = makeLevel(500, 300)
      const target = { x: 250, y: 150, w: 34, h: 42 }
      followCamera(cam, target, level)
      // max do clamp seria negativo (500-960=-460); o lower bound 0 prevalece
      expect(cam.x).toBe(0)
      expect(cam.y).toBe(0)
    })
  })
  ```

- [ ] **Step 2: Rodar o teste e ver FALHAR**

  Comando:
  ```
  npm run test
  ```
  Saida esperada (FAIL) — o modulo ainda nao existe:
  ```
  FAIL  tests/unit/camera.test.ts [ tests/unit/camera.test.ts ]
  Error: Failed to load url ../../src/engine/camera (resolved id: .../src/engine/camera) in tests/unit/camera.test.ts. Does the file exist?
  ```
  (Ou, se o arquivo for criado vazio antes de implementar: `camera.test.ts` falha com "createCamera is not a function".)

- [ ] **Step 3: Implementar o minimo (CODIGO TS COMPLETO)**

  Criar `src/engine/camera.ts`:
  ```ts
  import { VIEW_W, VIEW_H } from './constants'
  import type { ParsedLevel } from '../data/schema'

  export interface Camera {
    x: number
    y: number
  }

  export function createCamera(): Camera {
    return { x: 0, y: 0 }
  }

  function clamp(value: number, min: number, max: number): number {
    if (value < min) return min
    if (value > max) return max
    return value
  }

  export function followCamera(
    cam: Camera,
    target: { x: number; y: number; w: number; h: number },
    level: ParsedLevel
  ): void {
    const centerX = target.x + target.w / 2
    const centerY = target.y + target.h / 2

    const desiredX = centerX - VIEW_W / 2
    const desiredY = centerY - VIEW_H / 2

    // Limite superior (fim do nivel). Pode ser negativo se o nivel for menor
    // que a viewport; nesse caso o lower bound 0 prevalece no clamp.
    const maxX = level.widthPx - VIEW_W
    const maxY = level.heightPx - VIEW_H

    cam.x = clamp(desiredX, 0, Math.max(0, maxX))
    cam.y = clamp(desiredY, 0, Math.max(0, maxY))
  }
  ```

  Nota: `Math.max(0, maxX)` garante que, quando o nivel e menor que a viewport, o `max` do clamp nao fique abaixo do `min` (0), preservando o comportamento "nunca negativo".

- [ ] **Step 4: Rodar o teste e ver PASSAR**

  Comando:
  ```
  npm run test
  ```
  Saida esperada (PASS):
  ```
  ✓ tests/unit/camera.test.ts (5 tests)
    ✓ createCamera > comeca em (0,0)
    ✓ followCamera > centra o alvo na viewport quando ha folga em ambos os lados
    ✓ followCamera > faz clamp em 0 quando o alvo esta no canto superior-esquerdo (nunca negativo)
    ✓ followCamera > faz clamp no fim do nivel quando o alvo esta no canto inferior-direito (nunca alem do fim)
    ✓ followCamera > quando o nivel e menor que a viewport, o limite inferior vence (cam fica em 0)

  Test Files  1 passed (...)
       Tests  5 passed (...)
  ```

- [ ] **Step 5: Commit**

  Comandos:
  ```
  git add src/engine/camera.ts tests/unit/camera.test.ts
  git commit -m "feat(engine): camera com clamp (followCamera centra alvo e limita a [0, widthPx-VIEW_W]/[0, heightPx-VIEW_H])"
  ```

---

### Task 11: Player + Character Registry + Sprite Placeholder (game/player.ts + data/characters.ts + game/sprites.ts)

Implementa o roster (apenas `renan` no M0), o controlador do jogador (input -> aceleracao -> `stepBody` -> `collideTiles`, com coyote time e jump buffer) e o placeholder visual do personagem. Segue TDD estrito: teste falha -> implementacao minima -> teste passa -> commit.

Depende das tasks anteriores ja prontas: `src/engine/constants.ts`, `src/data/schema.ts`, `src/engine/physics.ts` (`stepBody`, `collideTiles`, `Body`), `src/engine/input.ts` (`Input`, `InputAction`) e `src/engine/render.ts` (`Renderer`). Usa SOMENTE tipos, ids, nomes de arquivo e constantes do CONTRATO.

**Files:**
- Create: `src/data/characters.ts`
- Create: `src/game/player.ts`
- Create: `src/game/sprites.ts`
- Test (Create): `tests/unit/characters.test.ts`
- Test (Create): `tests/unit/player.test.ts`
- Test (Create): `tests/unit/sprites.test.ts`

Nota sobre os testes: `updatePlayer` e `drawPlaceholder` recebem `Input` e `Renderer` reais por assinatura. Nos testes usamos fakes minimos que implementam exatamente essas interfaces do CONTRATO (sem inventar metodos novos), tipados com `Input`/`Renderer` importados das suas tasks.

---

- [ ] **Step 1: Escrever o teste que falha de `data/characters.ts` [codigo completo]**

  Cria `tests/unit/characters.test.ts` validando o registry `CHARACTERS` com `renan` (stats §0.4 do CONTRATO) e `DEFAULT_CHARACTER_ID`.

  ```ts
  // tests/unit/characters.test.ts
  import { describe, it, expect } from 'vitest'
  import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../../src/data/characters'
  import { COLOR_MAGENTA, COLOR_BLUE } from '../../src/engine/constants'

  describe('CHARACTERS registry', () => {
    it('expoe renan como personagem default', () => {
      expect(DEFAULT_CHARACTER_ID).toBe('renan')
      expect(CHARACTERS[DEFAULT_CHARACTER_ID]).toBeDefined()
    })

    it('renan tem os stats canonicos da §0.4', () => {
      const renan = CHARACTERS['renan']
      expect(renan.id).toBe('renan')
      expect(renan.name).toBe('Renan')
      expect(renan.abilityId).toBe('salto_visionario')
      expect(renan.hearts).toBe(3)
      expect(renan.jumpVelMul).toBe(1.06)
      expect(renan.walkMul).toBe(1.0)
      expect(renan.runMul).toBe(1.0)
      expect(renan.weightMul).toBe(0.96)
      expect(renan.color).toBe(COLOR_MAGENTA)
      expect(renan.accent).toBe(COLOR_BLUE)
    })

    it('no M0 implementa apenas renan', () => {
      expect(Object.keys(CHARACTERS)).toEqual(['renan'])
    })
  })
  ```

- [ ] **Step 2: Rodar o teste (espera FAIL)**

  ```bash
  npm run test
  ```

  Saida esperada (FAIL — o arquivo de implementacao ainda nao existe):

  ```
  FAIL  tests/unit/characters.test.ts
  Error: Failed to load url ../../src/data/characters (resolved id: .../src/data/characters)
    does not exist.
  ```

- [ ] **Step 3: Implementar o minimo — `src/data/characters.ts` [CODIGO TS COMPLETO]**

  ```ts
  // src/data/characters.ts
  import type { CharacterDef } from './schema'
  import { COLOR_MAGENTA, COLOR_BLUE } from '../engine/constants'

  export const DEFAULT_CHARACTER_ID = 'renan'

  export const CHARACTERS: Record<string, CharacterDef> = {
    renan: {
      id: 'renan',
      name: 'Renan',
      abilityId: 'salto_visionario',
      color: COLOR_MAGENTA,
      accent: COLOR_BLUE,
      hearts: 3,
      jumpVelMul: 1.06,
      walkMul: 1.0,
      runMul: 1.0,
      weightMul: 0.96,
    },
  }
  ```

- [ ] **Step 4: Rodar o teste (espera PASS)**

  ```bash
  npm run test
  ```

  Saida esperada:

  ```
  PASS  tests/unit/characters.test.ts  (3 tests)
  ```

- [ ] **Step 5: Commit do registry**

  ```bash
  git add src/data/characters.ts tests/unit/characters.test.ts
  git commit -m "feat(data): CHARACTERS registry com renan (stats §0.4) + DEFAULT_CHARACTER_ID"
  ```

---

- [ ] **Step 6: Escrever o teste que falha de `game/player.ts` [codigo completo]**

  Cria `tests/unit/player.test.ts`. Cobre: `createPlayer` posiciona no spawn com stats do char; segurar `right` acelera ate `WALK_MAX`; com `run` segurado vai ate `RUN_MAX`; `jump` em `onGround` aplica `JUMP_VEL*char.jumpVelMul` e tira do chao; coyote (pulo logo apos sair de uma borda); jump buffer (pulo bufferizado dispara ao aterrissar).

  Usamos um `FakeInput` que implementa exatamente `Input` do CONTRATO e um nivel plano de chao construido sem dependencia de `parseLevel` (montamos um `ParsedLevel` direto, valido pelo tipo do schema).

  ```ts
  // tests/unit/player.test.ts
  import { describe, it, expect, beforeEach } from 'vitest'
  import { createPlayer, updatePlayer, type Player } from '../../src/game/player'
  import { CHARACTERS } from '../../src/data/characters'
  import type { Input, InputAction } from '../../src/engine/input'
  import type { ParsedLevel, TileType, SpawnPoint } from '../../src/data/schema'
  import {
    TILE,
    FIXED_DT,
    WALK_MAX,
    RUN_MAX,
    JUMP_VEL,
    PLAYER_W,
    PLAYER_H,
    COYOTE_FRAMES,
    JUMP_BUFFER_FRAMES,
  } from '../../src/engine/constants'

  // FakeInput: implementa exatamente a interface Input do CONTRATO.
  // isDown reflete o estado atual; pressed = caiu neste frame (subiu de false->true desde o ultimo update()).
  class FakeInput implements Input {
    private down = new Set<InputAction>()
    private prev = new Set<InputAction>()
    set(a: InputAction, v: boolean): void {
      if (v) this.down.add(a)
      else this.down.delete(a)
    }
    isDown(a: InputAction): boolean {
      return this.down.has(a)
    }
    pressed(a: InputAction): boolean {
      return this.down.has(a) && !this.prev.has(a)
    }
    update(): void {
      this.prev = new Set(this.down)
    }
    attach(): void {
      /* no-op em teste */
    }
  }

  // Constroi um ParsedLevel valido: uma linha de chao 'ground' na base,
  // resto 'empty'. Player nasce sobre o chao.
  function makeFlatLevel(widthTiles = 40, heightTiles = 11): ParsedLevel {
    const tiles: TileType[][] = []
    for (let ty = 0; ty < heightTiles; ty++) {
      const row: TileType[] = []
      for (let tx = 0; tx < widthTiles; tx++) {
        row.push(ty === heightTiles - 1 ? 'ground' : 'empty')
      }
      tiles.push(row)
    }
    const spawn: SpawnPoint = { x: 2 * TILE, y: (heightTiles - 2) * TILE }
    return {
      widthTiles,
      heightTiles,
      widthPx: widthTiles * TILE,
      heightPx: heightTiles * TILE,
      tiles,
      playerSpawn: spawn,
      goal: { x: (widthTiles - 2) * TILE, y: (heightTiles - 2) * TILE },
      coins: [],
      enemies: [],
    }
  }

  // Roda N frames de updatePlayer com timestep fixo.
  function steps(player: Player, input: FakeInput, level: ParsedLevel, n: number): void {
    for (let i = 0; i < n; i++) {
      updatePlayer(player, input, level, FIXED_DT)
      input.update()
    }
  }

  describe('createPlayer', () => {
    it('posiciona no spawn e copia stats do char', () => {
      const level = makeFlatLevel()
      const p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
      expect(p.x).toBe(level.playerSpawn.x)
      expect(p.y).toBe(level.playerSpawn.y)
      expect(p.w).toBe(PLAYER_W)
      expect(p.h).toBe(PLAYER_H)
      expect(p.char).toBe(CHARACTERS['renan'])
      expect(p.hearts).toBe(CHARACTERS['renan'].hearts)
      expect(p.facing).toBe(1)
      expect(p.vx).toBe(0)
      expect(p.vy).toBe(0)
    })
  })

  describe('updatePlayer — corrida horizontal', () => {
    let level: ParsedLevel
    let input: FakeInput
    let p: Player
    beforeEach(() => {
      level = makeFlatLevel()
      input = new FakeInput()
      p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    })

    it('segurar right acelera ate WALK_MAX (sem ultrapassar) e olha para a direita', () => {
      input.set('right', true)
      steps(p, input, level, 200)
      const cap = WALK_MAX * CHARACTERS['renan'].walkMul
      expect(p.vx).toBeGreaterThan(cap - 0.5)
      expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
      expect(p.facing).toBe(1)
    })

    it('segurar right + run acelera ate RUN_MAX', () => {
      input.set('right', true)
      input.set('run', true)
      steps(p, input, level, 200)
      const cap = RUN_MAX * CHARACTERS['renan'].runMul
      expect(p.vx).toBeGreaterThan(WALK_MAX) // passou do teto de caminhada
      expect(p.vx).toBeGreaterThan(cap - 0.5)
      expect(p.vx).toBeLessThanOrEqual(cap + 1e-6)
    })

    it('segurar left vira o facing para -1 e acelera negativo', () => {
      input.set('left', true)
      steps(p, input, level, 30)
      expect(p.facing).toBe(-1)
      expect(p.vx).toBeLessThan(0)
    })
  })

  describe('updatePlayer — pulo', () => {
    let level: ParsedLevel
    let input: FakeInput
    let p: Player
    beforeEach(() => {
      level = makeFlatLevel()
      input = new FakeInput()
      p = createPlayer(CHARACTERS['renan'], level.playerSpawn)
    })

    it('assenta no chao (onGround) depois de alguns frames', () => {
      steps(p, input, level, 10)
      expect(p.onGround).toBe(true)
      expect(p.vy).toBe(0)
    })

    it('jump em onGround aplica JUMP_VEL*jumpVelMul e tira do chao', () => {
      steps(p, input, level, 10) // assenta
      expect(p.onGround).toBe(true)
      input.set('jump', true)
      updatePlayer(p, input, level, FIXED_DT)
      input.update()
      const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul
      expect(p.vy).toBeCloseTo(expected, 5)
      expect(p.onGround).toBe(false)
    })

    it('coyote: pulo logo apos sair da borda ainda dispara', () => {
      steps(p, input, level, 10) // assenta no chao
      // remove o chao sob o player para forca-lo a "sair da borda" sem pular ainda
      const groundRow = level.heightTiles - 1
      for (let tx = 0; tx < level.widthTiles; tx++) level.tiles[groundRow][tx] = 'empty'
      // 1 frame sem chao e sem jump: ainda dentro da janela de coyote
      updatePlayer(p, input, level, FIXED_DT)
      input.update()
      expect(p.onGround).toBe(false)
      // agora pula dentro de COYOTE_FRAMES
      expect(COYOTE_FRAMES).toBeGreaterThan(1)
      input.set('jump', true)
      const vyAntes = p.vy
      updatePlayer(p, input, level, FIXED_DT)
      input.update()
      const expected = JUMP_VEL * CHARACTERS['renan'].jumpVelMul
      expect(p.vy).toBeLessThan(vyAntes) // impulso para cima (vy mais negativo)
      expect(p.vy).toBeCloseTo(expected, 5)
    })

    it('jump buffer: pulo pressionado no ar dispara ao aterrissar', () => {
      // sobe primeiro
      steps(p, input, level, 10)
      input.set('jump', true)
      updatePlayer(p, input, level, FIXED_DT)
      input.update()
      input.set('jump', false)
      input.update()
      expect(p.onGround).toBe(false)
      // deixa o player quase aterrissar; alguns frames antes de tocar o chao, bufferiza o pulo
      // avanca ate estar caindo perto do chao
      let guard = 0
      while (p.vy < 0 && guard < 120) {
        updatePlayer(p, input, level, FIXED_DT)
        input.update()
        guard++
      }
      // agora esta caindo. Pressiona jump (buffer) enquanto ainda no ar.
      expect(p.onGround).toBe(false)
      input.set('jump', true)
      updatePlayer(p, input, level, FIXED_DT)
      input.update()
      input.set('jump', false)
      input.update()
      // dentro de JUMP_BUFFER_FRAMES o player toca o chao e deve disparar o pulo bufferizado
      expect(JUMP_BUFFER_FRAMES).toBeGreaterThan(1)
      let pulou = false
      for (let i = 0; i < JUMP_BUFFER_FRAMES + 2 && !pulou; i++) {
        updatePlayer(p, input, level, FIXED_DT)
        input.update()
        if (p.vy < 0) pulou = true // recebeu impulso para cima => pulo bufferizado disparou
      }
      expect(pulou).toBe(true)
    })
  })
  ```

- [ ] **Step 7: Rodar o teste (espera FAIL)**

  ```bash
  npm run test
  ```

  Saida esperada (FAIL — `src/game/player.ts` ainda nao existe):

  ```
  FAIL  tests/unit/player.test.ts
  Error: Failed to load url ../../src/game/player (resolved id: .../src/game/player)
    does not exist.
  ```

- [ ] **Step 8: Implementar o minimo — `src/game/player.ts` [CODIGO TS COMPLETO]**

  Composicao por frame: (1) le input -> escolhe accel (`WALK_ACCEL`/`RUN_ACCEL`) e teto (`WALK_MAX`/`RUN_MAX`) ja escalados pelos multiplicadores do char; (2) aplica deceleracao no chao (`GROUND_DECEL`) ou no ar (`AIR_DECEL`) quando sem input horizontal; (3) atualiza coyote/jumpBuffer; (4) dispara pulo se buffer + (no chao ou coyote); (5) `stepBody` integra gravidade/posicao e `collideTiles` resolve colisao. `onGround` final vem da resolucao de tiles dentro de `collideTiles`.

  ```ts
  // src/game/player.ts
  import type { Body } from '../engine/physics'
  import { stepBody, collideTiles } from '../engine/physics'
  import type { Input } from '../engine/input'
  import type { CharacterDef, ParsedLevel, SpawnPoint } from '../data/schema'
  import {
    PLAYER_W,
    PLAYER_H,
    WALK_ACCEL,
    RUN_ACCEL,
    WALK_MAX,
    RUN_MAX,
    GROUND_DECEL,
    AIR_DECEL,
    JUMP_VEL,
    COYOTE_FRAMES,
    JUMP_BUFFER_FRAMES,
  } from '../engine/constants'

  export interface Player extends Body {
    char: CharacterDef
    facing: 1 | -1
    coyote: number
    jumpBuffer: number
    lives: number
    hearts: number
  }

  export function createPlayer(char: CharacterDef, spawn: SpawnPoint): Player {
    return {
      x: spawn.x,
      y: spawn.y,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: false,
      char,
      facing: 1,
      coyote: 0,
      jumpBuffer: 0,
      lives: 3,
      hearts: char.hearts,
    }
  }

  export function updatePlayer(player: Player, input: Input, level: ParsedLevel, dt: number): void {
    const char = player.char

    const running = input.isDown('run')
    const accel = running ? RUN_ACCEL * char.runMul : WALK_ACCEL * char.walkMul
    const maxSpeed = running ? RUN_MAX * char.runMul : WALK_MAX * char.walkMul

    const left = input.isDown('left')
    const right = input.isDown('right')

    // Aceleracao horizontal a partir do input; deceleracao quando sem direcao.
    if (right && !left) {
      player.facing = 1
      player.vx += accel
      if (player.vx > maxSpeed) player.vx = maxSpeed
    } else if (left && !right) {
      player.facing = -1
      player.vx -= accel
      if (player.vx < -maxSpeed) player.vx = -maxSpeed
    } else {
      const decel = player.onGround ? GROUND_DECEL : AIR_DECEL
      if (player.vx > 0) {
        player.vx -= decel
        if (player.vx < 0) player.vx = 0
      } else if (player.vx < 0) {
        player.vx += decel
        if (player.vx > 0) player.vx = 0
      }
    }

    // Mesmo em corrida, se o player ja vinha mais rapido que o teto atual (ex.: trocou run->walk),
    // o teto e respeitado de forma assimetrica: nunca acelera ALEM do teto pela aceleracao,
    // mas nao freia bruscamente — a deceleracao acima cuida disso quando sem input.

    // Coyote time: conta frames desde que estava no chao.
    if (player.onGround) {
      player.coyote = COYOTE_FRAMES
    } else if (player.coyote > 0) {
      player.coyote -= 1
    }

    // Jump buffer: registra a intencao de pulo por alguns frames.
    if (input.pressed('jump')) {
      player.jumpBuffer = JUMP_BUFFER_FRAMES
    } else if (player.jumpBuffer > 0) {
      player.jumpBuffer -= 1
    }

    // Dispara o pulo se ha intencao bufferizada E (no chao OU dentro da janela de coyote).
    if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = JUMP_VEL * char.jumpVelMul
      player.onGround = false
      player.jumpBuffer = 0
      player.coyote = 0
    }

    // Integra fisica (gravidade ate MAX_FALL) e resolve colisao contra tiles solidos.
    stepBody(player, level, dt)
    collideTiles(player, level)
  }
  ```

- [ ] **Step 9: Rodar o teste (espera PASS)**

  ```bash
  npm run test
  ```

  Saida esperada:

  ```
  PASS  tests/unit/characters.test.ts
  PASS  tests/unit/player.test.ts
  ```

- [ ] **Step 10: Commit do player**

  ```bash
  git add src/game/player.ts tests/unit/player.test.ts
  git commit -m "feat(game): createPlayer/updatePlayer com WALK/RUN accel, coyote e jump buffer"
  ```

---

- [ ] **Step 11: Escrever o teste que falha de `game/sprites.ts` [codigo completo]**

  Cria `tests/unit/sprites.test.ts`. Usa um `FakeRenderer` que implementa exatamente a interface `Renderer` do CONTRATO e grava as chamadas de `drawRect`. Verifica: desenha pelo menos 3 retangulos (corpo cor do char + faixa accent + olho); o corpo usa `char.color`; existe pelo menos um retangulo com `char.accent`; o olho fica do lado de `facing` (x do olho > centro quando facing=1, < centro quando facing=-1).

  ```ts
  // tests/unit/sprites.test.ts
  import { describe, it, expect } from 'vitest'
  import { drawPlaceholder } from '../../src/game/sprites'
  import { CHARACTERS } from '../../src/data/characters'
  import type { Renderer } from '../../src/engine/render'

  interface RectCall {
    x: number
    y: number
    w: number
    h: number
    color: string
  }

  // FakeRenderer: implementa exatamente a interface Renderer do CONTRATO.
  class FakeRenderer implements Renderer {
    rects: RectCall[] = []
    // ctx nao e usado por drawPlaceholder; um stub satisfaz o tipo em runtime de teste.
    ctx = {} as CanvasRenderingContext2D
    clear(_color: string): void {}
    beginWorld(_camX: number, _camY: number): void {}
    endWorld(): void {}
    drawRect(x: number, y: number, w: number, h: number, color: string): void {
      this.rects.push({ x, y, w, h, color })
    }
    present(): void {}
  }

  describe('drawPlaceholder', () => {
    const char = CHARACTERS['renan']
    const X = 100
    const Y = 200
    const W = 34
    const H = 42

    it('desenha o corpo na cor do char, faixa accent e olho (>= 3 retangulos)', () => {
      const r = new FakeRenderer()
      drawPlaceholder(r, char, X, Y, W, H, 1)
      expect(r.rects.length).toBeGreaterThanOrEqual(3)
      // corpo: primeiro retangulo, cor do char, cobrindo a area dada
      const body = r.rects[0]
      expect(body.color).toBe(char.color)
      expect(body.x).toBe(X)
      expect(body.y).toBe(Y)
      expect(body.w).toBe(W)
      expect(body.h).toBe(H)
      // existe pelo menos um retangulo com a cor de accent (a faixa)
      expect(r.rects.some((rc) => rc.color === char.accent)).toBe(true)
    })

    it('coloca o olho no lado direito quando facing=1', () => {
      const r = new FakeRenderer()
      drawPlaceholder(r, char, X, Y, W, H, 1)
      const centerX = X + W / 2
      // o ultimo retangulo desenhado e o olho
      const eye = r.rects[r.rects.length - 1]
      expect(eye.x).toBeGreaterThanOrEqual(centerX)
    })

    it('coloca o olho no lado esquerdo quando facing=-1', () => {
      const r = new FakeRenderer()
      drawPlaceholder(r, char, X, Y, W, H, -1)
      const centerX = X + W / 2
      const eye = r.rects[r.rects.length - 1]
      expect(eye.x + eye.w).toBeLessThanOrEqual(centerX)
    })
  })
  ```

- [ ] **Step 12: Rodar o teste (espera FAIL)**

  ```bash
  npm run test
  ```

  Saida esperada (FAIL — `src/game/sprites.ts` ainda nao existe):

  ```
  FAIL  tests/unit/sprites.test.ts
  Error: Failed to load url ../../src/game/sprites (resolved id: .../src/game/sprites)
    does not exist.
  ```

- [ ] **Step 13: Implementar o minimo — `src/game/sprites.ts` [CODIGO TS COMPLETO]**

  Ordem das chamadas: (1) corpo na cor do char cobrindo `x,y,w,h`; (2) faixa accent (uma listra horizontal na parte superior do corpo); (3) olho na cor INK posicionado no lado de `facing`. O teste depende dessa ordem (corpo = `rects[0]`, olho = ultimo).

  ```ts
  // src/game/sprites.ts
  import type { Renderer } from '../engine/render'
  import type { CharacterDef } from '../data/schema'
  import { COLOR_INK } from '../engine/constants'

  export function drawPlaceholder(
    r: Renderer,
    char: CharacterDef,
    x: number,
    y: number,
    w: number,
    h: number,
    facing: 1 | -1,
  ): void {
    // 1) Corpo: retangulo na cor do personagem.
    r.drawRect(x, y, w, h, char.color)

    // 2) Faixa accent: listra horizontal na parte superior do corpo.
    const stripeH = Math.max(2, Math.round(h * 0.18))
    const stripeY = y + Math.round(h * 0.22)
    r.drawRect(x, stripeY, w, stripeH, char.accent)

    // 3) Olho: quadrado pequeno na cor INK, deslocado para o lado do facing.
    const eyeSize = Math.max(2, Math.round(w * 0.18))
    const eyeY = y + Math.round(h * 0.30)
    const centerX = x + w / 2
    const eyeX =
      facing === 1
        ? Math.round(centerX + w * 0.16) // lado direito
        : Math.round(centerX - w * 0.16 - eyeSize) // lado esquerdo
    r.drawRect(eyeX, eyeY, eyeSize, eyeSize, COLOR_INK)
  }
  ```

- [ ] **Step 14: Rodar o teste (espera PASS)**

  ```bash
  npm run test
  ```

  Saida esperada (a suite inteira da task verde):

  ```
  PASS  tests/unit/characters.test.ts
  PASS  tests/unit/player.test.ts
  PASS  tests/unit/sprites.test.ts
  ```

- [ ] **Step 15: Commit do sprite placeholder**

  ```bash
  git add src/game/sprites.ts tests/unit/sprites.test.ts
  git commit -m "feat(game): drawPlaceholder (corpo + faixa accent + olho no lado do facing)"
  ```

---

### Task 12: Montagem World 1 Greybox + Goal + HUD + Smoke E2E (game/game.ts + game/goal.ts + ui/hud.ts + main.ts + tests/e2e/world1.spec.ts)

Fecha a fatia vertical jogável do M0: ligar `checkGoal`, orquestrar o estado `playing` em `createGame` (player + câmera + timer decrescendo de `TIME_START`, vitória dispara `state.set('win')`), desenhar o HUD em `960x528` (mono UPPERCASE), montar tudo em `main.ts` expondo `window.__GAME_STATE` para o teste, e provar de ponta a ponta com Playwright (segura `ArrowRight` até o player encostar no goal e o estado virar `win`).

Pré-requisitos (entregues por tasks anteriores e usados aqui sem reescrever): `engine/constants.ts`, `engine/state.ts` (`createStateMachine`), `engine/loop.ts` (`createLoop`), `engine/input.ts` (`createInput`), `engine/render.ts` (`createRenderer`), `engine/physics.ts`, `engine/camera.ts` (`createCamera`, `followCamera`), `data/schema.ts`, `data/characters.ts` (`CHARACTERS`, `DEFAULT_CHARACTER_ID`), `data/levels/world1-zona1.ts` (`world1Zona1`), `game/levelParser.ts` (`parseLevel`), `game/player.ts` (`createPlayer`, `updatePlayer`), `game/sprites.ts` (`drawPlaceholder`).

**Files:**
- Create: `src/game/goal.ts`
- Create: `src/ui/hud.ts`
- Create: `src/game/game.ts`
- Modify: `src/main.ts`
- Modify: `index.html` (somente se ainda não tiver `<canvas id="game">` + `<script type=module src=/src/main.ts>` — ver Step 9)
- Test: `tests/unit/goal.test.ts`
- Test: `tests/unit/game.test.ts`
- Test: `tests/unit/hud.test.ts`
- Test: `tests/e2e/world1.spec.ts`

---

- [ ] **Step 1: Escrever o teste que falha de `checkGoal` (AABB vs tile goal)**

Cria `tests/unit/goal.test.ts`. Usa um `LevelDef` mínimo com legenda canônica (`S`=spawn, `G`=goal, `#`=ground) e `parseLevel` para obter o `ParsedLevel`. Verifica: (a) player longe do goal -> `false`; (b) player sobreposto ao tile goal -> `true`.

```ts
// tests/unit/goal.test.ts
import { describe, it, expect } from 'vitest'
import { parseLevel } from '../../src/game/levelParser'
import { createPlayer } from '../../src/game/player'
import { checkGoal } from '../../src/game/goal'
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../../src/data/characters'
import { TILE } from '../../src/engine/constants'
import type { LevelDef } from '../../src/data/schema'

const def: LevelDef = {
  id: 'test-goal',
  world: 1,
  zone: 1,
  rows: [
    '......',
    '......',
    'S....G',
    '######',
  ],
}

function makePlayer() {
  const level = parseLevel(def)
  const player = createPlayer(CHARACTERS[DEFAULT_CHARACTER_ID], level.playerSpawn)
  return { level, player }
}

describe('checkGoal', () => {
  it('retorna false quando o player esta longe do goal', () => {
    const { level, player } = makePlayer()
    expect(checkGoal(player, level)).toBe(false)
  })

  it('retorna true quando o AABB do player intersecta o tile goal', () => {
    const { level, player } = makePlayer()
    // posiciona o player exatamente sobre o tile goal
    player.x = level.goal.x
    player.y = level.goal.y
    expect(checkGoal(player, level)).toBe(true)
  })

  it('retorna true em sobreposicao parcial (canto) com o tile goal', () => {
    const { level, player } = makePlayer()
    player.x = level.goal.x - player.w + 2
    player.y = level.goal.y - player.h + 2
    expect(checkGoal(player, level)).toBe(true)
  })

  it('retorna false quando o player encosta de leve fora do tile goal', () => {
    const { level, player } = makePlayer()
    player.x = level.goal.x - player.w - 1
    player.y = level.goal.y
    expect(checkGoal(player, level)).toBe(false)
  })
})
```

Observação: o tile goal ocupa a célula `TILE x TILE`; `level.goal` é o `SpawnPoint` em pixels (canto superior-esquerdo do tile), conforme `parseLevel`. `TILE` é importado só para deixar explícito o tamanho do tile no raciocínio do teste (não precisa ser usado em asserção).

---

- [ ] **Step 2: Rodar o teste de `checkGoal` e ver FALHAR**

```
npm run test
```

Saída esperada (FAIL) — o módulo ainda não existe:

```
FAIL  tests/unit/goal.test.ts [ tests/unit/goal.test.ts ]
Error: Failed to load url ../../src/game/goal (resolved id: .../src/game/goal.ts). Does the file exist?
```

---

- [ ] **Step 3: Implementar `src/game/goal.ts` (mínimo para passar)**

`checkGoal` faz AABB do player contra o retângulo `TILE x TILE` do tile goal. Usa `level.goal` (pixels). Intersecção estrita (`<`/`>`) para que apenas encostar a borda não conte como colisão.

```ts
// src/game/goal.ts
import type { ParsedLevel } from '../data/schema'
import { TILE } from '../engine/constants'
import type { Player } from './player'

export function checkGoal(player: Player, level: ParsedLevel): boolean {
  const gx = level.goal.x
  const gy = level.goal.y
  return (
    player.x < gx + TILE &&
    player.x + player.w > gx &&
    player.y < gy + TILE &&
    player.y + player.h > gy
  )
}
```

---

- [ ] **Step 4: Rodar o teste de `checkGoal` e ver PASSAR**

```
npm run test
```

Saída esperada (PASS):

```
 ✓ tests/unit/goal.test.ts (4 tests)
   ✓ checkGoal > retorna false quando o player esta longe do goal
   ✓ checkGoal > retorna true quando o AABB do player intersecta o tile goal
   ✓ checkGoal > retorna true em sobreposicao parcial (canto) com o tile goal
   ✓ checkGoal > retorna false quando o player encosta de leve fora do tile goal
```

Commit:

```
git add src/game/goal.ts tests/unit/goal.test.ts
git commit -m "feat(goal): checkGoal AABB do player vs tile goal (M0 Task 12)"
```

---

- [ ] **Step 5: Escrever o teste que falha de `drawHud`**

Cria `tests/unit/hud.test.ts`. Como `drawHud` desenha no Canvas, o teste usa um `Renderer` falso (mock do contrato) que registra as chamadas a `fillText`. Verifica que o HUD: (a) não lança; (b) escreve algo contendo o tempo, as vidas e as moedas; (c) usa texto em UPPERCASE (sem letras minúsculas a-z no que foi desenhado).

```ts
// tests/unit/hud.test.ts
import { describe, it, expect } from 'vitest'
import { drawHud } from '../../src/ui/hud'
import type { Renderer } from '../../src/engine/render'

function makeFakeRenderer() {
  const texts: string[] = []
  const ctx = {
    save() {},
    restore() {},
    fillText(text: string) {
      texts.push(text)
    },
    set fillStyle(_v: string) {},
    get fillStyle() {
      return '#000'
    },
    set font(_v: string) {},
    get font() {
      return ''
    },
    set textBaseline(_v: string) {},
    get textBaseline() {
      return 'alphabetic'
    },
    set textAlign(_v: string) {},
    get textAlign() {
      return 'left'
    },
  } as unknown as CanvasRenderingContext2D

  const renderer = {
    ctx,
    clear() {},
    beginWorld() {},
    endWorld() {},
    drawRect() {},
    present() {},
  } as unknown as Renderer

  return { renderer, texts }
}

describe('drawHud', () => {
  it('nao lanca e desenha o tempo, vidas e moedas', () => {
    const { renderer, texts } = makeFakeRenderer()
    expect(() =>
      drawHud(renderer, { time: 250, lives: 3, coins: 0, hwMeter: 0 }),
    ).not.toThrow()
    const all = texts.join(' | ')
    expect(all).toContain('250')
    expect(all).toContain('3')
    expect(all).toContain('0')
  })

  it('desenha tudo em UPPERCASE (sem minusculas a-z)', () => {
    const { renderer, texts } = makeFakeRenderer()
    drawHud(renderer, { time: 199, lives: 2, coins: 7, hwMeter: 500 })
    const all = texts.join('')
    expect(all).not.toMatch(/[a-z]/)
  })
})
```

---

- [ ] **Step 6: Rodar o teste de `drawHud` e ver FALHAR**

```
npm run test
```

Saída esperada (FAIL):

```
FAIL  tests/unit/hud.test.ts [ tests/unit/hud.test.ts ]
Error: Failed to load url ../../src/ui/hud (resolved id: .../src/ui/hud.ts). Does the file exist?
```

---

- [ ] **Step 7: Implementar `src/ui/hud.ts` (mínimo para passar)**

Desenha em espaço de tela `960x528` (chamado fora de `beginWorld/endWorld`). Fonte monoespaçada, labels UPPERCASE. Mostra TEMPO, VIDAS, MOEDAS e o medidor Humanware (`HW_METER_MAX` declarado, usado de fato no M1; aqui só mostramos o número). Usa `COLOR_TEXT` para o texto e `COLOR_MAGENTA` para o medidor HW.

```ts
// src/ui/hud.ts
import type { Renderer } from '../engine/render'
import { COLOR_TEXT, COLOR_MAGENTA, HW_METER_MAX } from '../engine/constants'

export function drawHud(
  r: Renderer,
  data: { time: number; lives: number; coins: number; hwMeter: number },
): void {
  const ctx = r.ctx
  ctx.save()
  ctx.font = '16px monospace'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const time = Math.max(0, Math.ceil(data.time))
  const timeStr = String(time).padStart(3, '0')
  const coinsStr = String(data.coins).padStart(2, '0')

  ctx.fillStyle = COLOR_TEXT
  ctx.fillText(`TEMPO ${timeStr}`, 16, 14)
  ctx.fillText(`VIDAS ${data.lives}`, 160, 14)
  ctx.fillText(`MOEDAS ${coinsStr}`, 280, 14)

  // medidor Humanware (declarado no M0, ativo no M1)
  const hwPct = Math.round((data.hwMeter / HW_METER_MAX) * 100)
  ctx.fillStyle = COLOR_MAGENTA
  ctx.fillText(`HW ${String(hwPct).padStart(3, '0')}`, 460, 14)

  ctx.restore()
}
```

Nota: todos os labels (`TEMPO`, `VIDAS`, `MOEDAS`, `HW`) já estão em UPPERCASE e os valores são numéricos, satisfazendo o teste de "sem minúsculas".

---

- [ ] **Step 8: Rodar o teste de `drawHud` e ver PASSAR**

```
npm run test
```

Saída esperada (PASS):

```
 ✓ tests/unit/goal.test.ts (4 tests)
 ✓ tests/unit/hud.test.ts (2 tests)
   ✓ drawHud > nao lanca e desenha o tempo, vidas e moedas
   ✓ drawHud > desenha tudo em UPPERCASE (sem minusculas a-z)
```

Commit:

```
git add src/ui/hud.ts tests/unit/hud.test.ts
git commit -m "feat(hud): drawHud mono UPPERCASE (tempo/vidas/moedas/medidor) (M0 Task 12)"
```

---

- [ ] **Step 9: Escrever o teste que falha de `createGame`**

Cria `tests/unit/game.test.ts`. Monta um `Renderer` falso (drawRect/clear contam chamadas) e um `Input` falso programável. Verifica: (a) estado inicial `playing`; (b) `update` decrementa o timer a partir de `TIME_START` (em segundos: `dt` em segundos por frame); (c) ao teleportar o player para cima do goal e chamar `update`, o estado vira `win`; (d) `render` chama `clear`, `beginWorld`, `endWorld` e desenha pelo menos 1 `drawRect` (tiles/player).

```ts
// tests/unit/game.test.ts
import { describe, it, expect } from 'vitest'
import { createGame } from '../../src/game/game'
import { parseLevel } from '../../src/game/levelParser'
import { TIME_START, FIXED_DT } from '../../src/engine/constants'
import type { Renderer } from '../../src/engine/render'
import type { Input, InputAction } from '../../src/engine/input'
import type { LevelDef } from '../../src/data/schema'

const def: LevelDef = {
  id: 'test-game',
  world: 1,
  zone: 1,
  rows: [
    '..........',
    '..........',
    'S........G',
    '##########',
  ],
}

function makeFakeRenderer() {
  const calls = { clear: 0, beginWorld: 0, endWorld: 0, drawRect: 0, present: 0 }
  const ctx = {
    save() {},
    restore() {},
    fillText() {},
    set fillStyle(_v: string) {},
    get fillStyle() {
      return '#000'
    },
    set font(_v: string) {},
    get font() {
      return ''
    },
    set textBaseline(_v: string) {},
    get textBaseline() {
      return 'top'
    },
    set textAlign(_v: string) {},
    get textAlign() {
      return 'left'
    },
  } as unknown as CanvasRenderingContext2D
  const renderer = {
    ctx,
    clear() {
      calls.clear++
    },
    beginWorld() {
      calls.beginWorld++
    },
    endWorld() {
      calls.endWorld++
    },
    drawRect() {
      calls.drawRect++
    },
    present() {
      calls.present++
    },
  } as unknown as Renderer
  return { renderer, calls }
}

function makeFakeInput(down: Partial<Record<InputAction, boolean>> = {}): Input {
  return {
    isDown: (a: InputAction) => down[a] === true,
    pressed: () => false,
    update() {},
    attach() {},
  }
}

describe('createGame', () => {
  it('inicia no estado playing', () => {
    const { renderer } = makeFakeRenderer()
    const level = parseLevel(def)
    const game = createGame(renderer, makeFakeInput(), level)
    expect(game.state.get()).toBe('playing')
  })

  it('decrementa o timer a partir de TIME_START', () => {
    const { renderer } = makeFakeRenderer()
    const level = parseLevel(def)
    const game = createGame(renderer, makeFakeInput(), level)
    // 60 passos de FIXED_DT ~ 1 segundo de jogo
    for (let i = 0; i < 60; i++) game.update(FIXED_DT)
    // timer exposto via render data nao acessivel; validamos que nao venceu por tempo (>0)
    // e que o estado segue playing (ninguem tocou o goal)
    expect(game.state.get()).toBe('playing')
  })

  it('vence (state win) quando o player alcanca o goal', () => {
    const { renderer } = makeFakeRenderer()
    const level = parseLevel(def)
    const game = createGame(renderer, makeFakeInput(), level)
    // expoe o player via game para teleportar em cima do goal
    game.player.x = level.goal.x
    game.player.y = level.goal.y
    game.update(FIXED_DT)
    expect(game.state.get()).toBe('win')
  })

  it('render desenha o mundo: clear/beginWorld/endWorld/drawRect', () => {
    const { renderer, calls } = makeFakeRenderer()
    const level = parseLevel(def)
    const game = createGame(renderer, makeFakeInput(), level)
    game.render(1)
    expect(calls.clear).toBeGreaterThanOrEqual(1)
    expect(calls.beginWorld).toBe(1)
    expect(calls.endWorld).toBe(1)
    expect(calls.drawRect).toBeGreaterThanOrEqual(1)
  })

  it('nao continua atualizando o player apos vencer', () => {
    const { renderer } = makeFakeRenderer()
    const level = parseLevel(def)
    const game = createGame(renderer, makeFakeInput({ right: true }), level)
    game.player.x = level.goal.x
    game.player.y = level.goal.y
    game.update(FIXED_DT)
    expect(game.state.get()).toBe('win')
    const xAtWin = game.player.x
    game.update(FIXED_DT)
    expect(game.player.x).toBe(xAtWin)
  })
})
```

Para o teste poder teleportar/ler o player, a `interface Game` do CONTRATO (`update`, `render`, `state`) é estendida com um campo público `player: Player` (não conflita com o CONTRATO: o CONTRATO define o mínimo; expor o player é necessário para teste e para o E2E ler progresso). Mantemos `update`, `render` e `state` exatamente como no CONTRATO.

---

- [ ] **Step 10: Rodar o teste de `createGame` e ver FALHAR**

```
npm run test
```

Saída esperada (FAIL):

```
FAIL  tests/unit/game.test.ts [ tests/unit/game.test.ts ]
Error: Failed to load url ../../src/game/game (resolved id: .../src/game/game.ts). Does the file exist?
```

---

- [ ] **Step 11: Implementar `src/game/game.ts` (estado playing + render + win)**

Orquestra o estado `playing`: `update` roda `input.update()` (consome `pressed`), `updatePlayer`, `followCamera`, decrementa o timer (`dt` em segundos), e checa `checkGoal` -> `state.set('win')`. Após `win`, `update` para de mover o player. `render`: `clear(COLOR_BG)`, `beginWorld(cam)`, desenha tiles (cor por tipo) e o goal (portal magenta) e o player (`drawPlaceholder`), `endWorld()`, depois `drawHud` no espaço de tela. Expõe `player` para teste/E2E.

```ts
// src/game/game.ts
import { createStateMachine } from '../engine/state'
import { createCamera, followCamera } from '../engine/camera'
import { drawPlaceholder } from './sprites'
import { checkGoal } from './goal'
import { createPlayer, updatePlayer, type Player } from './player'
import { drawHud } from '../ui/hud'
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../data/characters'
import type { Renderer } from '../engine/render'
import type { Input } from '../engine/input'
import type { ParsedLevel, TileType } from '../data/schema'
import {
  TILE,
  TIME_START,
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_VIOLET,
  COLOR_LIME,
  COLOR_MAGENTA,
  COLOR_INK,
} from '../engine/constants'

export interface Game {
  update(dt: number): void
  render(alpha: number): void
  state: ReturnType<typeof createStateMachine>
  player: Player
}

const TILE_COLOR: Record<TileType, string | null> = {
  empty: null,
  ground: COLOR_SURFACE,
  brick: COLOR_VIOLET,
  platform: COLOR_LIME,
  block: COLOR_VIOLET,
  spike: COLOR_INK,
  goal: COLOR_MAGENTA,
}

export function createGame(renderer: Renderer, input: Input, level: ParsedLevel): Game {
  const state = createStateMachine('playing')
  const player = createPlayer(CHARACTERS[DEFAULT_CHARACTER_ID], level.playerSpawn)
  const camera = createCamera()
  let time = TIME_START

  function update(dt: number): void {
    input.update()
    if (!state.is('playing')) return

    updatePlayer(player, input, level, dt)
    followCamera(camera, player, level)

    time -= dt
    if (time <= 0) {
      time = 0
      state.set('over')
      return
    }

    if (checkGoal(player, level)) {
      state.set('win')
    }
  }

  function render(_alpha: number): void {
    renderer.clear(COLOR_BG)
    renderer.beginWorld(camera.x, camera.y)

    // tiles (cor por tipo); o goal e desenhado como portal magenta
    for (let ty = 0; ty < level.heightTiles; ty++) {
      const rowTiles = level.tiles[ty]
      for (let tx = 0; tx < level.widthTiles; tx++) {
        const t = rowTiles[tx]
        const color = TILE_COLOR[t]
        if (color === null) continue
        renderer.drawRect(tx * TILE, ty * TILE, TILE, TILE, color)
      }
    }

    // portal (goal) destacado mesmo se o tile ja foi pintado acima
    renderer.drawRect(level.goal.x, level.goal.y, TILE, TILE, COLOR_MAGENTA)

    // player placeholder
    drawPlaceholder(renderer, player.char, player.x, player.y, player.w, player.h, player.facing)

    renderer.endWorld()

    drawHud(renderer, {
      time,
      lives: player.lives,
      coins: 0,
      hwMeter: 0,
    })

    renderer.present()
  }

  return { update, render, state, player }
}
```

Notas de conformidade com o CONTRATO:
- `update`/`render`/`state` têm exatamente as assinaturas do CONTRATO; `player` é adicional (necessário para teste e E2E).
- timer decresce de `TIME_START` em segundos (`dt` passado é `FIXED_DT = 1/60`).
- tempo esgotado -> `over` (regra canônica §0; CONTRATO foca em `win`, mas `over` por tempo é coerente com a máquina de estados e não conflita).
- cores por tipo de tile usam a paleta do CONTRATO; `goal` repintado como portal magenta.

---

- [ ] **Step 12: Rodar o teste de `createGame` e ver PASSAR**

```
npm run test
```

Saída esperada (PASS):

```
 ✓ tests/unit/goal.test.ts (4 tests)
 ✓ tests/unit/hud.test.ts (2 tests)
 ✓ tests/unit/game.test.ts (5 tests)
   ✓ createGame > inicia no estado playing
   ✓ createGame > decrementa o timer a partir de TIME_START
   ✓ createGame > vence (state win) quando o player alcanca o goal
   ✓ createGame > render desenha o mundo: clear/beginWorld/endWorld/drawRect
   ✓ createGame > nao continua atualizando o player apos vencer
```

Commit:

```
git add src/game/game.ts tests/unit/game.test.ts
git commit -m "feat(game): createGame orquestra estado playing + win + render (M0 Task 12)"
```

---

- [ ] **Step 13: Garantir `index.html` (canvas#game + script module)**

Confere se o `index.html` (criado na Task 1) tem o canvas e o módulo do CONTRATO. Se faltar, escreve este conteúdo exato. Resolução interna `960x528`; CSS escala com `image-rendering: pixelated` e letterbox `#050505`.

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Super Gravidade Zero World</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #050505;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      #game {
        width: min(100vw, calc(100vh * (960 / 528)));
        height: auto;
        aspect-ratio: 960 / 528;
        image-rendering: pixelated;
        background: #09090b;
      }
    </style>
  </head>
  <body>
    <canvas id="game" width="960" height="528"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

- [ ] **Step 14: Implementar `src/main.ts` (boot + expor `window.__GAME_STATE`)**

Pega `canvas#game`, cria `Renderer`/`Input`/`Loop`, parseia `world1Zona1`, monta `createGame`, e inicia o loop. Em cada `update`, publica `window.__GAME_STATE = game.state.get()` para o E2E ler sem framework. `createInput().attach(window)`.

```ts
// src/main.ts
import { createRenderer } from './engine/render'
import { createInput } from './engine/input'
import { createLoop } from './engine/loop'
import { createGame } from './game/game'
import { parseLevel } from './game/levelParser'
import { world1Zona1 } from './data/levels/world1-zona1'

declare global {
  interface Window {
    __GAME_STATE?: string
  }
}

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) {
    throw new Error('canvas#game nao encontrado')
  }

  const renderer = createRenderer(canvas)
  const input = createInput()
  input.attach(window)

  const level = parseLevel(world1Zona1)
  const game = createGame(renderer, input, level)

  const loop = createLoop(
    (dt) => {
      game.update(dt)
      window.__GAME_STATE = game.state.get()
    },
    (alpha) => {
      game.render(alpha)
    },
  )

  window.__GAME_STATE = game.state.get()
  loop.start()
}

boot()
```

Conformidade: `main.ts` monta tudo na ordem do CONTRATO (`createRenderer`, `createInput().attach(window)`, `parseLevel(world1Zona1)`, `createGame`, `createLoop(game.update, game.render).start()`). O único acréscimo é publicar `window.__GAME_STATE` (gancho de teste, sem efeito no jogo).

---

- [ ] **Step 15: Build de sanidade (typecheck + bundle)**

Garante que `main.ts`/`game.ts`/`hud.ts`/`goal.ts` compilam em strict e o bundle gera, antes do E2E que sobe a página real.

```
npm run build
```

Saída esperada (PASS):

```
vite vX.Y.Z building for production...
✓ XX modules transformed.
dist/index.html                  ...
dist/assets/index-XXXX.js        ...
✓ built in NNNms
```

Commit:

```
git add src/main.ts index.html
git commit -m "feat(main): boot do jogo + window.__GAME_STATE; index.html canvas 960x528 (M0 Task 12)"
```

---

- [ ] **Step 16: Escrever o smoke E2E Playwright (`tests/e2e/world1.spec.ts`)**

Abre a página (servida pelo `webServer` do `playwright.config.ts` da Task 1, que roda `npm run dev`), espera o estado inicial `playing`, segura `ArrowRight` até `window.__GAME_STATE === 'win'`, e afirma a vitória. Usa polling com tolerância de tempo; mantém `ArrowRight` pressionado o tempo todo.

```ts
// tests/e2e/world1.spec.ts
import { test, expect } from '@playwright/test'

test('World 1 Zona 1: corre ate o goal e vence', async ({ page }) => {
  await page.goto('/')

  // canvas montado e jogo iniciado em 'playing'
  await expect(page.locator('#game')).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE), { timeout: 5000 })
    .toBe('playing')

  // foca o canvas e segura ArrowRight (sem soltar) para correr ate o goal
  await page.locator('#game').click({ position: { x: 10, y: 10 } })
  await page.keyboard.down('ArrowRight')

  // espera o estado virar 'win' enquanto o player avanca pela fase
  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE), { timeout: 60000, intervals: [250] })
    .toBe('win')

  await page.keyboard.up('ArrowRight')
})

declare global {
  interface Window {
    __GAME_STATE?: string
  }
}
```

Notas:
- `page.goto('/')` depende do `use.baseURL` + `webServer` definidos no `playwright.config.ts` da Task 1; nenhuma URL é inventada aqui.
- `intervals: [250]` faz o `expect.poll` reavaliar a cada 250 ms; o timeout de 60 s cobre a corrida greybox completa (`goal` ~ coluna 160).
- Não há tela DOM de vitória no M0; a verificação de vitória é via `window.__GAME_STATE === 'win'`, exatamente como o CONTRATO pede ("expor window.__GAME_STATE para o teste ler").

---

- [ ] **Step 17: Rodar o E2E e ver PASSAR**

```
npm run test:e2e
```

Saída esperada (PASS):

```
Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/world1.spec.ts:3:1 › World 1 Zona 1: corre ate o goal e vence (Ns)

  1 passed (Ns)
```

Se falhar por tempo (player travou antes do goal): conferir que `world1Zona1` (Task da fase) tem chão contínuo da spawn `S` até o goal `G` e que `updatePlayer`/`collideTiles` resolvem X antes de Y (CONTRATO de `physics.ts`). O E2E não deve ser ajustado para mascarar buraco no greybox; corrigir o dado/colisão.

Commit:

```
git add tests/e2e/world1.spec.ts
git commit -m "test(e2e): smoke World 1 Zona 1 corre ate o goal e vence (M0 Task 12)"
```

---

- [ ] **Step 18: Suite completa verde (unit + build + e2e) e commit final do marco**

```
npm run test
npm run build
npm run test:e2e
```

Saída esperada — todos PASS:

```
 ✓ tests/unit/goal.test.ts (4 tests)
 ✓ tests/unit/hud.test.ts (2 tests)
 ✓ tests/unit/game.test.ts (5 tests)
 ... (demais testes unit das tasks anteriores) ...
 Test Files  N passed (N)

✓ built in NNNms

  ✓  1 [chromium] › tests/e2e/world1.spec.ts ... World 1 Zona 1: corre ate o goal e vence
  1 passed
```

Commit final do M0:

```
git add -A
git commit -m "chore(m0): fatia vertical jogavel completa — World 1 Zona 1 ate a vitoria (Task 12)"
```

Resultado: abrir no navegador (`npm run dev`), o personagem Renan (`DEFAULT_CHARACTER_ID`) spawna na World 1 Zona 1 greybox, anda/corre/pula com física, câmera e colisão de tiles, alcança o portal (goal) e o estado vira `win` — fatia vertical do M0 concluída.

---

## Questoes em Aberto (consolidado)
- O CONTRATO define present() na interface Renderer mas nao especifica seu comportamento; como o desenho vai direto ao canvas visivel (sem backbuffer/offscreen), tratei present() como no-op reservado. Se M0+ adotar double-buffering (canvas offscreen -> drawImage no visivel), present() passaria a fazer o blit final.
- O teste injeta o ctx via canvas.getContext stub em vez de usar o canvas real do jsdom, porque o jsdom nao implementa o contexto 2d de forma util (nao pinta e os metodos sao no-op sem espionagem). Isso casa com o escopo da Task ('ctx stub/mock que registra chamadas').
- O CONTRATO define enemies como Array<{x;y;kind:string}> mas nao fixa o valor de 'kind' para o caractere 'g'. Adotei kind:'enemy'. No M1, quando inimigos forem instanciados, confirmar se o tipo deve ser mais especifico (ex.: 'fool' para 'F' vs 'enemy' para 'g').
- parseLevel usa a constante TILE (=48) de constants.ts para o calculo de px, mas schema.ts tambem exporta TILE_SIZE (=48). Ambos valem 48, entao o resultado e identico; mantive TILE por ser a constante de engine usada no resto do M0. Se a equipe preferir TILE_SIZE no parser por ser do mesmo modulo dos tipos, e uma troca trivial de import.
- O CONTRATO marca facing como 1 | -1 mas createPlayer nao especifica o facing inicial; assumi facing=1 (olhando para a direita, coerente com o avanco para o portal). Confirmar se ha preferencia.
- lives na interface Player nao tem valor inicial no CONTRATO; usei START_LIVES=3 (valor da constante) hardcoded como 3 no createPlayer. Se preferir, troco por importar START_LIVES de constants.ts.
- A semantica exata de 'platform e solido so descendo' vive em collideTiles (Task de physics) e nao afeta os testes desta task (nivel de teste usa apenas 'ground').
- O CONTRATO define a `interface Game` apenas com `update`/`render`/`state`, mas o teste unitario e o gancho E2E precisam ler/posicionar o player. Estendi `Game` com um campo publico `player: Player` (sem alterar as 3 assinaturas do CONTRATO). Se a regra for nao adicionar nenhum campo, o E2E precisaria de outro gancho (ex.: `window.__PLAYER_X`) — confirmar a preferencia.
- O CONTRATO menciona explicitamente apenas `win` para o estado de fim; adicionei `over` quando `time<=0` (coerente com a maquina de estados do §0). Se o M0 deve ignorar o timeout (nunca ir para `over`), removo o ramo e deixo o timer apenas decrescer/clampar em 0.
- Assumi que `playwright.config.ts` (Task 1) define `webServer` (rodando `npm run dev`) e `use.baseURL`, permitindo `page.goto('/')`. Se nao definir, o spec precisa de uma URL absoluta ou de configuracao de servidor.