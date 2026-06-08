# Gravidade Zero — O Jogo · Documento de Design (Spec)

---

_Data: 2026-06-08 · Status: rascunho para revisao · Projeto interno Gzero (diversao do grupo) · Arquitetura expansivel (multi-arquivo)._

> Gerado a partir das decisoes travadas em sessao de brainstorming. Jogo-base: remixed-6e07a45d.html. Dossie da empresa: docs/gzero-site-dossier.md.

---

## Sumario
0. **Cânone do Projeto (FONTE ÚNICA DA VERDADE — prevalece sobre as demais seções)**
1. Visao Geral & Pilares de Design
2. Arquitetura & Estrutura de Arquivos
3. Modelo de Dados & Formatos
4. Motor & Fisica (port da base)
5. Personagens Jogaveis & Habilidades
6. Superpoder Humanware
7. Inimigos, Obstaculos & Chefes
8. Mundos & Design de Fases
9. Coletaveis & Progressao
10. Visual, UI/HUD & Marca
11. Pipeline de Arte (Higgsfield -> Sprites)
12. Audio
13. Estrategia de Testes & Verificacao
14. Roadmap & Marcos
15. Riscos, Decisoes em Aberto & Apendices

---

## 0. Cânone do Projeto (FONTE ÚNICA DA VERDADE)

> Seção adicionada após a **revisão adversarial**, que encontrou 22 divergências entre seções (os autores em paralelo fixaram valores próprios para os sistemas NOVOS). **Onde qualquer seção (3–15) conflitar com este §0, o §0 prevalece.** Implementação e plano leem os valores daqui. As constantes herdadas da base (TILE=48, GRAVITY=0.8, JUMP_VEL=-15.4, MAX_FALL=17, STAR_TIME=480, TIME_START=250) permanecem como nas §1/§4 (estavam consistentes).

### 0.1 Resolução & render
- **Buffer interno de render: 960×528** (canônico). TILE=48 → 20×11 tiles visíveis; HUD/UI desenham no mesmo espaço 960×528. A resolução "480×264" da §10 está **revogada** (reescalar a tipografia da §10 para o espaço 960). Escala para tela via CSS com `image-rendering: pixelated`, preservando aspecto 960:528.

### 0.2 Modo Humanware — constantes canônicas
| Constante | Valor | Notas |
|---|---|---|
| `HW_TIME_SCALE` (mundo no Modo) | **0.35** | revoga 0.45 (§4/§7) e 0.55 (§8) |
| `METER_MAX` | **1000** | 4 segmentos de 250 |
| Ganho moeda / Super Skill | **8** | |
| Ganho stomp | **60** | (§7 "0.06" → 60) |
| Ganho heart-orb (coração) | **25** | = 2,5% do medidor (não "25%") |
| Ganho reparar zona | **250** | (§7 "0.25" → 250) |
| Ganho Lifecard | **500** | |
| Duração do Modo | **300 frames (5 s)** | |
| Cooldown pós-Modo | **300 frames** | |
| Timer da FASE no Modo | **pausado** | |
| `riddleTimer` da Esfinge no Modo | **desacelera** (a 0.35), não pausa | timer de combate ≠ timer de fase |

- Modelo de slow-motion: **dt contínuo escalado** (`dt * scale`); player roda em `playerScale = 1.0`. O modelo de "pular frames/acumulador" da §4.5 está **revogado**.
- O Modo **não dá invencibilidade total** (hazards de ambiente ainda causam dano); congela inimigos `tolo*` e turbina ferramentas.

### 0.3 IDs de habilidade — enum único
Definir UMA vez em `data/schema.ts`; nunca renomear/reaproveitar. **snake_case PT:** `salto_visionario` (Renan), `dash_criativo` (Dante), `escudo_governanca` (Julio), `builder` (Artur), `emc2` (Einstein), `amplificador` (Renante). Demais esquemas (kebab, `double-jump`, `visionary_jump`, etc.) **revogados**.

### 0.4 Stats canônicos do roster (revoga a tabela duplicada da §3.4; fonte = §5.2)
| Personagem | jumpVelMul | walkMul | runMul | weightMul | corações |
|---|---|---|---|---|---|
| Renan | **1.06** (→ −16.3) | 1.00 | 1.00 | 0.96 | 3 |
| Dante | 1.00 | 1.06 | 1.08 | 1.00 | 3 |
| Julio | 1.00 | 1.00 | 1.00 | 1.08 | 4 |
| Artur | 1.00 | 1.00 | 1.00 | 1.00 | 3 |
| Einstein | 0.94 | 0.92 | 1.00 | 1.00 | 2 |

- Renan `jumpVelMul` = **1.06** (revoga 1.10/§3.4 e 1.15/§13.3.3).
- Dante dash: **dashSpeed=12.0, dashFrames=12, iFrames=16** (revoga 11/10 da §13.3.3 e 8.5 da §15.5).

### 0.5 Corações vs. Vidas (recursos distintos)
- **Corações** = HP dentro da fase; varia por personagem (§0.4). Perder todos = perder 1 vida.
- **Vidas/continues** = global; começa em **3**, máximo **9**.
- `frag.existential` concede **+1 coração máximo base** a todos (não "+1 vida"). i-frames ao tomar dano: **90 frames (1,5 s)**.

### 0.6 Composição de time-scale (Einstein + Humanware)
Regra única: **`Math.min`** (nunca multiplicar). Einstein `emc2` pessoal: worldScale **0.25**. No Modo Humanware com Einstein: `min(0.35, 0.25)` = **0.25**. O "0.20 multiplicado" da §6.5.3 está **revogado**.

### 0.7 Legenda canônica do tilemap (revoga a da §8.1; fonte = §3)
`#`=ground · `B`=brick · `=`=platform(one-way) · `?`=block(item) · `^`=spike · `o`=coin/Super Skill · `*`=estrela · `F`=Tolo com Ferramenta · `g`=inimigo básico · `L`=Lifecard · `S`=spawn do player · `G`=goal/portal. Reescrever os tilemaps da §8 com esta legenda.

### 0.8 Mapa canônico de desbloqueio (revoga duplicatas §5.10/§8.3/§9.3)
| Personagem | Desbloqueio |
|---|---|
| **Renan** | inicial (default) |
| **Dante** | Lifecard no fim da World 1 · Zona 1 |
| **Julio** | Lifecard na fase-chefe da World 1 (concluir sem tomar dano) |
| **Artur** | Lifecard na fase-cliente da World 2 (gate de Dash do Dante) |
| **Einstein** | Lifecard em segredo alto da World 3 |
| **Renante** | após reunir as 3 Transformações + vencer a Esfinge |

### 0.9 Amplificação do Renante (revoga descrições qualitativas da §9.3.4; fonte = patches numéricos da §5.9)
Renan: maxAirJumps 2 + revealRadius 9 · Dante: dashFrames 18 / dashSpeed 13.5 / iFrames 24 · Julio: escudo 360° + staminaMax 240 + regen 2.0 · Einstein: worldScale 0.25 / duração 210 · Artur: plataforma +1 tile largura + duração maior.

### 0.10 Contagem de fases (unidade explícita)
- **Nós no hub:** 12 (5 mundos-pilar + 5 fases-cliente + 1 Vale do Silício + 1 arena da Esfinge).
- **Fases jogáveis:** 22 = 15 (5 pilares × 3) + 5 cliente + 1 Vale do Silício + 1 Esfinge.

### 0.11 Árvore de pastas canônica (revoga §12.2/§13.9; fonte = §2.2)
`src/engine/`, `src/game/`, `src/data/`, `src/ui/`, `src/assets/`. Áudio em **`src/engine/audio/`**. Os layouts `src/audio/` (§12) e `src/core/`+`src/systems/`+`src/render/` (§13) estão **revogados**.

### 0.12 Orçamento do build single-file
Alvo **< 5 MB**, limite duro **< 8 MB** (§15 alinhar ao alvo de 5 MB). Música = procedural/chiptune (não OGG embutido).

### 0.13 Lacunas reconhecidas (escopo pós-MVP — ver §14)
- **Esfinge:** arena fixa (não-scrolling), glifos A/B/C, fluxo enigma↔esquiva, e **banco de enigmas ≥9 com rotação** → detalhados no **Marco M3** (chefes). Não bloqueiam o MVP (World 1).
- **Conteúdo batida-a-batida de W2–W5** → Marcos M3/M4. Só a **World 1** é especificada batida-a-batida (é o MVP).

### 0.14 Mapa de referências cruzadas (corrige numeração das §§)
Ao ler "ver §N": roster=**§5**, motor/física=**§4**, Humanware=**§6**, inimigos/chefes=**§7**, fases=**§8**, progressão=**§9**, UI/marca=**§10**, arte=**§11**, áudio=**§12**, testes=**§13**, roadmap=**§14**.

---

## 1. Visao Geral & Pilares de Design

> Documento vivo. Esta secao estabelece o "porque" e as regras de fronteira do projeto. Decisoes de fisica, arquitetura, roster, arte e fases sao detalhadas nas secoes seguintes (ver secao 2 em diante) e nao devem ser duplicadas aqui.

---

### 1.1. Premissa

**Gravidade Zero — O Jogo** e um platformer 2D de marca da **Gzero** (Gravidade Zero), construido para rodar no navegador (HTML5 Canvas 2D, resolucao fixa de **960x528**, mesmo aspecto do jogo-base de 11 tiles de 48px). O jogo nasce de um jogo-base existente (vanilla JS + Canvas) que sera **portado e expandido** para uma base seria, data-driven e modular (Vite + TypeScript), sem framework pesado no gameplay.

A narrativa traduz literalmente a lore da marca (ver dossie `docs/gzero-site-dossier.md` e secao de lore do spec): o mundo foi **esmagado pela "gravidade"** — o peso da complexidade, da cultura morta e da automacao sem alma. O heroi atravessa um **PORTAL** e entra no reino de **GRAVIDADE ZERO**: um espaco sem peso, de plataformas flutuantes, onde a leveza ainda e possivel. A missao e **reparar as zonas corrompidas, reunir as 3 Transformacoes (Existencial + Cultural + Digital)** e atingir a **CONSCIENCIA UNIFICADA**, devolvendo leveza ao mundo.

O antagonista recorrente e **"O Tolo com a Ferramenta"** (a tese central da marca: "um tolo com uma ferramenta continua sendo um tolo"). O chefe-enigma e a **ESFINGE** ("decifra-me ou te devoro"). A frase de vitoria final e a assinatura da marca: **"Voce tambem acredita que podemos mudar o mundo? Bora juntos."**

O diferencial mecanico do jogo — que o separa de um clone de Mario — e o **Superpoder HUMANWARE** (ver secao 4): um medidor de coracao/consciencia compartilhado por todos os personagens, que ao encher dispara o **MODO HUMANWARE** (mundo desacelera, inimigos "Tolo" congelam, ferramentas viram "potencia"). Esse e o tema da marca virado verbo de gameplay: **"IA amplifica, nao substitui o potencial humano"**.

**Pitch de uma frase:** *Um platformer de marca onde voce atravessa o reino de Gravidade Zero, derrota os "Tolos com Ferramentas", decifra a Esfinge e reune as 3 Transformacoes — usando consciencia humana (HUMANWARE) como seu maior superpoder.*

---

### 1.2. Core Gameplay Loop

O loop e estruturado em tres camadas temporais. Todas as constantes citadas (TILE=48, etc.) vem do jogo-base e sao a referencia de partida; valores definitivos de fisica/balanceamento sao fixados na secao de fisica e balanceamento.

**Camada 1 — Loop momento-a-momento (segundos):**

```
correr / pular  ->  evitar perigo (inimigo, vao, projetil)  ->  coletar (moeda, item, coracao)
       ^                                                                        |
       |                                                                        v
   reposicionar  <-  recompensa imediata (feedback visual/sonoro, +HUMANWARE)  -
```

1. O jogador entra numa fase controlando 1 dos 5 herois (ver roster na secao 5).
2. Move-se da esquerda para a direita (scroll horizontal com camera clamp), enfrentando **plataformas flutuantes, vaos, blocos com bump, inimigos de patrulha e projeteis**.
3. Cada acao "boa" (coletar moeda/item, stomp em inimigo, decifrar pista) **enche o medidor HUMANWARE** e da feedback imediato.
4. Usa a **habilidade unica do personagem** (ex.: Salto Visionario do Renan, Dash Criativo do Dante — ver secao 5) para resolver os obstaculos da fase.

**Camada 2 — Loop da fase (2 a 5 minutos por fase):**

```
INICIO da fase  ->  navegar segmentos  ->  enfrentar mini-desafio / mecanica da zona
                                                        |
                                                        v
            META (goal coluna 160) <- coletar a Transformacao/Lifecard da zona <- (opcional) usar MODO HUMANWARE para passar trecho dificil
```

5. Conforme avanca, o medidor enche ate **MODO HUMANWARE** ficar disponivel; ativa-lo permite vencer trechos punitivos (o mundo desacelera, "Tolos" congelam).
6. Ao chegar na **META** (goal por volta da coluna 160 do mapa de 168 tiles), a fase e concluida; o jogador pode **desbloquear a Lifecard** de um personagem (que libera novo jogavel) e/ou um fragmento de **Transformacao**.

**Camada 3 — Loop de progressao (sessao inteira):**

```
fase concluida -> Lifecard/Transformacao coletada -> novo personagem/zona desbloqueado
       ^                                                            |
       |                                                            v
   rejogar fase  <-  buscar segredos/cartas que faltam  <-  reunir as 3 Transformacoes -> CONSCIENCIA UNIFICADA -> VITORIA
```

7. Reunir as **3 Transformacoes** (Existencial, Cultural, Digital) e atravessar a fase final (Esfinge / Consciencia Unificada) **conclui o jogo** e dispara a tela de vitoria com a frase da marca.

---

### 1.3. Condicao de Vitoria e Derrota

**Vitoria (macro — fim do jogo):** reunir as **3 Transformacoes** e completar a fase final da **CONSCIENCIA UNIFICADA** (que inclui o confronto/enigma com a **ESFINGE**). Dispara o estado `win` (ver maquina de estados na secao de arquitetura, herdada da base: `loading/title/playing/win/over`) com a tela e a frase **"Voce tambem acredita que podemos mudar o mundo? Bora juntos."**

**Vitoria (micro — fim de fase):** alcancar a **META** da fase (interagir com o goal por volta da coluna 160). Toda fase tem uma META alcancavel; nenhuma fase e um beco sem saida.

**Derrota:** transicao para o estado `over` quando ocorre qualquer um dos abaixo. Valores herdados/fixados a partir da base:

| Condicao de derrota | Regra | Valor |
| --- | --- | --- |
| Tempo esgotado | Contador da fase chega a 0 | `TIME_START = 250` (segundos de jogo, herdado da base) |
| Queda em vao | Player cai abaixo do limite inferior do nivel | Y do player > altura do mundo + margem |
| Dano fatal | Player perde a ultima vida ao tocar inimigo/projetil sem invencibilidade | inicia com **3 vidas** |
| Toque em hazard | Toque em zona de perigo da fase (ex.: poco de "gravidade") | dano = perda de 1 vida + knockback |

**Regras de dano e i-frames (fixadas):** ao tomar dano nao-fatal, o player perde 1 vida, ganha **90 frames (1.5 s a 60fps) de invencibilidade piscante** e knockback. **Estrela** (power-up herdado) concede invencibilidade total por `STAR_TIME = 480` frames (8 s). O **MODO HUMANWARE** NAO concede invencibilidade total — ele desacelera o mundo e congela "Tolos", mas o player ainda pode tomar dano de hazards de ambiente (ver secao 4 para o contrato exato do modo).

---

### 1.4. Pilares de Design

Os pilares sao a "constituicao" do projeto: toda decisao de feature, arte ou balanceamento deve poder ser justificada por pelo menos um deles. Em conflito, vence o pilar de menor numero.

#### P1 — Sentir o controle antes de tudo ("game feel" primeiro)
A base mecanica do platformer (corrida, pulo, queda, stomp) precisa ser **gostosa em 5 segundos**, antes de qualquer narrativa ou arte final. Reusamos as constantes ajustadas do jogo-base como ponto de partida (`GRAVITY=0.8`, `JUMP_VEL=-15.4`, `COYOTE=7`, `JUMP_BUFFER=8`, `WALK_MAX=4.6`, `RUN_MAX=7.3`, `STOMP_BOUNCE=-11.5`) porque ja foram tunadas para se sentirem certas. Coyote time e jump buffer sao **inegociaveis** (perdoam o jogador). Qualquer nova mecanica entra so depois que o pulo basico estiver perfeito.

#### P2 — A marca virou mecanica (tema = verbo)
Nada na Gzero e tema "colado por cima": cada conceito de marca tem uma traducao jogavel concreta.

| Conceito da marca | Traducao em gameplay |
| --- | --- |
| "IA amplifica, nao substitui" | Renante (IA) so AMPLIFICA a habilidade do heroi, nunca age sozinho (ver secao 5) |
| HUMANWARE / "caminho do coracao" | Medidor de coracao -> MODO HUMANWARE (ver secao 4) |
| "Tolo com a ferramenta" | Arquetipo de inimigo principal |
| Esfinge ("decifra-me ou te devoro") | Chefe-enigma |
| 3 Transformacoes / Consciencia Unificada | Objetivos colecionaveis + condicao de vitoria |
| Lifecards / LVL MAX / Super Skills | Desbloqueio de personagens + habilidades unicas |
| Clientes (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan) | Fases-desafio tematicas |

#### P3 — Jogavel ja, bonito depois (placeholder-first / pipeline hibrido)
Construimos com **placeholders desenhados em codigo** (formas e paletas Gzero) de modo que o jogo esteja **jogavel do dia 1**, e trocamos por arte final do Higgsfield depois, sem refatorar gameplay (pipeline de arte = abordagem 2, hibrida — ver secao de arte/pipeline). Implicacao tecnica: **assets sao dados intercambiaveis**; o codigo de gameplay nunca depende de um sprite especifico existir. Risco conhecido: operacoes de conta do Higgsfield estao falhando hoje; o pilar P3 garante que isso **nao bloqueia** o desenvolvimento.

#### P4 — Data-driven e expansivel (conteudo sem recompilar logica)
Personagens, fases, inimigos e assets sao **dados** (objetos tipados / JSON), nao codigo hardcoded. Adicionar uma fase nova (ex.: fase-desafio de um cliente) ou um personagem novo deve ser **editar dados**, nao mexer no motor. Este pilar habilita o escopo "serio e expansivel" aprovado pelo usuario. Contrato minimo dos dados (detalhado nas secoes de fases/roster; aqui so o formato de fronteira):

```typescript
/** Identidade estavel usada em saves, dados e telemetria. Nunca reaproveitar um id. */
type CharacterId = "renan" | "dante" | "julio" | "artur" | "einstein";
type CompanionId = "renante";
type TransformationId = "existencial" | "cultural" | "digital";
type GameStateName = "loading" | "title" | "playing" | "win" | "over";

/** Definicao de fase como DADO (campos completos na secao de fases). */
interface LevelDef {
  readonly id: string;            // ex.: "z1-portal", "desafio-vivo"
  readonly title: string;         // nome exibido, pt-BR
  readonly zone: TransformationId | "tutorial" | "final";
  readonly widthTiles: number;    // base = 168
  readonly heightTiles: number;   // base = 11
  readonly groundRow: number;     // base = 9 (GROUND_ROW)
  readonly goalColumn: number;    // base = 160
  readonly timeStart: number;     // base = 250 (TIME_START)
}
```

#### P5 — Diversao interna com orgulho de marca (zoeira grounded)
O publico e **interno** (o grupo da Gzero), entao in-jokes e zoeira sao bem-vindos — **mas sempre ancorados na marca real**. Personagens sao pessoas reais da empresa (Renan, Dante, Julio, Artur, Einstein/pai do Renan); a zoeira reforca a cultura, nunca a contradiz. Regra pratica: se uma piada precisa de explicacao para alguem de fora da Gzero, ela e in-joke (ok); se ela faz a marca parecer ridicula em vez de divertida, ela viola o pilar (corta). Tom detalhado em 1.6.

#### P6 — Web-first, leve e portavel
Roda em qualquer navegador moderno, **Canvas 2D puro**, sem dependencia de servidor para jogar. Deploy primario na **Vercel** (a Gzero ja usa Vercel) e build modular Vite + TS; alem disso, oferecemos um **build single-file opcional** (HTML autocontido) para compartilhar no grupo via link/arquivo. Meta de performance fixada como criterio do pilar:

| Metrica | Alvo | Limite duro |
| --- | --- | --- |
| Frame rate | 60 fps estavel | nunca abaixo de 50 fps em notebook medio |
| Tamanho do build single-file | < 5 MB | < 8 MB (com arte final embutida) |
| Tempo ate jogavel (title -> playing) | < 1.5 s | < 3 s |
| Dependencias de runtime no gameplay | 0 frameworks | 0 (Canvas 2D + TS compilado) |

---

### 1.5. Publico-Alvo

**Publico primario (unico que importa para decisoes):** colaboradores e circulo proximo da **Gzero** — pessoas que conhecem Renan, Dante, Julio, Artur, Einstein, a mascote **Renante**, a doutrina HUMANWARE e os clientes (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan).

Implicacoes de design desse publico:
- **Onboarding curto.** Sao adultos ocupados; a primeira fase (tutorial) deve ensinar pulo, coleta e HUMANWARE em **menos de 2 minutos**, sem texto longo.
- **Sessoes curtas e rejogaveis.** Uma fase = 2 a 5 min. Da para zerar em uma pausa de cafe; da para rejogar para pegar Lifecards.
- **Referencias internas valorizadas.** O grupo VAI reconhecer in-jokes (P5). Eles sao um recurso, nao um risco.
- **Sem requisitos de acessibilidade competitiva nem localizacao.** Publico fala pt-BR; **toda a UI/textos do jogo sao em pt-BR**. Sem necessidade de i18n (ver nao-objetivos, 1.7).
- **Reputacional, nao comercial.** O jogo e vitrine de cultura/marca interna; nao ha monetizacao, conta de usuario ou metricas de receita.

**Publico secundario (tolerado, nao otimizado):** alguem de fora a quem um colaborador mostra o jogo numa reuniao/evento. Para esse caso, o jogo deve ser **autoexplicativo o suficiente para ser divertido sem conhecer a marca** — a zoeira interna agrega para quem entende, mas o platformer funciona sozinho (consequencia direta do pilar P2: tema vira mecanica, entao a mecanica diverte mesmo sem decodificar o tema).

---

### 1.6. Diretrizes de Tom ("brincalhao mas grounded")

O tom alvo e **brincalhao com orgulho de marca, nunca cinico nem corporativo-engessado**. Concretamente:

| Dimensao | FAZER | NAO FAZER |
| --- | --- | --- |
| Humor | In-jokes da Gzero, apelidos reais (Einstein = pai do Renan), zoeira leve entre os personagens | Piada que humilha uma pessoa real ou que faz a marca parecer amadora |
| Voz dos textos | Direta, energica, mono UPPERCASE nos labels/HUD (alinhado ao design), pt-BR coloquial-profissional | Juridiques, jargao corporativo vazio, "sinergia/disrupcao" como piada gasta |
| Lore | Tratar Gravidade Zero, HUMANWARE e as 3 Transformacoes com **seriedade interna** (sao o coracao do jogo) | Zombar da propria doutrina a ponto de descredibiliza-la |
| Antagonista | "O Tolo com a Ferramenta" e comico-pateta (errado por arrogancia, nao por maldade) | Vilao sombrio/violento que quebra o clima leve |
| Vitoria | Inspiradora e calorosa — fecha com "Bora juntos." | Final sarcastico ou anticlimatico |

**Linha-guia editorial (regra de ouro):** *toda piada deve ser algo que Renan, Dante, Julio, Artur ou Einstein riria junto, nao algo de que eles teriam vergonha.* Quando em duvida entre "engracado" e "respeitoso a marca", **vence respeito a marca** (P5).

**Exemplos concretos de copy aprovados (tom de referencia):**
- Tela de game over por tempo: `"A GRAVIDADE TE PEGOU. RESPIRA E TENTA DE NOVO."`
- Stomp num "Tolo": `"FERRAMENTA SEM CONSCIENCIA = ZERO POTENCIA."`
- HUMANWARE cheio: `"HUMANWARE MAXIMO! O CORACAO ASSUME O CONTROLE."`
- Desbloqueio de Lifecard: `"LIFECARD DESBLOQUEADA — {NOME} ENTROU NO TIME."`
- Vitoria final: `"VOCE TAMBEM ACREDITA QUE PODEMOS MUDAR O MUNDO? BORA JUNTOS."`

---

### 1.7. Nao-Objetivos (YAGNI explicito)

Para proteger o escopo "serio e expansivel" sem virar um buraco sem fundo, os itens abaixo estao **explicitamente fora** da v1. Cada um tem uma justificativa ancorada nos pilares. Mover qualquer item para "dentro" exige decisao consciente em outra secao — **nao assumir** que estao implicitos.

| # | Nao-objetivo (NAO construir na v1) | Por que (pilar) | O que fazer em vez disso |
| --- | --- | --- | --- |
| N1 | **Multiplayer / co-op / online** | Publico joga solo; rede triplica complexidade e quebra P6 | Single-player local apenas |
| N2 | **Backend, contas de usuario, login** | P6 (web-first sem servidor); publico interno nao precisa | Save local em `localStorage` (progresso, Lifecards, recordes) |
| N3 | **Internacionalizacao (i18n) / multi-idioma** | Publico e pt-BR (1.5) | Textos pt-BR hardcoded nos dados, em UPPERCASE nos labels |
| N4 | **Engine 3D, WebGL, fisica baseada em motor externo** | P6 (Canvas 2D puro) e P1 (controle artesanal) | Canvas 2D + fisica AABB simples herdada da base |
| N5 | **Framework de UI pesado no gameplay (React/Vue/etc.)** | P6 (0 frameworks no runtime de jogo) | Canvas para o jogo; HTML/CSS so para shell/menus se necessario |
| N6 | **Editor de fases in-game / level editor para usuarios** | P4 ja torna fases editaveis como DADO por devs; editor visual e luxo | Editar `LevelDef` em arquivos de dados |
| N7 | **Monetizacao, anuncios, microtransacoes, loja** | Projeto interno, reputacional (1.5) | Tudo desbloqueavel jogando |
| N8 | **Audio adaptativo/orquestral complexo, dublagem** | Fora do core; nao bloqueia P1 nem P2 | Trilha/efeitos simples (SFX + 1-2 musicas em loop) |
| N9 | **Acessibilidade de nivel WCAG/competitiva (leitor de tela, remap completo)** | Publico interno conhecido (1.5) | Controles fixos sensatos + alto contraste da paleta Gzero |
| N10 | **Roster alem dos 6 definidos; classes/skill-tree/RPG numerico** | Roster travado em 5 jogaveis + Renante (secao 5); profundidade RPG e creep | Habilidades unicas fixas por personagem, sem niveis numericos |
| N11 | **Geracao procedural de fases** | Conflita com P1/P2 (fases sao curadas e tematicas) | Fases desenhadas a mao como dados |
| N12 | **Animacao/cutscenes cinematograficas longas** | Sessoes curtas (1.5); nao agrega ao loop | Texto curto + key-art estatica nas transicoes |
| N13 | **Suporte mobile-touch otimizado / app nativo** | P6 = desktop-web-first; mobile nao e o canal interno | Teclado (desktop). Touch fica como possivel expansao futura, fora da v1 |
| N14 | **Sistema de conquistas/achievements externo (ex.: integracao com plataforma)** | Reputacional interno; complexidade desnecessaria | Lifecards + 3 Transformacoes ja sao a "colecao" |

**Principio YAGNI declarado:** construimos o **menor jogo completo e divertido** que honra os 6 pilares — um platformer com controle gostoso (P1), tema-vira-mecanica (P2), jogavel com placeholders ja (P3), expansivel via dados (P4), brincalhao-grounded (P5) e leve na web (P6) — e **nada alem disso** sem decisao explicita registrada em outra secao do spec.

---

## 2. Arquitetura & Estrutura de Arquivos

> Esta seção define **como** o "Gravidade Zero — O Jogo" é organizado em código: a stack, a árvore de pastas, as fronteiras entre módulos, os comandos de desenvolvimento, o deploy na Vercel e o build single-file opcional. O **conteúdo** dos sistemas (física, fases, roster, modo Humanware) é especificado nas seções correspondentes — aqui tratamos da estrutura que os sustenta. Referências: design data-driven de fases/personagens (ver seção 5), física e gameplay (ver seção 4), arte e pipeline de placeholders (ver seção 6), HUD/UI (ver seção 7).

### 2.1. Stack recomendada e justificativa

| Camada | Escolha | Por quê (decisão travada) |
|---|---|---|
| Bundler / dev server | **Vite 5.x** | HMR instantâneo, ESM nativo em dev, build Rollup otimizado. Plugin ecosystem maduro (single-file, legacy, assets). Zero config inicial. |
| Linguagem | **TypeScript 5.x** (`strict: true`) | Tipagem dos dados (fases, personagens, atlas) elimina classe inteira de bugs num projeto data-driven e expansível. Refactors seguros conforme o jogo cresce. |
| Renderização | **HTML5 Canvas 2D** (`CanvasRenderingContext2D`) | Porte direto do jogo-base; pixel art quadrado (radius 0) com `imageSmoothingEnabled=false`; sem custo de WebGL nem dependência de GPU. Resolução interna fixa **960×528**. |
| Framework de UI | **Nenhum no gameplay** (sem React/Vue/Svelte no loop) | O loop é `requestAnimationFrame` puro sobre Canvas. UI/HUD desenhada no Canvas + um overlay HTML/CSS mínimo (telas de menu, créditos). React é peso morto e GC pressure no game loop. |
| Estilo (overlay) | **CSS puro** + tokens Gzero (`tokens.css`) | Telas fora do gameplay (título, seleção de personagem, pausa, fim) usam DOM + CSS com as fontes Outfit/Inter/mono e tokens de cor. Ver seção 7. |
| Áudio | **Web Audio API** (wrapper próprio em `engine/audio/`) | Controle de mixagem, ducking no Modo Humanware, sem libs externas. |
| Testes | **Vitest** (unit) + **Playwright** (smoke E2E do canvas) | Vitest compartilha config do Vite; Playwright valida boot e 1 frame renderizado. |
| Lint/format | **ESLint** (flat config) + **Prettier** | Padrão de qualidade, `radius 0` e UPPERCASE em labels reforçados por convenção, não por lint. |
| Deploy | **Vercel** (static output) | A Gzero já usa Vercel. Build estático servido de CDN; preview deploys por branch. |
| Distribuição alternativa | **Build single-file** (`vite-plugin-singlefile`) | 1 `.html` autossuficiente para compartilhar no grupo via WhatsApp/Drive sem servidor. |

**Por que não um framework de UI no gameplay:** o jogo roda a 60fps com alocações mínimas por frame (object pooling de partículas e projéteis, ver seção 4). Um runtime de framework introduz overhead de reconciliação e pressão de garbage collector incompatíveis com um platformer. O DOM é usado **apenas** para telas estáticas e overlays, montadas/desmontadas raramente.

**Por que TypeScript e não JS vanilla (como a base):** o projeto é *sério e expansível* e *data-driven*. Tipos em `LevelData`, `CharacterDef`, `AtlasFrame`, `EnemyDef` (ver seção 2.6) transformam erros de dados (coluna inexistente, frame errado, habilidade mal-referenciada) em erros de compilação, não em bugs silenciosos em runtime.

**Versões fixadas (lockfile):** Node `>=20.11`, npm `>=10`. Pinagem via `package.json` `engines` + `.nvmrc` (`20`).

### 2.2. Árvore de pastas completa

```
SuperGzeroWorld/
├─ index.html                      # entrypoint Vite: <canvas id="game"> + overlay #ui-root + <script type="module" src="/src/main.ts">
├─ package.json                    # scripts, deps, engines
├─ package-lock.json
├─ tsconfig.json                   # strict, paths "@engine/*","@game/*","@data/*","@ui/*"
├─ vite.config.ts                  # config padrão (multi-arquivo) — modo build estático
├─ vite.config.singlefile.ts       # config do build single-file (vite-plugin-singlefile)
├─ vitest.config.ts
├─ playwright.config.ts
├─ eslint.config.js                # flat config
├─ .prettierrc.json
├─ .nvmrc                          # 20
├─ vercel.json                     # buildCommand + outputDirectory=dist + SPA fallback
├─ .gitignore                      # node_modules, dist, dist-single, coverage
├─ README.md
│
├─ public/                         # servido como-está em "/", NÃO processado pelo Vite
│  ├─ favicon.svg                  # G0_favcon_Vector.svg (branco, fundo escuro)
│  └─ social/og-image.png          # card de compartilhamento
│
├─ src/
│  ├─ main.ts                      # bootstrap: cria Canvas ctx, instancia Engine, registra cenas, inicia loop
│  ├─ config.ts                    # constantes GLOBAIS de runtime (resolução, debug flags, versão)
│  │
│  ├─ engine/                      # === MOTOR GENÉRICO — NÃO conhece "Gravidade Zero" ===
│  │  ├─ index.ts                  # barrel de exports públicos do engine
│  │  ├─ Game.ts                   # orquestrador: loop RAF, fixed timestep, escala de tempo
│  │  ├─ Loop.ts                   # acumulador de tempo fixo (update 60Hz) + render interpolado
│  │  ├─ SceneManager.ts           # pilha/máquina de cenas (push/pop/replace)
│  │  ├─ Scene.ts                  # interface Scene { enter, exit, update, render, handleInput }
│  │  ├─ Camera.ts                 # posição, clamp aos limites do nível, follow com deadzone
│  │  ├─ input/
│  │  │  ├─ InputManager.ts        # estado por frame: pressed/held/released
│  │  │  ├─ keyboard.ts            # mapeamento de teclas físicas -> ações
│  │  │  ├─ gamepad.ts             # Gamepad API (opcional, mesmo mapa de ações)
│  │  │  └─ actions.ts             # enum Action { Left,Right,Jump,Run,Ability,Pause,Confirm,Cancel }
│  │  ├─ render/
│  │  │  ├─ Renderer.ts            # wrapper ctx 2D, escala DPI, pixel-perfect, limpeza
│  │  │  ├─ Atlas.ts               # carrega PNG + mapa FRAMES; drawFrame(name,x,y,flip)
│  │  │  ├─ Layer.ts               # camadas de render (bg, world, fx, hud) com z-order
│  │  │  └─ primitives.ts          # rect duro, sombra com offset (radius 0), texto pixel
│  │  ├─ physics/
│  │  │  ├─ aabb.ts                # colisão AABB, sweep, resolução por eixo
│  │  │  ├─ TileGrid.ts            # Map "c,r"->TileKind; query por bbox
│  │  │  └─ integrate.ts           # integração de velocidade/gravidade (params injetados)
│  │  ├─ ecs/                      # entidades leves (composição, não ECS pesado)
│  │  │  ├─ Entity.ts              # base: pos, vel, size, alive, update, render
│  │  │  └─ Pool.ts               # object pool genérico<T> (partículas, projéteis)
│  │  ├─ audio/
│  │  │  ├─ AudioEngine.ts         # Web Audio: buses (music, sfx), ducking, volume
│  │  │  └─ Sound.ts               # buffer + play(rate, gain)
│  │  ├─ assets/
│  │  │  ├─ AssetLoader.ts         # carrega imagens/sons/json com progresso (0..1)
│  │  │  └─ decodeBase64.ts        # decodifica assets inline (modo single-file)
│  │  ├─ state/
│  │  │  ├─ EventBus.ts            # pub/sub tipado <GameEvents>
│  │  │  └─ SaveStore.ts           # persistência localStorage (progresso, lifecards)
│  │  └─ time/
│  │     └─ TimeScale.ts           # escala global de tempo (E=mc2, Modo Humanware)
│  │
│  ├─ game/                        # === REGRAS DO "GRAVIDADE ZERO" — depende de engine + data ===
│  │  ├─ index.ts
│  │  ├─ constants.ts              # CONSTANTES DE FÍSICA da base (TILE=48, GRAVITY=0.8, ...)
│  │  ├─ entities/
│  │  │  ├─ Player.ts              # estado do herói, máquina de movimento, aplica habilidade ativa
│  │  │  ├─ Enemy.ts               # "Tolo com a Ferramenta": patrulha + stomp + congela no Humanware
│  │  │  ├─ Coin.ts
│  │  │  ├─ Item.ts                # power-ups (estrela, lifecard, etc.)
│  │  │  ├─ Projectile.ts          # pooled
│  │  │  ├─ Particle.ts            # pooled
│  │  │  └─ Portal.ts              # teleporte entre zonas (lore)
│  │  ├─ systems/
│  │  │  ├─ MovementSystem.ts      # aplica integrate.ts com constants + estado do player
│  │  │  ├─ CollisionSystem.ts     # player×tiles, player×enemy, blocos bump/moeda
│  │  │  ├─ EnemySystem.ts         # IA de patrulha, stomp, projéteis
│  │  │  ├─ CoinItemSystem.ts      # coleta, contagem, spawn de itens de bloco
│  │  │  ├─ HumanwareSystem.ts     # medidor de coração/consciência + MODO HUMANWARE
│  │  │  ├─ AbilitySystem.ts       # despacha habilidade do personagem ativo (data-driven)
│  │  │  └─ SpawnSystem.ts         # instancia entidades a partir de LevelData
│  │  ├─ abilities/                # 1 arquivo por Super Skill (ver seção 3)
│  │  │  ├─ types.ts               # interface Ability { id, onActivate, onUpdate, onEnd }
│  │  │  ├─ saltoVisionario.ts     # Renan: pulo alto/duplo + revela portais
│  │  │  ├─ dashCriativo.ts        # Dante: investida que quebra obstáculos
│  │  │  ├─ escudoGovernanca.ts    # Julio: bloqueia dano (guardrails)
│  │  │  ├─ builder.ts             # Artur: cria plataforma/ferramenta temporária
│  │  │  ├─ emc2.ts                # Einstein: desacelera o tempo (usa TimeScale)
│  │  │  └─ renanteAmplify.ts      # Renante: amplifica a habilidade ativa (companheiro)
│  │  ├─ scenes/                   # cenas concretas (implementam engine/Scene)
│  │  │  ├─ LoadingScene.ts
│  │  │  ├─ TitleScene.ts
│  │  │  ├─ CharacterSelectScene.ts# seleção do roster + lifecards desbloqueadas
│  │  │  ├─ PlayScene.ts           # gameplay: orquestra todos os systems
│  │  │  ├─ PauseScene.ts          # overlay sobre PlayScene
│  │  │  ├─ WinScene.ts            # "Bora juntos."
│  │  │  └─ GameOverScene.ts
│  │  ├─ Level.ts                  # carrega LevelData -> TileGrid + spawns + metadados
│  │  └─ Progress.ts              # estado de campanha: zonas reparadas, transformações, lifecards
│  │
│  ├─ data/                        # === DADOS PUROS (sem lógica) — JSON/TS tipados ===
│  │  ├─ schema.ts                 # TODAS as interfaces TS dos dados (fonte da verdade)
│  │  ├─ characters.ts             # roster: Renan, Dante, Julio, Artur, Einstein, Renante
│  │  ├─ enemies.ts                # defs do "Tolo" e variações
│  │  ├─ items.ts                  # defs de power-ups e lifecards
│  │  ├─ tokens.ts                 # cores Gzero importadas/espelhadas de tokens.css
│  │  └─ levels/
│  │     ├─ index.ts               # registro ordenado de fases (campanha)
│  │     ├─ 01-zona-existencial.ts
│  │     ├─ 02-zona-cultural.ts
│  │     ├─ 03-zona-digital.ts
│  │     ├─ desafio-vivo.ts        # fases-desafio de clientes
│  │     ├─ desafio-kion.ts
│  │     ├─ desafio-ecorodovias.ts
│  │     ├─ desafio-mubadala.ts
│  │     ├─ desafio-jpmorgan.ts
│  │     └─ boss-esfinge.ts        # chefe-enigma
│  │
│  ├─ ui/                          # === OVERLAY DOM + HUD desenhado no Canvas ===
│  │  ├─ index.ts
│  │  ├─ Hud.ts                    # desenha HUD no Canvas (moedas, tempo, medidor Humanware)
│  │  ├─ overlay/
│  │  │  ├─ OverlayRoot.ts         # monta/desmonta DOM em #ui-root
│  │  │  ├─ TitleOverlay.ts        # logo GERZO + start
│  │  │  ├─ CharacterCard.ts       # card de personagem (retrato key-art + skill)
│  │  │  └─ Dialog.ts              # enigmas da Esfinge, falas do Renante
│  │  └─ styles/
│  │     ├─ tokens.css             # cópia versionada dos tokens Gzero (cores/fontes)
│  │     ├─ overlay.css            # layout dos overlays (radius 0, sombras duras)
│  │     └─ fonts.css              # @font-face Outfit, Inter, mono
│  │
│  └─ assets/                      # === ASSETS-FONTE processados pelo Vite (import) ===
│     ├─ atlas/
│     │  ├─ atlas.png              # spritesheet (placeholders -> arte Higgsfield)
│     │  └─ frames.json            # mapa FRAMES nome->{x,y,w,h}
│     ├─ characters/               # retratos key-art por personagem (PNG)
│     ├─ bg/
│     │  └─ space.jpg              # fundo escuro/espaço
│     ├─ audio/
│     │  ├─ music/
│     │  └─ sfx/
│     └─ logos/                    # SVGs Gzero (LogoInteira, letras G/Z/E/R/O)
│
├─ scripts/
│  ├─ pack-atlas.ts                # (opcional) gera frames.json a partir de PNGs soltos
│  └─ inline-assets.ts             # converte assets em base64 p/ build single-file
│
├─ tests/
│  ├─ unit/
│  │  ├─ aabb.test.ts
│  │  ├─ tilegrid.test.ts
│  │  ├─ humanware.test.ts
│  │  └─ schema.test.ts            # valida data/levels contra schema
│  └─ e2e/
│     └─ boot.spec.ts              # Playwright: abre, espera canvas, 1 frame sem erro
│
├─ docs/
│  ├─ gzero-site-dossier.md
│  └─ superpowers/specs/2026-06-08-gravidade-zero-game-design.md
│
└─ dist/                           # saída do build estático (gerado, em .gitignore)
   └─ dist-single/gravidade-zero.html   # saída do build single-file (gerado)
```

### 2.3. Responsabilidades e fronteiras de cada módulo

A regra-mestre de fronteiras é uma **hierarquia de dependência unidirecional**:

```
data  ←  game  ←  ui
   ↖        ↑       ↗
        engine  (não importa game, data nem ui)
```

`engine` é a camada mais baixa e **não conhece o jogo**; `game` orquestra; `data` é folha sem lógica; `ui` é folha de apresentação.

| Módulo | Responsabilidade | PODE importar | NÃO PODE importar | Fronteira chave |
|---|---|---|---|---|
| `src/config.ts` | Constantes de runtime (resolução 960×528, flags de debug, versão semântica). | nada | tudo | Sem lógica; só valores. |
| `engine/` | Motor reutilizável: loop, cenas, câmera, input, render, física AABB, áudio, assets, save, escala de tempo. **Agnóstico ao jogo.** | só `engine/*` e `config` | `game`, `data`, `ui` | Recebe parâmetros de física por injeção; nunca hardcoda `GRAVITY`. |
| `game/` | Regras do Gravidade Zero: entidades, systems, habilidades, cenas concretas, progressão. | `engine`, `data` | `ui` (exceto via `Hud` chamado pela `PlayScene` — ver nota) | Lê números de `game/constants.ts` e dados de `data/`. |
| `data/` | Dados puros: roster, fases, inimigos, itens, tokens, schema. **Sem `import` de engine/game/ui.** | só `data/schema` | `engine`, `game`, `ui` | Tudo tipado por `schema.ts`. Trocar uma fase = trocar dados, sem tocar código. |
| `ui/` | Apresentação: HUD no Canvas + overlays DOM/CSS. | `engine` (Renderer), `data` (tokens) | `game/systems` (recebe estado via props/snapshot, não importa systems) | UI consome um **snapshot imutável** de estado por frame; não muta o jogo. |
| `assets/` | Binários-fonte (PNG/JPG/JSON/áudio/SVG). | n/a | n/a | Importados via Vite (`import url`); inline no single-file. |
| `scripts/` | Tooling de build offline (empacotar atlas, inline base64). | Node APIs | runtime do jogo | Roda só em dev/CI, nunca no bundle. |

**Nota sobre `Hud` e a fronteira game↔ui:** para manter `ui` sem dependência de `game/systems`, a `PlayScene` produz a cada frame um **`HudSnapshot`** (objeto plano: moedas, tempo, vidas, `humanwareFill: 0..1`, `humanwareActive: boolean`, personagem ativo). `Hud.render(ctx, snapshot)` desenha sem nunca importar systems. Isso mantém o acoplamento em uma única estrutura de dados.

**Injeção de física no engine (decisão concreta):** `engine/physics/integrate.ts` expõe `integrate(entity, params: PhysicsParams, grid)`, onde `PhysicsParams` é construído em `game/constants.ts` a partir dos valores da base (`GRAVITY=0.8`, `MAX_FALL=17`, etc.). Assim o engine permanece reutilizável e os números de tuning ficam num único arquivo do jogo. Os valores canônicos vivem em `game/constants.ts`:

```ts
// game/constants.ts (valores travados da base)
export const TILE = 48;
export const PHYSICS = {
  gravity: 0.8, maxFall: 17,
  walkAccel: 0.7, runAccel: 0.95,
  walkMax: 4.6, runMax: 7.3,
  groundDecel: 0.6, airDecel: 0.18,
  jumpVel: -15.4, coyoteFrames: 7, jumpBufferFrames: 8,
  stompBounce: -11.5,
} as const;
export const ENEMY_SPEED = 1.25;
export const SIZES = {
  player: { w: 34, h: 42 }, enemy: { w: 38, h: 34 },
  coin: 26, item: 30,
} as const;
export const STAR_TIME = 480;       // frames de invencibilidade
export const PROJECTILE_SPEED = 8.5;
export const TIME_START = 250;      // segundos do timer
export const GROUND_ROW = 9;
export const LEVEL_DEFAULT = { cols: 168, rows: 11, goalCol: 160 } as const;
```

### 2.4. Diagrama textual de dependências entre módulos

Fluxo de import em tempo de compilação (seta `A → B` = "A importa B"):

```
                          main.ts
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                      ▼
   engine/Game        game/scenes/*            ui/overlay/*
        │                    │                      │
        │            ┌───────┼─────────┐            │
        ▼            ▼       ▼         ▼             ▼
  engine/Loop   game/systems game/entities game/abilities
  engine/SceneManager   │        │            │
  engine/Camera         └────┬───┴─────┬──────┘
  engine/render/*            ▼         ▼
  engine/physics/*       game/constants  data/* (characters,levels,enemies,items)
  engine/input/*                             │
  engine/audio/*                             ▼
  engine/assets/*                       data/schema.ts
  engine/state/*
  engine/time/TimeScale  ◄──── (usado por abilities/emc2 e HumanwareSystem)
        │
        ▼
   config.ts            (folha: ninguém abaixo)

  ui/Hud  ◄──(recebe HudSnapshot de game/scenes/PlayScene; importa só engine/render + data/tokens)
```

Fluxo em **runtime** por frame (loop de tempo fixo, ver seção 4 para detalhe da física):

```
RAF tick
  └─ Game.frame(dt)
       ├─ Loop.accumulate(dt)               // passos fixos de 1/60s
       │    └─ for cada passo fixo:
       │         ├─ InputManager.poll()
       │         ├─ SceneManager.current.update(step)
       │         │     └─ PlayScene.update():
       │         │          ├─ TimeScale.current  (E=mc2 / Humanware)
       │         │          ├─ AbilitySystem.update()  → abilities/*
       │         │          ├─ MovementSystem (integrate + PHYSICS)
       │         │          ├─ CollisionSystem (TileGrid + AABB)
       │         │          ├─ EnemySystem / CoinItemSystem
       │         │          ├─ HumanwareSystem (medidor → modo)
       │         │          └─ EventBus.emit(...)        // coin, stomp, win
       │         └─ Camera.follow(player) + clamp(level)
       └─ Renderer.render(alpha)             // interpolação visual
            ├─ Layer bg   → Atlas/space.jpg + parallax
            ├─ Layer world→ tiles, entities (drawFrame)
            ├─ Layer fx   → partículas, projéteis
            └─ Layer hud  → Hud.render(ctx, HudSnapshot)
```

`SaveStore` (engine/state) é acionado por eventos do `EventBus` (fim de fase, lifecard coletada) — não no caminho quente do frame. `EventBus` é o único canal de comunicação **lateral** entre systems, evitando que `EnemySystem` importe `HumanwareSystem` diretamente.

### 2.5. Aliases de import e configuração de TypeScript

Para evitar `../../../` e reforçar fronteiras, `tsconfig.json` define paths e o Vite os espelha:

```jsonc
// tsconfig.json (trecho)
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true, "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": {
      "@engine/*": ["src/engine/*"],
      "@game/*":   ["src/game/*"],
      "@data/*":   ["src/data/*"],
      "@ui/*":     ["src/ui/*"],
      "@assets/*": ["src/assets/*"],
      "@config":   ["src/config.ts"]
    }
  },
  "include": ["src", "tests", "scripts"]
}
```

Uma regra de ESLint (`no-restricted-imports`) bloqueia importações que violem a hierarquia da seção 2.3 (ex.: qualquer import de `@game/*` ou `@ui/*` dentro de `src/engine/**`, e qualquer import de `@engine/*`/`@game/*`/`@ui/*` dentro de `src/data/**`). A fronteira deixa de ser convenção e passa a ser verificável no CI.

### 2.6. Schema de dados (fonte da verdade)

`data/schema.ts` centraliza as interfaces que tornam o jogo data-driven. Estas tipagens são consumidas por `data/levels/*`, `data/characters.ts` e validadas em `tests/unit/schema.test.ts`. Conteúdo completo de cada campo é detalhado nas seções 4 (física/inimigos) e 5 (fases/roster); aqui fica a forma:

```ts
// data/schema.ts
export type TileKind = "ground" | "brick" | "platform" | "block";
export type AbilityId =
  | "salto-visionario" | "dash-criativo" | "escudo-governanca"
  | "builder" | "emc2";

export interface AtlasFrame { x: number; y: number; w: number; h: number; }
export type FrameMap = Record<string, AtlasFrame>;

export interface CharacterDef {
  id: "renan" | "dante" | "julio" | "artur" | "einstein";
  name: string;
  ability: AbilityId;
  abilityLabel: string;        // "SALTO VISIONÁRIO" (mono UPPERCASE no HUD)
  portrait: string;            // caminho do retrato key-art (Higgsfield)
  bodyFrames: string[];        // nomes de frames no atlas (corpo pixel)
  palette: string;             // token de cor de destaque (ex.: tokens.magentaClassic)
  unlockedByDefault: boolean;  // Renan true; demais via lifecard
}

export interface EnemyPlacement { col: number; row: number; type: string; }
export interface CoinPlacement   { col: number; row: number; }
export interface ItemPlacement   { col: number; row: number; item: string; }
export interface TilePlacement   { col: number; row: number; kind: TileKind; }
export interface PortalPlacement { col: number; row: number; targetLevelId?: string; }

export interface LevelData {
  id: string;                  // "01-zona-existencial"
  title: string;               // exibido na intro
  zone: "existencial" | "cultural" | "digital" | "desafio" | "boss";
  cols: number; rows: number;  // default 168 x 11
  groundRow: number;           // default 9
  goalCol: number;             // default 160
  timeStart: number;           // default 250
  bgAsset: string;             // "@assets/bg/space.jpg"
  tiles: TilePlacement[];
  enemies: EnemyPlacement[];
  coins: CoinPlacement[];
  items: ItemPlacement[];
  portals: PortalPlacement[];
  client?: "vivo" | "kion" | "ecorodovias" | "mubadala" | "jpmorgan"; // fases-desafio
}
```

Exemplo mínimo de dado de fase (forma, não conteúdo final — ver seção 5):

```ts
// data/levels/01-zona-existencial.ts
import type { LevelData } from "@data/schema";
export const zonaExistencial: LevelData = {
  id: "01-zona-existencial", title: "Zona Existencial",
  zone: "existencial", cols: 168, rows: 11, groundRow: 9,
  goalCol: 160, timeStart: 250, bgAsset: "@assets/bg/space.jpg",
  tiles: [{ col: 12, row: 9, kind: "brick" } /* ... */],
  enemies: [{ col: 20, row: 8, type: "tolo" }],
  coins: [{ col: 14, row: 7 }], items: [{ col: 30, row: 7, item: "lifecard-dante" }],
  portals: [{ col: 100, row: 8, targetLevelId: "02-zona-cultural" }],
};
```

### 2.7. Comandos de desenvolvimento e build

`package.json` `scripts`:

```jsonc
{
  "scripts": {
    "dev":            "vite",
    "build":          "tsc --noEmit && vite build",
    "build:single":   "tsc --noEmit && vite build --config vite.config.singlefile.ts",
    "preview":        "vite preview",
    "typecheck":      "tsc --noEmit",
    "lint":           "eslint .",
    "format":         "prettier --write .",
    "test":           "vitest run",
    "test:watch":     "vitest",
    "test:e2e":       "playwright test",
    "validate:data":  "vitest run tests/unit/schema.test.ts",
    "ci":             "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

| Comando | O que faz | Quando usar |
|---|---|---|
| `npm run dev` | Sobe Vite dev server em `http://localhost:5173` com HMR. | Desenvolvimento diário. |
| `npm run build` | Typecheck + bundle estático em `dist/` (chunks, hashing, minify). | Build de produção p/ Vercel. |
| `npm run build:single` | Gera **um** `dist-single/gravidade-zero.html` autossuficiente. | Compartilhar no grupo (ver 2.9). |
| `npm run preview` | Serve `dist/` localmente para conferir o build. | Validar antes do deploy. |
| `npm run typecheck` | `tsc --noEmit` (modo strict). | Pré-commit / CI. |
| `npm run test` | Vitest (unit + validação de schema das fases). | Pré-commit / CI. |
| `npm run test:e2e` | Playwright: boot do canvas sem erro de console. | CI / smoke pós-build. |
| `npm run validate:data` | Valida todas as fases contra `schema.ts`. | Após editar `data/levels/*`. |
| `npm run ci` | Pipeline completo (typecheck+lint+test+build). | Gate de merge. |

### 2.8. Deploy na Vercel (build estático)

O jogo é 100% estático (sem backend). Configuração em `vercel.json`:

```jsonc
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

Processo:
1. Repositório conectado ao projeto Vercel da Gzero (Git integration).
2. **Production:** push na branch `main` → deploy em produção (domínio do projeto na Vercel).
3. **Preview:** toda branch/PR gera um *preview deploy* com URL única — ideal para mandar links de teste no grupo antes de promover.
4. `installCommand: npm ci` garante build reprodutível pelo `package-lock.json`.
5. Assets com hash recebem `Cache-Control` imutável de 1 ano; `index.html` fica sem cache longo (revalidação), garantindo que novas versões apareçam imediatamente.
6. Variáveis de ambiente: nenhuma obrigatória (jogo offline-first). Caso futuras (ex.: telemetria interna), entram via Vercel Project Settings, lidas com prefixo `VITE_` no build.

### 2.9. Build single-file opcional (compartilhamento no grupo)

Objetivo: **um único `.html`** que roda com duplo-clique, sem servidor, sem CDN — para mandar no WhatsApp/Drive da Gzero. Tudo (JS, CSS, atlas PNG, bg JPEG, áudio, SVGs, fontes) embutido inline (base64/`data:` URIs), na mesma filosofia do jogo-base original.

`vite.config.singlefile.ts`:

```ts
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100_000_000,   // inlinar TODOS os assets como data:
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true }, // 1 bundle, sem chunks
    },
  },
});
```

Regras e fronteiras do modo single-file:
- **Sem `public/`**: arquivos em `public/` não são inlinados pelo Vite. Por isso assets que precisam viajar no single-file vivem em `src/assets/` e são **importados** (`import atlasUrl from "@assets/atlas/atlas.png"`), nunca referenciados por caminho absoluto `/`. `favicon.svg` (em `public/`) é dispensável no single-file.
- `AssetLoader` (engine/assets) já trabalha com URLs vindas de `import` — funciona idêntico nos dois builds; nenhum branch de código por modo de build.
- `scripts/inline-assets.ts` existe como rede de segurança para casos em que um asset muito grande precise ser convertido manualmente; em regra não é necessário com `assetsInlineLimit` alto.
- Resultado típico: `dist-single/gravidade-zero.html` (peso dominado pelo atlas PNG + bg JPEG + áudio). Aceitável para distribuição interna; não otimizado para web pública (sem cache de CDN).
- Limitação consciente: o `localStorage` do `SaveStore` é por-origem; rodando via `file://` o save funciona localmente na máquina de quem abriu, mas não sincroniza — comportamento esperado e adequado ao uso "diversão do grupo".

### 2.10. `index.html` (entrypoint) — forma

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gravidade Zero — O Jogo</title>
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <div id="app">
      <canvas id="game" width="960" height="528"></canvas>
      <div id="ui-root"></div>           <!-- overlays DOM (menu, pausa, diálogos) -->
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`main.ts` resolve o `<canvas>`, instancia `engine/Game` com `config.ts`, registra as cenas de `game/scenes/*`, faz `SceneManager.replace(LoadingScene)` e inicia o loop. O Canvas tem resolução interna fixa 960×528; o CSS escala mantendo proporção e `image-rendering: pixelated` para preservar o pixel art quadrado (radius 0). Detalhes de escala responsiva e barras letterbox em fundo `#050505` ficam na seção 7 (UI/HUD).

---

**Resumo da seção:** stack Vite+TS+Canvas2D sem framework no gameplay; quatro camadas com dependência unidirecional `data ← game ← ui` e `engine` na base, reforçadas por aliases e regra de lint; dados de fases/roster totalmente tipados por `schema.ts`; deploy estático na Vercel com previews por branch; e um build single-file de um `.html` para o grupo. As próximas seções detalham o conteúdo que esta estrutura sustenta (física — seção 4; roster e habilidades — seção 3; fases e dados — seção 5; arte — seção 6; UI/HUD — seção 7).

---

## 3. Modelo de Dados & Formatos

Esta seção define o **contrato de dados** do "Gravidade Zero — O Jogo": as interfaces TypeScript, os formatos de arquivo (tilemap em texto + metadados JSON), o manifesto de assets, o estado de save em `localStorage` e o objeto de configuração/constantes. Tudo é **data-driven**: personagens, fases e assets são dados externos carregados em runtime, nunca hard-coded no motor (ver seção 2 para a arquitetura de módulos e seção 4 para o pipeline de carga). Os valores numéricos partem das CONSTANTES DE FÍSICA DA BASE e foram fixados aqui — não há TBD.

### 3.1. Convenções gerais

- **Unidades:** tudo em pixels do mundo (não da tela). `TILE = 48`. Uma coordenada de grid `(col, row)` mapeia para mundo via `x = col * TILE`, `y = row * TILE`. A origem `(0,0)` é o canto superior-esquerdo; `y` cresce para baixo.
- **Identificadores:** todos os `id` são `kebab-case` ASCII, estáveis e usados como chave em saves e manifests (ex.: `"renan"`, `"vivo-zone-1"`, `"player-walk-0"`).
- **Cores:** sempre string hex `#rrggbb` minúscula, vinda dos tokens Gzero (ver seção 1). Nenhuma cor mágica fora do `Config.palette`.
- **Versionamento:** todo arquivo de dados serializável (`Level`, `SaveState`, `AssetManifest`) carrega um campo `schemaVersion: number` para permitir migração. Versão inicial = `1`.
- **Imutabilidade:** dados carregados de `/data` são tratados como `readonly` em runtime; o estado mutável vive em entidades do ECS-leve (seção 2), nunca nos blobs de dados.
- **Validação:** na carga, cada blob passa por um validador (`validateLevel`, `validateCharacter`, etc., seção 4) que rejeita campos desconhecidos em modo dev e aplica defaults em produção.

### 3.2. Tipos primitivos compartilhados

```ts
// src/data/types/common.ts

/** Versão de schema para migração de dados serializados. */
export type SchemaVersion = number;

/** Coordenada em pixels do mundo. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Coordenada em células do grid de tiles (col = coluna, row = linha). */
export interface GridPos {
  col: number;
  row: number;
}

/** Retângulo AABB em pixels do mundo, usado em colisão e hitboxes. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cor hex no formato #rrggbb (tokens Gzero). */
export type HexColor = `#${string}`;

/** Direção de facing/patrulha. */
export type Facing = "left" | "right";

/** Identificador estável kebab-case. */
export type Id = string;
```

### 3.3. Atlas, frames e animações

A arte (placeholders desenhados em código primeiro, depois trocados pelo Higgsfield — ver seção 1, PIPELINE DE ARTE) é endereçada por um **atlas de frames**: cada frame é um recorte retangular de um PNG. Animações são sequências de nomes de frame com timing.

```ts
// src/data/types/atlas.ts
import type { HexColor, Id } from "./common";

/** Um recorte retangular dentro de uma textura de atlas. */
export interface Frame {
  /** Chave única do frame, ex.: "player-renan-walk-0". */
  name: Id;
  /** Arquivo de atlas que contém este frame (chave em AssetManifest.atlases). */
  atlas: Id;
  /** Origem X do recorte na textura (px). */
  x: number;
  /** Origem Y do recorte na textura (px). */
  y: number;
  /** Largura do recorte (px). */
  w: number;
  /** Altura do recorte (px). */
  h: number;
  /** Pivô de desenho em fração do frame (0..1). Default {x:0.5,y:1} (pés no chão). */
  pivot?: Vec2;
  /** Offset extra de desenho em px (para alinhar arte ao hitbox). Default {x:0,y:0}. */
  offset?: Vec2;
}

/** Modo de repetição de uma animação. */
export type AnimLoop = "loop" | "once" | "pingpong";

/** Uma animação = sequência de frames + timing. */
export interface Anim {
  /** Chave única da animação, ex.: "renan.walk". */
  name: Id;
  /** Lista ordenada de nomes de Frame. */
  frames: Id[];
  /** Frames por segundo da reprodução (independe do framerate do jogo). */
  fps: number;
  /** Repetição. Default "loop". */
  loop?: AnimLoop;
}

import type { Vec2 } from "./common";
```

**Padrão de nomenclatura de frames** (obrigatório, para o pipeline de troca placeholder→Higgsfield funcionar sem reescrever dados):

| Categoria | Padrão | Exemplo |
|---|---|---|
| Personagem (corpo pixel) | `player-<charId>-<state>-<n>` | `player-renan-walk-0` |
| Retrato key-art | `portrait-<charId>` | `portrait-einstein` |
| Lifecard | `lifecard-<charId>` | `lifecard-julio` |
| Tile | `tile-<type>-<variant>` | `tile-ground-0`, `tile-brick-0` |
| Inimigo | `enemy-<enemyId>-<state>-<n>` | `enemy-tolo-walk-1` |
| Item/moeda | `item-<itemId>` / `coin-<n>` | `item-star`, `coin-2` |
| Projétil | `projectile-<id>-<n>` | `projectile-bug-0` |
| Efeito/partícula | `fx-<id>-<n>` | `fx-spark-0` |
| HUD/UI | `ui-<id>` | `ui-heart-full` |

**Estados de animação canônicos por personagem** (todos os 5 jogáveis usam o mesmo conjunto — "mesma base, paleta + traço marcante", ver seção 1): `idle`, `walk`, `run`, `jump`, `fall`, `skid`, `hurt`, `ability` (frame da habilidade ativa), `humanware` (pose do MODO HUMANWARE). Inimigo "Tolo": `walk`, `frozen` (congelado no Humanware), `squash` (stomp). Quantidades mínimas de frame por estado para os placeholders: `idle=2`, `walk=4`, `run=4`, `jump=1`, `fall=1`, `skid=1`, `hurt=1`, `ability=2`, `humanware=2`.

### 3.4. Character (personagem jogável e companheiro)

Define os 5 jogáveis + o companheiro Renante (ver ROSTER na seção 1). A física parte das CONSTANTES DA BASE e cada personagem aplica **multiplicadores** sobre elas — assim o tuning global vive no `Config` e o sabor individual vive aqui.

```ts
// src/data/types/character.ts
import type { Id, HexColor } from "./common";
import type { Anim } from "./atlas";

/** Tipo de habilidade especial (ver ROSTER, seção 1). */
export type AbilityKind =
  | "double-jump"     // Renan — Salto Visionário (pulo alto/duplo, revela portais)
  | "dash"            // Dante — Dash Criativo (investida que quebra obstáculos)
  | "shield"          // Julio — Escudo de Governança (bloqueia 1 dano)
  | "build"           // Artur — Builder (cria plataforma/ferramenta temporária)
  | "time-slow";      // Einstein — E=mc2 (desacelera o tempo)

/** Papel do personagem no jogo. */
export type CharacterRole = "playable" | "companion";

/** Multiplicadores de física aplicados sobre Config.physics. 1.0 = igual à base. */
export interface PhysicsModifiers {
  walkMax: number;      // mult. de WALK_MAX (4.6)
  runMax: number;       // mult. de RUN_MAX (7.3)
  jumpVel: number;      // mult. de JUMP_VEL (-15.4); >1 = pula mais alto
  accel: number;        // mult. de WALK_ACCEL/RUN_ACCEL
  weight: number;       // mult. de GRAVITY (0.8); <1 = mais "flutuante"
}

/** Parâmetros da habilidade especial. */
export interface AbilityConfig {
  kind: AbilityKind;
  /** Nome de exibição em pt-BR, ex.: "Salto Visionário". */
  label: string;
  /** Cooldown em frames a 60fps. */
  cooldownFrames: number;
  /** Duração do efeito em frames (0 = instantâneo). */
  durationFrames: number;
  /** Custo no medidor Humanware (0..100); 0 = uso livre. */
  meterCost: number;
  /**
   * Parâmetros específicos da habilidade (union discriminada por kind).
   * Mantidos como bag tipada para evitar branches mágicos no motor.
   */
  params: AbilityParams;
}

export type AbilityParams =
  | { kind: "double-jump"; extraJumps: number; revealRadiusTiles: number }
  | { kind: "dash"; speed: number; breaksTiles: boolean }
  | { kind: "shield"; hitsBlocked: number }
  | { kind: "build"; platformWidthTiles: number; lifetimeFrames: number }
  | { kind: "time-slow"; timeScale: number };

/** Paleta marcante do personagem (override dos tokens globais). */
export interface CharacterPalette {
  primary: HexColor;     // cor de traço marcante
  secondary: HexColor;
  accent: HexColor;      // normalmente um neon Gzero
}

/** Hitbox e métricas físicas do corpo. */
export interface CharacterBody {
  /** Largura do hitbox em px (base = 34). */
  width: number;
  /** Altura do hitbox em px (base = 42). */
  height: number;
}

export interface Character {
  schemaVersion: SchemaVersion;
  id: Id;                       // "renan", "dante", "julio", "artur", "einstein", "renante"
  name: string;                 // exibição: "Renan"
  role: CharacterRole;
  /** Subtítulo de lore (ver seção 1), ex.: "Co-fundador • Imersões no Vale do Silício". */
  tagline: string;
  body: CharacterBody;
  palette: CharacterPalette;
  physics: PhysicsModifiers;
  ability: AbilityConfig;
  /** Animações por estado canônico (ver 3.3). */
  anims: Record<string, Anim>;
  /** Frame do retrato key-art (3.3). */
  portraitFrame: Id;
  /** Frame da Lifecard de desbloqueio. */
  lifecardFrame: Id;
  /** Desbloqueio: id da Lifecard que precisa ser coletada (null = inicial). */
  unlockLifecard: Id | null;
  /**
   * Se for companion: ids de habilidade que o companheiro AMPLIFICA.
   * "*" = amplifica a habilidade atual de qualquer herói (caso do Renante).
   */
  amplifies?: (AbilityKind | "*")[];
}

import type { SchemaVersion } from "./common";
```

**Tabela de balanceamento do roster** (valores fixados, derivados das CONSTANTES DA BASE):

| Personagem | role | habilidade (kind) | jumpVel× | walkMax× | runMax× | weight× | cooldown (f) | meterCost | desbloqueio |
|---|---|---|---|---|---|---|---|---|---|
| Renan | playable | double-jump | 1.10 | 1.00 | 1.00 | 0.95 | 30 | 0 | inicial |
| Dante | playable | dash | 1.00 | 1.05 | 1.10 | 1.00 | 45 | 0 | `lifecard-dante` |
| Julio | playable | shield | 1.00 | 0.95 | 1.00 | 1.05 | 90 | 20 | `lifecard-julio` |
| Artur | playable | build | 1.00 | 1.00 | 1.00 | 1.00 | 120 | 25 | `lifecard-artur` |
| Einstein | playable | time-slow | 0.95 | 0.90 | 0.95 | 1.00 | 180 | 40 | `lifecard-einstein` |
| Renante | companion | — (amplifica `*`) | — | — | — | — | — | — | `lifecard-renante` |

> Nota: Renan é o personagem inicial (`unlockLifecard: null`). O **Superpoder Humanware** (seção 1) é igual para todos e vive no `Config.humanware` (ver 3.8), não em `Character` — o personagem só contribui com `meterCost` por habilidade.

### 3.5. Level e o formato de tilemap

Uma fase é um par **(tilemap em texto, metadados JSON)**. O tilemap é uma **grade ASCII** legível por humanos (fácil de editar à mão e versionar em git), e o JSON guarda spawns, inimigos, itens, goal e parâmetros. As dimensões da fase-base são `168 × 11` tiles (`GROUND_ROW = 9`, `goal = coluna 160`).

#### 3.5.1. Tipos de tile e legenda ASCII

Mapeamento exato `char → tipo` (consistente com o Map `"c,r"->ground/brick/platform/block` da base):

| Char | Tipo lógico | Sólido? | Comportamento |
|---|---|---|---|
| `.` | vazio | não | ar (não emite frame) |
| `#` | `ground` | sim | chão maciço (colisão nos 4 lados) |
| `B` | `brick` | sim | quebrável por dash/Humanware; bump por baixo |
| `=` | `platform` | semi | plataforma de uma via (colisão só por cima) |
| `?` | `block` | sim | bloco-surpresa: bump por baixo solta conteúdo |
| `o` | (spawn) `coin` | não | moeda solta no ar |
| `^` | hazard `spike` | não (dano) | espinho: causa dano por contato |
| `S` | spawn do jogador | não | ponto de início (1 por fase) |
| `G` | `goal` | não | portal/bandeira de fim de fase |

> Tiles `=` (platform) e `?` (block) podem reaparecer; espinhos `^` e moedas `o` são marcadores que o parser converte em entidades/hazards e **não** geram tile sólido. Inimigos e itens em blocos NÃO vão no ASCII — vão no JSON (3.5.3), porque carregam parâmetros.

#### 3.5.2. Formato do arquivo `.lvl` (tilemap em texto)

- Arquivo de texto puro UTF-8, extensão `.txt` (referenciado pelo JSON via `gridFile`).
- Cada linha = uma `row`; o número de linhas deve ser igual a `Level.rows`.
- Cada coluna = um char; todas as linhas devem ter exatamente `Level.cols` chars.
- Linhas começando com `;` são comentário e ignoradas pelo parser.
- Espaços à direita são permitidos (tratados como `.`).

Exemplo (recorte de `vivo-zone-1`, colunas 0–31 de 168, com o início da fase):

```text
; vivo-zone-1 — recorte colunas 0..31 (de 168), rows 0..10
................................
................................
................................
................................
......=====.....................
................?...............
............?...........====....
....S...........o.o.o...........
..........BBB...........^^......
################.....###########
################.....###########
```

Leitura: `row 9` e `row 10` são o chão (`GROUND_ROW = 9` é a primeira linha de chão; abaixo dela é maciço). O `S` na `row 7, col 4` é o spawn. Há um vão de 5 colunas (cols 16–20) no chão como abismo. `?` em `(5,15)` e `(6,12)` são blocos-surpresa. `====` são plataformas semi. `^^` em `(8, 24-25)` são espinhos sobre o chão. `o o o` em `(7, 16-20)` são moedas sobre o abismo.

#### 3.5.3. Interface `Level` (metadados JSON)

```ts
// src/data/types/level.ts
import type { Id, HexColor, GridPos, Facing } from "./common";
import type { SchemaVersion } from "./common";

/** Tipos de tile que aparecem como caracteres no grid. */
export type TileType = "empty" | "ground" | "brick" | "platform" | "block";

/** O que um bloco "?" libera ao receber bump por baixo. */
export type BlockContent =
  | { kind: "coin"; amount: number }
  | { kind: "item"; itemId: Id }              // ex.: "star", "lifecard-dante"
  | { kind: "coins-multi"; total: number };   // bloco de múltiplas moedas (tempo limitado)

/** Bloco-surpresa "?" enriquecido com conteúdo (posição casa com '?' do grid). */
export interface BlockSpawn {
  at: GridPos;
  content: BlockContent;
}

/** Tipos de inimigo. */
export type EnemyType =
  | "tolo"        // "O Tolo com a Ferramenta" — patrulha + stomp (base)
  | "tolo-shooter"// patrulha e dispara projétil "bug"
  | "esfinge";    // chefe-enigma (apenas em fases de chefe)

export interface EnemySpawn {
  type: EnemyType;
  at: GridPos;
  facing: Facing;            // direção inicial de patrulha
  /** mult. de ENEMY_SPEED (1.25); default 1.0. */
  speedMul?: number;
  /** limites de patrulha em colunas [min,max]; default = até parede/borda. */
  patrol?: { minCol: number; maxCol: number };
  /** só p/ tolo-shooter: frames entre disparos; default 120. */
  fireIntervalFrames?: number;
}

export interface CoinSpawn {
  at: GridPos;             // casa com 'o' do grid OU adicional via JSON
}

export interface ItemSpawn {
  itemId: Id;              // "star", "lifecard-<char>", "heart"
  at: GridPos;
}

/** Marcadores de portais (revelados pelo Salto Visionário do Renan). */
export interface PortalSpawn {
  id: Id;
  at: GridPos;
  /** destino: id de outra fase ou coluna dentro da mesma fase. */
  target: { levelId: Id } | { col: number };
  /** se true, só fica visível com habilidade double-jump ativa. */
  hidden: boolean;
}

/** Tema visual da fase (cliente-desafio, ver LORE seção 1). */
export type LevelTheme =
  | "gravity-zero"  // hub neutro
  | "vivo" | "kion" | "ecorodovias" | "mubadala" | "jpmorgan";

export interface Level {
  schemaVersion: SchemaVersion;
  id: Id;                    // "vivo-zone-1"
  name: string;              // "Vivo — Zona da Conexão"
  theme: LevelTheme;
  /** Dimensões em tiles. Base: cols=168, rows=11. */
  cols: number;
  rows: number;
  /** Primeira linha de chão maciço (base GROUND_ROW=9). */
  groundRow: number;
  /** Arquivo .txt com a grade ASCII (relativo a /data/levels/). */
  gridFile: string;
  /** Coluna do goal/portal de fim (base = 160). */
  goalCol: number;
  /** Tempo inicial em segundos (base TIME_START=250). */
  timeStart: number;
  /** Cor de fundo de espaço (token Gzero). Default "#09090b". */
  bgColor: HexColor;
  /** Música/ambiente (id em AssetManifest.audio); opcional. */
  musicId?: Id;
  /** Spawn do jogador. Se omitido, usa a posição do 'S' no grid. */
  playerSpawn?: GridPos;
  blocks: BlockSpawn[];
  enemies: EnemySpawn[];
  coins: CoinSpawn[];      // moedas extras além das marcadas com 'o'
  items: ItemSpawn[];
  portals: PortalSpawn[];
  /** Personagem cuja Lifecard está escondida nesta fase (gameplay de desbloqueio). */
  hiddenLifecard?: Id;     // ex.: "dante"
}
```

#### 3.5.4. Exemplo real de `Level` (JSON)

```json
{
  "schemaVersion": 1,
  "id": "vivo-zone-1",
  "name": "Vivo — Zona da Conexão",
  "theme": "vivo",
  "cols": 168,
  "rows": 11,
  "groundRow": 9,
  "gridFile": "vivo-zone-1.txt",
  "goalCol": 160,
  "timeStart": 250,
  "bgColor": "#09090b",
  "musicId": "track-vivo",
  "playerSpawn": { "col": 4, "row": 7 },
  "blocks": [
    { "at": { "col": 15, "row": 5 }, "content": { "kind": "coin", "amount": 1 } },
    { "at": { "col": 12, "row": 6 }, "content": { "kind": "item", "itemId": "star" } }
  ],
  "enemies": [
    {
      "type": "tolo",
      "at": { "col": 22, "row": 8 },
      "facing": "left",
      "speedMul": 1.0,
      "patrol": { "minCol": 21, "maxCol": 30 }
    },
    {
      "type": "tolo-shooter",
      "at": { "col": 40, "row": 8 },
      "facing": "left",
      "fireIntervalFrames": 120
    }
  ],
  "coins": [
    { "at": { "col": 16, "row": 7 } },
    { "at": { "col": 18, "row": 7 } },
    { "at": { "col": 20, "row": 7 } }
  ],
  "items": [
    { "itemId": "heart", "at": { "col": 70, "row": 5 } }
  ],
  "portals": [
    {
      "id": "vivo-secret-1",
      "at": { "col": 88, "row": 4 },
      "target": { "col": 150 },
      "hidden": true
    }
  ],
  "hiddenLifecard": "dante"
}
```

### 3.6. Items, moedas e projéteis

```ts
// src/data/types/item.ts
import type { Id, HexColor } from "./common";

export type ItemKind =
  | "coin"        // +1 ao contador (valor 26px na base)
  | "star"        // power-up estrela: invencibilidade (STAR_TIME=480 frames)
  | "heart"       // +1 vida
  | "lifecard"    // desbloqueia personagem
  | "heart-orb";  // enche o medidor Humanware

export interface ItemDef {
  id: Id;             // "star", "lifecard-dante", "heart"
  kind: ItemKind;
  label: string;      // "Estrela da Consciência"
  frame: Id;          // frame no atlas (3.3)
  /** px do hitbox (coin=26, item=30 na base). */
  size: number;
  color: HexColor;
  /** só p/ kind "star": duração em frames. Default 480. */
  durationFrames?: number;
  /** só p/ kind "lifecard": personagem desbloqueado. */
  unlocksCharacter?: Id;
  /** só p/ kind "heart-orb": pontos de medidor (0..100). Default 25. */
  meterGain?: number;
}

/** Definição de projétil (base: speed 8.5). */
export interface ProjectileDef {
  id: Id;             // "bug"
  frame: Id;
  speed: number;      // px/frame; base 8.5
  size: number;       // px hitbox
  damage: number;     // dano ao jogador
}
```

### 3.7. AssetManifest

Catálogo único, carregado primeiro, que indexa atlases (PNG), retratos, animações, áudio e fontes. Permite o swap placeholder→Higgsfield trocando apenas URLs e mantendo as chaves de frame.

```ts
// src/data/types/manifest.ts
import type { Id } from "./common";
import type { Frame, Anim } from "./atlas";
import type { SchemaVersion } from "./common";

export interface AtlasEntry {
  id: Id;             // "main", "characters", "ui"
  /** URL/caminho da textura (relativo a /assets/). */
  src: string;
  width: number;
  height: number;
}

export interface AudioEntry {
  id: Id;             // "track-vivo", "sfx-jump", "sfx-coin"
  src: string;
  /** "music" toca em loop; "sfx" one-shot. */
  kind: "music" | "sfx";
  volume: number;     // 0..1
}

export interface FontEntry {
  family: string;     // "Outfit", "Inter"
  src: string;
  weight: number;     // 400, 700, 800
}

export interface AssetManifest {
  schemaVersion: SchemaVersion;
  atlases: AtlasEntry[];
  /** Todos os frames de todos os atlases, indexados por name. */
  frames: Record<Id, Frame>;
  /** Animações compartilhadas (as de personagem ficam em Character.anims). */
  anims: Record<Id, Anim>;
  audio: AudioEntry[];
  fonts: FontEntry[];
  /** Retratos key-art: charId -> frame name. */
  portraits: Record<Id, Id>;
  /** Lifecards: charId -> frame name. */
  lifecards: Record<Id, Id>;
}
```

Exemplo (recorte de `manifest.json`):

```json
{
  "schemaVersion": 1,
  "atlases": [
    { "id": "main", "src": "atlas/main.png", "width": 1024, "height": 1024 },
    { "id": "characters", "src": "atlas/characters.png", "width": 1024, "height": 1024 }
  ],
  "frames": {
    "tile-ground-0": { "name": "tile-ground-0", "atlas": "main", "x": 0, "y": 0, "w": 48, "h": 48 },
    "player-renan-walk-0": {
      "name": "player-renan-walk-0", "atlas": "characters",
      "x": 0, "y": 0, "w": 48, "h": 48,
      "pivot": { "x": 0.5, "y": 1 }, "offset": { "x": 0, "y": -3 }
    },
    "coin-0": { "name": "coin-0", "atlas": "main", "x": 480, "y": 0, "w": 26, "h": 26 }
  },
  "anims": {
    "coin.spin": { "name": "coin.spin", "frames": ["coin-0", "coin-1", "coin-2", "coin-3"], "fps": 12, "loop": "loop" }
  },
  "audio": [
    { "id": "track-vivo", "src": "audio/track-vivo.mp3", "kind": "music", "volume": 0.6 },
    { "id": "sfx-jump", "src": "audio/jump.wav", "kind": "sfx", "volume": 0.8 }
  ],
  "fonts": [
    { "family": "Outfit", "src": "fonts/Outfit.woff2", "weight": 800 },
    { "family": "Inter", "src": "fonts/Inter.woff2", "weight": 400 }
  ],
  "portraits": { "renan": "portrait-renan", "dante": "portrait-dante" },
  "lifecards": { "dante": "lifecard-dante" }
}
```

> **Build single-file (seção 1):** no bundle single-file, `AtlasEntry.src`/`AudioEntry.src`/`FontEntry.src` aceitam **data-URI base64** (`data:image/png;base64,...`) em vez de caminho — exatamente como o jogo-base embute atlas/bg. O motor não distingue: passa a string para `Image.src`/`Audio.src`. Um passo de build (seção 4) inlina os assets e reescreve o manifest.

### 3.8. Config e constantes

Objeto único, tipado e congelado (`as const` + `Object.freeze`), centralizando todo o tuning global. Os personagens (3.4) aplicam multiplicadores sobre `physics`.

```ts
// src/data/types/config.ts
import type { HexColor } from "./common";

export interface PhysicsConfig {
  tile: number;          // 48
  gravity: number;       // 0.8
  maxFall: number;       // 17
  walkAccel: number;     // 0.7
  runAccel: number;      // 0.95
  walkMax: number;       // 4.6
  runMax: number;        // 7.3
  groundDecel: number;   // 0.6
  airDecel: number;      // 0.18
  jumpVel: number;       // -15.4
  coyoteFrames: number;  // 7
  jumpBufferFrames: number; // 8
  stompBounce: number;   // -11.5
  enemySpeed: number;    // 1.25
  projectileSpeed: number; // 8.5
}

export interface SizesConfig {
  player: { w: number; h: number };  // 34 x 42
  enemy: { w: number; h: number };   // 38 x 34
  coin: number;                      // 26
  item: number;                      // 30
}

export interface HumanwareConfig {
  /** Capacidade do medidor (0..meterMax). */
  meterMax: number;            // 100
  /** Ganho por moeda. */
  gainPerCoin: number;         // 4
  /** Ganho por stomp em inimigo. */
  gainPerStomp: number;        // 8
  /** Ganho por orbe heart-orb. */
  gainPerOrb: number;          // 25
  /** Duração do MODO HUMANWARE em frames quando ativado cheio. */
  durationFrames: number;      // 360 (6s a 60fps)
  /** Escala de tempo do mundo no modo (inimigos lentos). */
  worldTimeScale: number;      // 0.35
  /** true = inimigos "Tolo" congelam totalmente. */
  freezeTolos: boolean;        // true
  /** mult. de ataque/pulo no modo. */
  powerMul: number;            // 1.5
}

export interface RenderConfig {
  canvasWidth: number;   // 960
  canvasHeight: number;  // 528
  pixelRadius: number;   // 0 (pixel art quadrado, ver seção 1)
  hardShadowOffset: { x: number; y: number }; // sombra dura com offset
}

export interface RulesConfig {
  startLives: number;        // 3
  /** ordem dos estados (ver loop da base): loading→title→playing→win/over. */
  goalReachedScore: number;  // 1000 ao tocar o goal
  coinScore: number;         // 100 por moeda
  stompScore: number;        // 200 por inimigo
}

export interface Config {
  schemaVersion: number;
  physics: PhysicsConfig;
  sizes: SizesConfig;
  humanware: HumanwareConfig;
  render: RenderConfig;
  rules: RulesConfig;
  /** Paleta Gzero (tokens, seção 1). */
  palette: Record<string, HexColor>;
  /** Mapeamento char→TileType para o parser de tilemap (3.5.1). */
  tileLegend: Record<string, string>;
}
```

Valores fixados (`src/data/config.ts`):

```ts
export const CONFIG: Config = Object.freeze({
  schemaVersion: 1,
  physics: {
    tile: 48, gravity: 0.8, maxFall: 17,
    walkAccel: 0.7, runAccel: 0.95, walkMax: 4.6, runMax: 7.3,
    groundDecel: 0.6, airDecel: 0.18, jumpVel: -15.4,
    coyoteFrames: 7, jumpBufferFrames: 8, stompBounce: -11.5,
    enemySpeed: 1.25, projectileSpeed: 8.5,
  },
  sizes: {
    player: { w: 34, h: 42 }, enemy: { w: 38, h: 34 }, coin: 26, item: 30,
  },
  humanware: {
    meterMax: 100, gainPerCoin: 4, gainPerStomp: 8, gainPerOrb: 25,
    durationFrames: 360, worldTimeScale: 0.35, freezeTolos: true, powerMul: 1.5,
  },
  render: {
    canvasWidth: 960, canvasHeight: 528, pixelRadius: 0,
    hardShadowOffset: { x: 4, y: 4 },
  },
  rules: {
    startLives: 3, goalReachedScore: 1000, coinScore: 100, stompScore: 200,
  },
  palette: {
    bg0: "#09090b", bg1: "#121216", bg2: "#050505",
    pink: "#ff0055", magentaClassic: "#f43db3", magentaSite: "#e802cf",
    blue: "#0099ff", lime: "#cdf140", violet: "#7112ff", violet2: "#612af1",
    burgundy: "#990033", textLight: "#f7f3f6",
  },
  tileLegend: {
    ".": "empty", "#": "ground", "B": "brick", "=": "platform", "?": "block",
  },
} as const);
```

### 3.9. SaveState (localStorage)

Persistência local de progresso, personagens desbloqueados e preferências. Chave única `gzero.save.v1`. Serializado como JSON. Em mudança de `schemaVersion`, roda um migrador (seção 4) que preserva dados compatíveis e descarta o resto com fallback ao default.

```ts
// src/data/types/save.ts
import type { Id } from "./common";

/** Resultado por fase. */
export interface LevelProgress {
  completed: boolean;
  bestTimeSec: number;     // melhor tempo (menor); 0 = não concluída
  bestCoins: number;       // maior nº de moedas numa run
  bestScore: number;
  /** estrela de mestria: concluiu sem morrer. */
  flawless: boolean;
}

export interface Settings {
  musicVolume: number;     // 0..1
  sfxVolume: number;       // 0..1
  /** companheiro Renante ativo (amplifica habilidade). */
  companionEnabled: boolean;
  /** reduz partículas/flashes (acessibilidade). */
  reducedMotion: boolean;
}

export interface SaveState {
  schemaVersion: number;        // 1
  /** quando o save foi gravado (epoch ms). */
  updatedAt: number;
  /** personagem selecionado atualmente. */
  selectedCharacter: Id;        // "renan"
  /** ids de personagens desbloqueados. */
  unlockedCharacters: Id[];     // sempre inclui "renan"
  /** Lifecards já coletadas. */
  collectedLifecards: Id[];
  /** progresso por levelId. */
  levels: Record<Id, LevelProgress>;
  /** total acumulado de moedas (placar do grupo). */
  totalCoins: number;
  /** quais das 3 Transformações já reunidas (ver LORE seção 1). */
  transformations: {
    existential: boolean;
    cultural: boolean;
    digital: boolean;
  };
  settings: Settings;
}
```

Default inicial (`createDefaultSave()` retorna isto quando não há save):

```json
{
  "schemaVersion": 1,
  "updatedAt": 0,
  "selectedCharacter": "renan",
  "unlockedCharacters": ["renan"],
  "collectedLifecards": [],
  "levels": {},
  "totalCoins": 0,
  "transformations": { "existential": false, "cultural": false, "digital": false },
  "settings": {
    "musicVolume": 0.6,
    "sfxVolume": 0.8,
    "companionEnabled": false,
    "reducedMotion": false
  }
}
```

### 3.10. Pseudo-código do parser de tilemap

Converte o par (`.txt` ASCII + `Level` JSON) em estruturas de runtime consumidas pelo motor (seção 2). É a única ponte entre dados e entidades.

```ts
// src/data/loadLevel.ts (pseudo)
interface LoadedLevel {
  meta: Level;
  /** grid lógico [row][col] -> TileType. */
  tiles: TileType[][];
  solids: Map<string, TileType>;   // "col,row" -> tipo sólido (ground/brick/block)
  platforms: Set<string>;          // "col,row" das plataformas semi
  hazards: GridPos[];              // espinhos '^'
  spawnPlayer: GridPos;
  coins: CoinSpawn[];              // 'o' do grid + meta.coins
  goal: GridPos;
}

function loadLevel(meta: Level, gridText: string): LoadedLevel {
  const lines = gridText.split("\n").filter(l => !l.startsWith(";"));
  assert(lines.length === meta.rows, "row count != Level.rows");

  const tiles: TileType[][] = [];
  const solids = new Map<string, TileType>();
  const platforms = new Set<string>();
  const hazards: GridPos[] = [];
  const coins = [...meta.coins];
  let spawnPlayer = meta.playerSpawn ?? { col: 0, row: 0 };
  let goal = { col: meta.goalCol, row: meta.groundRow - 1 };

  for (let row = 0; row < meta.rows; row++) {
    const line = (lines[row] ?? "").padEnd(meta.cols, ".");
    tiles[row] = [];
    for (let col = 0; col < meta.cols; col++) {
      const ch = line[col];
      const key = `${col},${row}`;
      switch (ch) {
        case "#": tiles[row][col] = "ground";  solids.set(key, "ground"); break;
        case "B": tiles[row][col] = "brick";   solids.set(key, "brick");  break;
        case "?": tiles[row][col] = "block";   solids.set(key, "block");  break;
        case "=": tiles[row][col] = "platform"; platforms.add(key);       break;
        case "^": tiles[row][col] = "empty";   hazards.push({ col, row });break;
        case "o": tiles[row][col] = "empty";   coins.push({ at: { col, row } }); break;
        case "S": tiles[row][col] = "empty";   spawnPlayer = { col, row }; break;
        case "G": tiles[row][col] = "empty";   goal = { col, row };        break;
        default:  tiles[row][col] = "empty";
      }
    }
  }
  // BlockSpawn.content é casado com solids "block" pela posição (meta.blocks).
  return { meta, tiles, solids, platforms, hazards, spawnPlayer, coins, goal };
}
```

### 3.11. Layout de arquivos de dados

Organização física dos dados (consistente com a estrutura modular da seção 2):

```text
/data
  config.ts                 # CONFIG (3.8)
  manifest.json             # AssetManifest (3.7)
  /characters
    renan.json  dante.json  julio.json  artur.json  einstein.json  renante.json
  /levels
    index.json              # ordem/lista de Level ids
    vivo-zone-1.json        # Level meta (3.5.3)
    vivo-zone-1.txt         # tilemap ASCII (3.5.2)
    kion-zone-1.json kion-zone-1.txt
    ...                     # demais clientes-fase: ecorodovias, mubadala, jpmorgan
```

> Todos os tipos desta seção vivem em `src/data/types/*.ts` e são reexportados por `src/data/types/index.ts`. O motor (seção 2) importa apenas tipos `readonly`; os arquivos `.json`/`.txt` são carregados via `fetch` (multi-arquivo) ou inlinados como string/base64 no build single-file (seção 4).

---

## 4. Motor & Fisica (port da base)

Esta secao define como portar o motor vanilla JS do jogo-base (`C:\Users\artur\Downloads\remixed-6e07a45d.html`) para uma arquitetura **Vite + TypeScript + ESM** modular, organizada e expansivel (ver secao 1 para stack e secao 3 para direcao visual). O objetivo e preservar **a "sensacao" exata** da fisica da base — porque ja esta afinada e divertida — enquanto refatoramos o codigo monolitico em modulos testaveis e data-driven (ver secao 5 para o formato de dados de fases). Toda constante de fisica e portada com o **mesmo valor numerico** da base; nenhuma e "melhorada" sem playtest.

Decisao-chave de port: **simulacao em timestep fixo de 60 Hz** (a base assume 60 fps implicito via `requestAnimationFrame`). Refatoramos o loop para um acumulador determinista (dt fixo), de modo que a fisica fique identica independente do refresh-rate do monitor (60/120/144 Hz), eliminando o bug classico de "pulo mais alto em monitor de 144 Hz".

---

### 4.1 Visao geral da arquitetura de modulos

A base e um unico `<script>`. O port quebra isso em modulos ESM com responsabilidade unica. Layout de pastas dentro de `src/engine/` (codigo agnostico de conteudo) e `src/game/` (regras especificas de Gravidade Zero):

```
src/
  engine/
    loop.ts          # GameLoop: requestAnimationFrame + acumulador de timestep fixo
    time.ts          # Clock, dt fixo, escala de tempo (slow-mo do Humanware / E=mc2)
    input.ts         # InputManager unificado: teclado + toque + gamepad -> InputState
    camera.ts        # Camera 2D com clamp aos limites do nivel
    tilemap.ts       # TileMap: storage "c,r" -> TileType, queries de colisao
    collision.ts     # resolveAABB / sweptAABB tile-based, separado por eixo
    aabb.ts          # tipos AABB + helpers (intersects, overlapX/Y)
    physics.ts       # integracao de movimento (gravidade, aceleracao, atrito)
    state-machine.ts # StateMachine generica (push/pop/replace) + GameState interface
    rng.ts           # PRNG mulberry32 deterministico (particulas/spawns reproduziveis)
  game/
    constants.ts     # TODAS as constantes de fisica/gameplay (fonte unica da verdade)
    entities/        # Player, Enemy, Coin, Item, Projectile (ver secao 6)
    states/          # LoadingState, TitleState, SelectState, PlayingState, ...
    world.ts         # World: agrega tilemap + entidades + camera de um nivel
  main.ts            # bootstrap: cria canvas, GameLoop, StateMachine, vai p/ Loading
```

Regra de dependencia: `engine/` **nunca** importa de `game/`. `game/` importa de `engine/`. Isso permite reusar o motor para futuros mini-jogos da Gzero e mantem o motor testavel isoladamente com Vitest.

---

### 4.2 Constantes de fisica e gameplay (`constants.ts`)

Todas as constantes da base sao portadas para um unico modulo tipado e congelado. Valores **identicos** a base salvo onde anotado. Unidade de tempo: **frame fixo de 1/60 s** (ver 4.5); velocidades sao em px/frame, aceleracoes em px/frame^2.

```ts
// src/game/constants.ts
export const TILE = 48;                 // lado do tile em px

// --- Gravidade / queda ---
export const GRAVITY = 0.8;             // px/frame^2 somado a vy por frame
export const MAX_FALL = 17;             // clamp de vy para baixo

// --- Movimento horizontal ---
export const WALK_ACCEL = 0.7;          // aceleracao andando
export const RUN_ACCEL  = 0.95;         // aceleracao correndo (segurando "run")
export const WALK_MAX   = 4.6;          // velocidade max andando
export const RUN_MAX    = 7.3;          // velocidade max correndo
export const GROUND_DECEL = 0.6;        // atrito no chao (sem input)
export const AIR_DECEL    = 0.18;       // atrito no ar (sem input)

// --- Pulo ---
export const JUMP_VEL   = -15.4;        // vy inicial do pulo (y cresce p/ baixo)
export const COYOTE     = 7;            // frames de coyote time apos sair do chao
export const JUMP_BUFFER = 8;           // frames de buffer de pulo antes de aterrissar
export const STOMP_BOUNCE = -11.5;      // vy ao pisar em inimigo

// --- Inimigos / itens ---
export const ENEMY_SPEED = 1.25;        // velocidade de patrulha horizontal
export const STAR_TIME   = 480;         // frames de invencibilidade (estrela) = 8 s
export const PROJECTILE_SPEED = 8.5;    // velocidade horizontal do projetil

// --- Dimensoes de hitbox (px) ---
export const PLAYER_W = 34, PLAYER_H = 42;
export const ENEMY_W  = 38, ENEMY_H  = 34;
export const COIN_SIZE = 26;
export const ITEM_SIZE = 30;

// --- Nivel / mundo ---
export const LEVEL_COLS = 168;          // largura do nivel base em tiles
export const LEVEL_ROWS = 11;           // altura do nivel base em tiles
export const GROUND_ROW = 9;            // linha onde comeca o chao solido
export const GOAL_COL   = 160;          // coluna do objetivo (goal)

// --- Tela / tempo ---
export const VIEW_W = 960, VIEW_H = 528; // canvas logico (= 20 x 11 tiles)
export const TIME_START = 250;           // contador de tempo inicial do nivel
export const FIXED_DT = 1 / 60;          // passo fixo da simulacao (s)
export const FIXED_MS = 1000 / 60;       // ~16.6667 ms por passo
export const MAX_SUBSTEPS = 5;           // teto de passos por frame (anti spiral-of-death)

// --- Escala de tempo (slow-mo) ---
export const HUMANWARE_TIMESCALE = 0.45; // mundo a 45% no MODO HUMANWARE (ver secao 7)
export const EINSTEIN_TIMESCALE  = 0.35; // habilidade "E=mc2" do Einstein (ver secao 3 roster)
```

**Tabela de referencia rapida** (derivada das constantes acima):

| Grandeza | Valor base | Derivado / nota |
|---|---|---|
| Tile | 48 px | viewport 960x528 = 20x11 tiles |
| Altura de pulo (pico) | ~149 px | `JUMP_VEL^2 / (2*GRAVITY)` = 15.4^2/1.6 ≈ 148.2 px ≈ 3.1 tiles |
| Tempo de subida do pulo | ~19 frames | `JUMP_VEL / GRAVITY` ≈ 19.25 frames (~0.32 s) |
| Velocidade terminal de queda | 17 px/frame | = 1020 px/s |
| Alcance horizontal correndo no pico do pulo | ~280 px | ~5.8 tiles a RUN_MAX por ~38 frames de voo |
| STAR_TIME | 480 frames | 8.0 s a 60 fps |
| Coyote / buffer | 7 / 8 frames | ~117 ms / ~133 ms |

Decisao: o `constants.ts` e a **fonte unica da verdade**. Fases (secao 5) podem sobrescrever um subconjunto via campo `physicsOverrides` no JSON do nivel (ex.: zonas de baixa gravidade no reino "Gravidade Zero"), mas o default e sempre este objeto.

---

### 4.3 Modelo de colisao tile-based

Portado direto do conceito da base: o mundo solido vive num **Map esparso** `"c,r" -> TileType`, onde `c` = coluna, `r` = linha. Tiles fora do Map sao vazios (ar). Isso e barato em memoria e rapido de consultar.

#### Tipos de tile

```ts
// src/engine/tilemap.ts
export type TileType =
  | 'ground'    // solido por todos os lados
  | 'brick'     // solido; quebravel/bumpavel por baixo (ver secao 6)
  | 'block'     // solido; "?" que solta moeda/item ao bater por baixo
  | 'platform'; // semi-solido: colide SO de cima (pula atravessando por baixo)

export interface TileMap {
  cols: number;
  rows: number;
  get(c: number, r: number): TileType | null;
  set(c: number, r: number, t: TileType | null): void;
  isSolid(c: number, r: number): boolean;     // ground|brick|block
  isPlatform(c: number, r: number): boolean;  // platform
}
```

Implementacao do storage (mantendo o esquema string-key da base, encapsulado):

```ts
export function createTileMap(cols: number, rows: number): TileMap {
  const data = new Map<string, TileType>();
  const key = (c: number, r: number) => `${c},${r}`;
  return {
    cols, rows,
    get: (c, r) => data.get(key(c, r)) ?? null,
    set: (c, r, t) => { t ? data.set(key(c, r), t) : data.delete(key(c, r)); },
    isSolid: (c, r) => { const t = data.get(key(c, r)); return t === 'ground' || t === 'brick' || t === 'block'; },
    isPlatform: (c, r) => data.get(key(c, r)) === 'platform',
  };
}
```

#### Resolucao AABB separada por eixo (o coracao da fisica)

Modelo: cada entidade tem uma AABB (`x, y, w, h`) e velocidade (`vx, vy`). Resolvemos colisao **um eixo de cada vez** (X depois Y), consultando apenas os tiles que a AABB pode tocar (broadphase por range de colunas/linhas). Essa abordagem por eixos e a mesma da base e evita o "grude em quina" (corner-snag). Plataformas (`platform`) so bloqueiam no eixo Y quando a entidade esta **descendo** e seus pes estavam acima do topo do tile no frame anterior (one-way).

```ts
// src/engine/collision.ts
export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; }
export interface CollisionResult {
  onGround: boolean;   // tocou solido por baixo neste frame
  hitCeiling: boolean; // tocou solido por cima (gatilho de bump de block/brick)
  hitWallL: boolean;
  hitWallR: boolean;
  bumpTiles: Array<{ c: number; r: number }>; // tiles batidos por baixo (p/ block/brick)
}

const overlapRange = (lo: number, hi: number, size: number) =>
  ({ a: Math.floor(lo / size), b: Math.floor((hi - 1e-6) / size) });

export function resolveTileCollision(body: Body, map: TileMap): CollisionResult {
  const r: CollisionResult = { onGround:false, hitCeiling:false, hitWallL:false, hitWallR:false, bumpTiles:[] };
  const prevBottom = body.y + body.h; // base ANTES de mover em Y (capturada por quem chama, ver pseudo)

  // ---- Eixo X ----
  body.x += body.vx;
  {
    const top = body.y, bot = body.y + body.h;
    const { a: r0, b: r1 } = overlapRange(top, bot, TILE);
    if (body.vx > 0) {                                   // movendo p/ direita
      const c = Math.floor((body.x + body.w - 1e-6) / TILE);
      for (let row = r0; row <= r1; row++) if (map.isSolid(c, row)) {
        body.x = c * TILE - body.w; body.vx = 0; r.hitWallR = true; break;
      }
    } else if (body.vx < 0) {                            // movendo p/ esquerda
      const c = Math.floor(body.x / TILE);
      for (let row = r0; row <= r1; row++) if (map.isSolid(c, row)) {
        body.x = (c + 1) * TILE; body.vx = 0; r.hitWallL = true; break;
      }
    }
  }

  // ---- Eixo Y ----
  body.y += body.vy;
  {
    const left = body.x, right = body.x + body.w;
    const { a: c0, b: c1 } = overlapRange(left, right, TILE);
    if (body.vy > 0) {                                   // caindo
      const row = Math.floor((body.y + body.h - 1e-6) / TILE);
      for (let c = c0; c <= c1; c++) {
        const newTopOfTile = row * TILE;
        const wasAbove = prevBottom <= newTopOfTile + 0.5;
        if (map.isSolid(c, row) || (map.isPlatform(c, row) && wasAbove)) {
          body.y = newTopOfTile - body.h; body.vy = 0; r.onGround = true; break;
        }
      }
    } else if (body.vy < 0) {                            // subindo (cabeca)
      const row = Math.floor(body.y / TILE);
      for (let c = c0; c <= c1; c++) if (map.isSolid(c, row)) {
        body.y = (row + 1) * TILE; body.vy = 0; r.hitCeiling = true;
        r.bumpTiles.push({ c, r: row });                 // gatilho de bump (block/brick)
      }
    }
  }
  return r;
}
```

Notas de fidelidade ao porte:
- **Eixo X antes de Y**: garante que andar contra uma parede no chao nao "prenda" e que pisar em quinas seja suave. Igual a base.
- **Epsilon `1e-6`**: evita pegar o tile da borda direita/inferior por arredondamento (problema novo que aparece ao tornar o passo determinista).
- **`platform` one-way**: usa `prevBottom` (base do corpo no inicio do tick) para decidir se a entidade "vinha de cima". `wasAbove` com folga de 0.5 px absorve jitter. Permite o classico "subir por baixo da plataforma e cair em cima".
- **`bumpTiles`**: o `block`/`brick` batido por baixo nao e resolvido aqui; e devolvido para a entidade Player tratar a logica de gameplay (soltar moeda, quebrar brick, animar bump) — ver secao 6.

#### Por que AABB+separado e nao swept

A base usa resolucao por penetracao (move-e-corrige), nao swept (raycast continuo). Mantemos isso: as velocidades maximas (RUN_MAX=7.3, MAX_FALL=17) sao **menores que TILE=48**, entao o tunneling e impossivel em condicoes normais com dt fixo. **Excecao**: projeteis a PROJECTILE_SPEED=8.5 e qualquer entidade com `vy` proxima de MAX_FALL passando por plataformas de 1 tile estao folgadas (17 < 48). Nao precisamos de swept AABB. Documentamos isso como decisao: **sem CCD**; se no futuro alguma habilidade gerar velocidade > 40 px/frame (improvavel), subdividir o movimento em sub-passos por eixo.

---

### 4.4 Camera

Portada da base: camera segue o player no eixo X (e levemente em Y) com **clamp aos limites do nivel**, para nunca mostrar fora do mundo.

```ts
// src/engine/camera.ts
export interface Camera { x: number; y: number; w: number; h: number; }

export function createCamera(): Camera {
  return { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
}

// Centra no alvo, faz clamp [0, worldPx - view]. worldH < viewH => trava em 0.
export function updateCamera(cam: Camera, targetX: number, targetY: number, worldCols: number, worldRows: number) {
  const worldW = worldCols * TILE, worldH = worldRows * TILE;
  const desiredX = targetX - cam.w / 2;
  const desiredY = targetY - cam.h * 0.6; // alvo um pouco abaixo do centro (mais ceu visivel)
  cam.x = clamp(desiredX, 0, Math.max(0, worldW - cam.w));
  cam.y = clamp(desiredY, 0, Math.max(0, worldH - cam.h));
}
const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;
```

Decisoes:
- **Sem smoothing/lerp por padrao** (a base e snap). Opcional: deixar um campo `cam.lerp = 0.15` para um seguir suave; default = 1 (snap) para preservar a sensacao da base. Lerp deve usar **dt fixo**, nunca dt variavel, para nao depender de fps.
- Render: o `WorldRenderer` desenha com `ctx.translate(-Math.round(cam.x), -Math.round(cam.y))`. O `Math.round` evita "tile seams" (linhas entre tiles) com a arte pixel-art quadrada da secao 3. O HUD e desenhado **fora** do translate (coordenadas de tela).
- Niveis com altura = VIEW (11 linhas = 528 px) travam `cam.y = 0`; niveis verticais futuros usam o clamp Y automaticamente.

---

### 4.5 Game loop com timestep fixo

A base roda direto no `requestAnimationFrame` (assume 60 fps). **Refatoramos** para um **acumulador de passo fixo** — a mudanca tecnica mais importante do porte. Update roda em passos deterministas de `FIXED_DT = 1/60 s`; render interpola opcionalmente entre o estado anterior e o atual para suavidade em telas de alto refresh.

```ts
// src/engine/loop.ts
export class GameLoop {
  private acc = 0;
  private last = 0;
  private running = false;
  constructor(
    private update: (dt: number) => void,         // dt = FIXED_DT (constante)
    private render: (alpha: number) => void,       // alpha in [0,1) p/ interpolacao
  ) {}

  start() { this.running = true; this.last = performance.now(); requestAnimationFrame(this.frame); }
  stop()  { this.running = false; }

  private frame = (now: number) => {
    if (!this.running) return;
    let frameTime = (now - this.last) / 1000; // s
    this.last = now;
    if (frameTime > 0.25) frameTime = 0.25;   // pausa/aba inativa: nao acumular tempo gigante
    this.acc += frameTime;

    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.update(FIXED_DT);     // simulacao SEMPRE com passo identico
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.acc = 0; // spiral-of-death guard: descarta atraso residual

    const alpha = this.acc / FIXED_DT;        // fracao p/ interpolar render
    this.render(alpha);
    requestAnimationFrame(this.frame);
  };
}
```

Decisoes do loop:
- **`dt` da simulacao = `FIXED_DT = 1/60 s`**. Como portamos a fisica em px/frame (e nao px/s), na pratica o `update` ignora o valor de `dt` recebido e aplica as constantes "por passo" diretamente (1 passo = 1 frame da base). Passamos `dt` na assinatura por higiene/futuro, mas a integracao e por-passo. Resultado: **fisica byte-a-byte identica** a base em qualquer monitor.
- **`clamp` de `frameTime` a 0.25 s**: ao voltar de uma aba pausada o navegador entrega um delta enorme; sem o clamp o jogo "teleportaria". Combina com a pausa automatica (ver state machine, `visibilitychange` -> push `PausedState`).
- **`MAX_SUBSTEPS = 5`**: em maquina lenta o loop nunca executa mais que 5 updates por frame (anti spiral-of-death). O excedente e descartado (jogo "afina" em vez de travar).
- **Interpolacao de render (`alpha`)**: opcional. Para o port inicial podemos renderizar com `alpha=1` (posicao atual) — simples e suficiente. Quando habilitarmos suavidade em 120/144 Hz, cada entidade guarda `prevX/prevY` e o render usa `lerp(prev, cur, alpha)`. **Apenas o render interpola**; a logica nunca.
- **Escala de tempo (slow-mo)**: o slow-mo do MODO HUMANWARE (secao 7) e do "E=mc2" (Einstein, secao 3) **nao** mexe no loop. Em vez disso, o `World.update` recebe um `timeScale` e aplica menos passos de logica por update (ou pula updates de inimigos/projeteis em fracao das frames), mantendo o player em velocidade normal. Isso preserva o determinismo do loop e centraliza o efeito no `Clock`/`World`.

`Clock` auxiliar para escala de tempo seletiva:

```ts
// src/engine/time.ts
export interface Clock {
  scale: number;              // 1 = normal; HUMANWARE_TIMESCALE no modo; afeta INIMIGOS/mundo
  frame: number;              // contador global de frames de simulacao (deterministico)
}
// World aplica scale ao avancar timers de inimigos/projeteis/particulas;
// o Player permanece sempre em escala 1 (o heroi "se move rapido" no mundo lento).
```

---

### 4.6 State machine

A base ja tem estados (`loading/title/playing/win/over`). Portamos para uma **StateMachine generica baseada em pilha**, e **adicionamos** `select` (selecao de personagem — roster da secao 3) e `paused`. Estados finais de gameplay: `loading -> title -> select -> playing` com `paused` empilhavel sobre `playing`, e `playing -> win | over`.

```ts
// src/engine/state-machine.ts
export interface GameState {
  name: string;
  enter?(prev?: GameState): void;
  exit?(): void;
  update(dt: number, input: InputState): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  // pausa nao destroi o estado abaixo na pilha (continua renderizando congelado).
  pauseRender?: boolean; // se true, o estado de baixo ainda e desenhado por baixo
}

export class StateMachine {
  private stack: GameState[] = [];
  get current() { return this.stack[this.stack.length - 1]; }
  push(s: GameState) { s.enter?.(this.current); this.stack.push(s); }
  pop()  { this.stack.pop()?.exit?.(); }
  replace(s: GameState) { this.stack.pop()?.exit?.(); s.enter?.(); this.stack.push(s); }
  update(dt: number, input: InputState) { this.current?.update(dt, input); }
  render(ctx: CanvasRenderingContext2D, alpha: number) {
    // desenha de baixo p/ cima os estados com pauseRender, depois o topo
    const top = this.stack.length - 1;
    let start = top;
    while (start > 0 && this.stack[start].pauseRender) start--;
    for (let i = start; i <= top; i++) this.stack[i].render(ctx, alpha);
  }
}
```

Estados concretos (em `src/game/states/`):

| Estado | Entra de | Sai para | Responsabilidade |
|---|---|---|---|
| `LoadingState` | bootstrap | `TitleState` | carrega atlas/bg (ver pipeline de arte, secao 8) e fontes; barra de progresso magenta (secao 3) |
| `TitleState` | loading / over / win | `SelectState` | tela-titulo com logo Gzero (SVG); "Enter/Start" -> select |
| `SelectState` | title | `PlayingState` | escolha do personagem desbloqueado (roster secao 3); mostra Lifecards |
| `PlayingState` | select / paused-resume | `WinState`/`OverState`/`PausedState` | roda o `World` (tilemap+entidades+camera), HUD, timer, Humanware |
| `PausedState` | playing (`Esc`/`Start`/`blur`) | playing (pop) ou title | `pauseRender=true`; overlay escuro + menu; congela a simulacao |
| `WinState` | playing (chega ao GOAL_COL) | title / proxima fase | frase de vitoria (secao 3); placar de moedas/tempo |
| `OverState` | playing (vidas=0 ou tempo=0) | title / retry | game over; retry recomeca o `World` da fase |

Diagrama de transicoes:

```
            +-----------+
            |  Loading  |
            +-----+-----+
                  | assets prontos
                  v
            +-----------+   Enter   +-----------+   confirma   +-----------+
            |   Title   +---------->|  Select   +------------->|  Playing  |
            +-----+-----+           +-----------+              +-----+-----+
              ^   ^                                            push | | pop (resume)
              |   | voltar ao menu                                  v |
              |   +----------------------------+              +-----------+
              |                                 |             |  Paused   | (pauseRender)
        retry |                                 |             +-----------+
              |        chega GOAL_COL  +--------+--------+
              +------------------------|      Win        |
              |                        +-----------------+
              |   vidas=0 OU tempo=0   +-----------------+
              +------------------------|      Over       |
                                       +-----------------+
```

Decisoes:
- **Pilha (push/pop)**, nao apenas troca, para que `PausedState` preserve o `PlayingState` intacto por baixo (`pauseRender=true`) — pausa real sem perder estado do mundo.
- `visibilitychange`/`blur` da janela -> `push(PausedState)` automatico (anti "morri porque sai da aba").
- O `update` so e chamado no topo da pilha. Entao um `World` pausado simplesmente nao avanca — nenhum hack de "if paused return".

---

### 4.7 Input unificado: teclado + toque + gamepad

A base trata so teclado. **Adicionamos** toque (mobile, ja que o alvo e navegador) e gamepad (Gamepad API), tudo normalizado num unico `InputState` lido pelo `update`. O resto do jogo **nunca** olha eventos crus — so o `InputState`.

```ts
// src/engine/input.ts
export interface InputState {
  left: boolean; right: boolean;
  jump: boolean;        // estado atual do botao de pulo
  jumpPressed: boolean; // edge: pressionou NESTE tick (alimenta JUMP_BUFFER)
  run: boolean;         // segurar p/ RUN_ACCEL/RUN_MAX
  action: boolean;      // habilidade do personagem (secao 3) / projetil
  actionPressed: boolean;
  humanware: boolean;   // ativar MODO HUMANWARE quando medidor cheio (secao 7)
  pause: boolean;       // edge
}
```

`InputManager` agrega as 3 fontes, faz deteccao de borda (pressed) por tick e expoe `sample()`:

```ts
export class InputManager {
  private keys = new Set<string>();
  private pad: Gamepad | null = null;
  private touch = { left:false, right:false, jump:false, run:false, action:false, humanware:false };
  private prev = { jump:false, action:false, pause:false };

  constructor(canvas: HTMLCanvasElement) {
    addEventListener('keydown', e => { this.keys.add(e.code); if (BOUND.has(e.code)) e.preventDefault(); });
    addEventListener('keyup',   e => this.keys.delete(e.code));
    addEventListener('gamepadconnected', e => this.pad = e.gamepad);
    addEventListener('gamepaddisconnected', () => this.pad = null);
    this.bindTouch(canvas); // botoes virtuais on-screen (so aparecem se 'ontouchstart')
  }

  sample(): InputState {
    const gp = this.pad ? navigator.getGamepads()[this.pad.index] : null;
    const ax = gp ? gp.axes[0] : 0;
    const btn = (i: number) => !!gp?.buttons[i]?.pressed;

    const left  = this.keys.has('ArrowLeft')  || this.keys.has('KeyA') || ax < -0.4 || btn(14) || this.touch.left;
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD') || ax >  0.4 || btn(15) || this.touch.right;
    const jump  = this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW') || btn(0) || this.touch.jump;
    const run   = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || btn(2) || this.touch.run;
    const action = this.keys.has('KeyJ') || this.keys.has('KeyZ') || btn(1) || this.touch.action;
    const humanware = this.keys.has('KeyK') || this.keys.has('KeyX') || btn(3) || this.touch.humanware;
    const pause = this.keys.has('Escape') || btn(9);

    const s: InputState = {
      left, right, jump, run, action, humanware, pause,
      jumpPressed:   jump   && !this.prev.jump,
      actionPressed: action && !this.prev.action,
      pause:         pause  && !this.prev.pause,
    } as InputState;
    // nota: 'pause' acima e o edge; reatribuimos p/ clareza
    s.pause = pause && !this.prev.pause;

    this.prev = { jump, action, pause };
    return s;
  }
}
```

Mapa de controles (decidido):

| Acao | Teclado | Gamepad | Toque |
|---|---|---|---|
| Esquerda/Direita | Setas / A,D | D-pad 14/15 ou stick L | botoes virtuais < > |
| Pular | Espaco / Cima / W | A (0) | botao A |
| Correr | Shift | X (2) | hold em A do dpad direito |
| Acao/habilidade | J / Z | B (1) | botao B |
| Humanware | K / X | Y (3) | botao H (acende quando cheio) |
| Pausa | Esc | Start (9) | gesto/botao || |

Decisoes:
- **Deteccao de borda no `sample()`**: `jumpPressed`/`actionPressed`/`pause` sao edges de 1 tick. O `jumpPressed` alimenta o `JUMP_BUFFER` (8 frames) do player — o pulo nao exige timing perfeito. Como `sample()` roda 1x por **passo fixo**, o buffer e medido em frames de simulacao (deterministico).
- **`preventDefault` so nas teclas mapeadas** (`BOUND`) — nao sequestra atalhos do navegador como F5/Ctrl.
- **Toque condicional**: botoes virtuais (estilo neon magenta, secao 3) so renderizam se `'ontouchstart' in window`. Desktop nao ve overlay.
- **Gamepad por polling**: a Gamepad API exige reler `navigator.getGamepads()` a cada frame; fazemos no `sample()`. Deadzone de stick = 0.4.
- Input e amostrado **uma vez por passo fixo** dentro do `update`, garantindo consistencia com a simulacao determinista (nunca por evento solto durante o render).

---

### 4.8 Pseudo-codigo integrado: um passo completo de simulacao

Junta loop + input + fisica + colisao + camera. Este e o caminho percorrido a cada `FIXED_DT`:

```
function PlayingState.update(dt, input):       # dt == FIXED_DT, ignorado em favor de px/frame
    if input.pause: stateMachine.push(PausedState); return
    world.update(input)

function World.update(input):
    clock.frame += 1

    # ---- timers globais ----
    timeLeft -= 1/60                            # contador de tempo (TIME_START)
    if timeLeft <= 0: stateMachine.replace(OverState); return
    if humanwareActive: humanwareFrames -= 1; if 0: clock.scale = 1
    if starFrames > 0: starFrames -= 1          # STAR_TIME

    # ---- PLAYER (sempre escala 1) ----
    updatePlayer(player, input)

    # ---- INIMIGOS/PROJETEIS/PARTICULAS (afetados por clock.scale) ----
    if clock.frame % stepEveryN(clock.scale) == 0:   # slow-mo = pular fracao das frames
        for e in enemies: updateEnemy(e)
        for p in projectiles: updateProjectile(p)
    updateParticles(particles, clock.scale)

    # ---- interacoes ----
    handleStomp(player, enemies)                 # AABB player vs inimigo (ver secao 6)
    handlePickups(player, coins, items)
    handleBumpTiles(player.lastBumps, map)       # block solta moeda/item; brick quebra
    if player.x >= GOAL_COL*TILE: stateMachine.replace(WinState)
    if player.dead: lives -= 1; respawn-or-Over

    # ---- camera ----
    updateCamera(camera, player.x + player.w/2, player.y + player.h/2, map.cols, map.rows)


function updatePlayer(p, input):
    # --- horizontal: aceleracao / atrito ---
    accel = input.run ? RUN_ACCEL : WALK_ACCEL
    maxv  = input.run ? RUN_MAX  : WALK_MAX
    if input.left  and not input.right:  p.vx -= accel; p.facing = -1
    elif input.right and not input.left: p.vx += accel; p.facing = +1
    else:                                                  # sem input: atrito
        decel = p.onGround ? GROUND_DECEL : AIR_DECEL
        if abs(p.vx) <= decel: p.vx = 0 else: p.vx -= sign(p.vx)*decel
    p.vx = clamp(p.vx, -maxv, +maxv)

    # --- coyote time + jump buffer ---
    if p.onGround: p.coyote = COYOTE else: p.coyote = max(0, p.coyote-1)
    if input.jumpPressed: p.jumpBuffer = JUMP_BUFFER else: p.jumpBuffer = max(0, p.jumpBuffer-1)
    if p.jumpBuffer > 0 and p.coyote > 0:
        p.vy = JUMP_VEL                                    # habilidade do Renan pode permitir 2o pulo (secao 3)
        p.jumpBuffer = 0; p.coyote = 0; p.onGround = false
        spawnJumpParticles(p)
    # variable jump height: soltar o botao corta o impulso (sensacao Mario)
    if not input.jump and p.vy < JUMP_VEL*0.45: p.vy = JUMP_VEL*0.45

    # --- gravidade ---
    p.vy = min(p.vy + GRAVITY, MAX_FALL)

    # --- COLISAO (separada por eixo, ver 4.3) ---
    prevBottom = p.y + p.h
    result = resolveTileCollision(p, map)   # injeta prevBottom internamente
    p.onGround = result.onGround
    p.lastBumps = result.bumpTiles
    if result.onGround: p.coyote = COYOTE
```

Notas:
- **`variable jump height`** (cortar o pulo ao soltar o botao) e um pequeno acrescimo "Mario-like" alem da base. Decisao: incluir, pois melhora o feel e nao altera constantes; coeficiente fixado em `0.45`.
- **`stepEveryN(scale)`**: para slow-mo, `scale=0.45` -> rodar inimigos ~ a cada ~2 frames; implementacao concreta: acumulador fracionario `enemyAcc += scale; if enemyAcc >= 1 { enemyAcc -= 1; updateEnemies() }`. Player nunca passa por esse acumulador.
- Ordem rigida: **input -> player horizontal -> pulo -> gravidade -> colisao -> interacoes -> camera**. A camera sempre por ultimo, apos a posicao final do player, para nao tremular.

---

### 4.9 O que reusar vs. refatorar

Resumo de decisoes de porte, item a item:

| Sistema da base | Decisao | Detalhe |
|---|---|---|
| Constantes de fisica | **REUSAR (valores identicos)** | Copiar 1:1 para `constants.ts`; congelar com `as const`. Zero retuning sem playtest. |
| Tiles em `Map "c,r"` | **REUSAR (logica), refatorar (encapsular)** | Mesmo storage esparso, agora atras da interface `TileMap` tipada. |
| Colisao por eixo X/Y | **REUSAR (algoritmo), refatorar (extrair modulo)** | Vira `resolveTileCollision`; adicionar `platform` one-way explicito + epsilon. |
| Blocos com bump/moeda | **REUSAR (regra), refatorar (separar)** | Colisao devolve `bumpTiles`; a regra de gameplay vai p/ entidade (secao 6). |
| Camera com clamp | **REUSAR** | Portar `updateCamera`; adicionar opcao de lerp (default snap). |
| Loop `requestAnimationFrame` | **REFATORAR (mudanca importante)** | Trocar por acumulador de **timestep fixo 60 Hz** + guarda de substeps. Corrige dependencia de refresh-rate. |
| State machine (5 estados) | **REFATORAR + EXPANDIR** | Virar pilha generica; adicionar `select` e `paused`. |
| Input (so teclado) | **REFATORAR + EXPANDIR** | Unificar em `InputState`; adicionar toque e gamepad; edge-detection p/ buffer. |
| Inimigos (patrulha+stomp) | **REUSAR (mecanica)** | Mantida; integra ao slow-mo via `clock.scale` (ver secao 6/7). |
| Moedas/itens/estrela | **REUSAR** | `STAR_TIME` e pickups portados como estao (secao 6). |
| Projeteis | **REUSAR** | `PROJECTILE_SPEED` mantida; sem CCD (folga vs TILE). |
| Particulas | **REUSAR, refatorar (RNG deterministico)** | Trocar `Math.random` por `mulberry32` semeado, p/ replays/testes deterministas. |
| Atlas PNG + bg base64 + FRAMES | **REUSAR (estrutura), refatorar (carregamento)** | Mover de base64 embutido para assets carregados no `LoadingState` (ver secao 8); FRAMES vira JSON de coordenadas. |
| Maquina de render acoplada ao update | **REFATORAR** | Separar `update(dt)` de `render(alpha)` para o timestep fixo funcionar. |

**Principio geral do porte**: *a fisica e a sensacao sao sagradas e copiadas valor-a-valor; a arquitetura e completamente refeita.* Cobertura de testes (Vitest) foca exatamente nos invariantes que garantem a sensacao da base: altura de pulo = ~149 px, terminal de queda = 17, parar contra parede zera `vx`, plataforma one-way deixa subir por baixo, e o loop produz a mesma posicao do player apos N passos independente do timing de frames (teste de determinismo).

---

## 5. Personagens Jogaveis & Habilidades

Esta secao especifica os **5 personagens jogaveis** + o **companheiro Renante**, suas identidades (grounded nas pessoas reais da Gzero), assinaturas visuais de sprite pixel, specs completas de habilidade (input, efeito, parametros numericos, cooldown e balanceamento), as regras de amplificacao do companheiro, e o fluxo de selecao + desbloqueio por Lifecard.

Todas as constantes herdam a fisica da base (ver CONTEXTO / secao 4): `TILE=48`, `GRAVITY=0.8`, `MAX_FALL=17`, `WALK_MAX=4.6`, `RUN_MAX=7.3`, `JUMP_VEL=-15.4`, `COYOTE=7`, `JUMP_BUFFER=8`, `STOMP_BOUNCE=-11.5`, `ENEMY_SPEED=1.25`, player `34x42`, `STAR_TIME=480`. Unidade de tempo padrao desta secao = **frame** (1/60 s). Onde escrevo "ms" eh para leitura humana; o motor converte por `frames = round(ms / 16.667)`.

O **Superpoder HUMANWARE** (medidor de coracao/consciencia que enche e dispara o Modo HUMANWARE global) eh detalhado na **secao 6**; aqui tratamos apenas como cada **habilidade de personagem** (a "Super Skill" individual, com cooldown proprio) interage com ele.

---

### 5.1 Modelo de dados dos personagens (data-driven)

Toda a definicao de roster vive em dados (`src/data/characters.ts`), nao em codigo de gameplay. O motor de habilidades (secao 6) consome estas interfaces. Nenhum valor abaixo eh placeholder: todos sao valores de partida balanceados e prontos para tuning.

```ts
// src/data/characters.ts

/** Identidade estavel de cada personagem em todo o jogo. */
export type CharacterId = 'renan' | 'dante' | 'julio' | 'artur' | 'einstein';

/** Familia de habilidade — define o ramo de logica no AbilitySystem. */
export type AbilityKind =
  | 'double_jump'   // Renan  — Salto Visionario
  | 'dash'          // Dante  — Dash Criativo
  | 'shield'        // Julio  — Escudo de Governanca
  | 'build'         // Artur  — Builder
  | 'time_slow';    // Einstein — E=mc2

/** Como a habilidade eh acionada. */
export type AbilityTrigger =
  | 'press'         // toque unico no botao de habilidade
  | 'hold'          // segurar (mantem o efeito enquanto custo permitir)
  | 'double_tap'    // duplo toque na direcao (dash) ou no pulo (double jump)
  | 'air_press';    // toque no botao de pulo enquanto no ar

/** Vetor de stats base do personagem — multiplicadores sobre a fisica padrao. */
export interface CharacterStats {
  walkMaxMul: number;   // multiplica WALK_MAX (4.6)
  runMaxMul: number;    // multiplica RUN_MAX (7.3)
  accelMul: number;     // multiplica WALK_ACCEL/RUN_ACCEL
  jumpVelMul: number;   // multiplica JUMP_VEL (-15.4)
  weightMul: number;    // multiplica GRAVITY na queda (>1 = cai mais rapido)
  hpMax: number;        // pontos de vida (corações). Default do jogo = 3
}

/** Spec numerica completa da Super Skill. */
export interface AbilitySpec {
  kind: AbilityKind;
  trigger: AbilityTrigger;
  cooldownFrames: number;       // recarga apos uso (frames)
  durationFrames: number;       // duracao do efeito ativo (0 = instantaneo)
  heartGainOnUse: number;       // quanto o medidor HUMANWARE ganha ao usar bem (0..100)
  heartCostOnUse: number;       // custo opcional no medidor (0 = nao consome)
  /** parametros especificos da familia (uniao discriminada por kind) */
  params: AbilityParams;
  /** regra de amplificacao quando Renante esta acoplado (ver 5.9) */
  renante: RenanteAmp;
}

export type AbilityParams =
  | DoubleJumpParams
  | DashParams
  | ShieldParams
  | BuildParams
  | TimeSlowParams;

export interface CharacterDef {
  id: CharacterId;
  name: string;            // nome de exibicao
  role: string;            // papel real na Gzero
  signatureColor: string;  // token Gzero (cor de aura/traco)
  accentColor: string;     // segunda cor do sprite
  stats: CharacterStats;
  ability: AbilitySpec;
  lifecard: LifecardDef;   // ver 5.10
  spriteSheet: string;     // caminho do atlas pixel
  portrait: string;        // key-art Higgsfield (ou placeholder)
  unlockedByDefault: boolean;
}
```

> **Base de sprite compartilhada (decisao travada):** todos os 5 personagens usam **o mesmo rig de corpo pixel** — mesma silhueta de 34x42, mesmo numero/ordem de frames de animacao — variando apenas **paleta + 1 traco marcante** (cabelo, acessorio, aura). Isso garante consistencia (pipeline de arte 2, hibrido) e permite trocar o atlas placeholder pelo do Higgsfield sem mexer no codigo de animacao.

#### Atlas de animacao comum (mesmas chaves para todos)

| Estado | Frames | FPS de anim | Observacao |
|---|---|---|---|
| `idle` | 4 | 6 | respiracao leve |
| `walk` | 6 | 12 | ciclo de caminhada |
| `run` | 6 | 16 | usado acima de `WALK_MAX` |
| `jump_up` | 2 | — | subida (vy < 0) |
| `jump_fall` | 2 | — | queda (vy > 0) |
| `skill` | 4 | 14 | pose de habilidade (varia por personagem) |
| `hurt` | 2 | 8 | piscando na invencibilidade de dano |
| `humanware` | 4 | 10 | aura magenta pulsante (Modo HUMANWARE) |

Cada personagem define apenas qual **cor de aura** e quais **2 frames extras** ("traco marcante") sobrescrevem o `skill`. Tudo o mais eh herdado do rig.

---

### 5.2 Tabela-resumo do roster

| # | Personagem | Papel real | Habilidade (Super Skill) | Input | Cooldown | Cor assinatura |
|---|---|---|---|---|---|---|
| 1 | **Renan** | Co-fundador; lidera imersoes no Vale do Silicio | Salto Visionario (pulo alto + duplo; revela portais/segredos) | Pulo no ar (`air_press`) | 0 (recarga ao tocar o chao) | violeta `#7112ff` |
| 2 | **Dante** | Co-fundador | Dash Criativo (investida que quebra obstaculos) | Duplo toque na direcao | 48 f (~0,8 s) | lima `#cdf140` |
| 3 | **Julio** | Rosto da doutrina / pitch | Escudo de Governanca (bloqueia dano; guardrails) | Segurar botao habilidade (`hold`) | 90 f (~1,5 s) | azul `#0099ff` |
| 4 | **Artur** | Dono da marca / builder (o usuario) | Builder (cria plataforma/ferramenta temporaria) | Toque (`press`) | 120 f (~2 s) | pink `#ff0055` |
| 5 | **Einstein** | Pai do Renan; o genio/mentor | E=mc2 (desacelera o tempo) | Toque (`press`) | 300 f (~5 s) | magenta-classic `#f43db3` |

**Stats base por personagem** (multiplicadores sobre a fisica padrao; ver `CharacterStats`):

| Personagem | walkMaxMul | runMaxMul | accelMul | jumpVelMul | weightMul | hpMax |
|---|---|---|---|---|---|---|
| Renan | 1.00 | 1.00 | 1.00 | **1.06** (pulo base mais forte) | 0.96 | 3 |
| Dante | **1.06** | **1.08** | **1.10** | 0.98 | 1.00 | 3 |
| Julio | 0.96 | 0.94 | 0.95 | 0.96 | **1.08** (mais "pesado"/estavel) | **4** |
| Artur | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 3 |
| Einstein | **0.92** | **0.90** | 0.95 | 0.94 | 1.00 | 2 |

**Filosofia de balanceamento (declarada):** Artur eh o **baseline neutro** (todos os multiplicadores 1.0) — referencia de tuning. Renan troca pouca velocidade por mobilidade vertical. Dante eh o "agil/ofensivo". Julio eh o "tanque/defensivo" (4 corações, mais lento). Einstein eh o "fragil/cerebral" (2 corações, lento, mas a habilidade de tempo paga por isso). Nenhum personagem eh estritamente superior: cada um resolve fases diferentes (ver secao 7 sobre design de fases e secao 3 sobre lore das zonas).

---

### 5.3 Renan — "Salto Visionario"

**Identidade.** Co-fundador da Gzero, lidera as imersoes no Vale do Silicio; visionario que "enxerga o portal antes dos outros". Sprite: aura violeta `#7112ff`, **traco marcante = jaqueta com gola alta e um leve rastro de luz violeta nos pes**. Pose de `skill` = braco apontando para cima.

**Habilidade — double_jump.** Pulo inicial **mais alto** que o padrao + **um pulo extra no ar** (double jump). Ao usar o segundo pulo, **revela temporariamente portais e segredos ocultos** no raio da camera (tiles `secret` ganham contorno violeta brilhante).

```ts
export interface DoubleJumpParams {
  firstJumpVel: number;        // velocidade do 1o pulo (sobrescreve JUMP_VEL)
  secondJumpVel: number;       // velocidade do 2o pulo (no ar)
  maxAirJumps: number;         // quantos pulos extras no ar
  revealRadiusTiles: number;   // raio de revelacao de segredos (em tiles)
  revealDurationFrames: number;// quanto tempo segredos ficam destacados
}
```

| Parametro | Valor | Justificativa |
|---|---|---|
| `firstJumpVel` | **-16.3** (= -15.4 × 1.06) | salto base ~6% mais alto |
| `secondJumpVel` | **-13.0** | 2o pulo um pouco menor que o 1o (evita "voar") |
| `maxAirJumps` | **1** | exatamente um pulo extra |
| `revealRadiusTiles` | **6** | ~288 px — cobre quase a tela cheia (960/48=20 tiles) na metade vertical |
| `revealDurationFrames` | **150** (~2,5 s) | tempo de ler o segredo e agir |
| `trigger` | `air_press` | toque no botao de pulo enquanto `airJumpsLeft > 0` |
| `cooldownFrames` | **0** | recarrega ao tocar o solo (`onGround` reseta `airJumpsLeft`) |
| `heartGainOnUse` | **+8** | usar o 2o pulo para revelar segredo enche o medidor |
| `heartCostOnUse` | **0** | gratuito |

**Pseudo-codigo do input (resolucao do pulo):**

```ts
function onJumpPressed(p: Player) {
  const coyoteOk = p.coyoteTimer > 0;          // COYOTE=7
  const grounded = p.onGround || coyoteOk;
  if (grounded) {
    p.vy = ability.params.firstJumpVel;        // -16.3
    p.airJumpsLeft = ability.params.maxAirJumps; // 1
  } else if (p.airJumpsLeft > 0) {
    p.vy = ability.params.secondJumpVel;       // -13.0
    p.airJumpsLeft--;
    revealSecrets(p.x, p.y, params.revealRadiusTiles, params.revealDurationFrames);
    addHeart(ability.heartGainOnUse);          // +8
    spawnParticles('violet_ring', p.pos);      // anel violeta
  }
  // se nem solo nem air-jump: nada (jump_buffer ja tratado no update)
}
function onLand(p: Player) { p.airJumpsLeft = params.maxAirJumps; } // recarrega no chao
```

**Balanceamento.** O double jump eleva o teto de altura util de ~1,5 tile (pulo unico padrao) para ~2,6 tiles efetivos. Para manter desafio, fases-Renan (secao 7) usam vaos de 3+ tiles e segredos que **so** sao alcancaveis com o 2o pulo, sem quebrar fases de outros personagens (que usam rotas alternativas mais longas). Risco controlado: o 2o pulo nao reativa enquanto no ar (`maxAirJumps=1`), evitando voo infinito.

---

### 5.4 Dante — "Dash Criativo"

**Identidade.** Co-fundador, energia criativa "que avanca e quebra o obstaculo". Sprite: aura lima `#cdf140`, **traco marcante = oculos esportivos e rastro de linhas de velocidade lima**. Pose de `skill` = inclinado para frente.

**Habilidade — dash.** Investida horizontal rapida e curta. Concede **i-frames** (invencibilidade a dano) durante a investida, **quebra blocos `brick`** no caminho e **derrota inimigos "Tolo"** por contato frontal (sem precisar pisar). Dirigivel: usa a direcao atual do d-pad.

```ts
export interface DashParams {
  dashSpeed: number;          // velocidade horizontal durante o dash
  dashFrames: number;         // duracao do impulso
  iFrames: number;            // invencibilidade a dano durante/apos
  breaksBrick: boolean;       // quebra tiles 'brick'
  killsEnemiesOnContact: boolean;
  postDashFriction: number;   // desaceleracao ao final (multiplica vx)
  endControlLockFrames: number; // breve trava de input pos-dash
}
```

| Parametro | Valor | Justificativa |
|---|---|---|
| `dashSpeed` | **12.0** | ~1,64× o `RUN_MAX` (7.3) — claramente "super" |
| `dashFrames` | **12** (~0,2 s) | curto e nervoso |
| `iFrames` | **16** (~0,27 s) | cobre o dash + 4 f de margem |
| `breaksBrick` | `true` | quebra parede de tijolos para abrir atalhos |
| `killsEnemiesOnContact` | `true` (so "Tolo"/inimigo comum; **nao** chefe) | nao trivializa a Esfinge (ver secao 3/8) |
| `postDashFriction` | **0.80** | preserva ~80% da vx ao terminar (sensacao de momentum) |
| `endControlLockFrames` | **4** | micro-pausa para leitura, sem travar |
| `trigger` | `double_tap` (← ← ou → →) **ou** botao habilidade + direcao | janela de duplo toque = 14 f |
| `cooldownFrames` | **48** (~0,8 s) | impede spam continuo de travessia |
| `durationFrames` | **12** | = `dashFrames` |
| `heartGainOnUse` | **+5** por uso; **+10** se matar inimigo no dash | recompensa uso ofensivo |
| `heartCostOnUse` | **0** | — |

**Pseudo-codigo:**

```ts
function tryDash(p: Player, dir: -1 | 1) {
  if (p.skillCooldown > 0) return;
  p.skillState = 'dashing';
  p.dashTimer = params.dashFrames;       // 12
  p.iframeTimer = params.iFrames;        // 16
  p.facing = dir;
  p.skillCooldown = ability.cooldownFrames; // 48
  addHeart(ability.heartGainOnUse);      // +5
}

function updateDash(p: Player) {
  if (p.dashTimer > 0) {
    p.vx = params.dashSpeed * p.facing;  // 12 * dir
    if (params.breaksBrick) breakBricksInPath(p);
    if (params.killsEnemiesOnContact)
      killOverlappingEnemies(p, onKill = () => addHeart(5)); // +5 extra
    p.dashTimer--;
    if (p.dashTimer === 0) {
      p.skillState = 'recover';
      p.controlLock = params.endControlLockFrames; // 4
    }
  } else if (p.skillState === 'recover') {
    p.vx *= params.postDashFriction;     // 0.80
  }
}
```

**Balanceamento.** Dash de 12 f a 12 px/f cobre ~144 px (3 tiles) por uso. Cooldown de 48 f impede encadear dashes para zerar vaos enormes (max ~3 tiles + impulso). i-frames so 16 f: o jogador pode atravessar **um** projetil, nao spray continuo. Quebrar `brick` so abre atalhos opcionais; nunca destroi geometria critica (`ground`/`block` sao indestrutiveis por dash — ver tabela de tiles na secao 4).

---

### 5.5 Julio — "Escudo de Governanca"

**Identidade.** Rosto da doutrina e do pitch; "os guardrails que mantem a IA no lugar certo". Sprite: aura azul `#0099ff`, **traco marcante = mantto/escudo hexagonal nas costas** que materializa em frente ao usar. Pose de `skill` = postura defensiva, braco erguido com escudo. Tem **4 corações** (tanque).

**Habilidade — shield.** Enquanto **segurar** o botao, projeta um **escudo frontal** que: (a) **bloqueia 100% do dano** vindo da frente (contato e projeteis); (b) **reflete projeteis** de volta (vira ataque); (c) reduz velocidade enquanto ativo (peso do guardrail). Consome **stamina de escudo** que recarrega quando solto.

```ts
export interface ShieldParams {
  staminaMax: number;          // capacidade do escudo (frames de uso)
  staminaDrainPerFrame: number;// gasto por frame ativo
  staminaRegenPerFrame: number;// recuperacao quando inativo
  moveSpeedMulWhileActive: number; // penalidade de movimento
  reflectsProjectiles: boolean;
  blockArcDegrees: number;     // arco frontal protegido
  chipDamage: number;          // dano que vaza (0 = bloqueio total)
}
```

| Parametro | Valor | Justificativa |
|---|---|---|
| `staminaMax` | **180** (~3 s contínuos) | recurso significativo, mas finito |
| `staminaDrainPerFrame` | **1** | 180 f de uso total |
| `staminaRegenPerFrame` | **1.5** | recarga total em ~120 f (~2 s) quando solto |
| `moveSpeedMulWhileActive` | **0.55** | move-se ~45% mais devagar com escudo erguido |
| `reflectsProjectiles` | `true` | projetil refletido vira dano ao inimigo (speed 8.5) |
| `blockArcDegrees` | **160** | cobre a frente ampla, mas costas ficam expostas |
| `chipDamage` | **0** | bloqueio frontal eh total (escolha: defensivo confiavel) |
| `trigger` | `hold` (botao habilidade) | mantem enquanto segurar + houver stamina |
| `cooldownFrames` | **90** (~1,5 s) **apenas se a stamina zerar** ("escudo quebra") | penalidade por exaustao |
| `durationFrames` | dinamico (= enquanto `staminaCur > 0` e botao segurado) | — |
| `heartGainOnUse` | **+6** ao bloquear/refletir um ataque (nao por segurar) | recompensa defesa ativa |
| `heartCostOnUse` | **0** | usa stamina propria, nao o medidor HUMANWARE |

**Pseudo-codigo:**

```ts
function updateShield(p: Player, holding: boolean) {
  if (p.shieldBroken) {                       // escudo quebrado
    p.skillCooldown--;
    if (p.skillCooldown <= 0) { p.shieldBroken = false; p.shieldStamina = params.staminaMax; }
    return;
  }
  if (holding && p.shieldStamina > 0) {
    p.shieldActive = true;
    p.shieldStamina -= params.staminaDrainPerFrame;     // -1/f
    p.speedMul = params.moveSpeedMulWhileActive;        // 0.55
    if (p.shieldStamina <= 0) { p.shieldActive = false; p.shieldBroken = true; p.skillCooldown = ability.cooldownFrames; }
  } else {
    p.shieldActive = false;
    p.speedMul = 1;
    p.shieldStamina = min(params.staminaMax, p.shieldStamina + params.staminaRegenPerFrame); // +1.5/f
  }
}

// no resolvedor de dano:
function onIncomingDamage(p: Player, src: DamageSource) {
  if (p.shieldActive && withinArc(src.dir, p.facing, params.blockArcDegrees)) {
    addHeart(6);
    if (src.type === 'projectile' && params.reflectsProjectiles) reflectProjectile(src); // vira ataque
    return; // dano anulado (chipDamage=0)
  }
  applyDamage(p, src);
}
```

**Balanceamento.** O escudo eh **frontal e direcional** (160°): inimigos pelas costas/cima ainda acertam, exigindo posicionamento. Stamina finita (180 f) + quebra punitiva (90 f sem escudo) impedem "tartaruga" eterna. Reflexao premia leitura de timing contra os atiradores. Os 4 corações de Julio compensam a lentidao base e o fazem o personagem ideal para zonas de "muito projetil" (ex.: fase-desafio JPMorgan/governanca, secao 7).

---

### 5.6 Artur — "Builder"

**Identidade.** O usuario; dono da marca e builder. "Cria a ferramenta/plataforma que ainda nao existe." Sprite: aura pink operacional `#ff0055`, **traco marcante = capacete/visor de builder e um cubo de wireframe magenta que ele saca**. Pose de `skill` = jogando o cubo no chao/ar. Eh o **baseline neutro** de stats.

**Habilidade — build.** Materializa uma **plataforma solida temporaria** (1×1 tile) na posicao a frente do jogador (ou sob os pes, se no ar e sem chao abaixo). A plataforma eh **solida por cima** (`platform` da base — atravessa por baixo, pisa por cima) e some apos a duracao. Permite o jogador criar a propria rota.

```ts
export interface BuildParams {
  platformLifeFrames: number;  // tempo de vida da plataforma
  maxActivePlatforms: number;  // quantas podem existir ao mesmo tempo
  placeOffsetTiles: number;    // a quantos tiles a frente nasce
  placeBelowWhenAirborne: boolean; // se no ar, nasce sob os pes
  snapToGrid: boolean;         // alinha ao grid de TILE=48
  platformWidthTiles: number;
  platformHeightTiles: number;
}
```

| Parametro | Valor | Justificativa |
|---|---|---|
| `platformLifeFrames` | **180** (~3 s) | tempo de usar e seguir; nao vira escada permanente |
| `maxActivePlatforms` | **2** | duas plataformas = uma "ponte" de 2 saltos; a 3a recicla a mais antiga |
| `placeOffsetTiles` | **1** | nasce 1 tile a frente, na altura do jogador |
| `placeBelowWhenAirborne` | `true` | "Builder" salva queda criando piso sob os pes |
| `snapToGrid` | `true` | alinha ao grid (encaixe limpo no level) |
| `platformWidthTiles` | **1** | 48 px de largura |
| `platformHeightTiles` | **1** | 48 px |
| `trigger` | `press` (botao habilidade) | — |
| `cooldownFrames` | **120** (~2 s) | impede criar piso continuo / escalar infinito |
| `durationFrames` | 0 (a criacao eh instantanea; a plataforma tem vida propria) | — |
| `heartGainOnUse` | **+7** ao criar uma plataforma que eh efetivamente pisada (sensor) | recompensa uso pratico, nao spam |
| `heartCostOnUse` | **0** | — |

**Pseudo-codigo:**

```ts
function tryBuild(p: Player) {
  if (p.skillCooldown > 0) return;
  let col, row;
  if (!p.onGround && params.placeBelowWhenAirborne) {
    col = worldToTile(p.x).col;
    row = worldToTile(p.y + p.h + TILE/2).row;   // sob os pes
  } else {
    col = worldToTile(p.x).col + p.facing * params.placeOffsetTiles;
    row = worldToTile(p.y + p.h/2).row;          // na altura do tronco
  }
  if (isOccupied(col, row)) return;               // nao sobrepoe geometria
  if (p.builtPlatforms.length >= params.maxActivePlatforms)
    removeOldest(p.builtPlatforms);               // recicla a mais antiga
  const plat = spawnTempPlatform(col, row, params.platformLifeFrames); // tile 'platform'
  p.builtPlatforms.push(plat);
  p.skillCooldown = ability.cooldownFrames;       // 120
  // heartGain disparado pelo sensor quando o player pisa nela (ver onPlatformStood)
}

function updateBuiltPlatforms(p: Player) {
  for (const plat of p.builtPlatforms) {
    plat.life--;
    if (plat.life <= 18) plat.blink = true;       // pisca antes de sumir (18 f de aviso)
    if (plat.stoodOn && !plat.creditedHeart) { addHeart(7); plat.creditedHeart = true; }
    if (plat.life <= 0) { removeTile(plat); p.builtPlatforms.remove(plat); }
  }
}
```

**Balanceamento.** Max 2 plataformas + cooldown de 120 f + vida de 180 f = no maximo ~2 saltos extras por ciclo, com aviso visual (pisca 18 f antes de sumir). Como Artur eh o baseline neutro de stats, sua forca eh **flexibilidade de rota**, nao stats — ele "resolve" qualquer fase, mas mais devagar que especialistas. Plataformas nunca nascem sobre geometria ocupada (`isOccupied`), evitando exploits de empurrar inimigos/atravessar paredes.

---

### 5.7 Einstein — "E=mc2"

**Identidade.** Apelido do **pai do Renan**; o genio/mentor de cabelo branco e oculos. "Dobra o tempo com a mente." Sprite: aura magenta-classic `#f43db3`, **traco marcante = cabelo branco eletrico e oculos redondos**; ao usar, formula `E=mc²` aparece em particulas. Pose de `skill` = mao na cabeça, concentrado. Personagem **fragil** (2 corações, mais lento).

**Habilidade — time_slow.** Desacelera **o mundo** (inimigos, projeteis, plataformas moveis, particulas) por um tempo, **enquanto o jogador mantem velocidade normal** — uma "bullet time" individual. Distinto do Modo HUMANWARE global (secao 6): o time_slow eh a **Super Skill pessoal** de Einstein, com cooldown proprio, e nao congela "Tolos" — apenas desacelera todo o mundo de forma uniforme.

```ts
export interface TimeSlowParams {
  worldTimeScale: number;      // fator de tempo do mundo (1 = normal)
  playerTimeScale: number;     // fator de tempo do jogador
  durationFrames: number;      // duracao em frames de TEMPO REAL
  affectsProjectiles: boolean;
  affectsEnemies: boolean;
  affectsMovingPlatforms: boolean;
  vignetteColor: string;       // overlay visual
}
```

| Parametro | Valor | Justificativa |
|---|---|---|
| `worldTimeScale` | **0.35** | mundo a 35% da velocidade (forte, mas legivel) |
| `playerTimeScale` | **1.0** | jogador em velocidade plena |
| `durationFrames` | **150** (~2,5 s em tempo real) | janela generosa para uma manobra dificil |
| `affectsProjectiles` | `true` | atravessar cortinas de projeteis |
| `affectsEnemies` | `true` | passar por patrulhas |
| `affectsMovingPlatforms` | `true` | timing de plataformas se torna trivial na janela |
| `vignetteColor` | `#f43db3` a 18% alpha | feedback claro de "tempo dobrado" |
| `trigger` | `press` (botao habilidade) | — |
| `cooldownFrames` | **300** (~5 s) | a habilidade mais forte = o maior cooldown |
| `durationFrames` (spec) | **150** | = acima |
| `heartGainOnUse` | **+10** | uso correto enche bastante o medidor |
| `heartCostOnUse` | **0** | — |

**Pseudo-codigo (motor de tempo):** o loop principal passa a aplicar dois deltas distintos.

```ts
// AbilitySystem expoe dois fatores que o gameloop le todo frame:
let worldTimeScale = 1.0;
let playerTimeScale = 1.0;

function tryTimeSlow(p: Player) {
  if (p.skillCooldown > 0) return;
  einstein.timeSlowTimer = params.durationFrames; // 150 (tempo real)
  worldTimeScale = params.worldTimeScale;         // 0.35
  playerTimeScale = params.playerTimeScale;       // 1.0
  p.skillCooldown = ability.cooldownFrames;       // 300
  addHeart(10);
  spawnFormulaParticles(p.pos);                   // "E=mc²"
}

function updateTime(p: Player) {
  if (einstein.timeSlowTimer > 0) {
    einstein.timeSlowTimer--;                      // conta em tempo real
    if (einstein.timeSlowTimer === 0) { worldTimeScale = 1; playerTimeScale = 1; }
  }
}

// no gameloop:
updateEnemies(dtBase * worldTimeScale);
updateProjectiles(dtBase * worldTimeScale);
updateMovingPlatforms(dtBase * worldTimeScale);
updateParticles(dtBase * worldTimeScale);
updatePlayer(dtBase * playerTimeScale);            // jogador imune ao slow
```

**Interacao com HUMANWARE (importante, sem contradicao com secao 6):** se o **Modo HUMANWARE** global ja estiver ativo (que tambem desacelera o mundo), os fatores **nao se multiplicam infinitamente** — aplica-se o **menor `worldTimeScale` vigente** (`Math.min`), e a duracao do time_slow continua contando em tempo real. Assim Einstein nunca "trava" o jogo em ~0.

**Balanceamento.** Cooldown longo (300 f) + personagem fragil (2 corações) tornam o time_slow um recurso de **planejamento**, nao de spam. Como o jogador anda em velocidade plena enquanto tudo desacelera, secoes "impossiveis" de timing viram resolviveis — por isso Einstein eh o personagem-chave de fases de precisao/projetil-denso (secao 7), pagando com fragilidade.

---

### 5.8 Tabela mestre de balanceamento (todas as habilidades)

| Habilidade | Trigger | Cooldown (f / ms) | Duracao (f / ms) | Custo | Ganho de coracao | Limite anti-abuso |
|---|---|---|---|---|---|---|
| Salto Visionario | air_press | 0 / reset no chao | instant. | — | +8 (revela segredo) | `maxAirJumps=1` |
| Dash Criativo | double_tap dir | 48 / 800 | 12 / 200 | — | +5 (+5 por kill) | i-frames so 16 f |
| Escudo de Governanca | hold | 90 / 1500 (so se quebrar) | dinamica (stamina 180 f) | stamina propria | +6 por bloqueio | arco 160°, regen 1.5/f |
| Builder | press | 120 / 2000 | 180 f de vida/plataforma | — | +7 (se pisada) | max 2 plataformas |
| E=mc2 | press | 300 / 5000 | 150 / 2500 | — | +10 | min() com HUMANWARE |

Constantes de tuning centralizadas (uma fonte de verdade):

```ts
// src/data/balance.ts — todos os numeros desta secao, editaveis sem tocar logica
export const ABILITY_BALANCE = {
  renan:    { firstJumpVel: -16.3, secondJumpVel: -13.0, maxAirJumps: 1, revealRadiusTiles: 6, revealDurationFrames: 150, cooldownFrames: 0,   heartGainOnUse: 8 },
  dante:    { dashSpeed: 12.0, dashFrames: 12, iFrames: 16, postDashFriction: 0.80, endControlLockFrames: 4, cooldownFrames: 48, heartGainOnUse: 5, heartGainOnKill: 5 },
  julio:    { staminaMax: 180, staminaDrainPerFrame: 1, staminaRegenPerFrame: 1.5, moveSpeedMulWhileActive: 0.55, blockArcDegrees: 160, chipDamage: 0, breakCooldownFrames: 90, heartGainOnBlock: 6 },
  artur:    { platformLifeFrames: 180, maxActivePlatforms: 2, placeOffsetTiles: 1, blinkWarnFrames: 18, cooldownFrames: 120, heartGainOnStood: 7 },
  einstein: { worldTimeScale: 0.35, playerTimeScale: 1.0, durationFrames: 150, cooldownFrames: 300, heartGainOnUse: 10 },
} as const;
```

---

### 5.9 Renante — companheiro de amplificacao

**Regra de ouro (decisao travada):** Renante (a IA, Renan+Dante) **NUNCA age sozinho**. Ele eh **opcional** e **so AMPLIFICA a habilidade atual do heroi** — coerente com a doutrina "IA amplifica, nao substitui o potencial humano" (secao 3). Visualmente eh um **pequeno orbe magenta** (`#e802cf`) que orbita o jogador; ao acoplar, ganha um anel da `signatureColor` do personagem ativo.

**Acoplamento.** Renante eh **toggle** (botao dedicado/menu). Quando acoplado:
- A habilidade do personagem ativo recebe um **modificador de amplificacao** (`RenanteAmp`).
- O **medidor HUMANWARE enche ~15% mais rapido** (Renante "amplifica a consciencia") — detalhe operacional; a logica do medidor vive na secao 6.
- Em troca, ha um **custo de fairness**: enquanto Renante esta acoplado, o **ganho de pontuacao de coleta cai 10%** (incentiva jogar com e sem ele; nao eh obrigatorio).

```ts
export interface RenanteAmp {
  /** texto curto do efeito (HUD/tooltip) */
  label: string;
  /** patch numerico aplicado por cima dos params base, so quando acoplado */
  patch: Partial<AbilityParams>;
}
```

**Amplificacao por personagem (concreta, sem ambiguidade):**

| Personagem | Habilidade | O que Renante AMPLIFICA | Patch numerico |
|---|---|---|---|
| **Renan** | Salto Visionario | +1 pulo aereo e raio de revelacao maior | `maxAirJumps: 2`, `revealRadiusTiles: 9`, `revealDurationFrames: 210` |
| **Dante** | Dash Criativo | dash mais longo e com mais i-frames | `dashFrames: 18`, `dashSpeed: 13.5`, `iFrames: 24` |
| **Julio** | Escudo de Governanca | escudo dura mais e cobre 360° (omnidirecional) | `staminaMax: 240`, `blockArcDegrees: 360`, `staminaRegenPerFrame: 2.0` |
| **Artur** | Builder | +1 plataforma simultanea e vida maior | `maxActivePlatforms: 3`, `platformLifeFrames: 240` |
| **Einstein** | E=mc2 | slow mais forte e mais longo | `worldTimeScale: 0.25`, `durationFrames: 210` |

**Regra de aplicacao (pseudo-codigo):** o patch eh **mesclado em runtime** sobre os params base; nada se duplica nos dados.

```ts
function resolveAbilityParams(char: CharacterDef, renanteAttached: boolean): AbilityParams {
  const base = char.ability.params;
  if (!renanteAttached) return base;
  return { ...base, ...char.ability.renante.patch }; // merge raso, patch vence
}
```

**Por que isso respeita a doutrina:** Renante **nao adiciona uma acao nova** (nao cria um ataque proprio, nao se move sozinho); ele apenas **escala parametros da Super Skill que o humano ja dispara**. Sem o jogador apertar o botao, Renante nao faz nada. Isso reforca "a IA amplifica, nao substitui" e "o estado de consciencia transforma tecnologia em potencia".

---

### 5.10 Lifecards e desbloqueio

Cada personagem (exceto o inicial) eh desbloqueado coletando sua **Lifecard** — um colecionavel especial escondido/recompensado nas fases (marca RPG da Gzero: "Lifecards", secao 3). A Lifecard eh persistida no save (localStorage).

```ts
export interface LifecardDef {
  characterId: CharacterId;
  /** onde a Lifecard pode ser obtida (referencia a fases — ver secao 7) */
  foundIn: { levelId: string; hint: string };
  /** estado runtime no save */
  collected: boolean;
}
```

**Mapa de desbloqueio (decisao travada):**

| Personagem | Estado inicial | Como desbloquear |
|---|---|---|
| **Renan** | **Desbloqueado** (`unlockedByDefault: true`) | personagem inicial — abre o jogo |
| **Dante** | Bloqueado | Lifecard no fim da **Zona 1** (segredo opcional acessivel a pe) |
| **Artur** | Bloqueado | Lifecard escondida na **Zona 2** (atras de parede de `brick` — qualquer um abre, mas obvio para Dante) |
| **Julio** | Bloqueado | Lifecard recompensa por **completar uma fase-desafio de cliente** (governanca/guardrails) |
| **Einstein** | Bloqueado | Lifecard atras de um **segredo alto** (incentiva o pulo de Renan revelar) na **Zona 3** |

**Estado de save (persistido):**

```ts
export interface RosterSaveState {
  unlocked: Record<CharacterId, boolean>; // { renan:true, dante:false, ... }
  lastSelected: CharacterId;              // default 'renan'
  renanteUnlocked: boolean;               // Renante tem sua propria Lifecard
}
// default no primeiro boot:
const DEFAULT_ROSTER: RosterSaveState = {
  unlocked: { renan: true, dante: false, julio: false, artur: false, einstein: false },
  lastSelected: 'renan',
  renanteUnlocked: false,
};
```

> **Renante** tambem eh desbloqueado por uma Lifecard propria (a "Lifecard RENANTE"), obtida apos reunir as **3 Transformacoes** parciais da primeira metade do jogo (gancho de lore, secao 3). Antes disso o toggle de companheiro aparece bloqueado na tela de selecao.

---

### 5.11 Tela de selecao de personagem — fluxo e UI

Estado de jogo dedicado: `select` (encaixa na maquina de estados da base, entre `title` e `playing` — ver secao 4). Estetica conforme direcao visual hibrida (fundo escuro `#09090b`, magenta de acao, pixel quadrado, sombras duras; fontes Outfit/Inter/mono UPPERCASE — secao 3 / tokens).

**Layout (960×528):**
- **Faixa superior:** logo `G0` branco (`G0_favcon_Vector.svg`) + label mono UPPERCASE "SELECIONE SEU HERANTE".
- **Carrossel central:** 5 cards horizontais (um por personagem). Card desbloqueado mostra **retrato key-art** (Higgsfield ou placeholder) + nome (Outfit) + papel (Inter) + 1 linha da habilidade (mono). Card bloqueado mostra **silhueta** com a `signatureColor` esmaecida + icone de **Lifecard ausente** + dica (`lifecard.foundIn.hint`).
- **Painel inferior direito:** **toggle RENANTE** (orbe magenta). Mostra, ao ligar, o texto de `renante.label` do personagem em foco (amplificacao especifica).
- **Rodape:** controles (mono UPPERCASE): `← →` navega, `ENTER/A` confirma, `R` liga/desliga Renante.

**Maquina de estados da tela (pseudo-codigo):**

```ts
type SelectScreenState = {
  cursor: number;           // 0..4 (indice do roster)
  renanteOn: boolean;
};

function updateSelect(s: SelectScreenState, input: Input, save: RosterSaveState) {
  if (input.pressed('left'))  s.cursor = (s.cursor + 4) % 5;
  if (input.pressed('right')) s.cursor = (s.cursor + 1) % 5;

  const char = ROSTER[s.cursor];
  const unlocked = save.unlocked[char.id];

  if (input.pressed('toggleRenante') && save.renanteUnlocked) s.renanteOn = !s.renanteOn;

  if (input.pressed('confirm')) {
    if (!unlocked) { playSfx('locked'); shakeCard(s.cursor); return; } // feedback "ainda bloqueado"
    save.lastSelected = char.id;
    startGame(char, { renanteAttached: s.renanteOn && save.renanteUnlocked });
  }
}
```

**Comportamento de foco:** ao mover o cursor, o card central faz **zoom-in com sombra dura** (offset 6 px na cor do personagem), toca um SFX curto, e o painel de habilidade faz **type-on** (mono) do texto. Cards bloqueados **nao** podem ser confirmados (feedback de "locked" + shake), mas mostram claramente **onde** achar a Lifecard — transformando a tela de selecao em um mini-mapa de progressao que puxa o jogador de volta as fases.

**Persistencia & retomada:** `lastSelected` reabre a tela com o cursor no ultimo heroi usado. Desbloqueios novos desde a ultima visita ganham um **badge "NOVO!"** (mono, lima `#cdf140`) ate serem vistos uma vez.

---

### 5.12 Exemplo de dado completo (Dante)

Exemplo end-to-end mostrando como um `CharacterDef` se materializa nos dados (placeholder de arte agora, troca pelo Higgsfield depois — pipeline 2):

```ts
export const DANTE: CharacterDef = {
  id: 'dante',
  name: 'Dante',
  role: 'Co-fundador',
  signatureColor: '#cdf140',   // lima
  accentColor: '#f43db3',
  stats: { walkMaxMul: 1.06, runMaxMul: 1.08, accelMul: 1.10, jumpVelMul: 0.98, weightMul: 1.0, hpMax: 3 },
  ability: {
    kind: 'dash',
    trigger: 'double_tap',
    cooldownFrames: 48,
    durationFrames: 12,
    heartGainOnUse: 5,
    heartCostOnUse: 0,
    params: {
      dashSpeed: 12.0, dashFrames: 12, iFrames: 16,
      breaksBrick: true, killsEnemiesOnContact: true,
      postDashFriction: 0.80, endControlLockFrames: 4,
    } as DashParams,
    renante: {
      label: 'RENANTE: dash +50% alcance e i-frames',
      patch: { dashFrames: 18, dashSpeed: 13.5, iFrames: 24 } as Partial<DashParams>,
    },
  },
  lifecard: { characterId: 'dante', foundIn: { levelId: 'zona-1', hint: 'Segredo no fim da Zona 1' }, collected: false },
  spriteSheet: 'assets/sprites/dante.placeholder.png',
  portrait: 'assets/portraits/dante.placeholder.png',
  unlockedByDefault: false,
};
```

Os outros quatro `CharacterDef` seguem identicamente o mesmo esqueleto, trocando `stats`, `params` e `renante.patch` pelos valores das tabelas 5.2–5.9. Isso fecha o contrato data-driven: **gameplay le dados, dados nao contem logica** — coerente com a stack e o design data-driven definidos no CONTEXTO.

---

## 6. Superpoder Humanware

> Doutrina-âncora desta seção (citada literalmente ao longo do design): "IA amplifica, não substitui o potencial humano"; HUMANWARE = "tecnologias nativas humanas; o caminho do coração"; "um tolo com uma ferramenta continua sendo um tolo — e o estado de consciência que transforma tecnologia em potência".

O **Superpoder Humanware** é o sistema-coração do jogo: o mecanismo que dá identidade temática a *Gravidade Zero — O Jogo* e amarra mecânica e lore. Ele é **igual para todos os personagens jogáveis** (ver seção do roster / habilidades — o que muda por personagem é a *habilidade base* amplificada, não o Humanware em si). É um medidor de **consciência/coração** que enche conforme o herói age "no caminho do coração" e, quando cheio, libera o **Modo Humanware**: um estado temporário em que "o estado de consciência transforma tecnologia em potência" — o mundo desacelera, os inimigos "Tolo com a Ferramenta" congelam, e a ferramenta/habilidade do herói vira potência turbinada.

Esta seção especifica: o modelo do medidor (fontes, taxas, decaimento, cap), a ativação, os efeitos numéricos do Modo, duração, cooldown, feedback audiovisual, amarração doutrinária e a representação no HUD (medidor de coração). Os números são declarados em **frames a 60 FPS** (o loop é `requestAnimationFrame` da base) e em **unidades de física da base** (TILE=48, ver CONSTANTES DE FÍSICA no contexto). Todos os valores abaixo são **decisões travadas** — sem placeholders.

---

### 6.1. Visão geral e princípios de design

| Princípio | Decisão de design |
|---|---|
| **Recompensa o "caminho do coração"** | O medidor enche mais ao *agir bem* (stomp limpo, resgate de fase, ajudar Renante) do que ao simplesmente coletar moedas. Coletar enche pouco; jogar com intenção enche muito. |
| **Não é botão de pânico infinito** | Cap rígido, decaimento fora de combate e cooldown impedem spam. É um *momento*, não um estado permanente. |
| **Universal, não por personagem** | Toda a fórmula do medidor é idêntica para Renan/Dante/Julio/Artur/Einstein. A *expressão* do Modo muda porque amplifica a habilidade base de cada um (seção do roster). |
| **Data-driven** | Todos os números vivem em `humanware.config.ts` (ver 6.10), carregado como dado. Designers ajustam sem tocar na lógica. |
| **Diegético** | O medidor é literalmente um coração na HUD; o Modo é "consciência unificada" temporária — alinhado à meta de jogo (reunir as 3 Transformações → Consciência Unificada). O Humanware é a *prévia jogável* dessa Consciência. |

---

### 6.2. Modelo do medidor (Heart Meter)

O medidor é um valor escalar contínuo `meter ∈ [0, METER_MAX]`.

#### 6.2.1. Capacidade (cap) e segmentação

| Constante | Valor | Racional |
|---|---|---|
| `METER_MAX` | **1000** | Unidade interna abstrata (não exibida ao jogador como número; vira 4 batidas/segmentos no HUD). |
| `SEGMENTS` | **4** | O coração tem 4 "batidas" visuais de 250 cada. Dá legibilidade de progresso sem texto. |
| `ACTIVATION_THRESHOLD` | **1000** (= 100%, 4/4 segmentos) | O Modo só ativa com o coração **cheio**. Não há ativação parcial. |
| `OVERFILL` | **não permitido** | Excedente acima de `METER_MAX` é descartado (clamp). |

> Decisão: o medidor enche em unidades, mas o HUD pensa em 4 segmentos de 250. Isso permite micro-feedback (cada ação dá um "pedaço" de batida) e macro-feedback (segmento cheio "trava" com flash).

#### 6.2.2. Fontes de enchimento (gain)

Cada evento de jogo concede `+gain` ao medidor. Valores em unidades (cap 1000). Pensados para que **uma fase normal** encha o coração ~2 a 3 vezes se jogada bem.

| Fonte (evento) | Ganho | Categoria | Observação |
|---|---:|---|---|
| Stomp em inimigo "Tolo" (normal) | **+60** | Ação | A ação heroica central. |
| Stomp em cadeia (combo, por inimigo extra no mesmo pulo) | **+90** | Ação | Bônus crescente: 2º inimigo +90, 3º +120 (ver 6.2.3). |
| Resolver mini-enigma da Esfinge / interruptor de zona | **+250** | Ação (grande) | "Reparar zona" = 1 segmento inteiro. |
| Coletar **Lifecard** de personagem | **+500** | Marco | Meio coração de uma vez (também desbloqueia personagem, ver roster). |
| Coletar moeda | **+8** | Coleta | Coleta enche pouco — de propósito (doutrina: agir > acumular). |
| Coletar item (cogumelo/equivalente, item 30px) | **+40** | Coleta | |
| Power-up Estrela coletado (STAR_TIME) | **+30** | Coleta | Estrela e Humanware coexistem (ver 6.7). |
| Bloco com bump revelando moeda/segredo | **+15** | Exploração | |
| Quebrar brick com intenção (Dash do Dante / Builder do Artur) | **+12** | Exploração | Recompensa uso de habilidade no level. |
| Renante (companheiro) presente e ativo | **×1.20** multiplicador | Modificador | Renante "amplifica": multiplica TODO gain por 1.20 (doutrina: IA amplifica). |
| Sem dano por 10s contínuos ("fluxo do coração") | **+5/s** (drip) | Passiva | Recompensa jogo limpo; some ao tomar dano. |
| Chegar ao goal (coluna 160) | **+250** | Marco | |

**Modificador Renante (companheiro opcional):** quando Renante está equipado e vivo, todo ganho é multiplicado por `RENANTE_GAIN_MULT = 1.20`. Isto é a tradução mecânica direta de "Renante só AMPLIFICA, nunca age sozinho": ele não enche o medidor por conta própria — ele *amplifica o que o herói faz*.

#### 6.2.3. Combo de stomp (cadeia)

Stomps consecutivos sem tocar o chão formam combo. O ganho escala:

```
gainStomp(comboIndex) = 60 + 30 * comboIndex   // comboIndex começa em 0
// 1º stomp: 60 | 2º: 90 | 3º: 120 | 4º+: 150 (cap por stomp)
```

- `STOMP_COMBO_WINDOW = 0` toques no chão (o combo só vive enquanto o player está no ar via `STOMP_BOUNCE = -11.5`).
- Cap por stomp individual: `STOMP_GAIN_CAP = 150`.
- O combo dá também feedback visual (ver 6.8) com texto flutuante `+60`, `+90`, `COMBO x3`.

#### 6.2.4. Decaimento (decay)

O medidor **não** decai durante combate ativo, mas decai fora dele para reforçar "agir continuamente".

| Estado | Regra de decaimento |
|---|---|
| **Em combate** (qualquer fonte de gain nos últimos `COMBAT_GRACE = 180` frames / 3s) | Decay = **0**. |
| **Fora de combate** (sem gain há > 3s) | `DECAY_RATE = 12 / segundo` (0.2 por frame a 60fps). |
| **Coração cheio (100%) e Modo NÃO ativado** | Decay = **0** (segura o cheio indefinidamente até o jogador ativar — recompensa quem encheu). |
| **Durante o Modo Humanware** | O medidor é a *barra de duração* do Modo: drena de 1000→0 (ver 6.5), ignorando regras de gain/decay normais. |
| **Após dano sofrido** | Penalidade instantânea: `-150` (ver 6.2.5). |

```
// pseudo, por frame
if (mode.active) { /* gerido pelo timer do Modo, ver 6.5 */ }
else {
  framesSinceGain++;
  const full = meter >= METER_MAX;
  const outOfCombat = framesSinceGain > COMBAT_GRACE; // 180
  if (outOfCombat && !full) meter -= DECAY_PER_FRAME;  // 0.2
  meter = clamp(meter, 0, METER_MAX);
}
```

#### 6.2.5. Penalidade de dano

Tomar dano contradiz "o caminho do coração", então custa medidor:

| Evento | Custo |
|---|---:|
| Tomar dano de inimigo/projétil | **-150** |
| Cair em buraco (morte) | medidor zera ao respawn (`meter = 0`) |
| Dano bloqueado pelo "Escudo de Governança" (Julio) | **0** (escudo protege também o coração — sinergia de roster) |

Stomp e dano nunca acontecem no mesmo frame (stomp tem prioridade pela física da base). O drip passivo "+5/s" (6.2.2) reinicia seu contador ao tomar dano.

---

### 6.3. Tabela-resumo de constantes do medidor

| Constante | Valor | Unidade |
|---|---:|---|
| `METER_MAX` | 1000 | unidades |
| `SEGMENTS` | 4 | segmentos (250 cada) |
| `ACTIVATION_THRESHOLD` | 1000 | unidades (100%) |
| `COMBAT_GRACE` | 180 | frames (3.0 s) |
| `DECAY_RATE` | 12 | unidades/s |
| `DECAY_PER_FRAME` | 0.2 | unidades/frame |
| `DAMAGE_PENALTY` | 150 | unidades |
| `RENANTE_GAIN_MULT` | 1.20 | multiplicador |
| `STOMP_GAIN_BASE` | 60 | unidades |
| `STOMP_GAIN_STEP` | 30 | unidades/combo |
| `STOMP_GAIN_CAP` | 150 | unidades |
| `FLOW_DRIP` | 5 | unidades/s (após 10s sem dano) |
| `FLOW_DRIP_DELAY` | 600 | frames (10 s) |

---

### 6.4. Ativação do Modo Humanware

#### 6.4.1. Condições

1. `meter >= ACTIVATION_THRESHOLD` (coração 4/4 cheio).
2. `cooldownRemaining === 0` (ver 6.6).
3. Estado de jogo `playing` (não em title/win/over/loading).
4. Player não está em `dead`/`respawning`.

#### 6.4.2. Input

- **Tecla dedicada:** `H` (teclado). Padrão data-driven e remapeável.
- **Gamepad:** botão `RB` / `R1` (shoulder direito), ou `Y`/`Triângulo` como alternativa.
- **Mobile (build single-file/touch):** botão de coração na HUD (toque).
- Buffer de input de `HW_BUFFER = 8` frames (reusa o conceito de `JUMP_BUFFER=8` da base): se o jogador apertar H no frame em que o medidor cruza 1000, ativa imediatamente.

#### 6.4.3. Sequência de ativação (handshake audiovisual)

Ao ativar há um **freeze-frame de impacto** antes do slow-motion entrar — o "respiro" dramático.

```
ACTIVATION_FREEZE = 12 frames   // congela TUDO (0.2s), tela com flash magenta
ACTIVATION_RAMP   = 18 frames   // time-scale interpola de 1.0 -> HW_TIME_SCALE
```

Linha do tempo da ativação:
- **f0:** input aceito → consome o cheio, dispara freeze-frame de 12 frames.
- **f0–f12:** mundo 100% parado; flash de tela magenta (#ff0055) com vinheta; toca o stinger "consciência". Aparece a frase de doutrina (ver 6.7).
- **f12–f30:** time-scale faz easing de 1.0 → 0.35 (entrada do slow-mo), inimigos Tolo começam a congelar, herói ganha aura.
- **f30+:** Modo plenamente ativo; começa a drenar a duração.

```ts
function tryActivateHumanware(state: GameState, input: Input): boolean {
  const hw = state.humanware;
  if (state.phase !== 'playing') return false;
  if (hw.active) return false;
  if (hw.cooldownRemaining > 0) return false;
  if (hw.meter < ACTIVATION_THRESHOLD) return false;
  if (!input.pressedBuffered('humanware', HW_BUFFER)) return false;

  hw.active = true;
  hw.meter = METER_MAX;          // garante cheio
  hw.duration = HW_DURATION;     // 360 frames (ver 6.5)
  hw.freeze = ACTIVATION_FREEZE; // 12
  hw.ramp = ACTIVATION_RAMP;     // 18
  state.timeScale = 1.0;         // ainda 1.0 durante o freeze
  fx.flash('#ff0055', 12);
  audio.play('hw_activate');     // stinger
  hud.showDoctrine('TECNOLOGIA → POTÊNCIA');
  return true;
}
```

---

### 6.5. Efeitos do Modo Humanware

O Modo dura `HW_DURATION = 360` frames (**6.0 segundos de tempo real**, medidos no relógio de parede, *não* no tempo de jogo desacelerado). Durante esses 6s reais, o medidor 1000→0 atua como **barra de duração** (drena linear).

#### 6.5.1. Escala de tempo (slow-motion seletivo)

| Alvo | Time-scale durante o Modo | Efeito |
|---|---:|---|
| **Mundo** (inimigos, projéteis, partículas físicas, plataformas móveis) | `HW_TIME_SCALE = 0.35` | Tudo a 35% da velocidade — "mundo desacelera". |
| **Player** | `HW_PLAYER_SCALE = 1.0` (relativo ao tempo real) | O herói se move em **velocidade normal** dentro do mundo lento → sensação de hiper-rapidez relativa. |
| **Inimigos "Tolo com a Ferramenta"** | **0.0 (congelados)** | Congelam completamente (ver 6.5.2). |
| **Timer da fase (TIME_START=250)** | **pausado** | O relógio da fase não corre durante o Modo (premia uso tático). |
| **HUD / animações de UI** | 1.0 | UI sempre fluida. |

Implementação: o `update(dt)` do mundo recebe `dt * worldTimeScale`; o player recebe `dt * playerTimeScale`. Como o player roda a 1.0 e o mundo a 0.35, o herói efetivamente "anda ~2.86× mais rápido" que tudo ao redor, mantendo as constantes de física da base intactas (não mexemos em GRAVITY/JUMP_VEL — só no `dt` aplicado a cada grupo).

```ts
function updateWorld(state, realDt) {
  const hw = state.humanware;
  let worldScale = 1.0, playerScale = 1.0;
  if (hw.active) {
    if (hw.freeze > 0) { hw.freeze--; return; }      // freeze-frame total
    if (hw.ramp > 0) {                               // easing de entrada
      const t = 1 - hw.ramp / ACTIVATION_RAMP;
      worldScale = lerp(1.0, HW_TIME_SCALE, easeOut(t));
      hw.ramp--;
    } else {
      worldScale = HW_TIME_SCALE;                    // 0.35
    }
    playerScale = HW_PLAYER_SCALE;                   // 1.0
    // drena duração em TEMPO REAL (independe do slow-mo)
    hw.duration -= 1;
    hw.meter = (hw.duration / HW_DURATION) * METER_MAX;
    if (hw.duration <= 0) endHumanware(state);
  }
  updatePlayer(state.player, realDt * playerScale);
  for (const e of state.enemies) {
    if (hw.active && e.kind === 'tolo') continue;    // congelado
    updateEnemy(e, realDt * worldScale);
  }
  updateProjectiles(state, realDt * worldScale);
  updateParticles(state, realDt * worldScale);
}
```

#### 6.5.2. Congelar o "Tolo com a Ferramenta"

Inimigos com `kind === 'tolo'` (inimigo-tema do contexto) **congelam por completo** durante o Modo:

- `velocity = 0`, animação pausada no frame atual, projéteis que eles dispararam também congelam (time-scale 0).
- Recebem sombreamento congelado: overlay azul-neon (#0099ff) translúcido + leve cristalização (partículas estáticas de gelo/dados).
- **Continuam vulneráveis**: o herói (em velocidade normal) pode fazer stomp/atravessar em sequência. Stomp em Tolo congelado dá ganho normal mas **não** reabastece o medidor durante o Modo (o medidor está em modo-duração) — em vez disso concede **tempo extra**: `+10 frames` de duração por Tolo derrotado, cap `+90 frames` (1.5s) por ativação (`HW_EXTEND_PER_KILL = 10`, `HW_EXTEND_CAP = 90`). Isso cria o loop "limpe a sala enquanto eles estão congelados".
- Inimigos **não-Tolo** (se houver outros arquétipos) apenas desaceleram (0.35), não congelam — reforça que o Humanware é *especificamente* a resposta ao Tolo (doutrina: "um tolo com uma ferramenta continua sendo um tolo").

#### 6.5.3. Ferramenta → Potência (amplificação da habilidade base)

Durante o Modo, a habilidade base do personagem ativo (seção do roster) é **turbinada**. O Humanware não substitui a habilidade — ele a amplifica (doutrina: "IA amplifica, não substitui").

| Personagem | Habilidade base | Potência no Modo Humanware |
|---|---|---|
| **Renan** — Salto Visionário | Pulo alto/duplo, revela segredos | Pulo **triplo** + raio de revelação dobrado; portais/segredos brilham na tela inteira. |
| **Dante** — Dash Criativo | Investida que quebra obstáculos | Dash atravessa **qualquer** brick/block e dá dano em linha; sem cooldown durante o Modo. |
| **Julio** — Escudo de Governança | Bloqueia dano | Escudo vira **aura ofensiva**: reflete projéteis e destrói Tolos no contato; invulnerabilidade total. |
| **Artur** — Builder | Cria plataforma/ferramenta temporária | Plataformas **instantâneas e ilimitadas** + cria uma "ferramenta-potência" que atira pulsos magenta. |
| **Einstein** — E=mc² | Desacelera o tempo | Empilha com o slow-mo: mundo cai para `0.20` (vs 0.35) só para Einstein, e ganha "eco" de ataque (golpes saem em dobro). |

**Numericamente, a amplificação genérica aplicada a TODOS** (em cima da habilidade específica acima):

| Atributo | Fora do Modo | No Modo Humanware | Fator |
|---|---:|---:|---:|
| Velocidade máx. de corrida (`RUN_MAX`) | 7.3 | **9.5** | ×1.30 |
| Aceleração de corrida (`RUN_ACCEL`) | 0.95 | **1.30** | ×1.37 |
| Pulo (`JUMP_VEL`) | -15.4 | **-17.5** | ×1.14 (mais alto) |
| Stomp bounce (`STOMP_BOUNCE`) | -11.5 | **-13.5** | ×1.17 |
| Dano de contato com Tolo congelado | 0 (precisa stomp) | **dano de corpo** (atravessa e mata) | — |
| Invulnerabilidade a dano de Tolo | não | **sim** (Tolos congelados não machucam) | — |
| Projétil do herói (speed 8.5) | 8.5 | **12.0**, atravessa inimigos | ×1.41 |

> Estes overrides vivem em `humanware.config.ts` como `powerOverrides` e são aplicados como *multiplicadores sobre as constantes da base*, nunca reescrevendo a base — garante reversão limpa ao fim do Modo.

#### 6.5.4. Fim do Modo

```ts
function endHumanware(state) {
  const hw = state.humanware;
  hw.active = false;
  hw.duration = 0;
  hw.meter = 0;                       // medidor zera (foi consumido como duração)
  hw.cooldownRemaining = HW_COOLDOWN; // 300 frames, ver 6.6
  state.timeScale = 1.0;
  fx.flash('#7112ff', 8);             // flash violeta de "retorno"
  audio.play('hw_end');               // stinger de descida
  hud.pulseHeart('empty');
}
```

Ao terminar: time-scale volta a 1.0 (com um `EXIT_RAMP = 10` frames de easing de saída para não "estalar"), Tolos descongelam, timer da fase retoma. O medidor recomeça do zero e o jogador volta a enchê-lo agindo.

---

### 6.6. Duração e cooldown — tabela canônica

| Constante | Valor (frames) | Valor (segundos reais) | Notas |
|---|---:|---:|---|
| `HW_DURATION` | 360 | 6.0 s | Duração base do Modo. |
| `HW_EXTEND_PER_KILL` | 10 | 0.167 s | +duração por Tolo derrotado no Modo. |
| `HW_EXTEND_CAP` | 90 | 1.5 s | Teto de extensão por ativação. |
| `HW_TIME_SCALE` | — | — | 0.35 (mundo). |
| `HW_PLAYER_SCALE` | — | — | 1.0 (player). |
| `ACTIVATION_FREEZE` | 12 | 0.2 s | Freeze-frame de impacto. |
| `ACTIVATION_RAMP` | 18 | 0.3 s | Easing de entrada do slow-mo. |
| `EXIT_RAMP` | 10 | 0.167 s | Easing de saída. |
| `HW_COOLDOWN` | 300 | 5.0 s | Tempo após o Modo em que o coração **pode encher mas não pode reativar**. |

**Cooldown:** após o Modo, `cooldownRemaining` conta de 300→0 em tempo real. Durante o cooldown o medidor **enche normalmente** (o jogador continua agindo), mas a ativação fica travada. Isso significa, na prática: mesmo que o jogador encha o coração super-rápido, há um piso de ~5s entre Modos. O HUD mostra o cooldown como o coração "recompondo-se" (ver 6.8). Modos Humanware mais longos (com extensão) consomem o mesmo cooldown fixo.

---

### 6.7. Interações com outros sistemas

| Sistema | Interação | Decisão |
|---|---|---|
| **Power-up Estrela (STAR_TIME=480, invencibilidade)** | Coexistem. | Se a Estrela estiver ativa e o jogador ativar o Humanware, os efeitos **somam** (invencível + slow-mo + potência). A Estrela continua contando no seu próprio relógio (em tempo real, não desacelerado). |
| **Escudo de Governança (Julio)** | Sinergia. | Dano bloqueado pelo escudo **não** aplica `DAMAGE_PENALTY` — protege o coração. |
| **Renante (companheiro)** | Amplificação de ganho. | `RENANTE_GAIN_MULT = 1.20`. Renante nunca ativa o Modo sozinho; só amplifica enchimento. |
| **Timer da fase (TIME_START=250)** | Pausa. | Pausado durante o Modo (inclui freeze e ramps). |
| **Câmera (clamp da base)** | Inalterada. | Câmera roda em tempo real (segue o player a 1.0). Adiciona-se um leve "zoom-punch" de +3% no freeze-frame, revertido no ramp. |
| **Chefe Esfinge (enigma)** | Tático. | Durante o enigma, o Modo desacelera animações de "devorar" da Esfinge, dando janela de resposta — mas **não** resolve o enigma pelo jogador (consciência ≠ trapaça). |
| **Estados de jogo (loading/title/playing/win/over)** | Restrito. | Ao entrar em `win`/`over`/pausa, o Modo é abortado via `endHumanware` sem cooldown (não pune o jogador por vencer). |

---

### 6.8. Feedback visual

Toda paleta segue a Direção Visual C (fundo escuro + magenta como cor de ação; ver seção de design). Pixel art quadrado (radius 0), sombras duras com offset.

#### 6.8.1. Estados do coração no HUD (ver 6.9)

| Estado do medidor | Visual do coração |
|---|---|
| 0–99% (enchendo) | Coração contornado em magenta-classic (#f43db3), preenchido proporcionalmente de baixo p/ cima com pink operacional (#ff0055). Cada segmento (250) que completa dá um *flash* de 6 frames e um "tum" sonoro. |
| 100% cheio, pronto | Coração pulsa (escala 1.0↔1.08, período 40 frames), borda lima (#cdf140) piscando, label mono UPPERCASE "HUMANWARE PRONTO". Prompt da tecla `[H]` aparece ao lado. |
| Modo ativo | Coração vira "barra de duração": esvazia 100%→0 em magenta-site (#e802cf) intenso, com partículas saindo. Vinheta magenta na borda da tela inteira. |
| Cooldown | Coração cinza-fragmentado recompondo-se peça por peça (animação de "cura"), em 300 frames. Sem pulso. |

#### 6.8.2. Efeitos de tela durante o Modo

- **Vinheta magenta** (#ff0055 → transparente) nas bordas, pulsando suave (período 60 frames).
- **Aura do herói:** halo magenta + violeta (#7112ff) com sombra dura offset (3px), partículas de "consciência" subindo (lima/azul).
- **Tolos congelados:** overlay azul-neon (#0099ff) semitransparente + cristalização estática.
- **Trilha de movimento (afterimage):** como o herói se move rápido no mundo lento, deixa 3 ecos fantasma magenta com alpha decrescente (0.4, 0.25, 0.1).
- **Desaturação leve do fundo:** o bg de espaço (#09090b/#121216) perde ~20% de saturação para o magenta do herói "saltar".
- **Texto de doutrina:** no freeze-frame, slogan mono UPPERCASE centralizado no topo, alternando entre as frases (6.7-doutrina) por ativação: `"TECNOLOGIA → POTÊNCIA"`, `"O CAMINHO DO CORAÇÃO"`, `"IA AMPLIFICA, NÃO SUBSTITUI"`, `"CONSCIÊNCIA = POTÊNCIA"`. Some no ramp.

#### 6.8.3. Eventos de partícula (reusa o sistema de partículas da base)

| Evento | Partículas |
|---|---|
| Ativação (freeze) | Explosão radial de 24 partículas magenta + 8 lima, 0.2s. |
| Tolo derrotado no Modo | Estilhaços azuis (cristal quebrando) + texto `+0.17s`. |
| Fim do Modo | Implosão violeta de 16 partículas para o centro do coração no HUD. |

---

### 6.9. Representação no HUD (medidor de coração)

O HUD (960×528) segue a grade da seção de UI. O medidor de coração fica no **canto superior esquerdo**, abaixo da contagem de vidas, antes de moedas e timer.

```
┌──────────────────────────────────────────────────────────────┐
│  G0  RENAN  x3        [♥▓▓▓░]  HUMANWARE   ⛁ 12   ⏱ 240        │  ← linha HUD
│         (logo)         coração   label     moedas  timer        │
└──────────────────────────────────────────────────────────────┘
```

- **Ícone:** coração pixel quadrado 32×32 (radius 0), borda 2px sombra dura offset 2px, na cor magenta-classic (#f43db3).
- **Preenchimento:** de baixo para cima, 4 segmentos visíveis com 1px de gap entre eles; cor pink operacional (#ff0055). O fill é *clamped* aos limites do coração (máscara de recorte).
- **Label:** texto mono UPPERCASE "HUMANWARE" em texto-claro (#f7f3f6); muda para "PRONTO" (lima) quando 100%, "ATIVO 6s" (contagem regressiva) durante o Modo, "AGUARDE 5s" (cinza) no cooldown.
- **Prompt de input:** quando pronto, um chip `[H]` (ou ícone de botão de gamepad) pisca ao lado do coração.
- **Renante presente:** um pequeno selo "×1.2" azul-neon (#0099ff) sobre o coração indica o multiplicador ativo.
- **Acessibilidade/legibilidade:** como o número interno (0–1000) não é exibido, o jogador lê *segmentos + cor + pulso*. Há também um modo de debug (`?debug=1` na URL) que mostra `meter/1000`, `duration`, `cooldown` numericamente.

```ts
function drawHeartMeter(ctx: CanvasRenderingContext2D, hw: HumanwareState, x: number, y: number) {
  const pct = hw.active
    ? hw.duration / HW_DURATION                  // barra de duração
    : hw.meter / METER_MAX;                        // enchimento
  drawHeartOutline(ctx, x, y, '#f43db3');          // moldura quadrada
  clipHeart(ctx, x, y, () => {
    fillBottomUp(ctx, x, y, pct, hw.active ? '#e802cf' : '#ff0055');
    drawSegmentGaps(ctx, x, y, SEGMENTS);
  });
  const ready = !hw.active && hw.cooldownRemaining === 0 && hw.meter >= METER_MAX;
  if (ready) pulseAndGlow(ctx, x, y, '#cdf140');   // pulso lima + prompt [H]
  if (hw.cooldownRemaining > 0) drawShatterRecompose(ctx, x, y, hw.cooldownRemaining / HW_COOLDOWN);
  if (hw.renanteActive) drawBadge(ctx, x, y, '×1.2', '#0099ff');
  drawLabel(ctx, x, y, hudLabel(hw));              // HUMANWARE / PRONTO / ATIVO / AGUARDE
}
```

---

### 6.10. Feedback sonoro

Áudio data-driven (chaves em `audio.config.ts`). Tom: marca Gzero (eletrônico/espacial, com "batimento de coração" como motivo recorrente).

| Chave | Quando | Descrição |
|---|---|---|
| `heart_tick` | A cada segmento (250) preenchido | "Tum" curto de coração, pitch sobe a cada segmento (1→4). |
| `heart_full` | Ao atingir 100% | Acorde de "carga completa" + batida dupla de coração. |
| `hw_activate` | No freeze-frame de ativação | Stinger de "respiro/inalar" + whoosh magenta + sub-bass; corta a música. |
| `hw_loop` | Durante o Modo | Loop ambiente abafado (mundo "submerso"), música da fase com low-pass filter (mundo lento soa abafado). |
| `hw_tolo_freeze` | Ao congelar Tolos | "Cristalização" digital glitchada. |
| `hw_extend` | Tolo derrotado no Modo | Sino curto ascendente. |
| `hw_end` | Fim do Modo | Stinger de "exalar" + remoção do low-pass (mundo "acorda"); música retoma volume. |
| `hw_cooldown_ready` | Cooldown chega a 0 | Tique suave de "pronto de novo". |

**Detalhe de áudio diegético:** durante o Modo, a música da fase passa por um filtro low-pass (corte ~600 Hz) + reverb, traduzindo sonoramente "o mundo desacelera". A trilha do herói (passos, ataque) **não** é filtrada — ele está em tempo normal. No fim, o filtro abre em `EXIT_RAMP` (10 frames).

---

### 6.11. Amarração com a doutrina (lore)

O Humanware é a mecânica que *literaliza* a filosofia da marca:

- **"IA amplifica, não substitui o potencial humano"** → Renante (a IA) só fornece o multiplicador `×1.20` de enchimento e a amplificação dos efeitos; nunca ativa o Modo nem age sozinho. O Modo só existe porque o **herói humano** encheu o coração agindo.
- **HUMANWARE = "tecnologias nativas humanas; o caminho do coração"** → o medidor é um *coração*, e enche muito mais por *agir bem* (stomp, reparar zona, resgatar) do que por acumular moedas. Esse é, mecanicamente, "o caminho do coração".
- **"um tolo com uma ferramenta continua sendo um tolo — e o estado de consciência que transforma tecnologia em potência"** → fora do Modo, a ferramenta/habilidade do herói é comum; o inimigo "Tolo com a Ferramenta" usa ferramentas sem consciência e é uma ameaça. No **Modo Humanware** (= "estado de consciência"), a mesma ferramenta vira **potência** (overrides de 6.5.3) e os Tolos, justamente por não terem consciência, **congelam** — incapazes de acompanhar o salto de consciência do herói.
- **Meta de jogo (Consciência Unificada / 3 Transformações)** → cada ativação do Humanware é uma *prévia* jogável da Consciência Unificada que o herói busca reunir ao longo do jogo. Narrativamente, dominar o Humanware prepara o jogador para o final (devolver a leveza ao mundo).
- **Frase de vitória** ("Você também acredita que podemos mudar o mundo? Bora juntos.") aparece no `win`; o Humanware é o que torna isso possível dentro da fase — o "bora juntos" ecoa a sinergia herói+Renante.

---

### 6.12. Interfaces TypeScript e configuração (data-driven)

```ts
// humanware.types.ts
export interface HumanwareState {
  meter: number;            // 0..METER_MAX
  active: boolean;
  duration: number;         // frames restantes do Modo (0..HW_DURATION+extend)
  extendGained: number;     // frames de extensão já concedidos (cap HW_EXTEND_CAP)
  cooldownRemaining: number;// frames até poder reativar
  freeze: number;           // frames de freeze-frame restantes
  ramp: number;             // frames de ramp de entrada restantes
  exitRamp: number;         // frames de ramp de saída restantes
  framesSinceGain: number;  // p/ regra de decaimento
  framesSinceDamage: number;// p/ flow drip
  renanteActive: boolean;   // multiplicador de ganho
}

export type GainSource =
  | 'stomp' | 'stompCombo' | 'zoneRepair' | 'lifecard' | 'coin'
  | 'item' | 'star' | 'blockBump' | 'brickBreak' | 'flowDrip' | 'goal';

export interface HumanwareConfig {
  meterMax: number;
  segments: number;
  activationThreshold: number;
  combatGrace: number;       // frames
  decayPerFrame: number;
  damagePenalty: number;
  renanteGainMult: number;
  flowDrip: number;          // por segundo
  flowDripDelay: number;     // frames
  gains: Record<GainSource, number>;
  stomp: { base: number; step: number; cap: number };
  mode: {
    duration: number;        // HW_DURATION
    timeScale: number;       // mundo
    playerScale: number;
    extendPerKill: number;
    extendCap: number;
    activationFreeze: number;
    activationRamp: number;
    exitRamp: number;
    cooldown: number;
  };
  powerOverrides: {          // multiplicadores sobre constantes da base
    runMaxMult: number;
    runAccelMult: number;
    jumpVelMult: number;
    stompBounceMult: number;
    projectileSpeedMult: number;
    projectilePierce: boolean;
    invulnToTolo: boolean;
  };
  doctrineLines: string[];   // frases mostradas na ativação
}
```

```ts
// humanware.config.ts  (valores canônicos desta seção)
export const HUMANWARE: HumanwareConfig = {
  meterMax: 1000,
  segments: 4,
  activationThreshold: 1000,
  combatGrace: 180,
  decayPerFrame: 0.2,
  damagePenalty: 150,
  renanteGainMult: 1.20,
  flowDrip: 5,
  flowDripDelay: 600,
  gains: {
    stomp: 60, stompCombo: 90, zoneRepair: 250, lifecard: 500,
    coin: 8, item: 40, star: 30, blockBump: 15, brickBreak: 12,
    flowDrip: 5, goal: 250,
  },
  stomp: { base: 60, step: 30, cap: 150 },
  mode: {
    duration: 360, timeScale: 0.35, playerScale: 1.0,
    extendPerKill: 10, extendCap: 90,
    activationFreeze: 12, activationRamp: 18, exitRamp: 10,
    cooldown: 300,
  },
  powerOverrides: {
    runMaxMult: 1.30, runAccelMult: 1.37, jumpVelMult: 1.14,
    stompBounceMult: 1.17, projectileSpeedMult: 1.41,
    projectilePierce: true, invulnToTolo: true,
  },
  doctrineLines: [
    'TECNOLOGIA → POTÊNCIA',
    'O CAMINHO DO CORAÇÃO',
    'IA AMPLIFICA, NÃO SUBSTITUI',
    'CONSCIÊNCIA = POTÊNCIA',
  ],
};
```

```ts
// Aplicação de ganho (chamado pelos sistemas de gameplay)
function addHumanware(hw: HumanwareState, source: GainSource, comboIndex = 0) {
  if (hw.active) return; // durante o Modo o medidor é a barra de duração
  let g = HUMANWARE.gains[source];
  if (source === 'stomp' || source === 'stompCombo') {
    g = Math.min(HUMANWARE.stomp.base + HUMANWARE.stomp.step * comboIndex, HUMANWARE.stomp.cap);
  }
  if (hw.renanteActive) g *= HUMANWARE.renanteGainMult;
  hw.meter = Math.min(HUMANWARE.meterMax, hw.meter + g);
  hw.framesSinceGain = 0;
  hud.flashSegmentIfCrossed(hw); // dispara heart_tick / heart_full
}
```

---

### 6.13. Loop de jogabilidade resultante (resumo)

1. O jogador age "no caminho do coração" (stomp em Tolos, repara zonas, joga limpo) → coração enche; coletar é apoio, não o foco.
2. Coração cheio (4/4) → HUD pulsa, prompt `[H]`. O cheio não decai: o jogador escolhe **quando** gastar.
3. Ativa `H` → freeze-frame dramático com frase de doutrina → slow-mo entra.
4. Por 6s reais: mundo a 35%, Tolos congelados, herói em velocidade normal com habilidade turbinada → "limpa a sala", cada Tolo derrotado estende até +1.5s.
5. Modo acaba → flash violeta, mundo acorda, cooldown de 5s (durante o qual o coração já volta a encher).
6. Repete. A cada Modo, o jogador sente, na prática, a tese da marca: **consciência humana transforma ferramenta em potência.**

---

**Constantes desta seção consumidas por outras seções:** a habilidade base de cada personagem (roster) é amplificada via `powerOverrides` (6.5.3); o `RENANTE_GAIN_MULT` define a função do companheiro; o medidor de coração ocupa slot fixo no HUD (ver seção de UI); a Esfinge e o Tolo com a Ferramenta têm comportamento específico sob o Modo (ver seções de inimigos/chefes). Toda a numérica é data-driven em `humanware.config.ts`, coerente com o design data-driven do projeto.

---

## 7. Inimigos, Obstaculos & Chefes

Esta secao define todo o bestiario, os perigos ambientais e os dois chefes de "Gravidade Zero — O Jogo". Tudo aqui parte das constantes de fisica da base (ver CONTEXTO e secao 2/3) e respeita a maquina de estados, o sistema de tiles `"c,r"->tipo` e o pipeline de placeholders-primeiro (arte de codigo agora, Higgsfield depois). Os valores estao calibrados para `TILE=48`, `GRAVITY=0.8`, jogador `34x42`, `ENEMY_SPEED=1.25` e `STOMP_BOUNCE=-11.5`.

Premissa narrativa unificadora (ver secao 1 — Lore): TODO inimigo e uma manifestacao da "gravidade da complexidade". O arquetipo-mae e **O Tolo com a Ferramenta** — "um tolo com uma ferramenta continua sendo um tolo". Os perigos ambientais sao a propria fisica do mundo esmagado. Os dois chefes sao a personificacao do enigma (A Esfinge) e do antagonista-raiz (A Gravidade / Status Quo).

### 7.0 Princípios transversais

- **Stomp e o verbo universal de pisada** (ver secao 4 — Controles): cair sobre a cabeca de um inimigo "pisável" o derrota e devolve `STOMP_BOUNCE=-11.5` ao jogador. Inimigos `armored` recusam stomp.
- **Modo Humanware** (ver secao 5 — Superpoder) afeta TODOS de forma consistente atraves de um unico campo `humanwareReaction`. Regra-mestre: ao ativar o Modo Humanware, o tempo do mundo escala por `WORLD_TIMESCALE_HW = 0.45` (mundo a 45% da velocidade), enquanto o jogador continua a 100%. Inimigos da familia "Tolo" tem reacao especial `freeze` (congelam por completo). Perigos ambientais nao congelam, mas herdam o timescale.
- **Constante global de tempo lento**: cada entidade le `effectiveDt = baseDt * (entity.humanwareReaction === 'freeze' && humanwareActive ? 0 : (humanwareActive ? WORLD_TIMESCALE_HW : 1))`. O jogador usa `effectiveDt = baseDt` sempre.
- **Dano ao jogador**: contato lateral/inferior com inimigo nao-pisado custa 1 unidade de vida (ver secao 6 — Vida/HUD) e concede `INVULN_AFTER_HIT = 90` frames de piscar. O power-up estrela (`STAR_TIME=480`) e o escudo do Julio sobrepoem esse dano (ver roster, secao 3).

### 7.1 Modelo de dados comum (TypeScript)

Todo inimigo/perigo/chefe e data-driven. Definicoes vivem em `src/data/enemies.ts`, `src/data/hazards.ts`, `src/data/bosses.ts` e sao instanciadas pelo spawner do nivel.

```ts
// src/engine/types/enemy.ts
export type Facing = -1 | 1;

export type HumanwareReaction =
  | 'freeze'      // congela 100% (familia Tolo)
  | 'slow'        // herda WORLD_TIMESCALE_HW (perigos ambientais, fauna neutra)
  | 'resist'      // ignora timescale, segue normal (so chefes em fases especificas)
  | 'vulnerable'; // continua agindo, porem fica pisável/destrutível mesmo se blindado

export type EnemyTrait =
  | 'stompable'   // morre por pisada
  | 'armored'     // recusa stomp (precisa de outra fonte de dano)
  | 'flying'      // ignora gravidade, segue rota
  | 'projectile_user'
  | 'splitter'    // ao morrer, gera filhotes
  | 'shielded';   // bloqueia 1 hit frontal

export interface EnemyDef {
  id: string;
  name: string;            // nome de exibicao
  spriteKey: string;       // chave no atlas/placeholder
  w: number; h: number;    // hitbox px
  hp: number;              // 1 = morre num hit
  speed: number;           // px/frame base
  contactDamage: number;   // dano ao jogador no toque lateral/inferior
  traits: EnemyTrait[];
  ai: AiKind;
  aiParams: Record<string, number>;
  humanwareReaction: HumanwareReaction;
  scoreValue: number;      // pontos ao derrotar
  heartFill: number;       // quanto enche o medidor Humanware ao derrotar (0..1 do total)
  palette: { body: string; accent: string; tool: string }; // tokens Gzero
}

export type AiKind =
  | 'patrol'        // anda e vira na borda/parede
  | 'patrol_chase'  // patrulha ate ver o jogador, entao persegue
  | 'shooter'       // estacionario/lento, dispara projeteis
  | 'hopper'        // pula em arco
  | 'drifter'       // voa em senoide/rota
  | 'charger'       // acumula e investe em linha reta
  | 'spawner';      // gera outras entidades

export interface EnemyInstance extends EnemyDef {
  x: number; y: number;
  vx: number; vy: number;
  facing: Facing;
  onGround: boolean;
  state: 'idle' | 'active' | 'hurt' | 'dying' | 'dead' | 'frozen';
  timers: { shoot: number; state: number; anim: number };
  hpCurrent: number;
}
```

### 7.2 O Tolo com a Ferramenta — arquétipo e variantes

O inimigo-tema (ver secao 1). Visualmente: corpo pixel quadrado (radius 0), sombra dura com offset, paleta base cinza-fumaca apatica com a **ferramenta** brilhando em magenta operacional `#ff0055` — a piada visual: a ferramenta e linda, o portador nao sabe usar. Todos da familia Tolo tem `humanwareReaction: 'freeze'`: no Modo Humanware eles travam (a consciencia unificada "desliga" a tolice) e ficam `vulnerable` ao toque do jogador, que pode atravessa-los/derruba-los sem dano.

Comportamento-mae (`patrol` / `patrol_chase`): anda a `speed`, vira ao encontrar parede ou borda de plataforma (raycast 1 tile a frente + 1 abaixo). Variantes especializam a IA e a ferramenta.

| Variante | id | IA | speed (px/f) | hp | traits | Ferramenta / gimmick | scoreValue | heartFill |
|---|---|---|---|---|---|---|---|---|
| Tolo Base | `fool_basic` | `patrol` | 1.25 | 1 | stompable | Martelo desligado; so anda e cai em buracos | 100 | 0.06 |
| Tolo Apressado | `fool_rusher` | `patrol_chase` | 1.25→2.6 | 1 | stompable | "Prompt sem pensar"; ao ver o heroi (raio 6 tiles) acelera p/ 2.6 e ignora bordas (cai) | 150 | 0.07 |
| Tolo Copia-Cola | `fool_copier` | `patrol` | 1.6 | 1 | stompable, splitter | Ao morrer por stomp gera 2 `fool_mini` (speed 1.9, hp1, sem split) | 200 | 0.08 |
| Tolo Blindado | `fool_armored` | `patrol` | 0.9 | 2 | armored | Capacete de "best practice" decorada; recusa stomp, pisada da bounce mas nao mata. Morre por: investida do Dante, Builder do Artur, projetil refletido, ou Humanware | 250 | 0.10 |
| Tolo Atirador | `fool_shooter` | `shooter` | 0.6 | 1 | stompable, projectile_user | Dispara "feature inutil" (projetil `8.5` px/f, cooldown 110f, alcance 9 tiles) na horizontal frontal | 220 | 0.09 |
| Tolo Saltitante | `fool_hopper` | `hopper` | 1.4 | 1 | stompable | Pula em arco (impulso vy `-9`, intervalo 70f); dificil de pisar no ar | 180 | 0.08 |

Parametros da IA `patrol_chase` (Tolo Apressado):

```ts
// aiParams para fool_rusher
{ chaseRadiusTiles: 6, baseSpeed: 1.25, chaseSpeed: 2.6,
  ignoreEdgeWhenChasing: 1, loseChaseRadiusTiles: 9 }
```

Pseudo-codigo de update (familia Tolo, resume todas as variantes):

```ts
function updateFool(e: EnemyInstance, world: World, dtFrames: number) {
  if (world.humanwareActive) { e.state = 'frozen'; return; } // freeze total

  switch (e.ai) {
    case 'patrol':
      e.vx = e.speed * e.facing;
      if (willHitWall(e, world) || (e.id !== 'fool_rusher' && atEdge(e, world)))
        e.facing = -e.facing as Facing;
      break;
    case 'patrol_chase': {
      const seesPlayer = dist(e, world.player) <= tiles(e.aiParams.chaseRadiusTiles);
      const chasing = seesPlayer && Math.abs(world.player.x - e.x) > 4;
      e.facing = (world.player.x < e.x ? -1 : 1) as Facing;
      e.vx = (chasing ? e.aiParams.chaseSpeed : e.aiParams.baseSpeed) * e.facing;
      if (willHitWall(e, world)) e.facing = -e.facing as Facing;
      if (!chasing && atEdge(e, world)) e.facing = -e.facing as Facing; // so cai se perseguindo
      break;
    }
    case 'shooter':
      e.timers.shoot -= dtFrames;
      if (e.timers.shoot <= 0 && lineOfSight(e, world.player, 9)) {
        spawnProjectile(e.x, e.y + e.h*0.4, 8.5 * e.facing, 0, 'fool_feature');
        e.timers.shoot = 110;
      }
      break;
    case 'hopper':
      if (e.onGround) { e.vy = -9; e.timers.state = 70; }
      e.vx = e.speed * e.facing;
      break;
  }
  applyGravity(e);          // GRAVITY=0.8, clamp MAX_FALL=17
  moveAndCollide(e, world); // colisao tile
}
```

Resolucao de combate (Tolo, frame de contato jogador↔inimigo):

```ts
if (stompFromAbove(player, e) && e.traits.includes('stompable')) {
  player.vy = STOMP_BOUNCE; // -11.5
  e.hpCurrent -= 1;
  if (e.hpCurrent <= 0) { killEnemy(e); if (e.traits.includes('splitter')) spawnSplit(e); }
} else if (stompFromAbove(player, e) && e.traits.includes('armored')) {
  player.vy = STOMP_BOUNCE * 0.6; // quica, mas nao mata
} else if (playerHasOffensiveState(player)) {
  // estrela, Dash do Dante, Builder, Humanware → mata blindado tambem
  killEnemy(e);
} else if (!player.invuln) {
  damagePlayer(player, e.contactDamage);
}
```

### 7.3 Perigos ambientais — Poços de Gravidade

Manifestam a "gravidade" que esmaga o mundo (ver secao 1). Sao zonas/tiles, nao entidades com IA. Vivem como tipo de tile especial `gravity_well` no Map `"c,r"->tipo` e como volumes em `hazards.ts`.

```ts
// src/data/hazards.ts
export interface GravityWell {
  id: string;
  centerTile: { c: number; r: number };
  radiusTiles: number;     // alcance do campo
  pull: number;            // aceleracao extra px/frame^2 somada ao vy/vx em direcao ao centro
  killAtCore: boolean;     // o nucleo e morte instantanea
  humanwareReaction: 'slow';
}
```

Comportamento: dentro do raio, o jogador (e projeteis) recebem aceleracao adicional `pull` apontando ao centro, somada por cima de `GRAVITY`. O nucleo (1 tile central) e morte instantanea (`killAtCore`), funcionando como o "buraco" classico do platformer, porem com sucção — o jogador precisa pular ANTES ou usar habilidade. Valores padrao:

| Subtipo | id | radiusTiles | pull | killAtCore | Uso de design |
|---|---|---|---|---|---|
| Poço fraco | `well_weak` | 2.5 | 0.25 | true | Ensina a mecanica; saltavel com pulo normal `JUMP_VEL=-15.4` |
| Poço médio | `well_mid` | 4 | 0.45 | true | Exige timing/corrida; recompensa o duplo pulo do Renan |
| Poço forte | `well_strong` | 5.5 | 0.75 | true | So atravessavel com Salto Visionario (Renan), plataforma do Builder (Artur), ou E=mc2 (Einstein) |
| Cinturão | `well_belt` | 3 (faixa) | 0.40 lateral | false | Empurra horizontalmente; nao mata, mas joga em outro perigo |

Pseudo-codigo:

```ts
function applyGravityWell(p: PlayerOrProjectile, w: GravityWell, world: World) {
  const dir = sub(tileCenter(w.centerTile), {x:p.x, y:p.y});
  const d = len(dir);
  if (d > tiles(w.radiusTiles)) return;
  const k = 1 - d / tiles(w.radiusTiles);          // mais forte perto do centro
  const ts = world.humanwareActive ? WORLD_TIMESCALE_HW : 1; // herda slow
  const a = w.pull * k * ts;
  p.vx += norm(dir).x * a;
  p.vy += norm(dir).y * a;
  if (w.killAtCore && d < tiles(0.6)) killEntity(p);
}
```

**Efeito do Modo Humanware**: `slow`. Como o pull e multiplicado por `WORLD_TIMESCALE_HW=0.45`, no Modo Humanware a sucção cai para ~45%, dando a janela exata para o heroi escapar de um `well_strong` — reforcando a fantasia "consciencia vence a gravidade".

### 7.4 Perigos ambientais — Skill Gaps

Os "Skill Gaps" sao lacunas no terreno que so existem visualmente como vazio quebrado (glitch magenta nas bordas) e representam a falta de dominio. Mecanicamente sao **vãos de plataforma** com largura calibrada para exigir uma habilidade especifica do roster (ver secao 3) — sao o principal lugar onde o desbloqueio de personagens importa.

```ts
export interface SkillGap {
  id: string;
  startTile: { c: number; r: number };
  widthTiles: number;          // largura do vão
  requiredHability:            // dica de design de qual skill resolve
    | 'any_jump' | 'double_jump' | 'dash' | 'builder' | 'time_slow';
  hasBridgeAnchor: boolean;    // ponto onde o Builder (Artur) ancora plataforma
  humanwareReaction: 'slow';
}
```

Tabela de largura x solucao (alcance horizontal de pulo do heroi a `RUN_MAX=7.3`, `JUMP_VEL=-15.4`, `GRAVITY=0.8` ⇒ alcance util ~5.5 tiles):

| Largura (tiles) | id sugerido | Resolve com | Observacao |
|---|---|---|---|
| ≤4 | `gap_basic` | `any_jump` | Qualquer personagem em corrida |
| 5–6 | `gap_double` | `double_jump` | Renan (Salto Visionario) facil; outros so com corrida perfeita |
| 7–8 | `gap_dash` | `dash` | Dante (Dash Criativo) cruza no ar; ou Builder |
| 9–11 | `gap_builder` | `builder` | Artur ancora plataforma temporaria no `hasBridgeAnchor` |
| qualquer + perigo móvel embaixo | `gap_time` | `time_slow` | Einstein (E=mc2) abre janela; Humanware tambem |

**Efeito do Modo Humanware**: `slow`. O mundo a 45% faz a fisica do salto parecer "flutuante" — na pratica, qualquer Skill Gap fica ~2 niveis mais facil (ex.: `gap_dash` vira atravessavel com corrida normal), porque o jogador mantem 100% da velocidade enquanto plataformas moveis e perigos abaixo desaceleram. Isso e intencional: o Humanware e um "modo Deus suave" de travessia.

### 7.5 Perigos temáticos adicionais

#### 7.5.1 Ruído / Bug (`hazard_noise`)

Entidade voadora-ambiental que personifica o ruido informacional. Visual: bloco de "estatica" glitch ciano/magenta que pisca, deixando rastro de pixels.

```ts
// EnemyDef
{ id:'hazard_noise', name:'Ruído', ai:'drifter', w:36, h:36, hp:1,
  speed:1.8, contactDamage:1, traits:['flying','stompable'],
  aiParams:{ amp: 1.5, freq: 0.06, baseY: 0 }, // senoide vertical
  humanwareReaction:'slow', scoreValue:160, heartFill:0.07 }
```

Comportamento `drifter`: voa horizontalmente a `speed`, oscilando em Y por senoide (`y = baseY + amp*tiles*sin(freq*t)`). Atravessa terreno (ignora colisao de tile), so colide com o jogador. E pisável (stompable) mas o padrao senoidal torna o timing dificil. Em grupos de 3–5 cria "campos de ruido" que o jogador deve costurar.

**Efeito Humanware**: `slow` — a 45% a senoide fica trivial de pisar; alem disso, no Modo Humanware o Ruido perde o flicker visual (vira solido), comunicando "consciencia silencia o ruido".

#### 7.5.2 Burocracia (`hazard_redtape`)

Obstaculo de zona/parede. Visual: pilhas de "carimbos" e fita (red tape) burgundy `#990033` formando barreiras que se abrem/fecham em ciclo — um portao temporizado.

```ts
export interface RedTapeGate {
  id: string;
  tile: { c: number; r: number };
  heightTiles: number;
  openFrames: number;   // tempo aberto
  closedFrames: number; // tempo fechado
  phase: number;        // offset inicial
  crushDamage: number;  // dano se fechar sobre o jogador
  humanwareReaction: 'slow';
}
```

Padrao: `{ openFrames: 90, closedFrames: 120, crushDamage: 1 }`. Quando fechado e solido (bloqueia passagem e empurra); fechar sobre o jogador causa `crushDamage` e empurra para fora. Ensina paciencia e leitura de ritmo. Variante "esmagador" (`redtape_crusher`) move verticalmente e mata no nucleo se o jogador ficar preso entre a fita e o chao.

**Efeito Humanware**: `slow` — a 45%, a janela aberta efetivamente dobra para o jogador (que esta a 100%), permitindo passar com folga. Tematicamente: "a leveza atravessa a burocracia".

### 7.6 Chefe 1 — A ESFINGE (enigma)

Chefe-enigma do mundo intermediario (ver secao 1: "decifra-me ou te devoro"). Aparece quando o heroi reune as 3 Transformacoes parciais. Combate hibrido: **enigma + esquiva**. Nao se vence apenas pulando — vence-se respondendo certo enquanto sobrevive aos padroes.

Visual: grande felino-mascara em pixel quadrado, corpo `#121216` com olhos e jucos magenta `#e802cf`; quando "pensa", projeta tres **glifos-resposta** flutuantes (plataformas-botao) sobre a arena.

```ts
// src/data/bosses.ts
export interface SphinxRiddle {
  prompt: string;          // pergunta (in-joke Gzero permitido)
  options: [string,string,string];
  correctIndex: 0|1|2;
  hintAfterWrong: string;
}

export interface SphinxBossDef {
  id: 'boss_sphinx';
  hp: 3;                    // 3 enigmas corretos = vitoria
  arenaTiles: { wTiles: 16; hTiles: 11 };
  riddleTimeFrames: 600;    // ~10s para escolher um glifo
  wrongPenaltyDamage: 1;    // erro custa 1 vida do jogador
  patterns: SphinxPatternId[];
  humanwareReaction: 'slow';
}
```

**Loop de combate (3 fases = 3 enigmas):**

1. **Fase de Enigma**: a Esfinge declama (texto na HUD, ver secao 6). Surgem 3 plataformas-glifo (A/B/C) na arena, cada uma sobre um trecho. O jogador deve pisar/permanecer 30 frames sobre o glifo da resposta correta antes de `riddleTimeFrames` esgotar.
   - Acerto: a Esfinge perde 1 hp (3→2→1) e recua; toca o "dano" visual.
   - Erro ou timeout: `wrongPenaltyDamage` ao jogador + a Esfinge solta o `hintAfterWrong` e dispara um padrao de ataque punitivo intensificado.
2. **Fase de Esquiva** (entre enigmas, dura `dodgeFrames=420`): a Esfinge executa um padrao de ataque enquanto recarrega o proximo enigma.

Padroes de ataque (escalam por hp restante 3→2→1):

| id | Descricao | Param hp=3 | Param hp=2 | Param hp=1 |
|---|---|---|---|---|
| `sweep_paw` | Garra varre o chao da arena, exige pulo | 1 onda, vel 6 | 2 ondas, vel 7 | 3 ondas, vel 8 |
| `glyph_rain` | Glifos-projeteis caem (vel 8.5) | 4 colunas | 6 colunas | 8 colunas |
| `gaze_beam` | Feixe horizontal telegrafado 40f | 1 feixe | 2 feixes | feixe + sweep |

```ts
function updateSphinx(b: SphinxBoss, world: World, dt: number) {
  const ts = world.humanwareActive ? WORLD_TIMESCALE_HW : 1; // slow
  if (b.phase === 'riddle') {
    b.riddleTimer -= dt * ts;
    const glyph = playerStandingGlyph(world.player, b);
    if (glyph === b.currentRiddle.correctIndex && (b.standTimer += dt) >= 30) {
      b.hp -= 1; b.phase = (b.hp <= 0) ? 'defeated' : 'dodge';
    } else if (b.riddleTimer <= 0) {
      damagePlayer(world.player, b.wrongPenaltyDamage);
      showHint(b.currentRiddle.hintAfterWrong);
      b.phase = 'dodge'; b.dodgeTimer = 420;
    }
  } else if (b.phase === 'dodge') {
    runPattern(b.currentPattern, b.hp, world, dt * ts);
    if ((b.dodgeTimer -= dt * ts) <= 0) { b.phase = 'riddle'; nextRiddle(b); }
  }
}
```

Banco de enigmas (exemplos canonicos, todos resolviveis pela lore/doutrina Gzero):

```ts
const SPHINX_RIDDLES: SphinxRiddle[] = [
  { prompt: 'O que um tolo com uma ferramenta continua sendo?',
    options: ['Um mestre','Um tolo','Uma máquina'], correctIndex: 1,
    hintAfterWrong: 'A ferramenta não muda quem a segura. A consciência sim.' },
  { prompt: 'O que a IA faz com o potencial humano?',
    options: ['Substitui','Amplifica','Ignora'], correctIndex: 1,
    hintAfterWrong: 'IA amplifica, não substitui — esse é o HUMANWARE.' },
  { prompt: 'Quantas Transformações formam a Consciência Unificada?',
    options: ['Duas','Três','Cinco'], correctIndex: 1,
    hintAfterWrong: 'Existencial + Cultural + Digital = três.' },
];
```

**Efeito do Modo Humanware**: `slow`. No combate da Esfinge o Humanware NAO congela o chefe (ele nao e da familia Tolo), mas a 45% desacelera os padroes de ataque E o relogio do enigma — dando tempo de ler a pergunta com calma. Designado como "tabua de salvacao": jogador encurralado ativa o medidor cheio e ganha folga cognitiva. Importante: o medidor de coracao tambem enche ao acertar enigmas (`heartFill: 0.25` por acerto), entao usa-lo na Esfinge e uma decisao tatica.

### 7.7 Chefe Final — A GRAVIDADE / O STATUS QUO

Chefe-raiz. Personificacao da "gravidade da complexidade, cultura morta e automacao sem alma" (ver secao 1). Nao e um inimigo a ser pisado: e um **campo/entidade colossal** que ocupa o fundo da arena, com um "nucleo" vulneravel que so abre em janelas. Vitoria desbloqueia a CONSCIENCIA UNIFICADA e a frase final: "Voce tambem acredita que podemos mudar o mundo? Bora juntos.".

```ts
export interface GravityBossDef {
  id: 'boss_gravity';
  totalHp: 9;                 // 3 por fase x 3 fases
  arenaTiles: { wTiles: 20; hTiles: 13 };
  phases: 3;
  coreOpenFrames: 150;        // janela em que o nucleo aceita dano
  coreCooldownFrames: 240;
  enrageAtHpPct: 0.33;
  humanwareReaction: 'resist' | 'vulnerable'; // varia por fase (ver abaixo)
}
```

O nucleo so recebe dano quando `coreOpen === true`. Fontes de dano ao nucleo: stomp no nucleo exposto, projetil refletido, e (decisivo) o Modo Humanware. Cada hit tira 1 de `totalHp`.

**Fase 1 — A Sucção (hp 9→7): "Ele tenta te puxar para baixo"**
- A Gravidade cobre a arena com `well_strong` pulsantes (ver 7.3) em 3 pontos fixos, alternando ativos a cada 180f.
- Pisos desabam em sequencia (tiles `crumble`, somem 45f apos pisados).
- Janela do nucleo: abre no centro-alto por `coreOpenFrames`; alcancavel com pulo/duplo pulo a partir de plataforma flutuante.
- `humanwareReaction` desta fase: **`vulnerable`** — o Humanware enfraquece a sucção (poços a 45%) e mantem o nucleo aberto +50% do tempo.

**Fase 2 — O Ruído (hp 7→4): "Ele te confunde"**
- Spawna ondas de `hazard_noise` (ver 7.5.1) — 4 por onda, intervalo 90f — e dispara `glyph_rain` reaproveitado da Esfinge (continuidade tematica).
- A tela aplica leve shake e inversao de cor parcial (efeito de confusao; nao inverte controles — apenas ruido visual, para nao frustrar).
- Janela do nucleo: abre apenas quando o jogador limpa uma onda inteira de Ruido (mecanica de "silenciar para revelar").
- `humanwareReaction`: **`vulnerable`** — no Humanware o Ruido vira solido/lento e o nucleo fica permanentemente exposto enquanto o medidor durar. Esta e a fase desenhada para "gastar" o Humanware.

**Fase 3 — O Status Quo (hp 4→0): "Ele insiste em continuar igual"**
- A Gravidade combina TODOS os perigos anteriores em ritmo acelerado (`enrage`): sweep_paw + glyph_rain + sucção, com `coreCooldownFrames` reduzido para 160.
- Surgem clones de `fool_armored` (3 por vez) protegendo o nucleo — reforço do tema "o Status Quo se cerca de tolos blindados".
- Janela do nucleo: abre por 90f apos o jogador derrotar os 3 Tolos guardas.
- `humanwareReaction`: **`resist`** — DECISAO DE DESIGN: na fase final o chefe RESISTE ao timescale (segue a 100%), MAS o Modo Humanware ainda CONGELA os Tolos guardas (familia Tolo = freeze sempre) e turbina o ataque do heroi. Logo o Humanware nao "trivializa" o climax; ele remove os guardas e amplifica o golpe final, mantendo o duelo direto heroi-vs-Gravidade. Tematicamente: "a gravidade nao desaparece; voce e que se torna leve o bastante para vence-la".

Pseudo-codigo do loop do chefe final:

```ts
function updateGravityBoss(b: GravityBoss, world: World, dt: number) {
  const phase = b.totalHp > 6 ? 1 : b.totalHp > 3 ? 2 : 3;
  // 'resist' so na fase 3; demais fases 'vulnerable'
  const ts = (phase === 3)
    ? 1
    : (world.humanwareActive ? WORLD_TIMESCALE_HW : 1);

  runPhasePatterns(phase, b, world, dt * ts);

  // janela do nucleo
  if (world.humanwareActive && phase !== 3) {
    b.coreOpen = true; // Humanware mantem aberto fases 1-2
  } else {
    tickCoreWindow(b, dt * ts); // alterna open/cooldown normalmente
  }

  if (phase === 3) freezeAllFools(world); // Tolos guardas congelam no Humanware

  if (b.coreOpen && coreHitThisFrame(world)) {
    b.totalHp -= 1;
    if (b.totalHp <= 0) triggerVictory(); // Consciencia Unificada + frase final
  }
}
```

Parametros consolidados das fases:

| Fase | hp | Perigos ativos | Nucleo (open/cooldown f) | Humanware |
|---|---|---|---|---|
| 1 Sucção | 9→7 | well_strong x3, tiles crumble | 150 / 240 | vulnerable (poços a 45%, nucleo +50% aberto) |
| 2 Ruído | 7→4 | hazard_noise ondas, glyph_rain | abre ao limpar onda | vulnerable (ruido solido, nucleo aberto enquanto durar) |
| 3 Status Quo | 4→0 | sweep+glyph+sucção, 3 fool_armored | 90 apos matar guardas / 160 | resist (chefe a 100%; Tolos congelam; golpe turbinado) |

### 7.8 Resumo data-driven (arquivo de exemplo)

```ts
// src/data/enemies.ts (extrato)
export const ENEMIES: EnemyDef[] = [
  { id:'fool_basic', name:'Tolo', spriteKey:'fool_basic', w:38,h:34, hp:1,
    speed:1.25, contactDamage:1, traits:['stompable'], ai:'patrol',
    aiParams:{}, humanwareReaction:'freeze', scoreValue:100, heartFill:0.06,
    palette:{ body:'#3a3a40', accent:'#ff0055', tool:'#f43db3' } },
  { id:'fool_armored', name:'Tolo Blindado', spriteKey:'fool_armored', w:40,h:36,
    hp:2, speed:0.9, contactDamage:1, traits:['armored'], ai:'patrol',
    aiParams:{}, humanwareReaction:'freeze', scoreValue:250, heartFill:0.10,
    palette:{ body:'#2a2a2e', accent:'#990033', tool:'#0099ff' } },
  { id:'hazard_noise', name:'Ruído', spriteKey:'noise', w:36,h:36, hp:1,
    speed:1.8, contactDamage:1, traits:['flying','stompable'], ai:'drifter',
    aiParams:{ amp:1.5, freq:0.06, baseY:0 }, humanwareReaction:'slow',
    scoreValue:160, heartFill:0.07,
    palette:{ body:'#050505', accent:'#cdf140', tool:'#e802cf' } },
];
```

### 7.9 Tabela-mestra: efeito do Modo Humanware (referência rápida)

| Categoria | Entidades | humanwareReaction | Efeito concreto no Humanware |
|---|---|---|---|
| Família Tolo | fool_* | freeze | Congelam 100%, viram atravessáveis (vulnerable), sem dano ao herói |
| Fauna/Ruído | hazard_noise | slow | A 45%; perde flicker, fica solido e fácil de pisar |
| Burocracia | redtape gates | slow | Janela aberta efetivamente dobra para o herói |
| Poços de Gravidade | well_* | slow | Sucção cai a 45%; janela de fuga garantida |
| Skill Gaps | gap_* | slow | Travessia ~2 níveis mais fácil; herói mantém 100% |
| Esfinge | boss_sphinx | slow | Padrões e relógio do enigma a 45%; folga cognitiva |
| Gravidade (F1/F2) | boss_gravity | vulnerable | Núcleo aberto +50%/permanente; perigos enfraquecidos |
| Gravidade (F3) | boss_gravity | resist | Chefe a 100% (não trivializa); Tolos guardas congelam; golpe turbinado |

---

## 8. Mundos & Design de Fases

Esta seção define a topologia de mundos do jogo, projeta a **World 1 (Humanware)** batida por batida — incluindo seu tilemap no formato da seção 3 — e formaliza a curva de dificuldade. Os tipos de dado aqui são consistentes com o formato data-driven definido nas seções 3 (tilemap) e 7 (entidades/inimigos). Todas as constantes de física são as da base (ver CONTEXTO): `TILE=48`, `GROUND_ROW=9`, nível padrão `168x11` tiles, `goal` na coluna 160.

---

### 8.1 Visão geral: estrutura de mundos

O jogo é organizado em **3 atos narrativos** que mapeiam as 3 Transformações da lore (Existencial → Cultural → Digital) rumo à **Consciência Unificada**. Cada ato contém **pilares jogáveis** + **fases-desafio MISSÃO IA** (clientes) intercaladas como "side-quests". O fechamento é o **Especial Vale do Silício** + o confronto com a **Esfinge**.

Os **5 pilares** são os mundos canônicos da jornada. Eles não são "temas de cliente" — são reinos da Gravidade Zero, cada um amarrado a uma doutrina da marca e a um herói cuja Lifecard é desbloqueada ali.

| # | Mundo (pilar) | Tema lore | Cor de zona (sobre base #09090b) | Mecânica-assinatura introduzida | Herói/Lifecard | Ato |
|---|---------------|-----------|----------------------------------|-------------------------------|----------------|-----|
| W1 | **Humanware** | "o caminho do coração"; reaprender a leveza humana | magenta #f43db3 | medidor Humanware + portais simples | **Renan** (Salto Visionário) | I — Existencial |
| W2 | **Cultura Viva** | revival da cultura morta; ritmo/criação | lima #cdf140 | plataformas-de-batida + Builder de plataforma | **Artur** (Builder) | II — Cultural |
| W3 | **Governança** | guardrails; "IA amplifica, não substitui" | azul #0099ff | escudo/zonas de dano + alavancas | **Julio** (Escudo de Governança) | II — Cultural |
| W4 | **Fluxo Criativo** | velocidade da criação; quebrar bloqueios | violeta #7112ff | dash que rompe paredes + esteiras | **Dante** (Dash Criativo) | III — Digital |
| W5 | **Relatividade** | o "gênio/mentor"; dobrar o tempo | violeta #612af1 + branco | desaceleração de tempo (puzzle-timing) | **Einstein** (E=mc²) | III — Digital |

**Fases-desafio MISSÃO IA (clientes)** — cada cliente vira uma fase curta de "desafio" (1 fase, mais densa, 110–130 colunas) com gimmick próprio. Não introduzem heróis; concedem recompensa de **Lifecards/heart** e in-jokes. Posição: encaixadas entre pilares para variar o ritmo.

| Código | Cliente | Gimmick da fase | Recompensa | Posição no fluxo |
|--------|---------|-----------------|------------|------------------|
| M-VIVO | **Vivo** | "sinal/cobertura": plataformas piscam ON/OFF em pulso | +1 vida extra | após W1 |
| M-KION | **Kion** | logística/esteiras: caixas-plataforma em trilho | upgrade de medidor Humanware (enche 15% mais rápido) | após W2 |
| M-ECOR | **Ecorodovias** | "estrada": rolagem rápida lateral semi-auto, pedágios=portões | atalho permanente no hub | após W3 |
| M-MUBA | **Mubadala** | "investimento": risco/recompensa, baús que custam moedas | multiplicador de score x1.25 da fase | após W4 |
| M-JPM | **JPMorgan** | "cofre/segurança": labirinto vertical com chaves | Lifecard secreta de **Renante** (companheiro) | após W5 |

**Especial Vale do Silício** (`SV-NASA`): fase-clímax onde Renan "lidera a imersão". Mistura todas as mecânicas dos 5 pilares em sequência (cada seção homenageia um pilar). Termina no **portal final** para a arena da Esfinge.

**Chefe-enigma — a Esfinge** (`BOSS-SPHINX`): arena fixa (não scrolling), 3 enigmas; errar = dano; acertar = abre fenda no chefe. Vitória dispara a frase: *"Você também acredita que podemos mudar o mundo? Bora juntos."* e a tela de **Consciência Unificada**.

#### Fluxo completo (grafo do hub)

```
HUB (Mapa-mundo: estações de portal estilo overworld)
  └─ W1 Humanware ──► M-VIVO ──► W2 Cultura Viva ──► M-KION
       │                                                  │
       ▼                                                  ▼
  W3 Governança ◄── M-ECOR ◄───────────────────────  (M-ECOR abre atalho de volta ao hub)
       │
       ▼
  W4 Fluxo Criativo ──► M-MUBA ──► W5 Relatividade ──► M-JPM
                                                          │
                                                          ▼
                                              SV-NASA (Vale do Silício)
                                                          │
                                                          ▼
                                              BOSS-SPHINX (Esfinge) ──► VITÓRIA
```

Total: **5 pilares + 5 fases-cliente + 1 especial + 1 chefe = 12 estágios**. Cada pilar tem **3 fases internas** (ex.: W1-1, W1-2, W1-3), totalizando 15 fases de pilar; clientes/especial/chefe são fases únicas. Grande total de **21 fases jogáveis** (15 + 5 + 1) + 1 arena de chefe.

#### Interface de dados do mundo/fase

Consistente com o design data-driven (assets/fases como dados). Cada fase é um arquivo `levels/<id>.ts` exportando um `LevelDef`. O tilemap segue o formato da seção 3 (`Map<"c,r", TileKind>` derivado de uma matriz declarativa).

```ts
type WorldId = "W1" | "W2" | "W3" | "W4" | "W5";
type StageKind = "pillar" | "client" | "special" | "boss";

interface WorldDef {
  id: WorldId;
  name: string;            // "Humanware"
  act: 1 | 2 | 3;          // ato narrativo
  zoneColor: string;       // token de cor de zona (ex.: "#f43db3")
  bgLayers: string[];      // ids de camadas de parallax (ver seção 4)
  music: string;           // id de trilha
  unlockHero?: string;     // "renan" — Lifecard concedida ao 100% do mundo
  stages: string[];        // ["W1-1","W1-2","W1-3"]
}

interface LevelDef {
  id: string;              // "W1-1"
  world: WorldId | null;   // null para client/special/boss "neutros"
  kind: StageKind;
  cols: number;            // largura em tiles (default 168)
  rows: number;            // altura em tiles (default 11)
  groundRow: number;       // GROUND_ROW=9 por padrão
  goalCol: number;         // coluna do portal de saída (default 160)
  timeStart: number;       // TIME_START=250 por padrão
  difficulty: number;      // 1..10 (ver 8.4)
  tiles: TileLayer;        // matriz declarativa -> Map "c,r"->TileKind (seção 3)
  entities: EntitySpawn[]; // inimigos/itens/moedas (seção 7)
  checkpoints: number[];   // colunas de checkpoint (bandeiras de portal)
  intro?: ScriptedBeat;    // tutorial/cena scriptada opcional
  portalTheme: string;     // cor do portal de saída (token)
}

interface EntitySpawn {
  type: "goomba" | "fool" | "coin" | "heart" | "lifecard" | "star"
      | "item" | "platform_moving" | "portal_secret" | "block" | "spring";
  col: number;
  row: number;
  // overrides opcionais por entidade:
  patrol?: [number, number];   // colunas mín/máx de patrulha
  amplitude?: number;          // p/ plataformas móveis (tiles)
  speed?: number;              // override de ENEMY_SPEED etc.
  payload?: string;            // ex.: heroId p/ lifecard
}
```

> Convenção de leitura de tilemap (igual à seção 3): linha 0 = topo, linha 10 = base; `GROUND_ROW=9` é o chão "padrão" (linha 9), linha 10 é subsolo/preenchimento. Símbolos: `.`=vazio, `=`=ground, `#`=brick, `-`=platform (one-way), `?`=block (moeda/item), `B`=block sólido, `^`=spring, `o`=coin, `H`=heart, `L`=lifecard, `S`=star, `g`=goomba, `F`=Tolo (fool), `~`=plataforma móvel, `*`=portal secreto, `>`=portal de saída (goal).

---

### 8.2 World 1 — Humanware (tema, parâmetros e estrutura de 3 fases)

**Fantasia da zona:** o herói cruza o **primeiro limiar** da Gravidade Zero. O mundo começa "pesado" (cores apagadas, gravidade sentida) e progressivamente vira leveza magenta. É o tutorial *diegético*: o medidor de coração/consciência (Superpoder Humanware, ver seção 6) é apresentado aqui, e o **MODO HUMANWARE** é destravado na fase 3. O inimigo-tema é **"O Tolo com a Ferramenta"** (variante `fool` do goomba — patrulha igual, mas segura uma "ferramenta" que ele usa errado).

**Parâmetros padrão do mundo (W1):**

| Parâmetro | Valor | Nota |
|-----------|-------|------|
| `zoneColor` | `#f43db3` (magenta-classic) | acento; ação em `#ff0055` |
| `bg` | `#09090b` base, gradiente p/ `#121216` | espaço escuro |
| `cols` por fase | W1-1: 144, W1-2: 156, W1-3: 168 | cresce ao longo do mundo |
| `rows` | 11 | padrão |
| `groundRow` | 9 | padrão |
| `goalCol` | igual a `cols-8` | portal de saída |
| `timeStart` | 250 | padrão |
| `unlockHero` | `renan` | Lifecard do Renan no fim de W1-3 |

**Heróis disponíveis em W1:** apenas o **herói inicial** (default = Renan jogável em modo "trial" mas a Lifecard formal é coletada em W1-3, destravando-o no roster para rejogar). Renante (companheiro) ainda **não** disponível.

**Mecânicas introduzidas, em ordem (currículo de design):**

| Fase | Mecânica nova | Como é ensinada |
|------|---------------|-----------------|
| W1-1 | mover, pular, coyote/buffer, stomp em **Tolo**, moedas, blocos `?` | terreno plano, gaps largos e perdoadores, 1 inimigo isolado por vez |
| W1-2 | plataformas one-way (`-`), plataformas móveis (`~`), molas (`^`), pulo encadeado, **medidor Humanware enchendo** | verticalidade leve, primeiro gap exigindo plataforma móvel |
| W1-3 | **MODO HUMANWARE** (medidor cheio congela Tolos), portais secretos (`*`), Lifecard do Renan, **portal de saída** climático | seção "gauntlet" que só fica fácil ativando o Modo Humanware |

**Posicionamento de coletáveis (regra do mundo):** moedas em "trilhas" que ensinam o arco do pulo (curvas de 5–7 moedas sobre gaps). Cada fase tem **1 coração (`H`)** que enche +25% do medidor e **1 estrela (`S`)** escondida. A **Lifecard (`L`)** aparece só em W1-3, atrás de um pequeno desafio opcional.

---

### 8.3 World 1 — design batida por batida

A "batida" (beat) é a unidade de ritmo do design: **introduzir → testar → recombinar → recompensar/respirar**. Abaixo, cada fase de W1 é descrita por seções espaciais com colunas exatas, e W1-1 inclui o tilemap completo no formato da seção 3.

#### W1-1 — "O Primeiro Passo Leve" (cols 0–143, difficulty 1)

Objetivo de ritmo: o jogador deve completar sem morrer mesmo errando. Gaps largos mas com chão de pouso amplo. Apenas 3 Tolos no total, sempre isolados. **Checkpoint** na col 72.

| Seção | Cols | Beat | Conteúdo |
|-------|------|------|----------|
| A — Respiro/intro | 0–18 | introduzir andar/pular | chão plano; 1 trilha de 5 moedas em arco baixo (ensina pulo); cena `intro` mostra o HUD do medidor vazio |
| B — Primeiro Tolo | 19–34 | testar stomp | 1 Tolo patrulhando cols 24–30; bloco `?` (moeda) na col 28 acima; mola visual ausente (ainda) |
| C — Primeiro gap | 35–52 | testar pulo de distância | gap de 3 tiles (cols 41–43) com chão amplo dos dois lados; trilha de moedas sobre o gap |
| D — Blocos & item | 53–71 | recompensar | fileira de 3 blocos `?` (cols 58,60,62): um solta **item** (cogumelo/equivalente), outros moedas; **coração `H`** na col 66 (primeira injeção de medidor) |
| E — Checkpoint + 2 Tolos | 72–96 | recombinar | checkpoint col 72; 2 Tolos (patrulhas 78–84 e 88–94) separados por bloco sólido `B` na col 86 (cobertura) |
| F — Escada de bricks | 97–118 | introduzir verticalidade leve | escada ascendente de `#` (degraus em cols 100,103,106,109) levando a uma plataforma alta com 3 moedas; **estrela `S`** escondida em bloco `?` na col 112 (alto) |
| G — Reta final + portal | 119–143 | recompensa/saída | descida suave; trilha final de moedas; **portal de saída `>`** na col 136 (`goalCol`=136 p/ cols=144) |

**Tilemap W1-1 (formato seção 3).** Mostrado em janelas de colunas (cada bloco de 36 cols), 11 linhas (0=topo … 10=base). O renderer expande para `Map<"c,r",TileKind>`.

Janela 1 — cols 0–35 (Seções A–B):
```
row0:  ....................................
row1:  ....................................
row2:  ....................................
row3:  ....................................
row4:  ..........ooooo.....................
row5:  ....................................
row6:  ............................?.......
row7:  ....................................
row8:  ........................g...........
row9:  ====================================
row10: ====================================
```
> Nota: `ooooo` (cols 10–14, row4) = arco de moedas; `?` (col 28, row6) = bloco-moeda; `g` (col 24, row8 — patrulha 24–30) = Tolo. Chão contínuo rows 9–10.

Janela 2 — cols 36–71 (Seções C–D):
```
row0:  ....................................
row1:  ....................................
row2:  ....................................
row3:  ....................................
row4:  .....ooooo..........................
row5:  ....................................
row6:  ......................?.?.?.........
row7:  ....................................
row8:  ..............................H.....
row9:  =====...=====================.......
row10: =====...============================
```
> `=====...=====` = gap de 3 tiles (cols 41–43) com pousos amplos; moedas (cols 41–45, row4) sobre o gap; trio de blocos `?` cols 58,60,62 (row6 → índices relativos 22,24,26); `H` coração col 66 (row8). Subsolo row10 fecha o gap visualmente abaixo? Não — o gap é real: rows 9 e 10 abertos nas cols 41–43.

Janela 3 — cols 72–107 (Seções E–F início):
```
row0:  ....................................
row1:  ....................................
row2:  ....................................
row3:  ............................#.......
row4:  .........................#..oo......
row5:  ......................#.............
row6:  ...................#................
row7:  ..............B.....................
row8:  ......g...........g.................
row9:  ====================================
row10: ====================================
```
> Checkpoint lógico em col 72 (metadado, não tile). Tolos: col 78 (patrulha 78–84) e col 88 (patrulha 88–94), separados pelo bloco sólido `B` col 86 (row7). Escada de bricks `#` sobe: cols 91,94,97,100 (rows 6,5,4,3); moedas no topo cols 100–101 (row4).

Janela 4 — cols 108–143 (Seções F fim–G + portal):
```
row0:  ....................................
row1:  ....................................
row2:  ....................................
row3:  ....#...............................
row4:  ....?...............................
row5:  ........................oooo........
row6:  ....................................
row7:  ....................................
row8:  ............................>.......
row9:  ====================================
row10: ====================================
```
> Plataforma alta `#` col 112 (row3) com bloco `?` logo abaixo (col 112, row4) contendo a **estrela `S`** (acesso por pulo do topo da escada). Trilha final de moedas cols 132–135 (row5). **Portal de saída `>`** col 136 (row8) = `goalCol`. (Símbolo `>` posicionado em row8 para sprite do portal apoiado no chão.)

**Spawns de W1-1 (dados):**

```ts
const W1_1_entities: EntitySpawn[] = [
  { type: "fool",  col: 24, row: 8, patrol: [24, 30] },
  { type: "block", col: 28, row: 6, payload: "coin" },
  { type: "block", col: 58, row: 6, payload: "item" },   // cogumelo
  { type: "block", col: 60, row: 6, payload: "coin" },
  { type: "block", col: 62, row: 6, payload: "coin" },
  { type: "heart", col: 66, row: 8 },                     // +25% medidor
  { type: "fool",  col: 78, row: 8, patrol: [78, 84] },
  { type: "fool",  col: 88, row: 8, patrol: [88, 94] },
  { type: "block", col: 112, row: 4, payload: "star" },   // estrela escondida
  // moedas: geradas a partir dos 'o' do tilemap (loader converte)
];
const W1_1: LevelDef = {
  id: "W1-1", world: "W1", kind: "pillar",
  cols: 144, rows: 11, groundRow: 9, goalCol: 136,
  timeStart: 250, difficulty: 1,
  checkpoints: [72], portalTheme: "#f43db3",
  intro: { type: "tutorial", showHud: ["humanware_meter"], text: "Sinta a leveza. ↑ pula, → anda." },
  tiles: W1_1_tiles /* matriz acima */, entities: W1_1_entities,
};
```

#### W1-2 — "Plataformas Flutuantes" (cols 0–155, difficulty 2.5)

Objetivo de ritmo: introduzir **verticalidade** e **timing** de plataforma móvel sem punir duro. Primeira fase onde o **medidor Humanware** enche de forma perceptível (mais corações + mais inimigos para stompar). **Checkpoints** cols 60 e 110.

| Seção | Cols | Beat | Conteúdo |
|-------|------|------|----------|
| A — One-way intro | 0–22 | introduzir `-` | duas plataformas one-way escalonadas (cols 8 e 14) com moedas; chão sólido abaixo (queda segura) |
| B — Mola | 23–40 | introduzir `^` | mola na col 30 lança a um nicho alto com bloco `?` (item) e 4 moedas; Tolo na col 34 abaixo |
| C — Plataforma móvel #1 | 41–62 | testar timing | gap de 5 tiles (cols 46–50); plataforma móvel `~` horizontal (amplitude 3 tiles, speed 1.2) atravessa; checkpoint col 60 |
| D — Combo vertical | 63–92 | recombinar one-way+mola | "torre" leve: alterna `-` e `^` subindo 4 níveis; coração `H` no topo (col 84, alto); 2 Tolos patrulhando plataformas largas |
| E — Plataforma móvel #2 (vertical) | 93–118 | escalada | plataforma móvel `~` vertical (amplitude 4, speed 1.0) sobe um poço; estrela `S` escondida num nicho lateral (col 104); checkpoint col 110 |
| F — Travessia em arquipélago | 119–146 | clímax de timing | 4 plataformas one-way pequenas sobre vazio, com 2 móveis horizontais entre elas; trilha de moedas premia rota arriscada |
| G — Portal | 147–155 | saída | plataforma de pouso ampla; **portal `>`** col 148 (`goalCol`) |

**Spawns-chave de W1-2 (dados):**
```ts
const W1_2_entities: EntitySpawn[] = [
  { type: "block", col: 18, row: 6, payload: "coin" },
  { type: "spring", col: 30, row: 8 },
  { type: "block", col: 28, row: 3, payload: "item" },
  { type: "fool",  col: 34, row: 8, patrol: [32, 38] },
  { type: "platform_moving", col: 46, row: 8, amplitude: 3, speed: 1.2 }, // horizontal
  { type: "fool",  col: 70, row: 6, patrol: [66, 74] },
  { type: "fool",  col: 80, row: 4, patrol: [78, 86] },
  { type: "heart", col: 84, row: 3 },
  { type: "platform_moving", col: 100, row: 8, amplitude: 4, speed: 1.0 }, // vertical
  { type: "block", col: 104, row: 4, payload: "star" },
  { type: "platform_moving", col: 124, row: 7, amplitude: 3, speed: 1.3 },
  { type: "platform_moving", col: 134, row: 6, amplitude: 3, speed: 1.3 },
];
const W1_2: LevelDef = {
  id: "W1-2", world: "W1", kind: "pillar",
  cols: 156, rows: 11, groundRow: 9, goalCol: 148,
  timeStart: 250, difficulty: 2.5,
  checkpoints: [60, 110], portalTheme: "#f43db3",
  tiles: W1_2_tiles, entities: W1_2_entities,
};
```
> Mecânica de plataforma móvel: o jogador herda a velocidade da plataforma ao pisar (carry). `amplitude` em tiles, oscilação senoidal; `speed` em px/frame equivalente. Plataformas one-way usam colisão só por cima (drop-through não necessário em W1).

#### W1-3 — "O Coração Acende" (cols 0–167, difficulty 4)

Objetivo de ritmo: **revelar o MODO HUMANWARE** como solução de design. Existe um "gauntlet" (cols 96–140) propositalmente denso de Tolos; o jogador chega ali com o medidor cheio (gerado pelos stomps/corações anteriores) e ativa o Modo, que **congela os Tolos** e dá pulo/ataque turbinados — a passagem fica trivial *se* o jogador entendeu o medidor. Há um caminho "no-Humanware" mais punitivo para quem não ativar. **Lifecard do Renan** e **portal climático** no fim. **Checkpoints** cols 48, 96, 140.

| Seção | Cols | Beat | Conteúdo |
|-------|------|------|----------|
| A — Aquecimento | 0–24 | reativar tudo | recombina one-way+mola+Tolo; 2 Tolos + 1 coração `H` (col 20) — começa a encher o medidor de propósito |
| B — Portal secreto | 25–47 | recompensa exploratória | bloco `?` falso na col 36 revela **portal secreto `*`** → sala-bônus de moedas (sala 12×11, 14 moedas + estrela `S`), retorna à col 47; checkpoint col 48 |
| C — Carga do medidor | 49–95 | encher até ~80% | "corredor de stomps": 5 Tolos em plataformas escalonadas, cada stomp enche o medidor; coração `H` col 78; HUD pulsa em magenta avisando "Humanware pronto" perto do fim |
| D — GAUNTLET (Modo Humanware) | 96–140 | clímax/teste da mecânica-assinatura | densidade alta: 8 Tolos + projéteis de ferramenta + 3 gaps com plataformas móveis. Com Modo ativo: Tolos congelam, pulo turbinado cruza tudo. Checkpoint col 140 logo após |
| E — Lifecard do Renan | 141–155 | recompensa narrativa | desafio de pulo opcional (3 one-way altas) leva à **Lifecard `L` do Renan** (col 150, alto). Pegar = desbloqueia Renan no roster (`unlockHero`) |
| F — Portal climático | 156–167 | saída de mundo | plataforma elevada com **portal de saída `>`** col 160 (`goalCol`=160, igual à base); efeito visual de "limiar" magenta intenso; transição p/ M-VIVO |

**Lógica do gauntlet + Modo Humanware (pseudo-código):**
```ts
// Durante a seção D (cols 96..140):
function updateFool(fool: Fool, world: WorldState) {
  if (world.humanwareActive) {
    fool.frozen = true;            // congela "O Tolo com a Ferramenta"
    fool.vx = 0;
    fool.tint = "#7112ff";         // violeta = congelado
  } else {
    fool.frozen = false;
    patrolAndShoot(fool, world);   // patrulha + dispara projétil (speed 8.5)
  }
}
// Ativação: medidor cheio + tecla de Humanware (ver seção 6)
function tryActivateHumanware(p: Player, meter: Meter) {
  if (meter.value >= meter.max && input.humanware) {
    meter.value = 0;
    world.humanwareActive = true;
    world.timeScale = 0.55;        // mundo desacelera
    p.jumpVelBonus = 0.18;         // pulo turbinado (~+18%)
    p.attackBoosted = true;
    schedule(() => world.humanwareActive = false, HUMANWARE_TIME); // ~360 frames
  }
}
```

**Spawns-chave de W1-3 (excerto):**
```ts
const W1_3_entities: EntitySpawn[] = [
  { type: "fool",  col: 12, row: 8, patrol: [10, 16] },
  { type: "fool",  col: 18, row: 8, patrol: [16, 22] },
  { type: "heart", col: 20, row: 6 },
  { type: "block", col: 36, row: 6, payload: "coin" },        // gatilho visual
  { type: "portal_secret", col: 36, row: 7 },                  // sala-bônus
  // corredor de carga (C):
  { type: "fool", col: 54, row: 7, patrol: [52, 58] },
  { type: "fool", col: 62, row: 6, patrol: [60, 66] },
  { type: "fool", col: 70, row: 7, patrol: [68, 74] },
  { type: "heart", col: 78, row: 6 },
  { type: "fool", col: 82, row: 5, patrol: [80, 88] },
  { type: "fool", col: 90, row: 7, patrol: [88, 94] },
  // GAUNTLET (D) — 8 Tolos:
  { type: "fool", col: 98,  row: 8, patrol: [96, 102] },
  { type: "fool", col: 104, row: 6, patrol: [102, 108] },
  { type: "fool", col: 110, row: 8, patrol: [108, 114] },
  { type: "fool", col: 116, row: 5, patrol: [114, 120] },
  { type: "fool", col: 122, row: 8, patrol: [120, 126] },
  { type: "platform_moving", col: 126, row: 7, amplitude: 3, speed: 1.5 },
  { type: "fool", col: 130, row: 6, patrol: [128, 134] },
  { type: "fool", col: 134, row: 8, patrol: [132, 138] },
  { type: "fool", col: 138, row: 6, patrol: [136, 140] },
  // recompensa (E):
  { type: "lifecard", col: 150, row: 3, payload: "renan" },    // desbloqueia Renan
];
const W1_3: LevelDef = {
  id: "W1-3", world: "W1", kind: "pillar",
  cols: 168, rows: 11, groundRow: 9, goalCol: 160,
  timeStart: 250, difficulty: 4,
  checkpoints: [48, 96, 140], portalTheme: "#e802cf",
  tiles: W1_3_tiles, entities: W1_3_entities,
};
const WORLD_1: WorldDef = {
  id: "W1", name: "Humanware", act: 1, zoneColor: "#f43db3",
  bgLayers: ["space_far", "platforms_mid", "magenta_glow"],
  music: "humanware_theme", unlockHero: "renan",
  stages: ["W1-1", "W1-2", "W1-3"],
};
```

**Contagem de economia de W1 (balance):** moedas totais ≈ 38 (W1-1) + 46 (W1-2) + 52 (W1-3) = 136; corações: 1 por fase (3); estrelas: 1 por fase (3, escondidas); Lifecard: 1 (Renan, W1-3); inimigos Tolo: 3 + 4 + 18 = 25. Meta de medidor: encher 1x completo é alcançável até a col 95 de W1-3 via stomps + 1 coração.

---

### 8.4 Curva de dificuldade

Dificuldade é um escalar `1..10` por fase (`LevelDef.difficulty`), derivado de 4 alavancas combinadas. O design garante uma **serra dente** (sobe dentro do ato, alivia na fase-cliente seguinte, sobe de novo) para evitar fadiga.

**Alavancas e como escalam:**

| Alavanca | W1 (cedo) | Meio (W3/M-ECOR) | Tarde (W5/SV-NASA) | Boss |
|----------|-----------|------------------|--------------------|------|
| Densidade de inimigos (Tolos / 100 cols) | 4 | 9 | 14 | — (arena) |
| Tamanho/frequência de gaps | 2–3 tiles, raros | 4–5 tiles | 5–6 tiles + móveis | — |
| Janela de timing (frames de tolerância) | ~14 | ~9 | ~6 | enigma (sem timing) |
| Recursos do jogador (heróis/medidor) | só Renan | 3 heróis + Kion buff | 5 heróis + Renante | escolha livre |
| Punição de erro (checkpoints / 100 cols) | 0.7 | 1.2 | 1.5 | reset por enigma |

**Valores de `difficulty` por estágio (alvo de curva):**

```
W1-1  1.0   ┐
W1-2  2.5   │ Ato I sobe
W1-3  4.0   ┘
M-VIVO 3.0  ← alívio (fase-cliente, gimmick > densidade)
W2-1  3.5
W2-2  4.5
W2-3  5.0
M-KION 4.0  ← alívio
W3-1  4.5
W3-2  5.5
W3-3  6.0
M-ECOR 5.0  ← alívio
W4-1  5.5
W4-2  6.5
W4-3  7.0
M-MUBA 6.0  ← alívio (mas risco $)
W5-1  6.5
W5-2  7.5
W5-3  8.0
M-JPM 7.0   ← alívio (mas labiríntico)
SV-NASA 9.0 ← clímax mecânico
BOSS  10.0  ← enigma + 3 fases de dano
```

Plotado, isso forma a serra dente desejada: cada pico de pilar é seguido por uma fase-cliente ~1.0 abaixo, e cada novo pilar supera o pico anterior. O salto W1-3→M-VIVO (4.0→3.0) ensina ao jogador que "respirar" existe, antes de o Ato II elevar o teto.

**Função de balanceamento (referência de tuning):**
```ts
// difficulty estimado a partir das alavancas (sanity-check de design, não runtime):
function estimateDifficulty(l: LevelDef): number {
  const enemyDensity = countFools(l) / (l.cols / 100);     // ~Tolos por 100 cols
  const gapPressure  = avgGapSize(l) * gapFrequency(l);
  const timingPenalty = 14 - minTimingWindowFrames(l);      // janelas menores = +difícil
  const safety = (l.checkpoints.length / (l.cols / 100));   // mais checkpoints = -difícil
  const raw = 0.45*enemyDensity + 0.30*gapPressure + 0.20*timingPenalty - 0.25*safety;
  return clamp(round(raw, 1), 1, 10);
}
```

**Acessibilidade do escopo (decisão):** como o público é interno e a diversão é o objetivo, há um modificador global opcional `assistMode` (toggle no hub) que multiplica `timeStart` por 1.5, dá +1 vida por checkpoint e reduz dano de projétil de Tolo pela metade — sem alterar a geometria das fases. Ele não muda os valores de `difficulty` (que são de design), apenas a tolerância de execução. Isso mantém o jogo "sério e expansível" enquanto permite zoeira casual no grupo.

---

### 8.5 Notas de consistência

- O **portal de saída** de toda fase usa `goalCol` (W1-1=136, W1-2=148, W1-3=160) e dispara a transição para a próxima estação do hub (ver fluxo em 8.1). A coluna 160 de W1-3 reusa exatamente a `goal` da base.
- O **MODO HUMANWARE** descrito aqui (congelar Tolos, `timeScale=0.55`, pulo/ataque turbinados) é a aplicação concreta em fase do superpoder definido na seção 6; valores numéricos (`HUMANWARE_TIME`, taxa de enchimento) são propriedade da seção 6 e apenas referenciados.
- O inimigo **`fool`** ("O Tolo com a Ferramenta") herda o comportamento de patrulha+stomp do goomba da base e adiciona projétil (`speed 8.5`, da base) — detalhamento completo do AI/hitbox é da seção 7.
- A **estrela `S`** reaproveita o power-up de invencibilidade da base (`STAR_TIME=480`); em W1 ela é colecionável de score/segredo, distinto do Modo Humanware.
- Lifecards são o mecanismo de desbloqueio de roster definido no CONTEXTO; W1 entrega **Renan**. Renante (companheiro) só é obtido em **M-JPM** (ver 8.1), nunca em W1.

---

## 9. Coletaveis & Progressao

Esta secao define toda a economia de coletaveis, a espinha dorsal de progressao da campanha e o ciclo de recompensa do jogador. Tudo aqui e **data-driven** (ver secao 2 sobre a stack Vite + TypeScript): coletaveis sao instancias de dados, nao codigo hard-coded. As constantes de fisica e tamanhos vem da base (TILE=48; moeda 26px; item 30px) e sao reusadas. Onde houver overlap, referencio: HUD/feedback (ver secao 7), roster e habilidades (ver secao 4), fases e clientes (ver secao 8), MODO HUMANWARE (ver secao 6), chefes/Esfinge (ver secao 10).

### 9.0 Visao geral do loop de progressao

```
COLETAR Super Skills ───► pontuacao + enche o medidor HUMANWARE (ver secao 6)
COLETAR Lifecard ───────► desbloqueia personagem jogavel (persistente)
COLETAR Playbook ───────► power-up temporario na fase atual
COLETAR Fragmento ──────► 1 das 3 Transformacoes (persistente, marco de fim de fase-chefe)
3 Fragmentos ───────────► CONSCIENCIA UNIFICADA ───► fase final + condicao de vitoria
```

Tres camadas de coletavel:

| Camada | Coletavel | Escopo | Persiste entre fases? | Salva no perfil? |
|---|---|---|---|---|
| Economia | Super Skill | Por fase | Nao (reseta visual; total acumula) | Sim (`totalSuperSkills`) |
| Buff | Playbook | Por fase | Nao (efeito acaba ou morre com o dano) | Nao |
| Meta-progressao | Lifecard | Global | Sim | Sim (`unlockedCharacters`) |
| Macro-progressao | Fragmento de Transformacao | Global | Sim | Sim (`fragments`) |

Persistencia: `localStorage` chave `gz_save_v1` (JSON serializado da interface `SaveData`, definida em 9.8). Save autonomatico ao concluir qualquer fase e ao pegar Lifecard/Fragmento.

---

### 9.1 Super Skills (moedas reskinadas)

As moedas da base (`coin`, 26px) sao reskinadas como **Super Skills**: orbes magenta de energia/conhecimento que o heroi absorve. Tematicamente sao "centelhas de skill" espalhadas pelas zonas — colhe-las representa o heroi recuperando capacidade tecnica/criativa enquanto avanca em Gravidade Zero.

Visual (placeholder em codigo, ver pipeline de arte na secao 11): losango/quadrado girando (radius 0, pixel quadrado) em magenta-site `#e802cf` com nucleo lima `#cdf140` e sombra dura offset (2px, 2px) em burgundy `#990033`. Animacao: rotacao senoidal de escala horizontal (efeito "spinning coin") em ciclo de 32 frames.

#### 9.1.1 Tipos de Super Skill

| id | Nome | Cor nucleo | Valor (pontos) | Enche HUMANWARE | Raridade / onde aparece |
|---|---|---|---|---|---|
| `skill.spark` | Centelha | lima `#cdf140` | 100 | +1 | Comum — trilhas, blocos `?` |
| `skill.flow` | Fluxo | azul `#0099ff` | 250 | +3 | Incomum — caminhos alternativos, plataformas altas |
| `skill.mastery` | Maestria | violeta `#7112ff` | 1000 | +8 | Rara — segredos, fim de secao de salto |

- 1 Centelha = unidade base. 100 Centelhas = 1 vida extra (ver 9.6.3).
- O medidor HUMANWARE precisa de 100 pontos de carga (ver secao 6); valores acima sao os pontos de carga que cada skill injeta. Pegar ~100 Centelhas, ~34 Fluxos ou ~13 Maestrias enche o medido do zero.

#### 9.1.2 Interface de dados

```ts
// src/data/types.ts
export type SuperSkillId = "skill.spark" | "skill.flow" | "skill.mastery";

export interface SuperSkillDef {
  id: SuperSkillId;
  label: string;          // "Centelha"
  scoreValue: number;     // 100 / 250 / 1000
  humanwareCharge: number;// 1 / 3 / 8
  lifeShardValue: number; // quantas "unidades" conta p/ a vida extra (1 / 3 / 12)
  frameKey: string;       // chave no atlas FRAMES (ver secao 5)
  coreColor: string;      // token de cor
}

export const SUPER_SKILLS: Record<SuperSkillId, SuperSkillDef> = {
  "skill.spark":   { id: "skill.spark",   label: "Centelha", scoreValue: 100,  humanwareCharge: 1, lifeShardValue: 1,  frameKey: "skill_spark",   coreColor: "#cdf140" },
  "skill.flow":    { id: "skill.flow",    label: "Fluxo",    scoreValue: 250,  humanwareCharge: 3, lifeShardValue: 3,  frameKey: "skill_flow",    coreColor: "#0099ff" },
  "skill.mastery": { id: "skill.mastery", label: "Maestria", scoreValue: 1000, humanwareCharge: 8, lifeShardValue: 12, frameKey: "skill_mastery", coreColor: "#7112ff" },
};

// Instancia colocada na fase (data-driven, ver secao 8)
export interface SuperSkillInstance {
  type: SuperSkillId;
  col: number;  // coluna em tiles
  row: number;  // linha em tiles
  fromBlock?: boolean; // true = sai de bloco ? ao bump
}
```

#### 9.1.3 Coleta (pseudo-codigo)

```ts
function onPlayerOverlapSkill(p: Player, s: SuperSkillInstance, run: RunState) {
  const def = SUPER_SKILLS[s.type];
  run.score += def.scoreValue;
  run.skillsCollected += 1;
  run.lifeShardAccumulator += def.lifeShardValue;
  humanware.addCharge(def.humanwareCharge); // ver secao 6
  if (run.lifeShardAccumulator >= 100) {     // 100 unidades = 1 vida
    run.lifeShardAccumulator -= 100;
    run.lives += 1;
    spawnFloatingText("1UP", s, "#cdf140"); // ver secao 7
  }
  spawnPickupParticles(s, def.coreColor);    // particulas magenta/lima
  sfx.play("skill_pickup");
  removeSkill(s);
}
```

#### 9.1.4 Distribuicao por fase (alvos de design)

| Tipo de fase | Centelhas | Fluxos | Maestrias | Total minimo p/ encher HUMANWARE 1x |
|---|---|---|---|---|
| Tutorial (Z-00) | 40 | 4 | 0 | facil (~52 pts) |
| Fase padrao | 80–120 | 8–14 | 2–4 | sobra |
| Fase-cliente (Vivo/Kion/etc., ver secao 8) | 90–140 | 10–16 | 3–6 | sobra |
| Fase-chefe / Esfinge | 30–50 | 4–6 | 1–2 | apertado (incentiva combate, ver secao 10) |

Regra de design: nenhuma fase exige coletar 100% das Super Skills para terminar; coletar tudo e recompensado com o ranking S (ver 9.7).

---

### 9.2 Os 3 Fragmentos de Transformacao -> Consciencia Unificada

O eixo macro da campanha (ver lore na secao 1 e mapa-mundo na secao 8). O heroi precisa reunir as **3 Transformacoes** — Existencial, Cultural e Digital — cada uma materializada como um **Fragmento de Transformacao**. Reunir os 3 ativa a **CONSCIENCIA UNIFICADA**, que abre a fase final e e a condicao de vitoria do jogo.

#### 9.2.1 Os tres Fragmentos

| id | Transformacao | Cor | Drop de | Bonus permanente concedido | Lema |
|---|---|---|---|---|---|
| `frag.existential` | Existencial | violeta `#7112ff` | Chefe do Mundo 1 | +1 vida maxima base; medidor HUMANWARE enche 10% mais rapido | "Conhece-te" |
| `frag.cultural` | Cultural | magenta-classic `#f43db3` | Chefe do Mundo 2 | MODO HUMANWARE dura +20% (ver secao 6) | "Pertence" |
| `frag.digital` | Digital | azul `#0099ff` | Chefe do Mundo 3 (a ESFINGE, ver secao 10) | Habilidade do personagem ativo recarrega 15% mais rapido | "Amplifica" |

Os 3 bonus sao cumulativos e persistentes (gravados em `SaveData.fragments`), valendo em qualquer fase/personagem dali em diante. Tematicamente sao a doutrina Gzero: as 3 Transformacoes que somam na Consciencia Unificada.

#### 9.2.2 Como e onde coletar

- Fragmentos **nao** ficam soltos no cenario. Cada um e o premio garantido por derrotar o chefe do seu mundo (ver secao 10). Ao vencer o chefe, o Fragmento aparece flutuando no centro da arena com pulso de luz; tocar nele dispara cutscene curta de absorcao e a transicao de fim de fase.
- Coleta e idempotente: se o jogador refizer uma fase-chefe ja vencida (replay), o Fragmento aparece como "ja absorvido" (silhueta) e nao concede o bonus de novo, mas ainda conta para a tela de resultado.
- Ordem: o mapa-mundo (secao 8) gateia os mundos linearmente (Mundo 2 exige `frag.existential`, etc.), entao os Fragmentos sao naturalmente coletados em ordem Existencial -> Cultural -> Digital.

#### 9.2.3 Consciencia Unificada e condicao de vitoria

```ts
export type FragmentId = "frag.existential" | "frag.cultural" | "frag.digital";

export interface UnifiedConsciousness {
  readonly required: FragmentId[]; // os 3
  isAchieved(save: SaveData): boolean;
}

export const UNIFIED: UnifiedConsciousness = {
  required: ["frag.existential", "frag.cultural", "frag.digital"],
  isAchieved: (save) => UNIFIED.required.every(f => save.fragments[f] === true),
};
```

- Quando `isAchieved` vira `true`, o mapa-mundo desbloqueia a **fase final "Consciencia Unificada"** (Mundo 4, fase unica). Um aviso aparece: "As 3 Transformacoes ressoam. A Consciencia te chama."
- Vitoria do jogo = concluir a fase final. Ao tocar o goal final (coluna 160, GROUND_ROW=9 reusados da base), a maquina de estados vai para `state = "win"` global (distinto do `win` de fim de fase), com a tela de creditos e a frase de vitoria da marca:
  > **"Voce tambem acredita que podemos mudar o mundo? Bora juntos."**
- Pre-condicao de acesso a fase final no codigo de transicao do mapa:

```ts
function canEnterFinalLevel(save: SaveData): boolean {
  return UNIFIED.isAchieved(save);
}
```

- A fase final usa o MODO HUMANWARE de forma ritual (ver secao 6) e termina com o confronto-enigma de fechamento da Esfinge ja resolvido no Mundo 3, agora ecoando a doutrina ("um tolo com uma ferramenta continua sendo um tolo").

---

### 9.3 Lifecards (desbloqueiam personagens)

A marca Gzero ja usa "Lifecards" (ver lore, secao 1). Aqui sao **cartas colecionaveis** que desbloqueiam os personagens jogaveis do roster (ver secao 4). Cada personagem tem exatamente uma Lifecard.

#### 9.3.1 Tabela de Lifecards

| Lifecard | Personagem | Habilidade desbloqueada | Onde esta escondida | Inicial? |
|---|---|---|---|---|
| `card.renan` | Renan | Salto Visionario (pulo alto/duplo; revela portais) | Disponivel desde o inicio | **Sim** |
| `card.dante` | Dante | Dash Criativo (investida que quebra obstaculos) | Mundo 1, fase 2 — sala secreta atras de blocos `block` quebraveis | Nao |
| `card.julio` | Julio | Escudo de Governanca (bloqueia 1 dano) | Mundo 1, fase-chefe — recompensa por nao tomar dano na luta | Nao |
| `card.artur` | Artur | Builder (cria plataforma/ferramenta temporaria) | Mundo 2, fase-cliente — alcancavel so usando o Dash de Dante (gate de habilidade) | Nao |
| `card.einstein` | Einstein | E=mc2 (desacelera o tempo) | Mundo 3, segredo no alto revelado pelo Salto Visionario de Renan | Nao |
| `card.renante` | Renante (companheiro IA, ver 9.3.4) | Amplifica habilidade ativa | Mundo 3, apos derrotar a Esfinge (junto do `frag.digital`) | Nao |

Renan e jogavel desde o comeco; os demais exigem encontrar a Lifecard. Varias Lifecards estao atras de **gates de habilidade** (precisa de outro personagem ja desbloqueado), criando backtracking opcional pelo mapa-mundo — leve metroidvania dentro do platformer.

#### 9.3.2 Visual e coleta

- Visual placeholder: carta retangular 30px de largura (mesma escala do `item`=30 da base) com borda magenta `#ff0055`, fundo escuro `#121216`, inicial do personagem (G/Z/E/R/O ou retrato) em pixel branco. Flutua com bob senoidal e brilho pulsante.
- Ao coletar: pausa breve (freeze de 40 frames), zoom na carta, banner "LIFECARD DESBLOQUEADA — [Nome]", e o personagem fica selecionavel na tela de selecao (ver secao 7). Som de fanfarra.

```ts
export type CharacterId = "renan" | "dante" | "julio" | "artur" | "einstein";
export type LifecardId = `card.${CharacterId}` | "card.renante";

export interface LifecardDef {
  id: LifecardId;
  character: CharacterId | "renante";
  worldRef: string;     // "w1.l2", para o spawn na fase (ver secao 8)
  requiresAbility?: string; // gate: "dash" | "highjump" ... (id da habilidade necessaria p/ alcancar)
}

export interface LifecardInstance {
  id: LifecardId;
  col: number;
  row: number;
}
```

#### 9.3.3 Logica de desbloqueio

```ts
function onCollectLifecard(card: LifecardInstance, save: SaveData) {
  const def = LIFECARDS[card.id];
  if (def.character === "renante") {
    save.companionUnlocked = true;
  } else if (!save.unlockedCharacters.includes(def.character)) {
    save.unlockedCharacters.push(def.character);
  }
  persistSave(save); // localStorage gz_save_v1
  showLifecardBanner(def);
  sfx.play("lifecard_unlock");
}
```

#### 9.3.4 Renante (companheiro, nao personagem)

Renante e a IA da marca e **nunca** age sozinho (ver secao 4 e 6): sua Lifecard ativa um **toggle de companheiro** na selecao. Quando ligado, Renante orbita o heroi e **amplifica a habilidade atual** do personagem ativo:

| Personagem ativo | Habilidade base | Amplificacao do Renante |
|---|---|---|
| Renan | Salto Visionario | Pulo duplo vira triplo; raio de revelacao de portal +50% |
| Dante | Dash Criativo | Dash atravessa 1 inimigo a mais sem parar |
| Julio | Escudo de Governanca | Escudo absorve 2 danos em vez de 1 |
| Artur | Builder | Plataforma criada dura +50% e fica 1 tile mais larga |
| Einstein | E=mc2 | Slow-time dura +30% |

Renante e puramente de suporte: nao causa dano direto, fiel a doutrina "IA amplifica, nao substitui".

---

### 9.4 Playbooks (power-ups)

Os power-ups da base (item de power-up estrela etc.) sao reskinados como **Playbooks** — itens 30px que saem de blocos `?`/`block` (bump, reusando a logica de bump da base) ou ficam escondidos. Tematicamente sao "jogadas" / ferramentas-de-trabalho da Gzero que viram potencia (alinhado ao MODO HUMANWARE, secao 6). Sao **temporarios** e ficam ativos so na fase atual (ou ate o timer expirar / o heroi tomar dano, conforme o item).

#### 9.4.1 Tabela completa de Playbooks (efeitos numericos)

| id | Nome | Efeito (numeros concretos, base na secao do CONTEXTO) | Duracao | Empilha? | Cor |
|---|---|---|---|---|---|
| `pb.cafe` | Cafe (Crescimento) | Heroi cresce: hitbox 34x42 -> 38x54; aguenta 1 hit a mais (vira "grande"; ao tomar dano volta a pequeno em vez de morrer) | Ate tomar dano | Nao (estado on/off) | lima `#cdf140` |
| `pb.flowState` | Flow State | WALK_MAX 4.6->5.6, RUN_MAX 7.3->8.6, RUN_ACCEL 0.95->1.15 | 600 frames (~10s) | Renova timer | azul `#0099ff` |
| `pb.guardrail` | Guardrail | Concede 1 escudo absorve-dano (parecido com Escudo do Julio, mas item) | Ate absorver 1 hit | +1 escudo (max 2) | violeta `#7112ff` |
| `pb.estrela` | Estrela da Consciencia | Invencibilidade (port direto do power-up estrela da base) + inimigos "Tolo" levam dano ao contato | STAR_TIME=480 frames | Renova timer | magenta-site `#e802cf` (cor de acao) |
| `pb.projetil` | Tool Throw | Habilita arremesso de projetil (speed 8.5 da base); 3 cargas | Ate gastar 3 cargas | +3 cargas (max 9) | pink `#ff0055` |
| `pb.lifeUp` | 1UP | +1 vida imediata | Instantaneo | n/a | branco `#f7f3f6` |
| `pb.springJump` | Mola (Salto Reforcado) | Proximo pulo: JUMP_VEL -15.4 -> -19.0 (1 uso) | 1 pulo | +1 carga (max 3) | magenta-classic `#f43db3` |

Notas de equilibrio:
- `pb.estrela` e o item raro/poderoso, 1–2 por fase no maximo.
- `pb.cafe` e o "cogumelo" funcional: estado de tamanho que da margem de erro de 1 hit. Interage com `pb.guardrail` (escudo conta antes do tamanho).
- Numeros usam as constantes do CONTEXTO como linha de base e aplicam multiplicadores fixos (declarados acima, sem TBD).

#### 9.4.2 Interface e ordem de resolucao de dano

```ts
export type PlaybookId =
  | "pb.cafe" | "pb.flowState" | "pb.guardrail" | "pb.estrela"
  | "pb.projetil" | "pb.lifeUp" | "pb.springJump";

export interface PlaybookDef {
  id: PlaybookId;
  label: string;
  durationFrames: number;   // 0 = instantaneo, -1 = ate condicao (dano/uso)
  stackMode: "renew" | "addCharge" | "toggle" | "instant";
  maxCharges?: number;      // para addCharge
  apply(p: Player, run: RunState): void;
  tick?(p: Player, run: RunState): void; // por frame enquanto ativo
}

// Ordem de absorcao de dano (do primeiro ao ultimo consumido):
// 1) pb.estrela ativo  -> dano ignorado (invencivel)
// 2) Escudo de Governanca / pb.guardrail -> consome 1 escudo
// 3) pb.cafe (grande)  -> vira pequeno (consome o estado)
// 4) nenhum dos acima  -> perde 1 vida (ver 9.6)
function resolveDamage(p: Player, run: RunState) {
  if (p.flags.star) return;            // 1
  if (p.shields > 0) { p.shields--; return; } // 2
  if (p.size === "big") { p.size = "small"; p.iframes = 90; return; } // 3
  loseLife(run);                        // 4
}
```

#### 9.4.3 Spawn e fonte

- De blocos: na config da fase (ver secao 8), um bloco `?`/`block` carrega `{ contains: PlaybookId | SuperSkillId }`. Ao dar bump (logica portada da base), o item sobe 1 tile e fica coletavel.
- Soltos: `PlaybookInstance { id, col, row }` direto no cenario, geralmente em rotas de risco.
- HUD: itens com timer mostram barra/contagem regressiva; cargas (projetil, mola) mostram contador (ver secao 7).

---

### 9.5 Bonus e segredos auxiliares

Para encher de detalhe a economia (sem novos sistemas pesados):

| Coletavel | Efeito | Onde |
|---|---|---|
| Letra Gzero (G, Z, E, R, O) | Colecione as 5 letras de "GZERO" numa mesma fase -> bonus de 5.000 pts + 1 vida | 1 letra escondida por secao, 5 secoes/fase |
| Portal-segredo | Atalho que pula um trecho; revelado pelo Salto Visionario de Renan | Fases de Mundo 1 e 3 |
| Caixa-cliente | Cofre tematico do cliente da fase (Vivo/Kion/Ecorodovias/Mubadala/JPMorgan, ver secao 8); da 3 Fluxos + 1 Maestria | 1 por fase-cliente |

As 5 letras G/Z/E/R/O reaproveitam os SVGs de letras do design (ver secao 1 e 11). O conjunto "GZERO" e um colecionavel-piada da marca, alinhado ao tom interno/zoeira-grounded.

---

### 9.6 Pontuacao, vidas e tempo

#### 9.6.1 Tabela de pontos

| Acao | Pontos |
|---|---|
| Centelha (`skill.spark`) | 100 |
| Fluxo (`skill.flow`) | 250 |
| Maestria (`skill.mastery`) | 1.000 |
| Stomp em "Tolo" (inimigo, ver secao 10) | 200 |
| Stomp encadeado (combo, n-esimo no ar) | 200 x (n) ate cap 8.000 |
| Inimigo morto via projetil/dash/estrela | 150 |
| Inimigo congelado eliminado em MODO HUMANWARE | 300 |
| Letra Gzero coletada | 1.000 cada |
| Conjunto "GZERO" completo | +5.000 (alem das letras) + 1UP |
| Caixa-cliente | (valor dos itens dentro) |
| Fragmento de Transformacao | 25.000 |
| Lifecard | 10.000 |
| Cada segundo restante no fim da fase | 50 |
| Cada Super Skill nao coletada na fase | 0 (mas reduz % de coleta -> afeta rank) |

#### 9.6.2 Combo de stomp (pseudo-codigo)

```ts
function onStompEnemy(p: Player, e: Enemy, run: RunState) {
  if (!p.grounded) run.airComboIndex += 1; else run.airComboIndex = 1;
  const pts = Math.min(200 * run.airComboIndex, 8000);
  run.score += pts;
  spawnFloatingText(`+${pts}`, e, "#ff0055"); // ver secao 7
  p.vy = STOMP_BOUNCE; // -11.5 da base
}
// run.airComboIndex zera ao tocar o chao.
```

#### 9.6.3 Vidas

- Vidas iniciais: 3. Maximo: 9 (HUD mostra contador, nao icones empilhados infinitamente).
- 1UP via: 100 unidades de Super Skill (ver 9.1.3), item `pb.lifeUp`, conjunto "GZERO" completo.
- Bonus permanente de `frag.existential`: +1 ao maximo e ao inicial (passa a comecar com 4).
- Game over: ao chegar a 0 vidas, `state = "over"` (maquina de estados da base). Reinicia o mundo atual do ultimo checkpoint/inicio de fase; Fragmentos e Lifecards ja coletados **permanecem** (sao persistentes), Super Skills/Playbooks da fase resetam.

#### 9.6.4 Tempo

- `TIME_START = 250` por fase (da base). Conta regressiva. Em 0 sem terminar = perde 1 vida e reinicia a fase.
- Em MODO HUMANWARE (ver secao 6), o relogio do mundo desacelera, mas **o cronometro da fase pausa** (justo: o slow nao deve drenar tempo punindo o jogador).
- Tempo restante vira pontos no fim (50/segundo, ver 9.6.1) e alimenta o rank.

---

### 9.7 Tela de resultado de fim de fase

Disparada no estado `win` (fim de fase, distinto da vitoria global do jogo, ver 9.2.3). Layout segue a direcao visual (fundo `#09090b`, magenta de acao, pixel quadrado radius 0, sombras duras, fontes Outfit display + mono UPPERCASE nos labels — ver secao 1 e 7).

#### 9.7.1 Conteudo da tela

```
┌──────────────────────────────────────────────┐
│  FASE LIMPA — [NOME DA ZONA]                   │  (Outfit display)
│                                                │
│  SUPER SKILLS .......  87 / 110     (79%)      │  (mono UPPERCASE)
│  TEMPO RESTANTE .....  62  x50  = 3.100         │
│  STOMPS / COMBO MAX .  9   / x4                 │
│  LETRAS GZERO .......  G Z E R O  (completo!)   │
│  HUMANWARE USADO ....  2x                       │
│  SEM DANO ...........  SIM  (+5.000)            │
│  ─────────────────────────────────────────     │
│  PONTOS DA FASE .....  41.250                   │
│  TOTAL ACUMULADO ....  118.700                  │
│                                                │
│            RANK:  [ S ]                         │  (selo magenta, animado)
│                                                │
│  [↵ CONTINUAR]     [R REJOGAR]                  │
└──────────────────────────────────────────────┘
```

#### 9.7.2 Calculo de rank (D a S)

Rank por **pontuacao da fase + criterios de pureza**. Base = pontos da fase normalizados por um alvo por fase (`targetScore`, definido na config da fase, ver secao 8). Bonus de criterio elevam o rank.

```ts
export type Rank = "D" | "C" | "B" | "A" | "S";

export interface LevelResult {
  levelId: string;
  skillsCollected: number;
  skillsTotal: number;
  timeRemaining: number;
  maxCombo: number;
  humanwareUses: number;
  tookDamage: boolean;
  gzeroSetComplete: boolean;
  levelScore: number;
  targetScore: number; // da config da fase
}

export function computeRank(r: LevelResult): Rank {
  const ratio = r.levelScore / r.targetScore;      // 1.0 = no alvo
  const coverage = r.skillsCollected / r.skillsTotal;
  let tier =
    ratio >= 1.25 ? 4 :  // S-base
    ratio >= 1.00 ? 3 :  // A
    ratio >= 0.75 ? 2 :  // B
    ratio >= 0.50 ? 1 :  // C
                    0;   // D
  // Bonus de pureza
  if (!r.tookDamage) tier += 1;
  if (coverage >= 0.90) tier += 1;
  if (r.gzeroSetComplete) tier += 1;
  tier = Math.min(tier, 4);
  return (["D", "C", "B", "A", "S"] as const)[tier];
}
```

- **Rank S** exige, na pratica: ficar no alvo de pontos + pelo menos dois entre {sem dano, 90%+ coleta, GZERO completo}. Recompensa S: selo no perfil por fase (`SaveData.levelStats[levelId].bestRank`) e desbloqueia uma paleta-skin alternativa do personagem ao alcancar S em todas as fases de um mundo (cosmetico, sem efeito de gameplay).

#### 9.7.3 Acoes da tela

- **Continuar** (`Enter`): salva (`persistSave`), volta ao mapa-mundo (ver secao 8) ou inicia transicao de cutscene se foi fase-chefe (Fragmento absorvido).
- **Rejogar** (`R`): recarrega a mesma fase para melhorar o rank; mantem desbloqueios persistentes.
- Se a Consciencia Unificada acabou de ser atingida nesta fase (3o Fragmento), a tela encadeia o aviso de desbloqueio da fase final antes de retornar ao mapa.

---

### 9.8 Modelo de save persistente

Toda meta-progressao numa unica estrutura serializavel (`localStorage` chave `gz_save_v1`). RunState e por-jogada (memoria), SaveData e persistente.

```ts
export interface LevelStat {
  cleared: boolean;
  bestRank: Rank;
  bestScore: number;
  bestSkillCoverage: number; // 0..1
  gzeroSetDone: boolean;
}

export interface SaveData {
  version: 1;
  totalScore: number;
  totalSuperSkills: number;            // acumulado lifetime
  unlockedCharacters: CharacterId[];   // sempre inclui "renan"
  companionUnlocked: boolean;          // Renante
  fragments: Record<FragmentId, boolean>;
  levelStats: Record<string, LevelStat>;
  unlockedSkins: string[];             // recompensa de rank S por mundo
  lastWorld: string;                   // checkpoint no mapa-mundo (ver secao 8)
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  totalScore: 0,
  totalSuperSkills: 0,
  unlockedCharacters: ["renan"],
  companionUnlocked: false,
  fragments: { "frag.existential": false, "frag.cultural": false, "frag.digital": false },
  levelStats: {},
  unlockedSkins: [],
  lastWorld: "w1.l1",
};
```

```ts
// RunState: estado volatil de uma jogada/fase (nao persiste)
export interface RunState {
  score: number;
  lives: number;
  time: number;               // frames de TIME_START
  skillsCollected: number;
  skillsTotal: number;
  lifeShardAccumulator: number; // 0..99
  airComboIndex: number;
  maxCombo: number;
  humanwareUses: number;
  tookDamage: boolean;
  gzeroLetters: Set<"G"|"Z"|"E"|"R"|"O">;
  activePlaybooks: Map<PlaybookId, number>; // id -> frames/cargas restantes
}
```

Helpers de persistencia:

```ts
function persistSave(s: SaveData) {
  localStorage.setItem("gz_save_v1", JSON.stringify(s));
}
function loadSave(): SaveData {
  const raw = localStorage.getItem("gz_save_v1");
  if (!raw) return structuredClone(DEFAULT_SAVE);
  try {
    const parsed = JSON.parse(raw) as SaveData;
    return parsed.version === 1 ? parsed : structuredClone(DEFAULT_SAVE);
  } catch { return structuredClone(DEFAULT_SAVE); }
}
```

Build single-file (ver secao 2): o mesmo `gz_save_v1` funciona; ao compartilhar o HTML no grupo da Gzero, cada pessoa mantem seu proprio save no navegador.

---

### 9.9 Resumo de consistencia entre secoes

- Super Skills alimentam o medidor HUMANWARE (secao 6) e a pontuacao (9.6).
- Lifecards desbloqueiam o roster (secao 4); Renante so amplifica (secao 4/6).
- Fragmentos saem de chefes (secao 10) e gateiam o mapa-mundo (secao 8) ate a Consciencia Unificada = vitoria.
- Playbooks reusam bump/estrela/projetil/STOMP_BOUNCE/JUMP_VEL/STAR_TIME da base (CONTEXTO), com multiplicadores fixos declarados.
- Tela de resultado e save seguem a direcao visual e a stack data-driven (secoes 1, 2, 7).

---

## 10. Visual, UI/HUD & Marca

Esta secao define a camada visual completa de "Gravidade Zero — O Jogo": paleta com papeis exatos, tipografia, grid de pixel art, especificacao de cada tela (com wireframes textuais), uso do logo, opcoes de pos-processamento (CRT/scanline), acessibilidade e as regras de marca. Tudo aqui e data-driven e implementavel em TypeScript sobre Canvas 2D (ver secao 2 para stack). A direcao e a "C — Hibrido": fundo escuro/espaco + MAGENTA como cor de acao, pixel art quadrado (radius 0), sombras duras com offset.

### 10.1 Paleta de cores (tokens canonicos)

Os tokens vivem em `C:\Users\artur\Área de Trabalho\Gzero\Diretriz_Design_Gzero\tokens.css` e sao reespelhados no codigo do jogo como modulo TS (`src/render/palette.ts`) para nao depender de CSS dentro do canvas. Hexes sao FIXOS — nunca aproximar "no olho".

#### 10.1.1 Tabela mestra de cores

| Token | Hex | Papel no jogo | Onde aparece |
|---|---|---|---|
| `bg-void` | `#050505` | Fundo absoluto / vinheta externa / letterbox | Atras de tudo, barras de aspect-ratio |
| `bg-space` | `#09090b` | Fundo de espaco padrao (camada mais distante) | Parallax camada 0, telas de menu |
| `bg-panel` | `#121216` | Superficie de paineis/cards/HUD | Caixas de HUD, modais, pause |
| `surface-raised` | `#1c1c22` | Superficie elevada (card focado, slot) | Card selecionado na selecao de heroi |
| `surface-line` | `#2a2a33` | Linhas/divisores/grade sutil | Bordas internas, separadores |
| `ink` | `#f7f3f6` | Texto claro principal | Titulos, valores de HUD |
| `ink-dim` | `#a8a2ad` | Texto secundario/labels apagados | Subtitulos, dicas, rodape |
| `ink-mute` | `#6b6670` | Texto desabilitado/placeholder | Itens travados, hint fraco |
| `action` (pink-op) | `#ff0055` | COR DE ACAO primaria: foco, dano, perigo, CTA | Cursor de menu, barra de vida, hit flash |
| `magenta-classic` | `#f43db3` | Magenta de marca: destaque amigavel, coletaveis | Moedas/lifecards glow, partculas de coleta |
| `magenta-site` | `#e802cf` | Magenta saturado: acento de portal/transformacao | Portais, aura de habilidade |
| `neon-blue` | `#0099ff` | Neon frio: Renan/visionario, info, links | Habilidade Renan, tooltips de info |
| `neon-lime` | `#cdf140` | Neon quente-frio: sucesso, energia, Dante | Feedback positivo, dash de Dante, +tempo |
| `violet` | `#7112ff` | Violeta profundo: Humanware/consciencia | Medidor Humanware, modo Humanware |
| `violet-alt` | `#612af1` | Violeta secundario (gradiente Humanware) | Segunda parada do gradiente Humanware |
| `burgundy` | `#990033` | Risco/sangue de marca: aviso grave, game over | Tela de game over, dano critico |
| `star-gold` | `#ffd23f` | Power-up estrela (invencibilidade) | Aura/piscar da estrela (herdado da base) |
| `shadow-hard` | `#000000` @ 55% | Sombra dura com offset (pixel) | Texto, sprites, paineis |

Notas de papel:
- `action` (#ff0055) e a UNICA cor que pode "gritar". Reserve para foco, perigo e a acao mais importante de cada tela. Nao pintar areas grandes com ela.
- `magenta-classic`/`magenta-site` sao a familia "amigavel" de marca — coletaveis e portais. Diferencia perigo (vermelho-pink) de recompensa (magenta).
- `violet`/`violet-alt` pertencem EXCLUSIVAMENTE ao Humanware (ver secao 6). Nenhum outro sistema usa violeta como cor principal, para o jogador aprender "violeta = consciencia".
- Cada heroi tem uma cor-assinatura (ver 10.1.3) usada em portrait frame, trail e UI de habilidade.

#### 10.1.2 Modulo TS da paleta

```ts
// src/render/palette.ts
export const PALETTE = {
  bgVoid:        '#050505',
  bgSpace:       '#09090b',
  bgPanel:       '#121216',
  surfaceRaised: '#1c1c22',
  surfaceLine:   '#2a2a33',
  ink:           '#f7f3f6',
  inkDim:        '#a8a2ad',
  inkMute:       '#6b6670',
  action:        '#ff0055', // pink operacional — perigo/foco/CTA
  magentaClassic:'#f43db3',
  magentaSite:   '#e802cf',
  neonBlue:      '#0099ff',
  neonLime:      '#cdf140',
  violet:        '#7112ff', // Humanware
  violetAlt:     '#612af1',
  burgundy:      '#990033',
  starGold:      '#ffd23f',
} as const;

export type ColorToken = keyof typeof PALETTE;

// Helper para alpha sem alocar string toda hora em hot loops:
// hexA('#ff0055', 0.55) -> 'rgba(255,0,85,0.55)'
const _hexCache = new Map<string, [number, number, number]>();
export function hexA(hex: string, alpha: number): string {
  let rgb = _hexCache.get(hex);
  if (!rgb) {
    const n = parseInt(hex.slice(1), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _hexCache.set(hex, rgb);
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

// Gradiente canonico do Humanware (usar sempre estes dois stops):
export const HUMANWARE_GRADIENT: [string, string] = [PALETTE.violet, PALETTE.violetAlt];
```

#### 10.1.3 Cores-assinatura do roster

Cada heroi (ver secao 3) recebe UMA cor de marca, usada na moldura do retrato, no trail/particulas da habilidade e no acento da UI de selecao. Escolhidas da paleta existente para coerencia:

| Heroi | Cor-assinatura | Token | Justificativa |
|---|---|---|---|
| Renan | `#0099ff` | `neonBlue` | "Salto Visionario" — frio, revela segredos/portais |
| Dante | `#cdf140` | `neonLime` | "Dash Criativo" — energia/velocidade |
| Julio | `#ff0055` | `action` | "Escudo de Governanca" — alerta/guardrail (cor de protecao) |
| Artur | `#f43db3` | `magentaClassic` | "Builder" — magenta de marca, ele e o dono da marca |
| Einstein | `#f7f3f6` | `ink` | "E=mc2" — cabelo branco, contraste de "genio/luz" |
| Renante (IA) | `#7112ff` | `violet` | Companheiro Humanware — amplifica, cor de consciencia |

```ts
// src/data/heroColors.ts
export const HERO_COLOR: Record<string, ColorToken> = {
  renan: 'neonBlue',
  dante: 'neonLime',
  julio: 'action',
  artur: 'magentaClassic',
  einstein: 'ink',
  renante: 'violet',
};
```

### 10.2 Tipografia

Tres familias, todas autohospedadas em `public/fonts/` (sem CDN, para funcionar no build single-file e offline):

| Familia | Uso | Pesos | Transformacao |
|---|---|---|---|
| **Outfit** | Display: titulos, nome do jogo, headings de tela | 600, 800 | normal |
| **Inter** | Corpo: descricoes, dialogos, tooltips, legendas | 400, 600 | normal |
| **JetBrains Mono** | Labels/HUD/numeros: tempo, moedas, score, tags | 500, 700 | **UPPERCASE** |

Regra de marca: TODO label de HUD, badge e tag e mono UPPERCASE (ex.: `TEMPO`, `MOEDAS`, `HUMANWARE`, `LVL MAX`, `MISSAO IA`). Texto de leitura corrida (descricao de heroi, lore) e Inter em caixa normal.

#### 10.2.1 Escala tipografica (em pixels INTERNOS, ver 10.3)

Tamanhos sao expressos no espaco interno 480x264 e escalam junto com o canvas. Para nitidez pixel, usar tamanhos inteiros e fontes em px sem subpixel quando possivel.

| Estilo | Familia / peso | Tamanho (px internos) | Line-height | Uso |
|---|---|---|---|---|
| `display-xl` | Outfit 800 | 48 | 1.0 | Nome do jogo na splash |
| `display-l` | Outfit 800 | 32 | 1.05 | Titulo de tela (PAUSA, VITORIA) |
| `display-m` | Outfit 600 | 20 | 1.1 | Nome do heroi na selecao |
| `body` | Inter 400 | 12 | 1.4 | Descricoes, lore |
| `body-strong` | Inter 600 | 12 | 1.4 | Enfase em corpo |
| `label` | Mono 700 | 10 | 1.0 | Labels de HUD (UPPERCASE) |
| `label-sm` | Mono 500 | 8 | 1.0 | Micro-labels, rodape |
| `value` | Mono 700 | 16 | 1.0 | Valores numericos do HUD |

Para o canvas, declarar fonts assim:

```ts
// src/render/text.ts
export const FONTS = {
  displayXL: '800 48px Outfit, system-ui, sans-serif',
  displayL:  '800 32px Outfit, system-ui, sans-serif',
  displayM:  '600 20px Outfit, system-ui, sans-serif',
  body:      '400 12px Inter, system-ui, sans-serif',
  bodyStrong:'600 12px Inter, system-ui, sans-serif',
  label:     "700 10px 'JetBrains Mono', monospace",
  labelSm:   "500 8px 'JetBrains Mono', monospace",
  value:     "700 16px 'JetBrains Mono', monospace",
} as const;

// Sombra dura: desenhar o texto deslocado em shadow-hard ANTES do texto claro.
export function drawHardText(
  ctx: CanvasRenderingContext2D, txt: string, x: number, y: number,
  font: string, color: string, offset = 2, upper = false,
) {
  if (upper) txt = txt.toUpperCase();
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(txt, x + offset, y + offset);
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
}
```

Carregamento (preload via `FontFace` antes do estado `loading` terminar; ver secao 2 sobre boot). O @font-face fica no CSS da pagina host para o DOM (overlays), mas o canvas usa o mesmo `font-family` apos `document.fonts.ready`.

```css
/* index.css (host) */
@font-face { font-family:'Outfit'; src:url('/fonts/Outfit-ExtraBold.woff2') format('woff2'); font-weight:800; font-display:block; }
@font-face { font-family:'Outfit'; src:url('/fonts/Outfit-SemiBold.woff2') format('woff2'); font-weight:600; font-display:block; }
@font-face { font-family:'Inter'; src:url('/fonts/Inter-Regular.woff2') format('woff2'); font-weight:400; font-display:block; }
@font-face { font-family:'Inter'; src:url('/fonts/Inter-SemiBold.woff2') format('woff2'); font-weight:600; font-display:block; }
@font-face { font-family:'JetBrains Mono'; src:url('/fonts/JetBrainsMono-Medium.woff2') format('woff2'); font-weight:500; font-display:block; }
@font-face { font-family:'JetBrains Mono'; src:url('/fonts/JetBrainsMono-Bold.woff2') format('woff2'); font-weight:700; font-display:block; }
```

### 10.3 Grid de pixel: resolucao, escala, tamanhos de sprite

Decisao central: o jogo renderiza numa **resolucao interna fixa de 480x264** e e escalado por inteiro (`integer scaling`) ate caber no viewport, mantendo a janela canonica de **960x528** (= 2x). Isto preserva a fisica e os assets da base (TILE=48 no mundo) e ao mesmo tempo da o "look" pixel quadrado.

> Esclarecimento importante: existem DOIS espacos.
> - **Espaco-mundo** (fisica/colisao): usa as constantes da base — `TILE=48`, player 34x42, etc. Camera com clamp (ver secao 5).
> - **Espaco-render/UI** (este documento): buffer interno **480x264**, depois `ctx.scale(SCALE)` para a tela. O mundo e desenhado dentro desse buffer; o fator entre mundo e buffer e definido pela camera/viewport.

Para a UI (HUD, menus, telas), trabalhamos diretamente no espaco interno 480x264, garantindo crispness. Para o mundo, mantemos a render existente da base (TILE=48) num canvas logico de 960x528 e o tratamos como a camada "2x"; HUD/overlays sao desenhados por cima no mesmo contexto ja escalado.

#### 10.3.1 Constantes de render

```ts
// src/render/viewport.ts
export const RENDER = {
  INTERNAL_W: 480,
  INTERNAL_H: 264,
  CANON_W: 960,      // janela canonica = 2x interno
  CANON_H: 528,
  BASE_SCALE: 2,     // 480x264 -> 960x528
  PIXEL_RADIUS: 0,   // marca: cantos quadrados, SEMPRE
  SHADOW_OFFSET: 2,  // px internos, sombra dura
} as const;

// Integer scaling: maior inteiro k tal que (480k, 264k) cabe no container.
export function computeScale(containerW: number, containerH: number): number {
  const k = Math.max(1, Math.floor(Math.min(
    containerW / RENDER.INTERNAL_W,
    containerH / RENDER.INTERNAL_H,
  )));
  return k;
}

export function setupCanvas(canvas: HTMLCanvasElement): void {
  const k = computeScale(canvas.parentElement!.clientWidth, canvas.parentElement!.clientHeight);
  canvas.width  = RENDER.INTERNAL_W * k;
  canvas.height = RENDER.INTERNAL_H * k;
  // CSS pode esticar levemente para preencher (letterbox preto = bg-void).
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; // CRITICO p/ pixel art nitido
  ctx.setTransform(k, 0, 0, k, 0, 0); // tudo desenhado em coords 480x264
}
```

`image-rendering: pixelated` no CSS do `<canvas>` e obrigatorio; `imageSmoothingEnabled=false` no contexto idem. Letterbox (sobra do aspect-ratio) sempre `bg-void` (#050505).

#### 10.3.2 Tamanhos de sprite (atlas)

Sprites de gameplay herdam as caixas logicas da base (espaco-mundo), e a arte e desenhada na malha da base (TILE=48). Como referencia pixel "nativa" para a arte do Higgsfield e placeholders, definimos a malha-fonte de 16 px por celula de personagem, ampliada 3x no atlas (cada sprite-cell = 48 px de fonte), mantendo TILE=48 coerente:

| Entidade | Caixa de colisao (mundo) | Sprite-cell no atlas | Origem do desenho | Grid de autoria |
|---|---|---|---|---|
| Tile | 48x48 | 48x48 | canto sup-esq | 16x16 @3x |
| Player (herois) | 34x42 | 48x64 | base centralizada | 16x21 @3x, ancora pe |
| Inimigo "Tolo" | 38x34 | 48x48 | base centralizada | 16x16 @3x |
| Moeda | 26 (diam.) | 32x32 | centro | 16x16 @2x |
| Lifecard (coletavel) | 30x42 | 32x44 | centro | carta vertical |
| Item/power | 30 | 32x32 | centro | 16x16 @2x |
| Projetil | ~14 | 16x16 | centro | 16x16 @1x |
| Estrela (star) | 30 | 32x32 | centro | herdado da base |
| Portal | 96x144 (mundo) | 96x144 | base | animado 4 quadros |

Padrao de nomeacao no mapa `FRAMES` (compativel com a base): `entidade_estado_NN`, ex.: `renan_idle_00`, `renan_run_03`, `tolo_walk_01`, `coin_spin_02`. Cada heroi compartilha a MESMA base de corpo pixel (mesmas dimensoes e poses), variando paleta + um traco marcante (ver secao 4 sobre pipeline de arte). Animacoes minimas por heroi:

| Estado | Quadros | FPS de anim | Observacao |
|---|---|---|---|
| idle | 2 | 4 | respiro leve |
| run | 4 | 12 | ciclo de corrida |
| jump (subindo) | 1 | — | pose unica |
| fall (caindo) | 1 | — | pose unica |
| skill (habilidade) | 3 | 14 | trail na cor-assinatura |
| hurt | 1 | — | piscar (ver 10.6) |

### 10.4 Telas: wireframes textuais

Todas as telas vivem na maquina de estados herdada da base (`loading → title → select → playing → pause → win → over`; ver secao 5). Layout descrito no espaco interno 480x264. `[ ]` = caixa/painel; ascii apenas ilustrativo das proporcoes.

#### 10.4.1 Splash / Loading

Fundo `bg-void` com leve campo de estrelas estatico. Centro: favicon `G0_favcon_Vector.svg` (branco) pulsando suavemente (escala 0.96–1.0, 1.2 s, respeitando reduced-motion). Abaixo, barra de progresso fina (`action` sobre `surface-line`), largura 200 px, altura 4 px, radius 0. Label mono: `CARREGANDO GRAVIDADE ZERO`.

```
+------------------------------------------------------------+ bg-void
|                                                            |
|                          [G0]   (favicon branco, pulsa)    |
|                                                            |
|              [############--------]  (barra action)        |
|              CARREGANDO GRAVIDADE ZERO                     |
+------------------------------------------------------------+
```

#### 10.4.2 Titulo (title)

Fundo: parallax de espaco (`bg-space` + estrelas + plataformas flutuantes distantes em silhueta `bg-panel`). Logo `LogoInteira_[Vectorized].svg` ("GERZO") grande no terco superior. Subtitulo display: `O JOGO`. Tagline Inter dim: "Devolva a leveza ao mundo." Menu vertical centralizado, item ativo com cursor `▸` em `action` + leve glow magenta. Rodape mono dim: versao + `INTERNO — GZERO`.

```
+------------------------------------------------------------+
|   * .      *        [  LOGO "GERZO" SVG ]        .   *      |
|                         O JOGO                             |
|              Devolva a leveza ao mundo.                    |
|                                                            |
|                    ▸ JOGAR                                 |
|                      ESCOLHER HEROI                        |
|                      OPCOES                                |
|                      CREDITOS                              |
|                                                            |
|  v0.1.0                                  INTERNO — GZERO   |
+------------------------------------------------------------+
```

Itens de menu: `JOGAR`, `ESCOLHER HEROI`, `OPCOES`, `CREDITOS`. Navegacao por teclado/gamepad (ver 10.6.3). Hover/selecao: card sobe para `surface-raised`, label vira `ink`, cursor `action`.

#### 10.4.3 Selecao de heroi (select)

Carrossel horizontal de 5 cards jogaveis + slot do companheiro Renante (toggle). Card grande central mostra retrato key-art (Higgsfield) com moldura na cor-assinatura (10.1.3) e sombra dura. Painel lateral direito: nome (display-m), habilidade (mono UPPERCASE), descricao (body), e estado de desbloqueio (Lifecard). Herois travados: retrato em silhueta `ink-mute` + cadeado + texto `COLETE A LIFECARD`.

```
+------------------------------------------------------------+
|  ESCOLHER HEROI                          [G0]              |
|                                                            |
|  <   [ ]   [ ]   [ ===== ]   [ ]   [ ]   >                 |
|       din   art   |RETRATO|   jul   ein                    |
|                   |  key  |   +-------------------------+  |
|                   | art   |   | RENAN                   |  |
|                   [=======]   | SALTO VISIONARIO        |  |
|                               | Pulo duplo; revela      |  |
|   [x] RENANTE (companheiro)   | portais e segredos.     |  |
|                               | LIFECARD: DESBLOQUEADA  |  |
|                               +-------------------------+  |
|  [<- ->] NAVEGAR   [ENTER] CONFIRMAR   [R] RENANTE         |
+------------------------------------------------------------+
```

Toggle Renante: checkbox mono `[x] RENANTE (companheiro)` — quando ligado, aura `violet` sutil ao redor do card. Confirmar leva a `playing` com o heroi escolhido (ver secao 3/6 para efeitos).

Estrutura de dados que alimenta a tela (consistente com secao 3):

```ts
// src/data/roster.ts
export interface HeroCardView {
  id: string;                 // 'renan' | 'dante' | ...
  name: string;
  skillName: string;          // mono UPPERCASE: 'SALTO VISIONARIO'
  description: string;        // Inter body
  colorToken: ColorToken;     // moldura/trail
  portraitKey: string;        // chave do atlas de retratos (Higgsfield/placeholder)
  bodyBaseKey: string;        // base de corpo pixel
  unlock: { byLifecard: string; unlocked: boolean };
}
```

#### 10.4.4 HUD (durante playing)

HUD sempre legivel sobre o mundo. Faixa superior semi-transparente (`bg-panel` @ 70%) com 12 px de altura util, padding 8 px. Da esquerda para a direita:

1. **Heroi**: mini-retrato 16x16 com moldura na cor-assinatura + nome curto mono.
2. **Vidas**: icone favicon G0 pequeno x N (ex.: `G0 x 3`).
3. **Moedas**: icone moeda + valor (mono value), cor `magentaClassic`.
4. **Tempo**: label `TEMPO` + valor regressivo (comeca em `TIME_START=250`; pisca `action` abaixo de 30).
5. **Score** (opcional, alinhado a direita): mono value.

Canto inferior-esquerdo: **medidor Humanware** — barra vertical (ou arco de coracao) com gradiente `violet → violet-alt`, contorno `surface-line`, label mono `HUMANWARE`. Quando cheio: pulso + texto `PRONTO — [SHIFT]`. Durante MODO HUMANWARE: borda da tela ganha vinheta `violet` animada e o medidor esvazia (ver secao 6).

Power-up estrela ativo: aura `star-gold` no player + indicador de tempo restante (mini-barra). Habilidade do heroi com cooldown: pequeno anel/relogio na cor-assinatura ao lado do mini-retrato.

```
+------------------------------------------------------------+
| [R]RENAN  G0 x3   ()coin 12   TEMPO 187      SCORE 004200  |
|                                                            |
|                      .  mundo / gameplay  .                |
|                                                            |
|  [||||| ]                                                  |
|  HUMANWARE                                                 |
+------------------------------------------------------------+
```

Interface do estado de HUD:

```ts
// src/ui/hud.ts
export interface HudState {
  heroId: string;
  heroColor: ColorToken;
  lives: number;
  coins: number;
  timeLeft: number;       // frames/segundos restantes (regressivo)
  score: number;
  humanware: number;      // 0..1
  humanwareReady: boolean;
  humanwareActive: boolean;
  starTimeLeft: number;   // 0 = sem estrela; senao frames (STAR_TIME=480 base)
  skillCooldown: number;  // 0..1 (0 = pronto)
  companion: boolean;     // Renante ligado
}

export const HUD_LAYOUT = {
  barH: 12, pad: 8, miniPortrait: 16,
  humanwareBar: { x: 8, y: 264 - 8 - 64, w: 10, h: 64 }, // canto inf-esq
  timeWarnBelow: 30,
} as const;
```

#### 10.4.5 Pause

Overlay escurece o mundo (`bg-void` @ 70%, sem blur — pixel art nao borra). Painel central `bg-panel` com borda `surface-line`, titulo display-l `PAUSA`. Menu: `CONTINUAR`, `OPCOES`, `REINICIAR FASE`, `SAIR PARA O TITULO`. Mesmo padrao de cursor `action`. Mostra heroi atual e fase no rodape do painel.

```
+------------------------------------------------------------+
|######################### (escurecido) #####################|
|              +----------------------------+                |
|              |          PAUSA             |                |
|              |                            |                |
|              |   ▸ CONTINUAR              |                |
|              |     OPCOES                 |                |
|              |     REINICIAR FASE         |                |
|              |     SAIR PARA O TITULO     |                |
|              |                            |                |
|              |  RENAN  ·  FASE 1: VIVO    |                |
|              +----------------------------+                |
+------------------------------------------------------------+
```

#### 10.4.6 Vitoria (win)

Fundo de portal aberto (`magenta-site` + raios). Titulo display-l `VITORIA` em `ink` com glow magenta. Painel de resultados (mono): tempo restante, moedas, score, Lifecards coletadas. Se for o fim do arco (Consciencia Unificada), exibir a frase canonica de marca em destaque Inter 600: "Voce tambem acredita que podemos mudar o mundo? Bora juntos." Botoes: `PROXIMA FASE` / `MENU`.

```
+------------------------------------------------------------+
|        \  |  /        VITORIA         \  |  /              |
|       --  ()  -- (portal magenta)    --  ()  --            |
|              +----------------------------+                |
|              | TEMPO ......... 187         |               |
|              | MOEDAS ........ 24          |               |
|              | SCORE ......... 008600      |               |
|              | LIFECARDS ..... 2/5         |               |
|              +----------------------------+                |
|   "Voce tambem acredita que podemos mudar o mundo?         |
|                    Bora juntos."                           |
|        ▸ PROXIMA FASE        MENU                          |
+------------------------------------------------------------+
```

#### 10.4.7 Game over (over)

Fundo `bg-void` com vinheta `burgundy`. Titulo display-l `GAME OVER` em `burgundy`/`ink`. Subtexto tematico curto (lore): "A gravidade venceu desta vez." Inimigo-tema pode aparecer em silhueta. Opcoes: `TENTAR DE NOVO`, `ESCOLHER HEROI`, `MENU`.

```
+------------------------------------------------------------+
|::::::::::::::::: (vinheta burgundy) ::::::::::::::::::::::::|
|                                                            |
|                      GAME OVER                             |
|              A gravidade venceu desta vez.                 |
|                                                            |
|                 ▸ TENTAR DE NOVO                           |
|                   ESCOLHER HEROI                           |
|                   MENU                                     |
|                                                            |
+------------------------------------------------------------+
```

### 10.5 Uso do logo e iconografia

Assets em `C:\Users\artur\Área de Trabalho\Gzero\Logo_Gzero_vetores\`:

| Asset | Onde usar | Regras |
|---|---|---|
| `LogoInteira_[Vectorized].svg` ("GERZO") | Tela de titulo, tela de vitoria final, splash de creditos | Sempre sobre fundo escuro; nunca esticar; margem de respiro >= altura do "G"; cor original ou monocromatico `ink` |
| `G0_favcon_Vector.svg` (branco) | Favicon do browser, icone de vidas no HUD, loading, marca d'agua de canto | Versao branca SO em fundo escuro; tamanho minimo 16x16 px internos |
| Letras `G/Z/E/R/O` (individuais) | Transicoes, badges de mundo/fase, decoracao de menu | Podem ser recoloridas com tokens; usar como "selo", nao como texto corrido |

Regras transversais do logo:
- Renderizar SVGs em DOM-overlay (HTML por cima do canvas) OU pre-rasterizar para PNG nitido no `BASE_SCALE`. Nunca desenhar SVG borrado dentro do canvas.
- Nunca aplicar gradiente, sombra suave ou outline arredondado ao logo. Sombra, se houver, e dura com offset 2 px.
- O favicon G0 e o "icone-marca" do jogo: vidas, marca d'agua, loading. Consistencia reforca a marca interna.
- Em vitoria final, o "GERZO" pode "reacender" (animacao de neon ligando) — efeito permitido, sem distorcer a forma.

### 10.6 Pos-processamento: CRT / Scanline (herdado e expandido)

A base ja tem opcao de scanline; mantemos e formalizamos como pipeline opcional, aplicado ao buffer final ANTES do upscale para tela (ou via overlay CSS leve, o que custar menos). Tres niveis configuraveis:

| Modo | Efeito | Custo | Default |
|---|---|---|---|
| `off` | Nenhum pos-processamento | 0 | — |
| `scanlines` | Linhas escuras horizontais (1 px a cada 2), alpha ~0.12 sobre `bg-void` | baixo | **on** (default) |
| `crt` | Scanlines + leve curvatura de vinheta + aberracao cromatica magenta/ciano de 1 px nas bordas | medio | — |

```ts
// src/render/postfx.ts
export interface PostFxConfig {
  mode: 'off' | 'scanlines' | 'crt';
  scanlineAlpha: number;   // 0.12
  vignette: number;        // 0..1 (crt: 0.25)
  aberration: number;      // px (crt: 1)
}

export const POSTFX_DEFAULT: PostFxConfig = {
  mode: 'scanlines', scanlineAlpha: 0.12, vignette: 0.25, aberration: 1,
};
```

Regras: CRT/scanline NUNCA borra a arte (sem blur gaussiano). A aberracao cromatica usa magenta/ciano (coerente com a marca) e fica em 1 px para nao prejudicar leitura do HUD. `reduced-motion` reduz qualquer flicker animado do CRT a estatico. Tudo desligavel em Opcoes (10.7).

### 10.7 Acessibilidade

Tela `OPCOES` (acessivel do titulo e do pause) cobre acessibilidade e preferencias. Tudo persiste em `localStorage` (`gz:options`).

```ts
// src/options.ts
export interface GameOptions {
  reducedMotion: boolean;     // detecta prefers-reduced-motion; usuario pode forcar
  colorblindMode: 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  highContrast: boolean;      // reforca bordas/contraste do HUD
  postfx: PostFxConfig['mode'];
  screenShake: number;        // 0..1 (0 desliga; reduced-motion forca 0)
  flashIntensity: number;     // 0..1 piscar de dano/estrela (epilepsia-safe quando baixo)
  masterVolume: number; sfxVolume: number; musicVolume: number;
  keymap: Keymap;             // ver 10.7.3
}

export const OPTIONS_DEFAULT: GameOptions = {
  reducedMotion: false, colorblindMode: 'off', highContrast: false,
  postfx: 'scanlines', screenShake: 0.6, flashIntensity: 0.6,
  masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.6, keymap: DEFAULT_KEYMAP,
};
```

#### 10.7.1 Reduced motion

- Respeita `window.matchMedia('(prefers-reduced-motion: reduce)')` por padrao; opcao manual sobrepoe.
- Quando ativo: desativa `screenShake` (forca 0), remove parallax animado (vira camadas estaticas), congela pulsos/glow de UI (estado fixo), troca transicoes de tela por cross-fade rapido (<=120 ms) ou corte seco, e o CRT vira estatico.
- O gameplay/fisica NAO mudam — so a apresentacao.

#### 10.7.2 Daltonismo / contraste

- Como a marca usa magenta (acao) + vermelho-pink (perigo) + verde-lima (sucesso), nunca depender SO de cor para informacao. Reforcos redundantes obrigatorios:
  - **Forma/icone**: perigo = inimigo/spike com silhueta clara; sucesso = `+` e icone; coletavel = brilho + forma de moeda/carta.
  - **Texto/label**: estados criticos sempre tem label mono (ex.: tempo `< 30` ganha label piscando + numero, nao so cor).
- Modos `colorblindMode` aplicam uma LUT (lookup) leve de re-mapeamento ao buffer final OU trocam pares de cores conflitantes por presets seguros (ex.: sucesso vira `neon-blue` em deuteranopia em vez de `neon-lime`). Implementacao via filtro de matriz no buffer interno (barato em 480x264).
- `highContrast`: aumenta opacidade do fundo do HUD para 90%, adiciona contorno `ink` 1 px aos labels e engrossa a moldura do card selecionado.

```ts
// src/render/colorblind.ts — matrizes 3x3 aplicadas no buffer final
export const CB_MATRICES = {
  off:         null,
  protanopia:  [0.567,0.433,0,  0.558,0.442,0,  0,0.242,0.758],
  deuteranopia:[0.625,0.375,0,  0.7,0.3,0,      0,0.3,0.7],
  tritanopia:  [0.95,0.05,0,    0,0.433,0.567,  0,0.475,0.525],
} as const;
```

#### 10.7.3 Remapeamento de teclas

Todas as acoes sao remapeaveis na tela OPCOES > CONTROLES, com suporte a teclado e gamepad. Defaults (consistentes com a base):

| Acao | Tecla padrao | Alt | Gamepad |
|---|---|---|---|
| Mover esquerda | `ArrowLeft` | `A` | D-pad/stick esq. |
| Mover direita | `ArrowRight` | `D` | D-pad/stick dir. |
| Pular | `Space` | `K` | A (sul) |
| Correr / acao | `ShiftLeft`+dir, ou `J` | — | X (oeste) |
| Habilidade do heroi | `Z` | — | B (leste) |
| MODO HUMANWARE | `ShiftRight` | `H` | RT/R2 |
| Pause | `Escape` | `P` | Start |
| Confirmar (menu) | `Enter` | `Space` | A |
| Voltar (menu) | `Escape` | `Backspace` | B |

```ts
// src/input/keymap.ts
export type GameAction =
  | 'left' | 'right' | 'jump' | 'run' | 'skill'
  | 'humanware' | 'pause' | 'confirm' | 'back';

export type Keymap = Record<GameAction, string[]>; // KeyboardEvent.code[]

export const DEFAULT_KEYMAP: Keymap = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyK'], run: ['ShiftLeft', 'KeyJ'], skill: ['KeyZ'],
  humanware: ['ShiftRight', 'KeyH'], pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'], back: ['Escape', 'Backspace'],
};
```

Regras de remapeamento: deteccao de conflito (avisa em `action`), botao `RESTAURAR PADRAO`, e a UI mostra o glyph correto conforme o ultimo dispositivo usado (teclado vs gamepad). O coyote time (`COYOTE=7`) e o jump buffer (`JUMP_BUFFER=8`) seguem da fisica base (ver secao 5) e ajudam acessibilidade motora.

#### 10.7.4 Outras provisoes

- **Legibilidade**: tamanho minimo de texto interativo = `body` (12 px internos = 24 px @2x). HUD nunca abaixo de `label` (10 px).
- **Foco visivel**: navegacao de menu por teclado sempre mostra cursor `action` + moldura; nunca foco "invisivel".
- **Flash-safe**: `flashIntensity` limita piscar (dano, estrela) a frequencias seguras (< 3 flashes/s) e amplitude reduzida; default conservador (0.6).
- **Pausa amigavel**: `Escape` pausa de qualquer ponto do gameplay; perda de foco da janela (`blur`) auto-pausa.

### 10.8 Regras de marca para o jogo (do que fazer / evitar)

A marca Gzero ja e "RPG por natureza" (Lifecards, LVL MAX, Super Skills, MISSAO IA) e o publico e INTERNO — ha latitude para zoeira/in-jokes, desde que ancorada na marca e na lore (ver secao 1). Diretrizes:

**FACA:**
- Use a paleta canonica (10.1) com `action` (#ff0055) reservado a foco/perigo/CTA.
- Pixel art SEMPRE quadrada (radius 0), sombras duras com offset 2 px.
- Labels/HUD em mono UPPERCASE; corpo em Inter caixa normal.
- Reaproveite o vocabulario de marca como rotulos de jogo: `LVL MAX`, `SUPER SKILL`, `MISSAO IA`, `LIFECARD`, `HUMANWARE`. Eles ja sao da casa.
- Trate violeta como "consciencia/Humanware" e magenta como "acao/coletavel" de forma CONSISTENTE — o jogador aprende a linguagem de cor.
- Honre a lore nos textos de tela: portais, "devolver leveza", as 3 Transformacoes, a Esfinge como chefe-enigma, a frase de vitoria canonica.
- Mantenha as in-jokes da equipe (Renante = Renan+Dante, Einstein = "PAI do Renan", clientes virando fases) carinhosas e reconheciveis.
- Mantenha contraste alto entre HUD e mundo; HUD legivel em qualquer fase.

**EVITE:**
- Cantos arredondados, gradientes suaves no logo, glow gaussiano borrado, drop-shadows macios (quebram o look pixel/duro da marca).
- Pintar areas grandes com `#ff0055` ou usar essa cor para algo que nao seja foco/perigo/CTA.
- Usar violeta fora do contexto Humanware ou magenta para perigo (confunde a gramatica de cor).
- Esticar/distorcer/recolorir o logo "GERZO" fora das regras (10.5); favicon branco em fundo claro.
- Texto fora de marca (gírias datadas, memes externos sem ligacao com a Gzero) — a zoeira deve ser "in-house", nao internet generica.
- Conteudo que ridicularize clientes reais (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan): eles viram fases-desafio respeitosas, nao alvos de deboche.
- Misturar fontes fora do trio (Outfit/Inter/JetBrains Mono).
- Quebrar a doutrina central na narrativa: "IA amplifica, nao substitui"; o herois sempre AGEM, e Renante so amplifica (ver secao 6) — a UI deve refletir isso (Renante nunca tem barra de acao propria).

**Latitude informal (permitido por ser interno):** textos de loading/dicas com humor da Gzero, easter eggs com nomes da equipe, "achievements" de zoeira (ex.: `LVL MAX EM CAFE`), variacoes de fala de vitoria — desde que mantenham paleta, tipografia e tom de marca, e nunca comprometam legibilidade ou a doutrina Humanware.

### 10.9 Resumo de constantes desta secao

| Constante | Valor | Onde |
|---|---|---|
| Resolucao interna | 480x264 | render/UI |
| Janela canonica | 960x528 (2x) | viewport |
| Pixel radius | 0 | tudo |
| Sombra dura offset | 2 px internos | texto/sprites/paineis |
| Scanline alpha (default) | 0.12 | postfx |
| Fontes | Outfit / Inter / JetBrains Mono | tipografia |
| HUD barra superior | 12 px util, pad 8 | hud |
| Humanware bar | 10x64 px, canto inf-esq | hud |
| Aviso de tempo | `< 30` pisca `action` | hud |
| Cor de acao | `#ff0055` | foco/perigo/CTA |
| Cor Humanware | `#7112ff → #612af1` | medidor/modo |

---

## 11. Pipeline de Arte (Higgsfield -> Sprites)

Esta seção define o pipeline completo de produção de arte de personagem para o jogo: do retrato key-art gerado no Higgsfield ao sprite pixel empacotado no atlas e descrito no manifesto consumido pelo runtime. O princípio operacional é **placeholder-first**: o jogo nasce 100% jogável com corpos desenhados em código (formas vetoriais no Canvas), e a arte do Higgsfield substitui esses placeholders por troca de dados (manifesto + atlas), sem tocar na lógica de gameplay. Consistência com o roster (ver seção sobre Roster e Personagens), a direção visual híbrida C (fundo escuro/espaço + magenta de ação) e os tokens de marca Gzero é obrigatória em todo o pipeline.

> **Aviso de risco operacional (registrado em 2026-06-08):** as operações de conta do conector Higgsfield (`balance`, `media_upload`, `list_workspaces`, `select_workspace`) estão retornando "Something went wrong" — provável falha de auth/sessão do conector ou outage. Enquanto não houver reconexão validada, **nenhuma etapa do pipeline é bloqueante para o desenvolvimento do jogo**, porque o jogo roda inteiro com placeholders (ver 11.7). A produção de arte é uma trilha paralela e assíncrona. O fallback completo está em 11.8.

---

### 11.1 Visão geral do pipeline

```
[Foto de referência]                [Higgsfield Cloud]              [Pós-proc local]              [Build]
 selfies do Artur  ───────►  upload (media_upload) ──►  generate_image ──►  baixar PNG  ──►  downscale  ──►  quantizar  ──►  remover fundo  ──►  empacotar atlas  ──►  manifesto.json
 selfies da equipe          (img2img: nano_banana_pro     (job_display /      (raw key-art)    (grid pixel)   (paleta Gzero)   (alfa duro)        (PNG sprite-sheet)   (consumido no runtime)
 (fotos reais)               ou soul_2)                    show_generations)
```

Cada etapa tem entrada, saída e critério de aceite definidos. O pipeline é **idempotente por personagem**: regenerar um personagem não afeta os demais; o atlas é remontado a partir dos PNGs de sprite individuais versionados em disco.

Estágios e diretórios canônicos (todos sob `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld\`):

| Estágio | Diretório | Conteúdo | Versionado em git? |
|---|---|---|---|
| 0. Referência (input) | `art/refs/<personagem>/` | fotos selecionadas para img2img | Não (links/ponteiros) |
| 1. Key-art bruto (Higgsfield) | `art/keyart/raw/<personagem>/` | PNG full-res direto do Higgsfield | Não (LFS opcional) |
| 2. Key-art curado | `art/keyart/final/<personagem>.png` | retrato escolhido, 1024x1024 | Sim |
| 3. Pixel cru (pós-downscale) | `art/pixel/raw/<personagem>/` | poses em grid pixel, antes de quantizar | Não |
| 4. Sprite final por pose | `art/pixel/final/<personagem>/<pose>.png` | PNG RGBA quantizado, fundo removido | Sim |
| 5. Atlas empacotado | `public/assets/atlas/characters.png` | sprite-sheet único | Sim |
| 6. Manifesto | `public/assets/atlas/characters.manifest.json` | coordenadas + metadados | Sim |

> Fotos de referência (origem, conforme contexto): Artur em `C:\Users\artur\Área de Trabalho\Artur-Fotos-Avatar` (100 selfies); equipe em `C:\Users\artur\Área de Trabalho\Gzero\Higgsfield\Selfies` (17 fotos). Esses caminhos NÃO entram no repositório; o estágio 0 copia/symlinka as 1-3 melhores por personagem para `art/refs/<personagem>/`.

---

### 11.2 Entregáveis por personagem

Para cada um dos 5 jogáveis + o companheiro Renante, o pipeline produz **dois entregáveis primários** (retrato key-art + corpo pixel) e um conjunto de poses pixel derivadas.

**A. Retrato key-art (Higgsfield)** — 1 por personagem, usado em telas de UI (não no gameplay):
- Resolução: 1024x1024 px, RGBA, PNG.
- Usos: tela de seleção de personagem, card de desbloqueio da "Lifecard", HUD secundário, telas de vitória/derrota.
- Enquadramento: busto/meio-corpo, olhar para a câmera, fundo escuro espacial (#09090b) com leve halo magenta.

**B. Corpo pixel (sprite)** — base consistente para todos, com paleta + traço marcante por personagem. Mesma silhueta de **player 34x42** (constante da base, ver seção de Física), desenhada/exportada numa **célula de atlas de 48x48 px** (igual ao `TILE=48`, com padding interno de 3px de cada lado).

**Conjunto de poses pixel obrigatórias por personagem** (mínimo viável jogável):

| Pose | Frames | Tamanho da célula | Uso |
|---|---|---|---|
| `idle` | 2 | 48x48 | parado (respiração) |
| `walk` | 4 | 48x48 | andar (WALK_MAX 4.6) |
| `run` | 4 | 48x48 | correr (RUN_MAX 7.3) |
| `jump` | 1 | 48x48 | subindo (vy < 0) |
| `fall` | 1 | 48x48 | caindo (vy > 0) |
| `hurt` | 1 | 48x48 | dano/knockback |
| `power_humanware` | 2 | 48x48 | MODO HUMANWARE ativo (aura) |
| `ability` | 2 | 48x48 | habilidade própria (ver tabela 11.3) |

Total por personagem: **17 frames pixel** + **1 key-art**. Para 6 personagens: **102 frames pixel** + **6 key-arts**.

**C. Lifecard (derivado, sem nova geração)**: card 256x384 montado em runtime ou em build a partir do key-art (B) recortado + moldura SVG Gzero + nome em fonte mono UPPERCASE. Não exige rodada extra no Higgsfield.

---

### 11.3 Runbook do Higgsfield

#### 11.3.1 Escolha de modelo

| Critério | `nano_banana_pro` (image-to-image) | `soul_2` |
|---|---|---|
| Modo | foto -> pixel (img2img), fiel à referência | estilização mais autoral, menos literal |
| Uso primário | **padrão para todos os 5 humanos** (preserva rosto/identidade real) | fallback se nano_banana_pro perder semelhança; gerar Renante (IA, sem foto real) |
| Strength sugerido | 0.55–0.70 (mantém traços faciais) | 0.70–0.85 |
| Quando usar | Renan, Dante, Julio, Artur, Einstein | Renante; variações de estilo; retentativa criativa |

Decisão travada: **`nano_banana_pro` é o modelo default para os 5 jogáveis humanos** (img2img a partir de selfie real garante semelhança), e **`soul_2` é o default para Renante** (mascote IA sem foto de origem) e o fallback de estilo dos humanos.

#### 11.3.2 Ferramentas do conector (ordem de chamada)

1. `select_workspace` — garantir o workspace correto da Gzero.
2. `balance` / `show_plans_and_credits` — confirmar créditos antes de gerar em lote.
3. `media_upload` — subir a(s) foto(s) de referência do estágio 0.
4. `media_confirm` — confirmar o upload (handle/id do asset de referência).
5. `generate_image` — disparar a geração com prompt + referência + modelo.
6. `job_display` / `show_generations` — acompanhar o job até concluir.
7. baixar o PNG resultante para `art/keyart/raw/<personagem>/`.

> Todas as 4 primeiras operações de conta estão na lista de risco (11.0/11.8). Se qualquer uma falhar, parar e acionar o fallback; não tentar `generate_image` às cegas.

#### 11.3.3 Parâmetros padrão de geração

| Parâmetro | Valor |
|---|---|
| modelo | `nano_banana_pro` (humanos) / `soul_2` (Renante) |
| aspecto/resolução | 1:1, 1024x1024 |
| referência (img2img) | 1 selfie frontal nítida (humanos); sem ref para Renante |
| strength (img2img) | 0.62 (humanos) |
| número de variações por rodada | 4 |
| seed | registrar a seed da variação aprovada (reprodutibilidade) |
| negative prompt | ver template abaixo |

#### 11.3.4 Template de prompt (base comum)

Todos os prompts compartilham um **prefixo de estilo** travado para garantir consistência de roster e aderência à direção visual C:

> **PREFIXO (igual para todos):**
> `square pixel art character, retro 16-bit platformer hero, full-body, facing slightly right, clean readable silhouette, hard-edged shading with offset drop shadow, dark space background (#09090b), magenta action rim light (#ff0055 / #f43db3), neon accents allowed (electric blue #0099ff, lime #cdf140, violet #7112ff), Gzero brand palette, light skin/clothing details crisp, no anti-aliasing softness, centered, 0px corner radius aesthetic`

> **SUFIXO / NEGATIVE (igual para todos):**
> `--no blur, soft gradients, photorealistic skin, rounded ui, watermark, text, extra limbs, low contrast, washed-out colors, pastel background, busy background`

**Templates específicos por personagem** (preenchem o miolo `[CORE]` entre prefixo e sufixo). Cada um carrega o "traço marcante" exigido no roster:

| Personagem | `[CORE]` do prompt | Cor-marca (acento) |
|---|---|---|
| **Renan** (co-fundador, "Salto Visionário") | `confident founder hero, visionary aura, looking upward, subtle floating/anti-gravity pose, glowing portal motif behind him` | violeta #7112ff |
| **Dante** (co-fundador, "Dash Criativo") | `creative dynamic founder, mid-dash motion lines, energetic forward lean, breaking-obstacle vibe` | pink operacional #ff0055 |
| **Julio** (doutrina/pitch, "Escudo de Governança") | `composed presenter hero, holding a hexagonal energy shield (guardrails motif), grounded stance` | azul #0099ff |
| **Artur** (dono da marca/builder, "Builder") | `maker/builder hero, holding a glowing modular platform/tool block he just created, tinkerer energy` | lima #cdf140 |
| **Einstein** (PAI do Renan, mentor "E=mc²") | `elderly genius mentor, **wild white hair**, **round glasses**, time-bending aura, chalk-equation glow E=mc², wise expression` | magenta-site #e802cf |
| **Renante** (IA companheira, só amplifica) | `friendly AI companion sprite, small floating drone/orb-being, glowing magenta core, amplifier rings, no human face, supportive sidekick scale (smaller)` | magenta-classic #f43db3 |

> Nota crítica para Einstein: o prompt DEVE conter explicitamente `wild white hair` e `round glasses` — é o identificador visual obrigatório do personagem no contexto. Para os 5 humanos, a img2img com `nano_banana_pro` parte da selfie real; o `[CORE]` ajusta pose/adereço, não inventa rosto.

#### 11.3.5 Rodada de geração — checklist por personagem

```
1. Selecionar 1–3 selfies frontais nítidas em art/refs/<personagem>/.
2. select_workspace -> balance (>= créditos para 4 variações).
3. media_upload(foto) -> media_confirm -> obter ref_id.
4. generate_image(model, prompt=PREFIXO+CORE+SUFIXO, ref=ref_id, strength=0.62, n=4, ratio=1:1).
5. job_display até status=done; show_generations para revisar as 4.
6. Curadoria: escolher 1 (semelhança + leitura de silhueta). Registrar seed.
7. Baixar -> art/keyart/raw/<personagem>/var_<seed>.png ; aprovar -> art/keyart/final/<personagem>.png.
8. (Opcional) gerar 1 rodada de "folha de poses" usando o key-art final como referência img2img,
   pedindo as 8 poses da tabela 11.2 numa grade — OU produzir poses no pós-processamento (preferido, mais barato).
```

Decisão travada: para **economia de créditos e consistência**, gerar **1 key-art por personagem** no Higgsfield e **derivar as 8 poses no pós-processamento local** (recolorização/recorte/pequenos ajustes manuais), em vez de gerar 17 frames no Higgsfield. Se o resultado de derivação ficar pobre, escalar para rodadas extras de img2img pose-a-pose (custo maior, registrar no orçamento de créditos).

---

### 11.4 Pós-processamento (raw key-art -> sprite final)

Quatro etapas determinísticas. Toda a etapa roda localmente (Node/script ou ferramenta de imagem), produzindo saída reprodutível.

#### 11.4.1 Downscale para grid de pixel
- Alvo: célula de **48x48 px**, conteúdo do corpo em **34x42 px** (mesma caixa de colisão do player da base), centralizado horizontalmente, alinhado pela base (pés no fundo da célula menos 3px de padding).
- Método: redimensionamento **nearest-neighbor** (sem suavização) a partir do recorte de corpo do key-art. Para preservar definição, fazer um pré-downscale por médias para ~2x o alvo e depois nearest-neighbor ao alvo final.
- Saída: `art/pixel/raw/<personagem>/<pose>.png`.

#### 11.4.2 Quantização para a paleta de marca
- Reduzir a imagem à **paleta Gzero fixa** (máx. 16 cores por sprite) para garantir coesão visual entre todos os personagens.
- Paleta-mestra (dos tokens de marca, ver direção visual C):

```ts
// art/palette.ts — paleta canônica de quantização
export const GZERO_PALETTE = [
  '#050505', // preto-espaço profundo
  '#09090b', // fundo base
  '#121216', // fundo alternativo
  '#f7f3f6', // texto/claro (highlights)
  '#ff0055', // pink operacional (ação)
  '#f43db3', // magenta-classic
  '#e802cf', // magenta-site
  '#0099ff', // neon azul
  '#cdf140', // neon lima
  '#7112ff', // violeta
  '#612af1', // violeta 2
  '#990033', // burgundy (risco/sombra dura)
] as const;
export type GzeroColor = typeof GZERO_PALETTE[number];
```

- Algoritmo: **sem dithering** (pixel art quadrado, sombras duras), mapeando cada pixel à cor de menor distância euclidiana em espaço RGB linear. A cor de acento por personagem (tabela 11.3) é "fixada" (não pode ser substituída por outra da paleta no rosto/adereço-marca).
- Sombra dura: a sombra de cada personagem usa **burgundy #990033** com offset (consistente com "sombras duras com offset" da direção visual). Sem gradientes.

#### 11.4.3 Remoção de fundo (alfa duro)
- O fundo espacial gerado deve virar **transparente**. Como não há gradiente desejado, usar **chave de fundo por cor + threshold**: pixels com distância < limiar das cores de fundo (`#050505`, `#09090b`, `#121216`) viram `alpha=0`.
- Borda: **sem feather**; alfa binário (0 ou 255) para manter pixel art nítido e silhueta sólida (importante para legibilidade contra o fundo escuro do jogo).
- Validação: a silhueta resultante deve ser contígua (1 componente conexo principal); flood-fill de canto a canto não pode "vazar" para dentro do corpo.
- Saída: `art/pixel/final/<personagem>/<pose>.png` (RGBA, fundo transparente).

#### 11.4.4 Empacotamento no atlas
- Todos os frames finais de todos os personagens entram num **único sprite-sheet** `public/assets/atlas/characters.png`.
- Layout: grade fixa de **células 48x48**, **8 colunas** (uma coluna por pose, na ordem da tabela 11.2 acrescida dos frames extras), **1 linha-bloco por personagem** (cada personagem ocupa as linhas necessárias para seus 17 frames; ver layout abaixo). Sem trimming agressivo — grade regular facilita o cálculo de índice no runtime.
- Estratégia de coordenadas: como a grade é regular e a célula é 48x48, o runtime pode calcular `sx = col*48`, `sy = row*48`, mas o **manifesto continua sendo a fonte da verdade** (ver 11.5) para permitir futuras mudanças de layout sem tocar no código.
- Tamanho previsto do atlas: 8 colunas x (frames totais). Com 17 frames/personagem x 6 = 102 frames; em grade de 12 colunas x 9 linhas = 108 células -> atlas **576x432 px**. (Decisão: usar **12 colunas** para um sheet mais quadrado; o manifesto absorve o layout.)

---

### 11.5 Manifesto (contrato de dados runtime)

O manifesto é o **contrato data-driven** entre arte e código (alinhado ao design data-driven da stack). O runtime nunca codifica coordenadas; lê tudo do manifesto. Trocar arte = trocar `characters.png` + `characters.manifest.json`, zero mudança de lógica.

#### 11.5.1 Interfaces TypeScript

```ts
// src/types/atlas.ts

/** Uma célula retangular dentro do atlas (pixels). */
export interface AtlasFrame {
  x: number;      // canto superior-esquerdo no sheet
  y: number;
  w: number;      // 48 (largura da célula)
  h: number;      // 48
  /** offset de desenho relativo ao ponto de pés/origem do personagem */
  ox: number;     // ex.: -24 (metade de 48) para centralizar
  oy: number;     // ex.: -45 (pés na base)
}

export type PoseName =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall'
  | 'hurt' | 'power_humanware' | 'ability';

export interface Animation {
  pose: PoseName;
  frames: number[];      // índices em CharacterEntry.frames
  fps: number;           // velocidade da animação
  loop: boolean;
}

export interface CharacterEntry {
  id: string;            // 'renan' | 'dante' | 'julio' | 'artur' | 'einstein' | 'renante'
  displayName: string;   // 'Renan'
  model: 'nano_banana_pro' | 'soul_2';  // origem da geração (rastreio)
  seed: number | null;   // seed Higgsfield da variação aprovada (null = placeholder)
  accentColor: string;   // cor-marca (tabela 11.3)
  isPlaceholder: boolean;// true enquanto não houver arte do Higgsfield
  keyart: string | null; // caminho do retrato 1024 (null = sem arte)
  frames: AtlasFrame[];  // todos os frames pixel deste personagem, em ordem
  animations: Record<PoseName, Animation>;
  ability: {             // ver seção de Roster
    id: string;          // 'salto_visionario' | 'dash_criativo' | ...
    label: string;       // 'Salto Visionário'
  };
}

export interface CharacterAtlasManifest {
  version: number;          // 1
  generatedAt: string;      // ISO date
  image: string;            // 'characters.png'
  cell: { w: 48; h: 48 };
  cols: number;             // 12
  characters: CharacterEntry[];
}
```

#### 11.5.2 Exemplo de manifesto (recorte real, formato final)

```json
{
  "version": 1,
  "generatedAt": "2026-06-08",
  "image": "characters.png",
  "cell": { "w": 48, "h": 48 },
  "cols": 12,
  "characters": [
    {
      "id": "renan",
      "displayName": "Renan",
      "model": "nano_banana_pro",
      "seed": 481923,
      "accentColor": "#7112ff",
      "isPlaceholder": false,
      "keyart": "../keyart/renan.png",
      "frames": [
        { "x": 0,  "y": 0, "w": 48, "h": 48, "ox": -24, "oy": -45 },
        { "x": 48, "y": 0, "w": 48, "h": 48, "ox": -24, "oy": -45 }
      ],
      "animations": {
        "idle":            { "pose": "idle",            "frames": [0,1],   "fps": 3,  "loop": true  },
        "walk":            { "pose": "walk",            "frames": [2,3,4,5], "fps": 10, "loop": true },
        "run":             { "pose": "run",             "frames": [6,7,8,9], "fps": 14, "loop": true },
        "jump":            { "pose": "jump",            "frames": [10],    "fps": 1,  "loop": false },
        "fall":            { "pose": "fall",            "frames": [11],    "fps": 1,  "loop": false },
        "hurt":            { "pose": "hurt",            "frames": [12],    "fps": 1,  "loop": false },
        "power_humanware": { "pose": "power_humanware", "frames": [13,14], "fps": 8,  "loop": true  },
        "ability":         { "pose": "ability",         "frames": [15,16], "fps": 10, "loop": false }
      },
      "ability": { "id": "salto_visionario", "label": "Salto Visionário" }
    }
  ]
}
```

#### 11.5.3 Carregamento no runtime (pseudo-código)

```ts
// src/render/CharacterRenderer.ts
async function loadCharacterAtlas(): Promise<{ sheet: HTMLImageElement; manifest: CharacterAtlasManifest }> {
  const manifest = await fetch('/assets/atlas/characters.manifest.json').then(r => r.json());
  const sheet = await loadImage(`/assets/atlas/${manifest.image}`);
  return { sheet, manifest };
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  entry: CharacterEntry,
  pose: PoseName,
  animTime: number,   // segundos
  px: number, py: number,  // posição mundo->tela (pés)
  flip: boolean,
) {
  if (entry.isPlaceholder) { drawPlaceholderBody(ctx, entry, pose, animTime, px, py, flip); return; }
  const anim = entry.animations[pose];
  const idx = anim.loop
    ? anim.frames[Math.floor(animTime * anim.fps) % anim.frames.length]
    : anim.frames[Math.min(anim.frames.length - 1, Math.floor(animTime * anim.fps))];
  const f = entry.frames[idx];
  ctx.save();
  ctx.imageSmoothingEnabled = false; // pixel art nítido — coerente com radius 0 / sombras duras
  if (flip) { ctx.translate(px, 0); ctx.scale(-1, 1); ctx.translate(-px, 0); }
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, px + f.ox, py + f.oy, f.w, f.h);
  ctx.restore();
}
```

A assinatura de `drawCharacter` é **idêntica** para placeholder e arte final — a única ramificação é `entry.isPlaceholder`. Isso garante que trocar a arte não muda o call-site.

---

### 11.6 Geração do atlas + manifesto (script de build)

Script `scripts/build-atlas.ts` (Node, rodado manualmente ou no build): varre `art/pixel/final/<personagem>/`, monta o sheet 12-col e emite o manifesto.

```ts
// scripts/build-atlas.ts (pseudo-código)
const CHAR_ORDER = ['renan','dante','julio','artur','einstein','renante'];
const POSE_ORDER: PoseName[] = ['idle','walk','run','jump','fall','hurt','power_humanware','ability'];
const POSE_FRAMECOUNT = { idle:2, walk:4, run:4, jump:1, fall:1, hurt:1, power_humanware:2, ability:2 };
const CELL = 48, COLS = 12;

let cursor = 0;                 // índice de célula global
const characters: CharacterEntry[] = [];
for (const id of CHAR_ORDER) {
  const frames: AtlasFrame[] = [];
  const animations: any = {};
  for (const pose of POSE_ORDER) {
    const start = frames.length;
    for (let i = 0; i < POSE_FRAMECOUNT[pose]; i++) {
      const col = cursor % COLS, row = Math.floor(cursor / COLS);
      frames.push({ x: col*CELL, y: row*CELL, w: CELL, h: CELL, ox: -CELL/2, oy: -45 });
      // blit do PNG art/pixel/final/<id>/<pose>_<i>.png na posição (col*CELL,row*CELL)
      cursor++;
    }
    animations[pose] = makeAnim(pose, range(start, frames.length));
  }
  characters.push(buildEntry(id, frames, animations)); // isPlaceholder=false se PNGs existem, senão true
}
writePNG('public/assets/atlas/characters.png');
writeJSON('public/assets/atlas/characters.manifest.json', { version:1, generatedAt: today(), image:'characters.png', cell:{w:48,h:48}, cols:COLS, characters });
```

Regra: se faltarem PNGs de um personagem, o script emite `isPlaceholder: true` e **não** quebra o build — o runtime cai no corpo desenhado em código (11.7). Isso mantém o jogo sempre buildável independentemente do estado do Higgsfield.

---

### 11.7 Estratégia placeholder-first (corpos desenhados em código)

Decisão central e travada: **o jogo é construído e fica jogável com placeholders desenhados em código no Canvas, antes de qualquer arte do Higgsfield.** A arte é uma camada de substituição posterior.

Cada personagem tem um placeholder gerado proceduralmente, respeitando a caixa 34x42 e a cor-marca (tabela 11.3), com a estética quadrada/sombra-dura da direção C:

```ts
// src/render/placeholders.ts
function drawPlaceholderBody(
  ctx: CanvasRenderingContext2D, entry: CharacterEntry, pose: PoseName,
  t: number, px: number, py: number, flip: boolean,
) {
  const W = 34, H = 42;
  const x = px - W/2, y = py - H;
  // sombra dura com offset (burgundy), radius 0
  ctx.fillStyle = '#990033';
  ctx.fillRect(x + 4, y + 4, W, H);
  // corpo: cor-marca do personagem
  ctx.fillStyle = entry.accentColor;
  ctx.fillRect(x, y, W, H);
  // "visor"/rosto claro
  ctx.fillStyle = '#f7f3f6';
  ctx.fillRect(x + 6, y + 6, W - 12, 10);
  // inicial do nome (mono) — leitura rápida de quem é quem
  ctx.fillStyle = '#09090b';
  ctx.font = '10px monospace';
  ctx.fillText(entry.displayName[0].toUpperCase(), x + W/2 - 3, y + 14);
  // sinal de pose: bob no idle, inclinação no run, aura no power_humanware
  if (pose === 'power_humanware') {
    ctx.strokeStyle = '#f43db3'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 3, W + 6, H + 6); // aura quadrada
  }
}
```

Marcos da abordagem placeholder-first:
1. **M0 — jogo jogável só com placeholders**: todos os 6 personagens têm `isPlaceholder: true`; gameplay completo (movimento, stomp, moedas, HUMANWARE) funciona. Não depende do Higgsfield.
2. **M1 — substituição incremental**: assim que o key-art de UM personagem é aprovado e empacotado, seu `isPlaceholder` vira `false` e o runtime passa a desenhar o sprite — sem mudança de código. Personagens podem migrar um a um.
3. **M2 — roster completo**: todos com arte final no atlas.

Benefício: o desenvolvimento de gameplay (seções de física/sistemas) **nunca fica bloqueado** pelo risco de auth/outage do Higgsfield.

---

### 11.8 Risco de auth/outage do Higgsfield e fallback

**Estado atual (2026-06-08):** operações de conta do conector Higgsfield (`balance`, `media_upload`, `list_workspaces`, `select_workspace`) retornam "Something went wrong" — causa provável: auth/sessão do conector expirada ou outage do serviço.

**Plano de mitigação / fallback (em ordem):**

| # | Ação | Quando | Resultado esperado |
|---|---|---|---|
| 1 | Continuar com placeholders (11.7) | imediatamente, sempre | jogo 100% jogável sem arte gerada |
| 2 | Reconectar o conector Higgsfield (re-auth da sessão) e reexecutar `select_workspace` -> `balance` | ao retomar a trilha de arte | confirma se era auth |
| 3 | Tentar novamente após algumas horas (caso seja outage do lado do serviço) | se re-auth não resolver | confirma se era outage |
| 4 | Gerar arte por canal alternativo equivalente (mesmo prompt/templates da 11.3) e baixar PNGs manualmente para `art/keyart/raw/<personagem>/` | se Higgsfield seguir indisponível e a arte for prioridade | mesmo pós-processamento (11.4) aplica-se igual |
| 5 | Pixel art desenhada à mão / refinamento manual dos placeholders | última instância | mantém estética da direção C |

Princípio: **o pipeline de pós-processamento (11.4), o atlas (11.6) e o manifesto (11.5) são agnósticos à origem do PNG**. Qualquer fonte que entregue um retrato/pose em PNG alimenta o restante do pipeline sem alteração. Portanto, a indisponibilidade do Higgsfield atrasa apenas o estágio 1, nunca o jogo.

**Antes de qualquer geração em lote:** validar `balance`/`show_plans_and_credits` (4 variações x 6 personagens = 24 gerações mínimas; reservar margem para retentativas de curadoria). Registrar a `seed` aprovada de cada personagem no manifesto (campo `seed`) para reprodutibilidade.

---

### 11.9 Resumo de decisões travadas desta seção

- Modelo default: `nano_banana_pro` (img2img) para os 5 humanos; `soul_2` para Renante e fallback de estilo.
- 1 key-art (1024x1024) por personagem no Higgsfield; **8 poses (17 frames) derivadas no pós-processamento local**, não geradas individualmente (economia de créditos).
- Célula de atlas 48x48 (= TILE), corpo 34x42 (= player da base), grade de 12 colunas, atlas único `characters.png` 576x432.
- Quantização para a paleta Gzero fixa (12 cores-mestras), **sem dithering**, sombra dura burgundy #990033 com offset, alfa binário (sem feather).
- Manifesto JSON é o único contrato runtime; `isPlaceholder` permite migração incremental e jogo sempre buildável.
- Placeholder-first é obrigatório: gameplay nunca bloqueado pela arte nem pelo outage do Higgsfield.
- Einstein DEVE ter `wild white hair` + `round glasses` no prompt.
- Fotos de referência: Artur em `C:\Users\artur\Área de Trabalho\Artur-Fotos-Avatar`; equipe em `C:\Users\artur\Área de Trabalho\Gzero\Higgsfield\Selfies`.

---

## 12. Audio

Esta secao especifica todo o subsistema de audio de "Gravidade Zero — O Jogo": trilha chiptune por mundo, biblioteca completa de SFX, tecnologia (Web Audio API com wrapper proprio leve, sem Howler como dependencia obrigatoria), controle de volume/mute persistente, e o pipeline para obter/gerar os assets com placeholders sinteticos primeiro (coerente com a filosofia de placeholder-first da secao 11/Pipeline de Arte). Tudo e data-driven (ver secao de dados/arquitetura), leve e portavel para o build single-file.

### 12.1. Principios e decisoes travadas

- **Tecnologia: Web Audio API nativa** (`AudioContext`) com um wrapper proprio `AudioBus` de ~6 KB minificado. Web Audio e escolhido para a MUSICA por permitir crossfade real entre mundos, ducking (abaixar a musica quando toca SFX importante), e geracao de chiptune procedural em runtime (placeholder zero-asset). **Howler.js NAO e dependencia obrigatoria**: e oferecido como adaptador opcional (`HowlerAdapter`) atras da mesma interface `AudioBackend`, util apenas se precisarmos de sprites de audio e fallbacks de formato muito agressivos. Decisao: comecar 100% Web Audio nativo; so plugar Howler se surgir bug de compatibilidade em algum navegador alvo.
- **Mute por padrao na primeira interacao, nunca autoplay travado**: por causa da policy de autoplay dos navegadores, o `AudioContext` so inicia (`resume()`) no primeiro input do jogador (mesmo gesto que ja temos no JUMP_BUFFER da secao de input). A tela de title (ver secao de estados) exibe o prompt "PRESSIONE PARA INICIAR" que tambem destrava o audio.
- **Formato dos assets: OGG Vorbis como primario, MP3 como fallback**. OGG cobre Chrome/Firefox/Edge; MP3 cobre Safari/iOS. Carregamento escolhe o formato suportado via `canPlayType`. Para o **build single-file**, os assets viram base64 data-URI embutidos (mesma tecnica do atlas PNG/JPEG da base), e a MUSICA pode cair no modo **chiptune procedural** (gerada por osciladores) para nao inflar o HTML.
- **Orcamento de peso**: musica em OGG ~96 kbps loop curto (8-16 s por faixa), alvo <= 180 KB por faixa OGG; SFX <= 12 KB cada. Total de audio no build multi-arquivo alvo <= 2.2 MB. No single-file, audio embutido alvo <= 900 KB (faixas mais curtas + mais reuso + opcao procedural).
- **Mixagem em 16 vozes simultaneas** de SFX (pool de nos), 2 vozes de musica (faixa atual + faixa entrando no crossfade). Acima disso, vozes mais antigas/de menor prioridade sao roubadas (voice stealing).
- **Estetica sonora**: chiptune/8-16 bit hibrido coerente com o "pixel art QUADRADO" e a direcao espaco/magenta (secao de Direcao Visual). Timbres: ondas square/pulse para melodia, triangle para baixo, noise para percussao. Clima geral: futurista-melancolico no overworld, energetico nas fases de cliente, tenso/dissonante nos chefes.

### 12.2. Arquitetura: grafo de audio e modulos

Grafo de roteamento Web Audio (todos os nos criados uma vez no boot):

```
AudioContext.destination
        ^
   masterGain  (volume master, default 0.8)
     ^      ^
musicGain   sfxGain      (buses por categoria)
  ^            ^
musicComp    (ganhos individuais por voz de SFX)
(DynamicsCompressorNode no music bus para suavizar crossfade)
```

- `masterGain`: ganho global, controlado por Master e pelo Mute.
- `musicGain`: ganho da musica; alvo de **ducking** (ver 12.6) e de crossfade entre mundos.
- `sfxGain`: ganho dos efeitos.
- `musicComp` (`DynamicsCompressorNode`, threshold -18 dB, ratio 4, attack 0.003, release 0.25): cola o crossfade e evita clipping quando duas faixas tocam juntas.

Modulos (arquivos, coerente com a organizacao multi-arquivo aprovada — ver secao de arquitetura):

| Arquivo | Responsabilidade |
|---|---|
| `src/audio/AudioBus.ts` | Cria o grafo, gerencia `AudioContext`, resume na primeira interacao, expoe volumes/mute. |
| `src/audio/AudioBackend.ts` | Interface comum; implementacoes `WebAudioBackend` (default) e `HowlerAdapter` (opcional). |
| `src/audio/Sfx.ts` | Pool de vozes de SFX, voice stealing, prioridade, pitch/pan, cooldown. |
| `src/audio/Music.ts` | Maquina de faixas por mundo, crossfade, loop com loopStart/loopEnd. |
| `src/audio/Chiptune.ts` | Sintetizador procedural (osciladores + envelopes) para placeholder e modo single-file. |
| `src/audio/audioData.ts` | Dados declarativos: catalogo de musicas e SFX (ver 12.7). |
| `src/audio/loadAudio.ts` | Decodifica buffers (OGG/MP3 ou data-URI), com cache e seletor de formato. |

### 12.3. Interface TypeScript (contrato publico)

```ts
export type AudioCategory = 'music' | 'sfx';

export interface AudioSettings {
  master: number;   // 0..1
  music: number;    // 0..1
  sfx: number;      // 0..1
  muted: boolean;
}

export interface SfxDef {
  id: SfxId;
  /** URLs por formato; primeiro suportado vence. No single-file vira data-URI. */
  src: { ogg?: string; mp3?: string };
  /** Se nao houver src (ou modo procedural), gera via Chiptune. */
  proc?: ChiptunePatch;
  gain: number;        // ganho base 0..1
  priority: number;    // 0 baixo .. 10 critico (chefe/dano)
  /** Variacao aleatoria de pitch em semitons (+/-), para evitar fadiga. */
  pitchJitter?: number;
  /** ms minimos entre dois disparos do mesmo id (anti-spam). */
  cooldownMs?: number;
  /** Se true, abaixa a musica enquanto toca (ducking). */
  duck?: boolean;
}

export interface MusicDef {
  id: MusicId;
  src: { ogg?: string; mp3?: string };
  proc?: ChiptuneTrack;   // fallback procedural por mundo
  loopStart: number;      // s
  loopEnd: number;        // s
  gain: number;           // 0..1
  bpm: number;
}

export interface AudioBackend {
  unlock(): Promise<void>;                 // resume() no 1o gesto
  loadAll(defs: AudioManifest): Promise<void>;
  playSfx(id: SfxId, opts?: PlaySfxOpts): SfxHandle | null;
  playMusic(id: MusicId, opts?: { fadeMs?: number }): void;
  stopMusic(opts?: { fadeMs?: number }): void;
  setVolume(cat: AudioCategory | 'master', v: number): void;
  setMuted(m: boolean): void;
  suspend(): void;                         // ao perder foco / pausar
  resume(): void;
}

export interface PlaySfxOpts {
  pitch?: number;   // multiplicador de playbackRate (1 = normal)
  pan?: number;     // -1 esq .. +1 dir (StereoPannerNode)
  gain?: number;    // override 0..1
}

export type SfxHandle = { stop(): void; readonly id: SfxId };
```

`SfxId` e `MusicId` sao uniões de string literais geradas a partir de `audioData.ts` (type-safe; um id invalido nao compila).

### 12.4. Musica chiptune por mundo

Cada mundo tem **uma faixa loop** propria. Mundos sao as zonas da lore (overworld + zonas-cliente da secao de fases). Loops curtos (8-16 s) com `loopStart`/`loopEnd` precisos para emenda perfeita. BPM e timbre escolhidos por clima.

| MusicId | Mundo / contexto | Clima | BPM | Loop (s) | Timbre principal | Tonalidade |
|---|---|---|---|---|---|---|
| `m_title` | Title / menu | Convite, leveza, mistico | 96 | 0.0 – 12.0 | pulse 25% + pad triangle | A menor |
| `m_overworld` | Gravidade Zero (hub flutuante / portais) | Espacial-melancolico, esperancoso | 110 | 0.0 – 16.0 | square lead + arpejo | E menor |
| `m_vivo` | Zona-cliente Vivo | Energetico, conectado | 132 | 0.0 – 12.0 | dual pulse + noise hat | C maior |
| `m_kion` | Zona-cliente Kion | Industrial, ritmico | 126 | 0.0 – 12.8 | square + baixo serrilhado | D menor |
| `m_ecorodovias` | Zona-cliente Ecorodovias | Veloz, "estrada", drive | 138 | 0.0 – 11.6 | pulse 12.5% rapido | G maior |
| `m_mubadala` | Zona-cliente Mubadala | Grandioso, dourado, vasto | 118 | 0.0 – 15.0 | pad + lead duplicado oitava | F maior |
| `m_jpmorgan` | Zona-cliente JPMorgan | Tenso, calculista, corporativo | 124 | 0.0 – 13.5 | baixo dominante + stabs | B menor |
| `m_humanware` | MODO HUMANWARE ativo (sobrepoe) | Triunfal, tempo desacelerado | 100 | 0.0 – 8.0 | lead brilhante + sino | A maior |
| `m_boss_tolo` | Chefe "O Tolo com a Ferramenta" | Caotico, agressivo, dissonante | 150 | 0.0 – 10.0 | square distorcido + noise | C# menor |
| `m_boss_esfinge` | Chefe-enigma "A Esfinge" | Enigmatico, ritual, pesado | 88 | 0.0 – 14.0 | pad grave + arpejo lento | E frigio |
| `m_win` | Vitoria / Consciencia Unificada | Resolucao, leveza devolvida | 104 | jingle 9.0 (sem loop) | full ensemble | A maior |
| `m_over` | Game over | Queda, gravidade vence | 80 | jingle 5.0 (sem loop) | descida cromatica | A menor |

Regras de troca de musica:
- Entrar num mundo dispara `playMusic(id, { fadeMs: 800 })` com **crossfade** de 800 ms (faixa antiga faz fade-out, nova faz fade-in via rampas no `musicGain` de cada voz).
- **MODO HUMANWARE** (secao do superpoder): nao troca a faixa do mundo; em vez disso, `m_humanware` entra como **camada sobreposta** com fade de 250 ms, a faixa do mundo cai para 35% de ganho (efeito "tempo desacelerado") e o `AudioContext` aplica leve `playbackRate` 0.92 na musica do mundo. Ao terminar o medidor, reverte com fade de 400 ms.
- Chefes (`m_boss_*`) substituem totalmente a faixa do mundo (crossfade 600 ms) ao entrar na arena.
- `m_win`/`m_over` sao **jingles sem loop**: a musica do mundo para com fade 300 ms, o jingle toca uma vez, e ao final fica silencio (title volta no input).
- A faixa atual e a posicao de loop persistem entre pause/resume usando `suspend()`/`resume()` do `AudioContext` (nao reinicia do zero).

### 12.5. Biblioteca de SFX

Conjunto minimo coerente com os sistemas da base (pulo, stomp, moeda, bloco, item, estrela, projetil) + os sistemas novos da lore (humanware, portal, lifecard, chefe, esfinge). Todos tem fallback procedural (`proc`) para placeholder/single-file.

| SfxId | Evento | Gain | Prio | pitchJitter | cooldown | duck | Descricao do timbre |
|---|---|---|---|---|---|---|---|
| `sfx_jump` | Pulo (qualquer heroi) | 0.7 | 4 | 1 st | 60 ms | nao | square ascendente rapido (chirp 220→600 Hz, 90 ms) |
| `sfx_jump_double` | 2o pulo do Renan ("Salto Visionario") | 0.7 | 5 | 1 st | 60 ms | nao | chirp mais agudo + brilho (sino curto) |
| `sfx_land` | Aterrissagem | 0.4 | 2 | 0.5 st | 80 ms | nao | thud noise curto filtrado |
| `sfx_stomp` | Pisar inimigo (STOMP_BOUNCE) | 0.8 | 6 | 1 st | 40 ms | nao | "squish" noise + queda de pitch |
| `sfx_coin` | Coletar moeda | 0.6 | 3 | 2 st | 0 ms | nao | dois pulses agudos (B5→E6, 120 ms) |
| `sfx_block_bump` | Bater bloco por baixo (bump) | 0.6 | 3 | 1 st | 30 ms | nao | square grave curto + noise |
| `sfx_block_break` | Quebrar brick | 0.7 | 4 | 1 st | 30 ms | nao | burst de noise + 3 fragmentos de pitch |
| `sfx_item_appear` | Item emerge do bloco | 0.6 | 4 | 0 | 0 | nao | arpejo ascendente pulse (5 notas) |
| `sfx_item_get` | Pegar item/power-up | 0.8 | 6 | 0 | 0 | sim | fanfarra curta ascendente (8 notas) |
| `sfx_star` | Power-up estrela (invencibilidade) | 0.9 | 7 | 0 | 0 | sim | jingle brilhante + inicio do loop de invencibilidade |
| `sfx_projectile` | Disparar projetil (speed 8.5) | 0.5 | 3 | 2 st | 90 ms | nao | "pew" pulse com queda rapida |
| `sfx_dash` | "Dash Criativo" do Dante | 0.7 | 5 | 1 st | 200 ms | nao | whoosh noise filtrado + sweep |
| `sfx_shield` | "Escudo de Governanca" do Julio | 0.6 | 5 | 0 | 150 ms | nao | hum metalico curto + click |
| `sfx_build` | "Builder" do Artur (cria plataforma) | 0.6 | 5 | 0 | 150 ms | nao | sequencia de 3 clicks "construindo" |
| `sfx_timeslow` | "E=mc2" do Einstein (desacelera tempo) | 0.7 | 6 | 0 | 0 | sim | sweep descendente + reverb-tail |
| `sfx_renante` | Renante amplifica habilidade | 0.6 | 5 | 0 | 100 ms | nao | bleep digital + harmonico |
| `sfx_humanware_charge` | Medidor de coracao enchendo (tick) | 0.35 | 2 | 0 | 0 | nao | pulse curto sobe de pitch conforme enche |
| `sfx_humanware_ready` | Medidor cheio (pode ativar) | 0.8 | 7 | 0 | 0 | sim | acorde ascendente brilhante |
| `sfx_humanware_on` | ATIVAR MODO HUMANWARE | 1.0 | 9 | 0 | 0 | sim | swell grande + "freeze" dos Tolos (whoosh + sino grave) |
| `sfx_humanware_off` | Fim do modo Humanware | 0.6 | 5 | 0 | 0 | sim | descida suave, retorno do tempo |
| `sfx_portal` | Entrar/usar portal | 0.8 | 7 | 0 | 0 | sim | sweep ascendente magenta + shimmer (warble) |
| `sfx_lifecard` | Coletar Lifecard (desbloqueio de heroi) | 0.9 | 8 | 0 | 0 | sim | fanfarra de desbloqueio (10 notas) + sino |
| `sfx_damage` | Heroi toma dano | 0.8 | 8 | 0 | 120 ms | sim | "hurt" descendente dissonante (noise + pulse) |
| `sfx_death` | Heroi morre | 0.9 | 9 | 0 | 0 | sim | queda longa cromatica (a "gravidade" vence) |
| `sfx_enemy_appear` | Inimigo "Tolo" entra | 0.4 | 2 | 1 st | 100 ms | nao | grunido curto noise |
| `sfx_boss_hit` | Acertar chefe | 0.8 | 8 | 1 st | 80 ms | sim | impacto grave + flash de pitch |
| `sfx_boss_roar` | Rugido/ataque do chefe | 1.0 | 9 | 0 | 300 ms | sim | noise grave modulado + queda |
| `sfx_sphinx_riddle` | Esfinge fala o enigma | 0.7 | 7 | 0 | 0 | sim | tom ritualistico + voz sintetica (bitcrush) |
| `sfx_sphinx_correct` | Resposta certa | 0.9 | 8 | 0 | 0 | sim | acorde maior resolvido |
| `sfx_sphinx_wrong` | Resposta errada ("te devoro") | 0.9 | 9 | 0 | 0 | sim | acorde dissonante + rugido |
| `sfx_ui_move` | Navegar menu | 0.4 | 1 | 0 | 40 ms | nao | click pulse curto |
| `sfx_ui_confirm` | Confirmar menu | 0.5 | 2 | 0 | 60 ms | nao | dois pulses ascendentes |
| `sfx_ui_back` | Voltar menu | 0.4 | 1 | 0 | 60 ms | nao | dois pulses descendentes |
| `sfx_goal` | Tocar o objetivo / fim de fase (coluna 160) | 0.9 | 8 | 0 | 0 | sim | jingle de bandeira ascendente |
| `sfx_timer_low` | Tempo acabando (TIME_START baixo) | 0.6 | 6 | 0 | 1000 ms | sim | bipe de alerta acelerando |

Notas de uso:
- `pitchJitter` aleatoriza `playbackRate` em +/- N semitons para evitar fadiga em SFX repetidos (moeda, pulo, stomp). Conversao: `rate = 2^(semitons/12)`.
- `cooldownMs` evita "metralhadora" de som quando muitos eventos disparam no mesmo frame (ex.: varias moedas).
- `duck = true` aciona ducking (12.6) — reservado a momentos narrativos/criticos (humanware, portal, dano, chefe, lifecard), nunca em SFX de alta frequencia (moeda, pulo).
- **Pan estereo** opcional via `PlaySfxOpts.pan`: SFX posicionais (inimigo, projetil) recebem pan proporcional a `(entityX - cameraCenterX)` clampeado em [-0.8, 0.8] para reforcar a posicao na tela 960x528.

### 12.6. Ducking e voice management

- **Ducking**: quando um SFX com `duck:true` toca, `musicGain` cai para 45% por uma rampa de 80 ms, segura durante o som, e volta em 220 ms (rampas lineares no Web Audio). Ducks sao contados (refcount): a musica so volta quando o ultimo SFX-duck termina.
- **Pool de vozes de SFX**: 16 nos reutilizaveis. Ao disparar, pega uma voz livre; se nenhuma livre, rouba a de **menor prioridade e mais antiga** (voice stealing por `priority`). SFX criticos (`priority >= 8`: dano, morte, humanware_on, chefe, esfinge) nunca sao roubados por sons de menor prioridade.
- **Musica**: 2 vozes (atual + entrando). Crossfade usa duas `AudioBufferSourceNode` com loop, cada uma em seu `GainNode`, rampando em sentidos opostos durante `fadeMs`.

### 12.7. Dados (data-driven) — exemplo de `audioData.ts`

```ts
export const MUSIC: Record<MusicId, MusicDef> = {
  m_overworld: {
    id: 'm_overworld',
    src: { ogg: 'audio/music/overworld.ogg', mp3: 'audio/music/overworld.mp3' },
    proc: CHIP_OVERWORLD,         // fallback procedural (Chiptune.ts)
    loopStart: 0, loopEnd: 16, gain: 0.7, bpm: 110,
  },
  m_boss_tolo: {
    id: 'm_boss_tolo',
    src: { ogg: 'audio/music/boss_tolo.ogg', mp3: 'audio/music/boss_tolo.mp3' },
    proc: CHIP_BOSS_TOLO,
    loopStart: 0, loopEnd: 10, gain: 0.75, bpm: 150,
  },
  // ... demais faixas da tabela 12.4
};

export const SFX: Record<SfxId, SfxDef> = {
  sfx_coin: {
    id: 'sfx_coin',
    src: { ogg: 'audio/sfx/coin.ogg', mp3: 'audio/sfx/coin.mp3' },
    proc: { wave: 'square', notes: ['B5', 'E6'], dur: 0.12, decay: 0.08 },
    gain: 0.6, priority: 3, pitchJitter: 2, cooldownMs: 0,
  },
  sfx_humanware_on: {
    id: 'sfx_humanware_on',
    src: { ogg: 'audio/sfx/humanware_on.ogg', mp3: 'audio/sfx/humanware_on.mp3' },
    proc: { wave: 'pulse', notes: ['C3','G3','C4','E4','G4'], dur: 0.9, decay: 0.5 },
    gain: 1.0, priority: 9, duck: true,
  },
  // ... demais efeitos da tabela 12.5
};
```

Disparo nos sistemas de jogo (acoplamento minimo, so um `bus.playSfx(id)`):

```ts
// no sistema de pulo
if (jumpStarted) bus.playSfx(hero.id === 'renan' && isDoubleJump ? 'sfx_jump_double' : 'sfx_jump');
// no sistema de moeda
onCoinCollect: () => bus.playSfx('sfx_coin');
// posicional (inimigo)
const pan = clamp((enemy.x - camCenterX) / (960 / 2), -0.8, 0.8);
bus.playSfx('sfx_enemy_appear', { pan });
// ativar superpoder (secao do Humanware)
onHumanwareActivate: () => { bus.playSfx('sfx_humanware_on'); bus.playMusic('m_humanware', { fadeMs: 250 }); }
```

### 12.8. Sintetizador procedural (Chiptune.ts) — placeholder-first

Coerente com a estrategia de placeholders desenhados em codigo (ver Pipeline de Arte): **o jogo e jogavel com audio sem nenhum arquivo de som**, gerando tudo via osciladores. Isso tambem alimenta o modo single-file leve.

```ts
export interface ChiptunePatch {     // 1 SFX procedural
  wave: 'square' | 'pulse' | 'triangle' | 'sawtooth' | 'noise';
  notes: string[];                   // ex.: ['B5','E6']
  dur: number;                       // s total
  decay: number;                     // s do envelope (AD)
  pulseWidth?: number;               // 0..1 (so para 'pulse')
}

// Gera um SFX em runtime: oscilador -> gain (envelope AD) -> sfxGain
function playPatch(ctx: AudioContext, out: GainNode, p: ChiptunePatch) {
  const t0 = ctx.currentTime;
  const step = p.dur / p.notes.length;
  p.notes.forEach((n, i) => {
    const osc = p.wave === 'noise' ? makeNoise(ctx) : ctx.createOscillator();
    if (osc instanceof OscillatorNode) {
      osc.type = (p.wave === 'pulse' ? 'square' : p.wave) as OscillatorType;
      osc.frequency.value = noteToHz(n);
    }
    const g = ctx.createGain();
    const start = t0 + i * step;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(1, start + 0.005);          // attack
    g.gain.exponentialRampToValueAtTime(0.0001, start + p.decay);   // decay
    osc.connect(g).connect(out);
    osc.start(start); osc.stop(start + step + 0.02);
  });
}
```

A musica procedural (`ChiptuneTrack`) e um sequenciador minimo: arrays de `{ lane: 'lead'|'bass'|'arp'|'noise', steps: number[] }` em uma grade de 16 steps por compasso, agendados em loop pelo `bpm` da faixa. Cada mundo da tabela 12.4 tem um `ChiptuneTrack` correspondente (`CHIP_OVERWORLD`, `CHIP_VIVO`, ...) com a tonalidade/clima indicados. Som "quadrado" coerente com a arte pixel (square/pulse dominantes, sem reverb pesado).

### 12.9. Controles de volume, mute e persistencia

UI de audio no menu de opcoes (estilo Gzero: labels mono UPPERCASE, sliders quadrados radius 0, magenta #ff0055 como cor de acao, fundo #09090b — ver Direcao Visual):

- **MASTER**, **MUSICA**, **SFX**: tres sliders 0–100% (passo de 5%). Default: master 80%, musica 70%, sfx 100%.
- **MUTE** (tecla `M`): silencia tudo zerando `masterGain` sem perder os valores dos sliders; restaura ao desmutar.
- Atalhos de teclado: `M` mute toggle, `[` / `]` baixa/sobe master em 10%.
- **Persistencia** em `localStorage` chave `gz_audio` (JSON de `AudioSettings`). Carregado no boot; salvo a cada alteracao (debounce 250 ms).
- **Pause automatico**: ao perder foco da janela (`visibilitychange` / `blur`), chama `bus.suspend()`; ao retornar, `bus.resume()` — coerente com a maquina de estados de pause.

```ts
const DEFAULTS: AudioSettings = { master: 0.8, music: 0.7, sfx: 1.0, muted: false };
function loadSettings(): AudioSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('gz_audio') ?? '{}') }; }
  catch { return DEFAULTS; }
}
// aplicacao: masterGain.gain = settings.muted ? 0 : settings.master;
//            musicGain.gain  = settings.music;  sfxGain.gain = settings.sfx;
```

### 12.10. Carregamento, formatos e build single-file

- **Selecao de formato**: no boot, `loadAudio.ts` testa `audio.canPlayType('audio/ogg; codecs="vorbis"')`; se vazio, usa `mp3`. Buffers sao decodificados com `ctx.decodeAudioData` e cacheados por id.
- **Preload**: na tela de loading (ver maquina de estados) carrega `m_title`, `m_overworld` e todos os SFX de `priority >= 4`. Faixas de mundo/chefe carregam **sob demanda** (lazy) na transicao, com a faixa procedural tocando imediatamente como ponte ate o OGG decodificar (sem "buraco" de audio).
- **Multi-arquivo (Vercel)**: assets em `public/audio/{music,sfx}/*.{ogg,mp3}`, servidos com cache-control longo (hash no nome via Vite).
- **Single-file**: um script de build embute os SFX como data-URI base64 no HTML; **a musica usa o modo procedural** (`Chiptune.ts`) para nao inflar o arquivo, mantendo o alvo <= 900 KB. Flag de build `AUDIO_INLINE=procedural-music` controla isso.

### 12.11. Como obter/gerar os assets (pipeline, leve)

Ordem de prioridade, do mais barato/rapido ao mais polido:

1. **Procedural primeiro (zero asset)**: `Chiptune.ts` cobre 100% dos SFX e musicas listados. O jogo nasce com audio completo sem nenhum arquivo — coerente com placeholder-first. Isso ja e o suficiente para playtests internos do grupo Gzero.
2. **SFX 8-bit gerados por ferramenta**: usar **jsfxr/sfxr** (gerador chiptune open-source, exporta WAV) para refinar os efeitos da tabela 12.5. Cada `SfxDef.proc` ja documenta o timbre alvo, servindo de briefing. Exportar WAV -> converter para OGG (96 kbps) + MP3 (128 kbps) com `ffmpeg`.
3. **Musica chiptune**: compor os loops da tabela 12.4 em um tracker (ex.: BeepBox/Bosca Ceoil para chiptune rapido, ou FamiTracker para som NES autentico), exportar WAV, cortar `loopStart`/`loopEnd`, converter para OGG/MP3. Cada faixa ja tem BPM, tonalidade e timbre definidos.
4. **Conversao padrao** (comando de referencia): `ffmpeg -i in.wav -c:a libvorbis -b:a 96k out.ogg` e `ffmpeg -i in.wav -c:a libmp3lame -b:a 128k out.mp3`.
5. **Licenciamento**: usar somente assets proprios (procedural/trackers nossos) ou bibliotecas CC0 (ex.: freesound CC0, OpenGameArt) para evitar problema de licenca em uso interno; registrar a origem em `docs/audio-credits.md`. NAO usar musica comercial mesmo sendo interno.

Resultado: o subsistema de audio e leve, totalmente data-driven, jogavel desde o dia 1 via sintese procedural, e evolui trocando `proc` por `src` arquivo a arquivo — exatamente como os placeholders de arte sao trocados pela arte do Higgsfield (ver Pipeline de Arte). Nenhuma dependencia bloqueante: o risco atual do Higgsfield (operacoes de conta falhando) NAO afeta audio.

---

## 13. Estrategia de Testes & Verificacao

Esta secao define COMO garantimos que "Gravidade Zero — O Jogo" funciona, permanece jogavel a 60fps e nao regride conforme expandimos (ver secao 1 para escopo, secao 2 para arquitetura modular). A estrategia tem cinco pilares: (1) **testes unitarios** para toda logica pura (fisica, colisao, medidor Humanware, parametros de habilidade, parser de fase); (2) **smoke/integracao** com Playwright dirigindo o jogo real no navegador; (3) **checklist de playtest** manual estruturado; (4) **orcamento de performance** com gate de 60fps; (5) **disciplina de TDD** para sistemas de regra. Ferramentas oficiais: **Vitest** (unit/integracao de logica) + **Playwright** (E2E/smoke no browser). Nenhuma outra dependencia de teste e introduzida.

### 13.1 Filosofia e regra de ouro

A regra de ouro do projeto: **toda funcao que produz um numero, um booleano ou um estado a partir de entradas deve ser pura, exportada e testavel sem Canvas, sem `requestAnimationFrame` e sem DOM**. Renderizacao (desenhar no Canvas 2D) e efeitos colaterais (audio, input bruto) ficam isolados nas bordas e sao verificados via Playwright, nunca por unit test.

Consequencia arquitetural (reforca a secao 2): separamos o codigo em tres camadas de testabilidade.

| Camada | Conteudo | Como testa | Cobertura-alvo |
| --- | --- | --- | --- |
| **Core (pura)** | fisica, colisao, AABB, medidor Humanware, params de habilidade, parser/validador de fase, camera-clamp, maquina de estados, RNG seedavel | Vitest (unit) | **>= 90% de linhas, 100% de branches em fisica/colisao/medidor** |
| **Sistemas (orquestracao)** | atualizacao de entidades por frame (`stepWorld`), spawn de inimigos/itens, bump de blocos, projeteis, particulas | Vitest (integracao de logica, sem render) | **>= 75% de linhas** |
| **Bordas (impuras)** | render Canvas, loop rAF, input listeners, audio, carregamento de atlas | Playwright (smoke/E2E) + revisao manual | Coberta por fluxos E2E, sem meta de % |

Meta global de cobertura agregada (`vitest --coverage`): **linhas >= 80%, funcoes >= 80%, branches >= 75%**. O gate de CI falha abaixo desses limites (ver 13.9).

### 13.2 Determinismo: o pre-requisito de tudo

Para testar fisica e gameplay de forma reproduzivel, o `stepWorld` (avanco de um frame logico) DEVE ser **deterministico**:

1. **Passo de tempo fixo logico.** O loop de jogo roda a `dt = 1` "tick" por frame de logica (60Hz). A renderizacao usa interpolacao, mas a simulacao avanca em ticks inteiros. Testes chamam `stepWorld(state, input)` N vezes; nunca dependem de tempo real de parede.
2. **RNG seedavel e injetavel.** Substituimos qualquer `Math.random()` por um PRNG `mulberry32(seed)` injetado no estado. Particulas, drops e variacoes cosmeticas usam esse RNG. Em testes, fixamos `seed = 1` para reproducibilidade total.
3. **Input como dado.** Input vira um objeto puro `InputFrame` (ver 13.4). Testes passam sequencias de `InputFrame`; Playwright traduz teclas reais em `InputFrame` na borda.

```ts
// core/rng.ts — PRNG deterministico (NUNCA Math.random no core)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### 13.3 Testes unitarios — logica pura

Ferramenta: **Vitest** (`environment: 'node'` para o core; `jsdom` so onde precisar de DOM minimo). Arquivos co-localizados: `src/core/physics.ts` -> `src/core/physics.test.ts`. Convencao de nome: `*.test.ts`.

#### 13.3.1 Fisica do jogador

Reusa as constantes travadas no CONTEXTO (ver tambem secao de fisica). Centralizamos em `core/constants.ts` para que teste e jogo leiam a MESMA fonte.

```ts
// core/constants.ts (extrato — fonte unica de verdade)
export const TILE = 48;
export const GRAVITY = 0.8, MAX_FALL = 17;
export const WALK_ACCEL = 0.7, RUN_ACCEL = 0.95;
export const WALK_MAX = 4.6, RUN_MAX = 7.3;
export const GROUND_DECEL = 0.6, AIR_DECEL = 0.18;
export const JUMP_VEL = -15.4;
export const COYOTE = 7, JUMP_BUFFER = 8;
export const STOMP_BOUNCE = -11.5;
export const ENEMY_SPEED = 1.25;
export const STAR_TIME = 480, TIME_START = 250;
export const GROUND_ROW = 9, GOAL_COL = 160;
```

Casos de teste obrigatorios para fisica (`physics.test.ts`):

| # | Cenario | Entrada | Assercao exata |
| --- | --- | --- | --- |
| F1 | Gravidade acumula | vy=0, 1 tick em queda | `vy === 0.8` (= GRAVITY) |
| F2 | Velocidade de queda satura | vy=20, aplica gravidade | `vy === 17` (clamp em MAX_FALL) |
| F3 | Aceleracao de caminhada | vx=0, segurar direita 1 tick (sem run) | `vx === 0.7` (WALK_ACCEL) |
| F4 | Velocidade de caminhada satura | vx=4.5, +WALK_ACCEL | `vx === 4.6` (clamp WALK_MAX) |
| F5 | Corrida satura mais alto | run=true, acelera ate platô | `vx === 7.3` (RUN_MAX) |
| F6 | Desaceleracao no chao | vx=4.6, sem input, no chao | `vx === 4.0` (=4.6-0.6 GROUND_DECEL) |
| F7 | Desaceleracao no ar | vx=4.6, sem input, no ar | `vx === 4.42` (=4.6-0.18 AIR_DECEL) |
| F8 | Pulo aplica JUMP_VEL | onGround=true, pressionar pulo | `vy === -15.4` |
| F9 | Altura de pico do pulo | simular pulo ate vy>=0 | pico **entre 144 e 152 px** (~3 tiles); cravar em snapshot |
| F10 | Coyote time permite pulo | sair de plataforma, pular dentro de 7 ticks | pulo executa |
| F11 | Coyote expira | pular no tick 8 apos sair | pulo NAO executa |
| F12 | Jump buffer | pressionar pulo 8 ticks antes de tocar o chao | ao aterrissar, pula no mesmo tick |
| F13 | Jump buffer expira | pressionar pulo 9 ticks antes de aterrissar | NAO pula |
| F14 | Desaceleracao nunca inverte | vx=0.3, GROUND_DECEL=0.6 | `vx === 0` (clamp em zero, nao -0.3) |

```ts
// physics.test.ts (exemplo F8/F9)
import { describe, it, expect } from 'vitest';
import { applyJump, stepVertical } from './physics';
import { JUMP_VEL, GRAVITY } from './constants';

describe('pulo do jogador', () => {
  it('F8: aplica JUMP_VEL ao pular do chao', () => {
    const p = { vy: 0, onGround: true, coyote: 0, jumpBuffer: 0 };
    applyJump(p);
    expect(p.vy).toBe(JUMP_VEL); // -15.4
  });

  it('F9: altura de pico fica entre 144 e 152 px', () => {
    const p = { y: 0, vy: JUMP_VEL, onGround: false };
    let peak = 0;
    for (let t = 0; t < 60 && p.vy < 0; t++) {
      p.y += p.vy; p.vy = Math.min(p.vy + GRAVITY, 17);
      peak = Math.max(peak, -p.y);
    }
    expect(peak).toBeGreaterThanOrEqual(144);
    expect(peak).toBeLessThanOrEqual(152);
  });
});
```

#### 13.3.2 Colisao (AABB tile/entidade)

A colisao e o sistema mais propenso a regressao; exige **100% de branches**. Funcao pura `resolveCollision(box, dx, dy, tileAt)` onde `tileAt(c, r)` consulta o `Map` de tiles ("c,r" -> tipo). Player 34x42, inimigo 38x34 (dims travadas no CONTEXTO).

| # | Cenario | Assercao |
| --- | --- | --- |
| C1 | Cair sobre tile `ground` | `onGround === true`, `vy === 0`, `y` alinhado ao topo do tile |
| C2 | Bater a cabeca em `brick` por baixo | `vy === 0`, dispara `onBumpHead` |
| C3 | Andar contra parede solida | `vx === 0`, posicao trava na borda do tile |
| C4 | Atravessar `platform` subindo | sem colisao (one-way: so colide descendo) |
| C5 | Pousar em `platform` descendo | colide, `onGround === true` |
| C6 | `block`/`brick` quebravel ao bump | retorna `{ broke: true }` quando aplicavel |
| C7 | Resolver eixos separadamente | mover dx depois dy evita "tunelamento" de canto |
| C8 | Sem tiles -> sem colisao | `onGround === false` (livre) |
| C9 | AABB jogador x inimigo (overlap topo) | classifica como **stomp** |
| C10 | AABB jogador x inimigo (overlap lateral) | classifica como **dano** |

Regra de classificacao stomp vs dano (pura, testavel): e **stomp** se `player.vy > 0` (descendo) E `player.bottomPrev <= enemy.top + 8`. Caso contrario, **dano** (a menos que invencivel por estrela ou Modo Humanware — ver 13.3.4).

#### 13.3.3 Parametros de habilidade (roster — ver secao 5)

Cada heroi tem habilidade data-driven. Testamos que os parametros aplicam o efeito correto SEM render. Os 5 jogaveis + companheiro do CONTEXTO:

```ts
// core/abilities.ts
export interface AbilityParams {
  id: 'salto_visionario' | 'dash_criativo' | 'escudo_governanca' | 'builder' | 'emc2';
  jumpVelMul: number;     // multiplicador sobre JUMP_VEL
  doubleJump: boolean;
  revealSecrets: boolean;
  dashSpeed: number;      // 0 = sem dash
  dashBreaksBlocks: boolean;
  blockDamage: boolean;   // escudo: anula 1 hit
  spawnsPlatform: boolean;
  timeScale: number;      // 1 = normal; <1 desacelera (E=mc2)
  cooldownTicks: number;
}
```

| Heroi | Habilidade | Assercao-chave do teste |
| --- | --- | --- |
| Renan | Salto Visionario | `doubleJump === true`; 2o pulo aplica `JUMP_VEL * jumpVelMul` (1.15 => -17.71); `revealSecrets` marca portais ocultos como visiveis |
| Dante | Dash Criativo | `dashSpeed === 11` por 10 ticks; `dashBreaksBlocks` quebra `brick`/`block` no caminho |
| Julio | Escudo de Governanca | proximo hit com escudo ativo => `damage === 0`, escudo consumido, `cooldownTicks` inicia |
| Artur | Builder | cria 1 plataforma 1x1 tile a frente; dura 240 ticks; remove apos expirar |
| Einstein | E=mc2 | `timeScale === 0.5` por 180 ticks; inimigos e projeteis avancam metade da distancia/tick; jogador normal |
| Renante (companheiro) | Amplificacao | NUNCA age sozinho: com Renante ativo, `cooldownTicks` da habilidade do heroi reduz 30% e a magnitude do efeito sobe 20%. Teste: sem heroi base, Renante nao produz nenhuma acao. |

Teste exemplar de invariante do Renante (regra de design travada — "so amplifica"):

```ts
it('Renante nunca age sem habilidade base', () => {
  const s = makeState({ hero: null, companion: 'renante' });
  const out = triggerAbility(s);
  expect(out.actions).toEqual([]); // amplificador puro, zero acao propria
});
```

#### 13.3.4 Medidor Humanware (superpoder central — ver secao 6)

Medidor de coracao/consciencia 0..100. Enche agindo bem/coletando; cheio -> MODO HUMANWARE temporario (mundo desacelera, inimigos "Tolo" congelam, ferramentas turbinadas). Logica 100% pura.

```ts
// core/humanware.ts
export interface HumanwareState {
  meter: number;          // 0..100
  active: boolean;
  ticksLeft: number;      // duracao do modo quando ativo
}
export const HW = {
  MAX: 100,
  COIN_GAIN: 4,           // moeda
  STOMP_GAIN: 8,          // derrotar inimigo "Tolo"
  ITEM_GAIN: 15,          // item/lifecard
  DECAY_IDLE: 0.05,       // por tick parado sem coletar (evita "stall farming")
  MODE_TICKS: 360,        // 6 s a 60fps
  WORLD_SLOW: 0.5,        // timeScale do mundo no modo
} as const;
```

| # | Cenario | Assercao |
| --- | --- | --- |
| H1 | Moeda enche | +`COIN_GAIN` (4), clamp em 100 |
| H2 | Stomp em "Tolo" | +`STOMP_GAIN` (8) |
| H3 | Coleta item | +`ITEM_GAIN` (15) |
| H4 | Nunca passa de 100 | meter=98 +15 => `100` |
| H5 | Decay ocioso | sem ganho por 1 tick => meter -= 0.05, clamp >= 0 |
| H6 | Ativacao | meter=100 + input de modo => `active=true`, `ticksLeft=360`, meter zera |
| H7 | Inimigos "Tolo" congelam | no modo, `enemy.frozen === true`; outros tipos nao |
| H8 | Mundo desacelera | no modo, `timeScale === 0.5` |
| H9 | Ferramenta turbinada | no modo, ataque/pulo recebem multiplicador (ex.: dano x2, `jumpVelMul` +10%) |
| H10 | Expiracao | apos 360 ticks => `active=false`, retoma `timeScale=1`, descongela inimigos |
| H11 | Imunidade a dano no modo | colisao lateral com "Tolo" congelado => `damage === 0` |

#### 13.3.5 Parser/validador de fase (data-driven — ver secao 7)

Fases sao dados (JSON/objeto). Nivel base: 168x11 tiles, GROUND_ROW=9, goal na coluna 160. O parser converte a definicao em `Map` de tiles + listas de entidades, e o **validador** rejeita fases invalidas em build/CI.

```ts
// core/level.ts
export interface LevelDef {
  id: string;
  cols: number;            // ex.: 168
  rows: number;            // ex.: 11
  groundRow: number;       // 9
  goalCol: number;         // 160
  tiles: string[];         // 1 string por linha; chars: '.'=vazio 'G'=ground 'B'=brick 'P'=platform 'X'=block
  enemies: { type: string; col: number; row: number }[];
  coins: { col: number; row: number }[];
  items: { kind: string; col: number; row: number }[];
  client?: 'vivo'|'kion'|'ecorodovias'|'mubadala'|'jpmorgan'; // fase-desafio (ver secao 7/lore)
}
export interface ParsedLevel {
  tileMap: Map<string, TileType>; // chave "c,r"
  spawn: { col: number; row: number };
  goal: { col: number; row: number };
  enemies: Enemy[]; coins: Coin[]; items: Item[];
}
```

Regras do validador (`validateLevel` retorna lista de erros; lista vazia = valido):

| # | Regra | Erro se violada |
| --- | --- | --- |
| L1 | `tiles.length === rows` | "linhas != rows" |
| L2 | Toda linha tem `cols` chars | "largura inconsistente na linha N" |
| L3 | Apenas chars do alfabeto `.GBPX` | "char invalido 'Z' em c,r" |
| L4 | Existe spawn jogavel (chao solido sob a coluna 0-3) | "sem spawn seguro" |
| L5 | `goalCol < cols` e tem chao sob o goal | "goal fora do mapa / flutuando" |
| L6 | Caminho minimo: nenhum vao > 5 tiles sem plataforma alcancavel (alcance de pulo ~3 tiles) | "vao intransponivel em col N" |
| L7 | Inimigos/itens/moedas dentro dos limites do mapa | "entidade fora dos limites" |
| L8 | Pelo menos 1 caminho do spawn ao goal (BFS sobre tiles caminhaveis + saltos) | "fase incompletavel" |

L6 e L8 sao testes de **jogabilidade garantida** (a fase e sempre vencivel). BFS de alcancabilidade considera salto de ate 3 tiles de altura e 4 de largura (derivado da fisica F9).

```ts
it('L8: fase base de exemplo e completavel', () => {
  const parsed = parseLevel(LEVEL_01);
  expect(validateLevel(LEVEL_01)).toEqual([]);
  expect(isReachable(parsed.tileMap, parsed.spawn, parsed.goal)).toBe(true);
});
```

#### 13.3.6 Camera e maquina de estados

- **Camera-clamp** (puro): `clampCamera(targetX, levelWidthPx, viewW=960)` nunca mostra fora do mapa. Testes: borda esquerda (`camX === 0`), borda direita (`camX === levelWidthPx - 960`), centro segue jogador.
- **Maquina de estados** (loading/title/playing/win/over — do CONTEXTO): transicoes validas testadas como tabela.

| De | Evento | Para |
| --- | --- | --- |
| loading | assetsReady | title |
| title | start | playing |
| playing | reachGoal | win |
| playing | hpZero / timeZero | over |
| win | continue | title |
| over | retry | playing |
| over | menu | title |

Teste: transicoes ilegais (ex.: `loading -> win`) sao no-op e nao mudam estado.

### 13.4 Testes de integracao de logica (sem render)

Acima da unidade, testamos `stepWorld` orquestrando varios sistemas por N frames, ainda sem Canvas. Util para regressoes de gameplay completas e rapidas (centenas de testes em < 1 s).

```ts
// core/world.ts
export interface InputFrame {
  left: boolean; right: boolean; jump: boolean;
  run: boolean; ability: boolean; humanware: boolean;
}
export function stepWorld(state: GameState, input: InputFrame): GameState; // PURA
```

Cenarios de integracao (`world.test.ts`):

| # | Roteiro (sequencia de InputFrame) | Assercao |
| --- | --- | --- |
| W1 | Andar 60 ticks `right` sobre chao plano | jogador avanca >= 240 px, `onGround` o tempo todo, `hp` intacto |
| W2 | Pular sobre vao de 3 tiles | atravessa sem cair (vivo do outro lado) |
| W3 | Stomp em "Tolo" | inimigo removido, `STOMP_BOUNCE === -11.5` aplicado, +moeda/medidor |
| W4 | Colisao lateral sem estrela/Humanware | `hp` decrementa, i-frames ativos |
| W5 | Pegar estrela | `invincible` por `STAR_TIME` (480), atravessa "Tolo" sem dano |
| W6 | Encher medidor e ativar Humanware | inimigos "Tolo" congelam, `timeScale=0.5`, dura 360 ticks |
| W7 | Bump em `brick` com moeda | moeda emerge, contador +1 |
| W8 | Projetil acerta jogador | dano correto; projetil consumido |
| W9 | Run completa LEVEL_01 (script de inputs gravado) | estado final `win`, tempo restante > 0 |
| W10 | Time-attack: deixar `TIME_START` (250) zerar | estado `over` por tempo |

W9 usa um **roteiro de inputs gravado** (`fixtures/level01-winning-run.json`): uma lista de `InputFrame` por tick que comprovadamente vence a fase. Esse fixture e o "teste dourado" anti-regressao de fisica — se alguem mexer numa constante e quebrar a corrida, W9 falha imediatamente.

### 13.5 Smoke / integracao E2E — Playwright

Ferramenta: **Playwright** (`@playwright/test`), navegador-alvo Chromium (representa Chrome/Edge; navegador e plataforma-alvo do CONTEXTO). Viewport fixo no tamanho do jogo: **960x528**. O dev server e o `vite preview` (porta 4173); `webServer` do Playwright sobe automaticamente.

Por que E2E alem dos unit tests: so o navegador prova que o **atlas PNG/bg base64 carrega**, o **loop rAF roda**, o **input do teclado chega** e o **Canvas desenha**. Validamos comportamento observavel, nao pixels exatos (exceto poucos snapshots tolerantes).

Hooks de teste expostos no `window` SOMENTE em build de teste (flag `__GZ_TEST__`), para o Playwright inspecionar estado sem hacks frageis:

```ts
// exposto apenas quando import.meta.env.VITE_GZ_TEST === '1'
declare global {
  interface Window {
    __GZ__?: {
      getState(): { mode: string; x: number; coins: number; hp: number;
                    humanware: number; fpsAvg: number; timeLeft: number };
      loadLevel(id: string): void;
      pressScript(frames: InputFrame[]): Promise<void>; // injeta inputs deterministicos
    };
  }
}
```

Suite E2E minima obrigatoria (`e2e/smoke.spec.ts`):

| # | Fluxo | Passos | Assercao |
| --- | --- | --- | --- |
| E1 | **Carrega** | abrir `/`, esperar `mode==='title'` | titulo visivel; sem erro de console; logo Gzero presente |
| E2 | **Inicia** | tecla Enter/Espaco no titulo | `mode==='playing'` em < 2 s |
| E3 | **Move** | segurar Seta-direita 1 s | `getState().x` aumentou; sem erro de console |
| E4 | **Pula** | tecla de pulo | y do jogador sobe e desce (via 2 amostras de estado) |
| E5 | **Coleta** | andar ate 1a moeda | `coins` incrementa |
| E6 | **Humanware** | `pressScript` que enche medidor + ativa | `humanware===0` apos ativar e modo ativo |
| E7 | **Completa fase** | `pressScript(level01-winning-run)` | `mode==='win'` |
| E8 | **Game over** | deixar tempo zerar via `pressScript` ocioso | `mode==='over'` |
| E9 | **Sem erros de console** | rodar E1..E7 | `console.error` e `pageerror` capturados == 0 |
| E10 | **Assets** | interceptar `page.on('requestfailed')` | nenhuma request falhou (atlas/bg/fontes carregam) |
| E11 | **Troca de heroi** | desbloquear/selecionar via hook, jogar 30 ticks | habilidade do heroi escolhido ativa corretamente |
| E12 | **Single-file build** | abrir `dist-singlefile/index.html` via `file://` | E1..E3 passam (valida o build single-file do CONTEXTO) |

```ts
// e2e/smoke.spec.ts (E2/E3/E7/E9)
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  (page as any).__errors = errors;
  await page.goto('/');
  await page.waitForFunction(() => window.__GZ__?.getState().mode === 'title');
});

test('E2/E3: inicia e move', async ({ page }) => {
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__GZ__!.getState().mode))
    .toBe('playing');
  const x0 = await page.evaluate(() => window.__GZ__!.getState().x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  const x1 = await page.evaluate(() => window.__GZ__!.getState().x);
  expect(x1).toBeGreaterThan(x0);
});

test('E7: completa a fase com run gravada', async ({ page }) => {
  const frames = require('../fixtures/level01-winning-run.json');
  await page.keyboard.press('Enter');
  await page.evaluate(f => window.__GZ__!.pressScript(f), frames);
  await expect.poll(() => page.evaluate(() => window.__GZ__!.getState().mode))
    .toBe('win');
});

test.afterEach(({ page }) => {
  expect((page as any).__errors).toEqual([]); // E9
});
```

Snapshots visuais: usamos `toHaveScreenshot` com tolerancia `maxDiffPixelRatio: 0.02` em **apenas 3 telas estaveis** (title, HUD inicial de playing, win) para pegar regressoes graves de layout/cor da marca (fundo #09090b, magenta de acao — ver secao 4). Nao fazemos snapshot de frames de gameplay em movimento (instaveis).

### 13.6 Checklist de playtest manual

Rodado pelo time Gzero antes de cada release interna (jogo e para diversao do grupo — publico interno do CONTEXTO). Tempo-alvo: ~15 min. Marcar PASS/FAIL; qualquer FAIL bloqueia release.

**A. Controles e sensacao (game feel)**
- [ ] Pulo responde no mesmo frame; coyote/buffer fazem o pulo "perdoar" (nao falha em beirada).
- [ ] Correr vs andar e perceptivel (4.6 vs 7.3 de topo).
- [ ] Parar no chao freia rapido; no ar mantem inercia.
- [ ] Stomp da o "quique" satisfatorio (-11.5).

**B. Habilidades do roster (ver secao 5)**
- [ ] Renan: pulo duplo e revelacao de portais/segredos funcionam.
- [ ] Dante: dash quebra obstaculo certo.
- [ ] Julio: escudo bloqueia exatamente 1 dano.
- [ ] Artur: plataforma temporaria aparece, e usavel e some.
- [ ] Einstein: tempo desacelera; jogador continua agil.
- [ ] Renante so amplifica (nunca age sozinho).

**C. Humanware (superpoder central)**
- [ ] Medidor enche de forma justa (sem farm trivial; decay ocioso percebido).
- [ ] Modo Humanware: mundo desacelera, "Tolo" congela, ataque/pulo turbinam, dura ~6 s.

**D. Lore/marca (ver secao 8/lore)**
- [ ] Inimigo "O Tolo com a Ferramenta" lido como tema.
- [ ] Chefe ESFINGE apresenta enigma; vitoria mostra "Voce tambem acredita que podemos mudar o mundo? Bora juntos.".
- [ ] Tom e zoeira sao "grounded na marca" (interno, mas digno da Gzero).
- [ ] Cores/fontes batem com a direcao visual (magenta de acao, fundo escuro, Outfit/Inter/mono UPPERCASE no HUD).

**E. Robustez**
- [ ] Redimensionar janela nao quebra (scaling do Canvas 960x528).
- [ ] Perder foco da aba pausa/retoma sem bug.
- [ ] Reiniciar fase (over -> retry) zera estado corretamente.
- [ ] Sem travas/soft-locks; sempre da pra chegar ao goal (coluna 160).

**F. Acessibilidade basica**
- [ ] Teclado funciona 100% (jogo e teclado-first).
- [ ] HUD legivel a 960x528; contraste do texto #f7f3f6 sobre fundo escuro ok.

### 13.7 Orcamento de performance (60fps)

Alvo absoluto: **60fps no Canvas 2D**, navegador desktop, em maquina de referencia (notebook mediano, Chrome). Orcamento por frame: **16.6 ms**, dos quais reservamos:

| Etapa do frame | Orcamento (ms) | Nota |
| --- | --- | --- |
| Input + `stepWorld` (logica) | <= 3.0 | pura, deve ser barata |
| Render Canvas (tiles + entidades + particulas + HUD) | <= 9.0 | maior custo; ver tecnicas abaixo |
| Audio/eventos/misc | <= 1.5 | |
| Folga (margem) | ~3.1 | absorve picos de GC |

Metas mensuraveis (gate de performance):
- **FPS medio >= 58** e **>= 95% dos frames < 18 ms** numa run automatizada de 20 s rolando LEVEL_01.
- **Zero "long task" > 50 ms** apos o frame de loading (sem stutter perceptivel).
- **Sem crescimento de heap monotonico**: rodar 60 s e checar que `performance.memory` (Chrome) nao cresce > 10% (deteccao grosseira de leak; pooling de particulas/projeteis obrigatorio).
- **Budget de objetos**: <= 200 particulas ativas, <= 60 inimigos vivos por tela; pools pre-alocados (sem `new` por frame no hot path).

Tecnicas obrigatorias (ver secao 2/render): culling de tiles fora da camera (so desenhar colunas visiveis + 1 de margem), atlas unico (1 `drawImage` por sprite, sem trocar textura), bg pre-renderizado, `imageSmoothingEnabled=false` (pixel art quadrado, radius 0 — direcao visual), sem `shadowBlur` em loop (sombras duras com offset = `fillRect` deslocado, barato).

Medicao automatizada via Playwright (`e2e/perf.spec.ts`): instrumentamos um anel de tempos de frame no jogo, exposto em `getState().fpsAvg` e num buffer `window.__GZ__.frameTimes`. O teste roda a run gravada e afirma os limites:

```ts
test('PERF: 60fps em LEVEL_01', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Enter');
  await page.evaluate(() => window.__GZ__!.loadLevel('level01'));
  await page.waitForTimeout(20000);
  const ft: number[] = await page.evaluate(() => (window as any).__GZ__.frameTimes);
  const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
  const slow = ft.filter(t => t >= 18).length / ft.length;
  expect(1000 / avg).toBeGreaterThanOrEqual(58);
  expect(slow).toBeLessThanOrEqual(0.05);
});
```

Quando substituirmos placeholders pela arte do Higgsfield (pipeline do CONTEXTO), re-rodar PERF: assets maiores nao podem derrubar o FPS abaixo do gate; se derrubarem, otimizar atlas (reduzir dimensoes/recortar) antes de mergear.

### 13.8 Nota de TDD

Adotamos **TDD para todo o Core e Sistemas** (camadas puras da 13.1). Ciclo **red-green-refactor**:

1. **Red:** antes de implementar uma regra (ex.: jump buffer, ganho do medidor, regra L6 do validador), escreva o teste que descreve o comportamento esperado com os numeros exatos. Ele deve falhar.
2. **Green:** implemente o minimo para passar.
3. **Refactor:** limpe mantendo verde.

Justificativa (forte para este projeto): a fisica e o gameplay sao definidos por **constantes numericas exatas** (CONTEXTO) e por **invariantes de jogabilidade** (fase sempre vencivel, Renante nunca age sozinho, medidor satura em 100). TDD trava esses contratos e impede que ajustes de "feel" futuros quebrem silenciosamente o que ja funcionava. Render e bordas NAO seguem TDD estrito (verificados por Playwright/playtest), pois testar pixels antes de existir UI e contraproducente.

Regra pratica: **toda correcao de bug de logica comeca por um teste que reproduz o bug** (regression test), depois o fix. O fixture `level01-winning-run.json` (13.4 W9) e atualizado deliberadamente e versionado quando uma mudanca de fisica e intencional.

### 13.9 Estrutura de arquivos, scripts e CI

Layout (coerente com a arquitetura modular da secao 2):

```
SuperGzeroWorld/
  src/
    core/            # logica pura + *.test.ts co-localizados
    systems/         # stepWorld e orquestracao + *.test.ts
    render/          # Canvas (sem unit test; coberto por E2E)
    main.ts          # bootstrap do loop rAF (borda)
  fixtures/
    level01-winning-run.json
  e2e/
    smoke.spec.ts
    perf.spec.ts
  vitest.config.ts
  playwright.config.ts
```

Scripts `package.json`:

```jsonc
{
  "scripts": {
    "test": "vitest run --coverage",
    "test:watch": "vitest",          // loop de TDD
    "test:e2e": "playwright test",
    "test:perf": "playwright test e2e/perf.spec.ts",
    "verify": "npm run test && npm run test:e2e"  // gate completo
  }
}
```

Limites de cobertura em `vitest.config.ts` (gate falha o build se abaixo):

```ts
coverage: {
  provider: 'v8',
  thresholds: { lines: 80, functions: 80, branches: 75,
                'src/core/physics.ts': { lines: 90, branches: 100 },
                'src/core/collision.ts': { lines: 90, branches: 100 },
                'src/core/humanware.ts': { lines: 90, branches: 100 } }
}
```

**Gate de CI (GitHub Actions, antes de deploy na Vercel — ver secao de deploy):** em ordem, falha rapida (1) `npm run test` (unit+integracao+cobertura), (2) `npm run test:e2e` (smoke), (3) `npm run test:perf` (60fps). So depois de tudo verde o deploy de preview/producao prossegue. O build single-file e validado por E12. Toda fase nova roda automaticamente por `validateLevel` (13.3.5) num teste data-driven que itera sobre todos os arquivos de fase — adicionar uma fase quebrada falha o CI antes de chegar ao grupo.

---

## 14. Roadmap & Marcos

Esta seção define a sequência de entregas do projeto "Gravidade Zero — O Jogo", organizada em milestones (M0 a M4) com critérios de aceite verificáveis, estimativas, e definição explícita do MVP. Todos os marcos respeitam a stack travada (Vite + TypeScript, Canvas 2D, ESM, deploy Vercel — ver seção 2) e a abordagem de arte por placeholders-primeiro (ver seções 9 e 12). As constantes de física da base são reusadas no M0 (ver seção 5).

> **Regra de ouro do roadmap:** o jogo deve estar **jogável de ponta a ponta a cada milestone** (do título até a tela de vitória ou over). Nunca se entra em um milestone seguinte com o anterior em estado quebrado. "Greybox" significa formas/placeholders desenhados em código; "polido" significa arte e feedback de jogo finalizados para aquele escopo.

### 14.1 Visão geral dos marcos

| Marco | Nome | Foco | Duração estimada | Dias úteis acumulados | Estado |
|-------|------|------|------------------|------------------------|--------|
| **M0** | Fundação Jogável | Scaffold + port do motor + 1 personagem placeholder + World1 greybox | 2 semanas (10 dias úteis) | 10 | Pré-MVP |
| **M1** | **MVP — Gravidade Zero Jogável** | 5 personagens placeholders + Humanware + inimigos + World1 polida | 3 semanas (15 dias úteis) | 25 | **🎯 MVP** |
| **M2** | Identidade Visual Real | Troca de arte por key-art + pixel do Higgsfield | 2 semanas (10 dias úteis) | 35 | Pós-MVP |
| **M3** | Mundo Expandido | Mais mundos + chefes (Esfinge) + áudio | 4 semanas (20 dias úteis) | 55 | Pós-MVP |
| **M4** | Fases-Desafio de Cliente | Vivo, Kion, Ecorodovias, Mubadala, JPMorgan | 3 semanas (15 dias úteis) | 70 | Pós-MVP |

Estimativas assumem 1 desenvolvedor em ritmo de projeto sério porém paralelo a outras atividades (não full-time). São referenciais, não compromissos contratuais — o projeto é interno (ver seção 1). A ordenação é estritamente sequencial: cada marco depende do anterior.

### 14.2 Definição de MVP (lock)

> **O MVP é o M1.** O projeto é considerado um sucesso mínimo entregável quando o M1 está completo e deployado na Vercel.

**O MVP entrega:**

1. Os **5 personagens jogáveis** (Renan, Dante, Julio, Artur, Einstein) com placeholders de código consistentes (mesma base pixel, paletas distintas — ver seção 6), cada um com sua habilidade-assinatura funcional.
2. O **MODO HUMANWARE** completo: medidor de coração/consciência que enche agindo bem/coletando, e que ao encher dispara o estado temporário (mundo desacelera, inimigos "Tolo" congelam, ferramentas viram "potência") — ver seção 7.
3. **Inimigos** funcionais, incluindo o "Tolo com a Ferramenta" (patrulha + stomp da base) e a interação correta com o Humanware (congelam).
4. **World1 polida**: layout final, balanceamento, coletáveis, Lifecards de desbloqueio, portais entre seções, e a meta (goal) na coluna 160 (ver seção 5).
5. **Fluxo de jogo completo**: loading → title → seleção de personagem → playing → win/over, com HUD Gzero (mono UPPERCASE, ver seção 8).
6. **Deploy na Vercel** funcionando + build single-file opcional para compartilhar no grupo (ver seção 2).

**O MVP NÃO inclui (fica para M2+):**

- Arte final do Higgsfield (key-art / retratos / pixel definitivo) — o MVP roda 100% com placeholders desenhados em código.
- O companheiro **Renante** (amplificador de habilidade) — é desejável mas não bloqueante; entra em M1 se houver folga, senão escorrega para M2.
- Mundos 2+ e chefes (Esfinge) — M3.
- Áudio (música/SFX) — M3.
- Fases-desafio de cliente — M4.

**Critério de aceite-mestre do MVP:** um membro do grupo da Gzero abre a URL da Vercel, escolhe entre os 5 personagens, joga a World1 do início ao fim, ativa o Modo Humanware pelo menos uma vez, e chega à tela de vitória — sem travamentos, com 60fps estáveis e a identidade visual Gzero (magenta sobre fundo escuro) reconhecível.

### 14.3 M0 — Fundação Jogável (Pré-MVP)

**Objetivo:** sair de zero para um jogo jogável com o motor da base portado para TypeScript, 1 personagem e a primeira fase em greybox.

**Escopo:**

1. **Scaffold do projeto** (ver seção 2): repositório em `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld`, Vite + TypeScript + ESM, ESLint/Prettier, estrutura de pastas data-driven, `tokens.css` integrado, deploy de smoke-test na Vercel.
2. **Port do motor da base** (`remixed-6e07a45d.html`): tiles em `Map("c,r")`, blocos com bump/moedas, moedas, itens, partículas, câmera com clamp, máquina de estados (loading/title/playing/win/over), loop `requestAnimationFrame`. Constantes de física reusadas exatamente (ver seção 5).
3. **1 personagem placeholder** (Renan, o co-fundador líder) desenhado em código (retângulos/formas com paleta — pixel quadrado, radius 0, sombra dura).
4. **World1 greybox**: nível 168×11 tiles com `GROUND_ROW=9` e goal na coluna 160, montado como dados (não hardcoded), com chão, plataformas e a meta.
5. **Resolução-alvo 960×528** e canvas escalável.

**Estrutura de pastas alvo (entregável do M0):**

```
SuperGzeroWorld/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ public/
│  └─ assets/            # PNG/JPEG/atlas migrados da base
├─ src/
│  ├─ main.ts            # bootstrap + loop
│  ├─ engine/
│  │  ├─ loop.ts         # requestAnimationFrame, fixed timestep
│  │  ├─ input.ts        # teclado (buffer/coyote)
│  │  ├─ camera.ts       # clamp
│  │  ├─ tilemap.ts      # Map("c,r") -> ground/brick/platform/block
│  │  ├─ physics.ts      # GRAVITY, MAX_FALL, accel, decel
│  │  ├─ entity.ts       # base de player/inimigo/coletável
│  │  ├─ particles.ts
│  │  └─ states.ts       # máquina loading/title/playing/win/over
│  ├─ game/
│  │  ├─ player.ts
│  │  ├─ enemy.ts
│  │  ├─ collectibles.ts
│  │  └─ render.ts       # draw de placeholders
│  ├─ data/
│  │  ├─ characters.ts   # roster data-driven
│  │  ├─ worlds/
│  │  │  └─ world1.ts    # layout de tiles como dados
│  │  └─ frames.ts       # mapa FRAMES de coordenadas do atlas
│  └─ config/
│     └─ constants.ts    # TILE, GRAVITY, etc.
└─ docs/
   └─ superpowers/specs/2026-06-08-gravidade-zero-game-design.md
```

**Interface-âncora introduzida no M0** (consolidada em seção 4):

```ts
// src/config/constants.ts — física da base, travada
export const TILE = 48;
export const GRAVITY = 0.8;
export const MAX_FALL = 17;
export const WALK_ACCEL = 0.7;
export const RUN_ACCEL = 0.95;
export const WALK_MAX = 4.6;
export const RUN_MAX = 7.3;
export const GROUND_DECEL = 0.6;
export const AIR_DECEL = 0.18;
export const JUMP_VEL = -15.4;
export const COYOTE = 7;        // frames
export const JUMP_BUFFER = 8;   // frames
export const STOMP_BOUNCE = -11.5;
export const ENEMY_SPEED = 1.25;
export const STAR_TIME = 480;
export const TIME_START = 250;
export const GROUND_ROW = 9;
export const LEVEL_COLS = 168;
export const LEVEL_ROWS = 11;
export const GOAL_COL = 160;
export const VIEW_W = 960;
export const VIEW_H = 528;
```

**Critérios de aceite do M0:**

- [ ] `npm run dev` sobe o jogo localmente; `npm run build` gera bundle válido.
- [ ] Deploy de smoke-test na Vercel acessível por URL.
- [ ] Personagem Renan (placeholder) anda, corre, pula com a física exata da base (números da seção 5 batem em teste manual: pulo alcança a mesma altura da base).
- [ ] Coyote time (7 frames) e jump buffer (8 frames) funcionam.
- [ ] Câmera segue o player e faz clamp nas bordas do nível.
- [ ] World1 greybox carregada **de dados** (`world1.ts`), com chão na linha 9, plataformas e goal na coluna 160 alcançável.
- [ ] Ao tocar o goal, transição para estado `win`. Ao cair fora ou zerar tempo, estado `over`.
- [ ] Máquina de estados completa: loading → title → playing → win/over, com reinício.
- [ ] 60fps estáveis no Chrome em hardware do Artur.
- [ ] Zero erros no console.

**Definição de pronto (DoD):** código em TypeScript tipado (sem `any` solto no motor), commitado, jogável fim-a-fim em greybox, deploy de teste na Vercel verde.

### 14.4 M1 — MVP: Gravidade Zero Jogável 🎯

**Objetivo:** transformar a fundação em um jogo de marca completo e divertido, com todo o roster, o superpoder central e a primeira fase polida. **Este é o MVP.**

**Escopo:**

1. **5 personagens jogáveis** com placeholders consistentes (ver seções 6 e 9), cada um com habilidade-assinatura:

| Personagem | Habilidade | Efeito de gameplay (M1) |
|------------|-----------|--------------------------|
| Renan | Salto Visionário | Pulo mais alto + pulo duplo; revela portais/segredos próximos |
| Dante | Dash Criativo | Investida rápida horizontal que quebra `brick`/obstáculos |
| Julio | Escudo de Governança | Bloqueia 1 dano (guardrail); breve invulnerabilidade |
| Artur | Builder | Cria 1 plataforma/ferramenta temporária sob demanda |
| Einstein | E=mc² | Desacelera o tempo do mundo por X frames (slow-mo local) |

2. **Roster data-driven** — personagens definidos como dados, não código condicional:

```ts
// src/data/characters.ts
export type AbilityId = 'visionary_jump' | 'creative_dash'
  | 'governance_shield' | 'builder' | 'emc2';

export interface CharacterDef {
  id: 'renan' | 'dante' | 'julio' | 'artur' | 'einstein';
  name: string;
  ability: AbilityId;
  unlockedByDefault: boolean;   // M1: Renan = true; demais via Lifecard
  palette: { primary: string; accent: string; outline: string };
  // M2 troca isto por sprites do Higgsfield; M1 usa o draw de placeholder
  placeholderTint: string;
}

export const ROSTER: CharacterDef[] = [
  { id: 'renan', name: 'Renan', ability: 'visionary_jump',
    unlockedByDefault: true,
    palette: { primary: '#0099ff', accent: '#f43db3', outline: '#050505' },
    placeholderTint: '#0099ff' },
  { id: 'dante', name: 'Dante', ability: 'creative_dash',
    unlockedByDefault: false,
    palette: { primary: '#e802cf', accent: '#cdf140', outline: '#050505' },
    placeholderTint: '#e802cf' },
  { id: 'julio', name: 'Julio', ability: 'governance_shield',
    unlockedByDefault: false,
    palette: { primary: '#7112ff', accent: '#0099ff', outline: '#050505' },
    placeholderTint: '#7112ff' },
  { id: 'artur', name: 'Artur', ability: 'builder',
    unlockedByDefault: false,
    palette: { primary: '#ff0055', accent: '#cdf140', outline: '#050505' },
    placeholderTint: '#ff0055' },
  { id: 'einstein', name: 'Einstein', ability: 'emc2',
    unlockedByDefault: false,
    palette: { primary: '#f7f3f6', accent: '#612af1', outline: '#050505' },
    placeholderTint: '#f7f3f6' },
];
```

3. **MODO HUMANWARE** (superpoder central, igual para todos — ver seção 7): medidor de coração/consciência que enche agindo bem/coletando; cheio → modo temporário com desaceleração do mundo, congelamento dos inimigos "Tolo" e turbo nas habilidades.

```ts
// src/game/humanware.ts
export interface HumanwareState {
  meter: number;          // 0..METER_MAX
  active: boolean;
  framesLeft: number;     // duração do modo quando ativo
}

export const METER_MAX = 100;
export const HUMANWARE_DURATION = 360;  // frames (~6s a 60fps)
export const WORLD_TIMESCALE_HW = 0.5;  // mundo a meia velocidade no modo
export const GAIN_COIN = 4;             // por moeda
export const GAIN_GOOD_ACT = 10;        // por ato bom (stomp justo, item)
```

4. **Inimigos** (ver seção 10): "O Tolo com a Ferramenta" (patrulha + stomp da base, `ENEMY_SPEED=1.25`, 38×34) e variações de patrulha; congelam durante o Humanware.
5. **Lifecards** — coletável que desbloqueia o personagem correspondente; persistência em `localStorage`.
6. **World1 polida** — layout final balanceado, portais entre seções (lore de Gravidade Zero, ver seção 13), coletáveis distribuídos, e o "reparo da zona" como tema.
7. **HUD e telas Gzero** — título, seleção de personagem, HUD (tempo, moedas, medidor Humanware, Lifecards), tela de vitória com a frase "Você também acredita que podemos mudar o mundo? Bora juntos." (ver seções 8 e 13).
8. **Deploy Vercel + build single-file** opcional.
9. **(Opcional/stretch) Renante** — companheiro que amplifica a habilidade atual; entra se houver folga no cronograma, senão escorrega para M2.

**Critérios de aceite do M1 (MVP):**

- [ ] Os 5 personagens são selecionáveis (Renan por padrão; demais desbloqueáveis por Lifecard) e cada habilidade-assinatura funciona conforme a tabela.
- [ ] O medidor Humanware enche ao coletar/agir bem e, cheio, ativa o Modo Humanware: mundo a `WORLD_TIMESCALE_HW`, inimigos "Tolo" congelam, habilidades turbinadas, e expira após `HUMANWARE_DURATION`.
- [ ] Inimigos patrulham, podem ser derrotados por stomp (`STOMP_BOUNCE=-11.5`) e causam dano por contato lateral.
- [ ] Escudo de Governança (Julio) bloqueia exatamente 1 dano; Dash (Dante) quebra `brick`; Builder (Artur) cria plataforma temporária; E=mc² (Einstein) desacelera; Salto Visionário (Renan) faz pulo duplo e sinaliza portais.
- [ ] Lifecards desbloqueiam personagens e o estado persiste entre sessões (`localStorage`).
- [ ] World1 é completável do título à vitória, com a frase de vitória da marca exibida.
- [ ] Identidade visual Gzero aplicada: fundo escuro (#09090b/#121216/#050505), magenta de ação, HUD mono UPPERCASE, pixel quadrado/sombra dura.
- [ ] Deploy na Vercel verde + build single-file gerável e compartilhável.
- [ ] 60fps estáveis; zero erros de console; nenhum estado de jogo que trave o loop.
- [ ] **Critério-mestre do MVP (14.2) satisfeito por playtest de um membro do grupo.**

**Marco de comunicação:** ao fechar o M1, compartilhar a URL Vercel + o single-file no grupo da Gzero como "primeira versão jogável".

### 14.5 M2 — Identidade Visual Real (troca de arte via Higgsfield)

**Objetivo:** substituir os placeholders de código pela arte final do Higgsfield, sem alterar gameplay. Tudo que era placeholder vira sprite/atlas definitivo (ver seções 9 e 12).

**Escopo:**

1. **Pipeline de arte (abordagem 2, híbrida):** 1 retrato key-art por personagem + corpo pixel consistente (mesma base, paleta + traço marcante), via `nano_banana_pro` (image-to-image foto→pixel) ou `soul_2`, a partir das fotos do Artur (`C:\Users\artur\Área de Trabalho\Artur-Fotos-Avatar`) e da equipe (`...\Gzero\Higgsfield\Selfies`).
2. **Sistema de troca por dados:** a `CharacterDef` ganha referência a sprite/atlas; o renderer passa a desenhar sprites em vez de formas — alternável por flag para A/B com placeholders.
3. **Atlas Gzero:** novo `FRAMES` para personagens, inimigo "Tolo", coletáveis, portais e tiles, mantendo paleta de tokens.
4. **Retratos key-art** nas telas de título/seleção/Lifecard.

```ts
// extensão de CharacterDef em M2
export interface CharacterArt {
  keyArtUrl: string;       // retrato Higgsfield (telas/UI)
  atlasFrames: {           // animações pixel
    idle: string[]; run: string[]; jump: string[];
    ability: string[]; hurt: string[];
  };
}
```

**Risco conhecido (do contexto):** operações de conta do Higgsfield (balance/upload/workspaces) estavam falhando ("Something went wrong") — provável auth/sessão do conector ou outage. **Mitigação:** o M1 (MVP) não depende disso; o M2 só inicia após reconexão bem-sucedida. Enquanto o conector estiver instável, o jogo permanece publicável com placeholders. Plano B: gerar a arte por lotes em uma janela de conector estável e versioná-la em `public/assets`.

**Critérios de aceite do M2:**

- [ ] Os 5 personagens têm retrato key-art + corpo pixel consistente no jogo.
- [ ] Renderer alterna entre placeholder e sprite por flag (regressão A/B).
- [ ] Inimigo "Tolo", coletáveis e portais com arte final.
- [ ] Nenhuma mudança de física/gameplay vs. M1 (mesmos números da seção 5).
- [ ] Deploy Vercel atualizado + single-file regenerado.
- [ ] 60fps mantidos com os novos assets (sem regressão de performance).

### 14.6 M3 — Mundo Expandido (mais mundos + chefes + áudio)

**Objetivo:** crescer o jogo de 1 para múltiplos mundos, adicionar o chefe-enigma e dar trilha sonora/efeitos.

**Escopo:**

1. **Mais mundos** (mínimo World2 e World3), cada um com tema de lore: zonas a reparar rumo às 3 Transformações (Existencial + Cultural + Digital) e à Consciência Unificada (ver seção 13). Todos data-driven em `src/data/worlds/`.
2. **Sistema de mundos/progressão:** mapa de mundos, conclusão por mundo, persistência.
3. **Chefe ESFINGE** (chefe-enigma "decifra-me ou te devoro"): luta com mecânica de enigma — o jogador responde/age sob pressão; variações do "Tolo com a Ferramenta" como minions.
4. **Áudio:** música por mundo + SFX (pulo, moeda, stomp, Humanware, vitória), com mixer e mute. Web Audio API.
5. **Coleta das 3 Transformações** como objetivo macro de campanha.

```ts
// src/data/worlds/index.ts
export interface WorldDef {
  id: string;                 // 'world1' | 'world2' | ...
  title: string;
  transformation: 'existencial' | 'cultural' | 'digital' | null;
  cols: number; rows: number; groundRow: number; goalCol: number;
  tiles: string;              // encoded layout
  enemies: EnemySpawn[];
  boss?: 'esfinge';
  bgm: string;                // chave de áudio
}
```

**Critérios de aceite do M3:**

- [ ] Pelo menos 3 mundos jogáveis e encadeados, com progressão persistida.
- [ ] Chefe Esfinge funcional com mecânica de enigma e tela própria.
- [ ] As 3 Transformações são coletáveis e a Consciência Unificada é o objetivo final reconhecível.
- [ ] Música por mundo + SFX dos eventos principais, com controle de volume/mute.
- [ ] Sem regressão de 60fps; deploy Vercel + single-file atualizados.

### 14.7 M4 — Fases-Desafio de Cliente

**Objetivo:** adicionar fases temáticas inspiradas nos clientes da Gzero como desafios extras (ver seção 13).

**Escopo:**

1. **5 fases-desafio**, uma por cliente: Vivo, Kion, Ecorodovias, Mubadala, JPMorgan — cada uma com gimmick próprio coerente com o setor do cliente e com a marca (sem material confidencial; tom de "MISSÃO IA").
2. **Modo desafio:** desbloqueado após a campanha; ranking de tempo/pontos local (`localStorage`); selo de conclusão por cliente.
3. **Reuso total** de motor, inimigos e Humanware dos marcos anteriores — somente novos dados de fase + 1 gimmick por fase.

| Fase | Cliente | Gimmick-tema (decidido) |
|------|---------|--------------------------|
| C1 | Vivo | Conectividade: plataformas que aparecem em "pulsos de sinal" sincronizados |
| C2 | Kion | Logística/automação: esteiras móveis e empilhadeiras-obstáculo |
| C3 | Ecorodovias | Estrada: seção de rolagem mais veloz, pedágios como portais de checkpoint |
| C4 | Mubadala | Investimento: coletáveis de "valor" com risco/recompensa (burgundy #990033 = risco) |
| C5 | JPMorgan | Governança financeira: cofres-bloco e guardrails que exigem o Escudo de Governança |

**Critérios de aceite do M4:**

- [ ] 5 fases-desafio jogáveis, cada uma com seu gimmick e selo de conclusão.
- [ ] Modo desafio desbloqueia após a campanha; pontuação/tempo persistidos.
- [ ] Cada fase usa o motor existente sem fork de física.
- [ ] Deploy Vercel + single-file finais; jogo completo do título às 5 fases-desafio.

### 14.8 Dependências, ordem crítica e riscos transversais

**Caminho crítico (estritamente sequencial):** M0 → M1 (MVP) → M2 → M3 → M4. Nenhum marco posterior inicia antes dos critérios de aceite do anterior estarem verdes.

**Paralelizável dentro de um marco:**
- Em M1, o design de níveis da World1 polida pode avançar em paralelo às habilidades dos personagens.
- Em M2, a geração de arte do Higgsfield (assíncrona, por lotes) corre em paralelo à integração do renderer.
- Em M3, composição de áudio corre em paralelo ao level design dos novos mundos.

**Riscos e mitigações:**

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Conector Higgsfield instável ("Something went wrong") | Bloqueia M2 | MVP (M1) independe de arte final; gerar arte em lote quando o conector estabilizar; placeholders permanecem publicáveis |
| Física portada divergir da base | Sensação de jogo errada | Reusar constantes exatas (seção 5) e validar por teste manual de altura de pulo no M0 |
| Escopo de habilidades inflar | Atraso do MVP | M1 implementa a tabela 14.4 exatamente; extras (Renante) são stretch |
| Performance cair com assets reais | Quebra dos 60fps | Critério de aceite explícito de 60fps em M2/M3; atlas otimizado |
| Lore/clientes exporem material sensível | Risco de marca | Fases de cliente são temáticas/genéricas, sem dados confidenciais |

**Marcos compartilháveis com o grupo Gzero:** fim de **M1** (primeira versão jogável — prioridade), fim de **M2** (visual com a turma de verdade nas telas) e fim de **M3** (campanha com chefe e áudio). O M4 fecha o jogo completo.

---

## 15. Riscos, Decisões em Aberto & Apêndices

Esta seção consolida os riscos do projeto com mitigações concretas, registra as questões ainda em aberto (com a decisão provisória adotada para não travar a produção), trava o log de decisões já fechadas, e fornece glossário e referências. Onde uma seção anterior detalha o tema, ela é apenas referenciada por número (ex.: ver seção 3) para evitar duplicação.

---

### 15.1. Registro de Riscos (Risk Register)

Cada risco recebe um identificador estável (`R-NN`), categoria, probabilidade (Baixa/Média/Alta), impacto (Baixo/Médio/Alto/Crítico), uma **exposição** derivada (P×I numérico), gatilho de detecção, mitigação preventiva, plano de contingência (o que fazer quando ocorrer) e dono.

Escala numérica para exposição: Probabilidade {Baixa=1, Média=2, Alta=3} × Impacto {Baixo=1, Médio=2, Alto=3, Crítico=4}. Exposição ≥ 6 = risco prioritário (monitorar semanalmente); 3–4 = monitorar por marco; ≤ 2 = aceitar.

| ID | Categoria | Risco | Prob. | Impacto | Exp. | Dono |
|----|-----------|-------|-------|---------|------|------|
| R-01 | Infra/Conta | Auth/sessão do conector Higgsfield falhando ("Something went wrong" em balance/upload/workspaces) | Alta | Alto | 9 | Artur |
| R-02 | Arte | Inconsistência visual entre os 6 retratos key-art (paletas/luz/escala divergentes) | Alta | Alto | 9 | Artur |
| R-03 | Arte | Baixa fidelidade do rosto real (Renan, Dante, Julio, Artur, Einstein) no pixel/retrato | Média | Alto | 6 | Artur |
| R-04 | Processo | Scope creep — projeto "sério e expansível" virar infinito; nunca shipar | Alta | Crítico | 12 | Artur |
| R-05 | Técnico | Performance abaixo de 60 FPS no Canvas 2D (partículas, muitos inimigos, MODO HUMANWARE) | Média | Médio | 4 | Eng |
| R-06 | Conteúdo | Lore/marca distorcida ou zoeira interna fora do tom (ofende cliente/fundador) | Baixa | Alto | 3 | Artur |
| R-07 | Técnico | Quebra do build single-file (assets base64 muito grandes; limite de string/heap do browser) | Média | Médio | 4 | Eng |
| R-08 | Dados | Drift do design data-driven: dados de fase/personagem incompatíveis com schema (ver seções de fases e roster) | Média | Médio | 4 | Eng |
| R-09 | Jurídico/Marca | Uso de imagem de pessoas reais (fotos em `Artur-Fotos-Avatar` e `Higgsfield/Selfies`) sem consentimento explícito | Baixa | Crítico | 4 | Artur |
| R-10 | Físico/Game-feel | Reuso das constantes da base resultar em game-feel ruim no novo tema (espaço/baixa gravidade) | Média | Médio | 4 | Eng |
| R-11 | Infra/Deploy | Falha de deploy na Vercel (tamanho de bundle, caminho de assets, rota de SPA) | Baixa | Médio | 2 | Eng |
| R-12 | Acessibilidade | Magenta sobre fundo escuro abaixo do contraste mínimo em texto pequeno/HUD | Média | Baixo | 2 | Design |
| R-13 | Conteúdo | Balanceamento das 5+1 habilidades desequilibrado (um personagem "dominante") | Alta | Médio | 6 | Eng |

#### Detalhamento, mitigação e contingência por risco

**R-01 — Auth/sessão Higgsfield (Exposição 9, PRIORITÁRIO).**
- *Gatilho de detecção:* qualquer chamada de conta (`balance`, `media_upload`, `list_workspaces`, `select_workspace`) retornando "Something went wrong" ou timeout.
- *Mitigação preventiva:* desacoplar 100% o gameplay da arte final. Toda a v0 jogável usa **placeholders desenhados em código** (ver seção do pipeline de arte e seção de render). O Higgsfield é tratado como dependência **assíncrona e opcional**, nunca bloqueante.
- *Contingência (runbook):* (1) reconectar o conector / refazer login da sessão; (2) testar uma chamada read-only barata (`balance`) para confirmar saúde antes de lotes de geração; (3) se persistir > 24h, assumir outage e prosseguir só com placeholders; (4) registrar timestamp e mensagem exata do erro no log de produção para correlacionar com janelas de outage; (5) gerar arte em **lotes pequenos** (1 personagem por vez) para não perder trabalho num corte de sessão.
- *Critério de aceite para destravar:* duas chamadas read-only consecutivas com sucesso + um upload de teste de 1 imagem confirmado.

**R-02 — Consistência de arte entre retratos (Exposição 9, PRIORITÁRIO).**
- *Mitigação:* **prompt-base único e versionado** (um "style bible" textual reutilizado para todos os 6), mesma seed/política de seed quando suportado, mesmo modelo (`nano_banana_pro` como padrão; `soul_2` como alternativa — escolher UM por lote e não misturar dentro do mesmo conjunto de personagens), mesma resolução de saída, mesma direção de luz (key light superior-esquerda, sombra dura à direita conforme direção visual C), mesma paleta travada (fundo escuro + magenta de ação, ver seção de direção visual). Corpo pixel construído sobre **uma única base de esqueleto/silhueta** (mesma grade de sprite), variando apenas paleta + 1 traço marcante por personagem.
- *Contingência:* se um retrato sair fora do conjunto, refazer só ele com o mesmo prompt-base + referência cruzada de um retrato já aprovado (image-to-image usando um aprovado como guia de estilo). Checklist de consistência (ver 15.4) antes de aceitar qualquer arte.

**R-03 — Fidelidade do rosto real (Exposição 6).**
- *Mitigação:* usar foto-referência de melhor qualidade por pessoa (frontal, bem iluminada) do diretório de selfies; manter "traço marcante" como âncora de reconhecimento (Einstein = cabelo branco + óculos; demais = 1 marca cada definida no roster). Aceitar que **pixel art não precisa de fotorrealismo** — a meta é reconhecibilidade, não retrato fiel.
- *Contingência:* se o modelo não capturar o rosto, priorizar reconhecibilidade por **silhueta + paleta + acessório-marca** em vez de feições; validar com a própria pessoa ("você se reconhece?") como teste de aceitação subjetivo.

**R-04 — Scope creep (Exposição 12, MAIOR RISCO DO PROJETO).**
- *Mitigação:* fatiar em marcos com Definition of Done explícito (ver 15.1.1 abaixo). Regra dura: **nada entra no escopo de um marco já iniciado** — vai para um backlog "depois". Vertical slice primeiro: 1 fase jogável de ponta a ponta com 1 personagem (placeholder) + MODO HUMANWARE antes de qualquer expansão de roster/fases.
- *Contingência:* se um marco estourar prazo, **cortar conteúdo, nunca qualidade do núcleo** (reduzir nº de fases/personagens no marco, não a fidelidade do game-feel).

**R-05 — Performance < 60 FPS (Exposição 4).**
- *Mitigação:* orçamento de frame de **16,6 ms** (60 FPS). Teto de objetos ativos simultâneos definido (ver 15.1.2). Partículas com pool fixo (sem `new` no loop). Render só do que está dentro da câmera (culling por tile/coluna visível). `ctx.imageSmoothingEnabled = false` para pixel art. Evitar sombra de canvas em loop quente (sombra dura desenhada como retângulo offset, não `shadowBlur`).
- *Contingência:* degradar graciosamente — reduzir contagem de partículas, simplificar efeito do MODO HUMANWARE (menos overlay), cap de inimigos por tela.

**R-06 — Tom/marca (Exposição 3).**
- *Mitigação:* zoeira só "grounded na marca" e interna; nada que ridicularize cliente real (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan viram fases-desafio respeitosas, não piada). Fundadores e Einstein retratados de forma carinhosa/heroica. Revisão de tom por Artur antes de publicar.
- *Contingência:* remover/editar qualquer linha de diálogo ou easter egg sinalizado.

**R-07 — Build single-file quebrado (Exposição 4).**
- *Mitigação:* o single-file é build **opcional** (ver seção de build/deploy). O alvo primário é o build modular Vite. Inline de assets com plugin dedicado; manter assets comprimidos; teste de fumaça automatizado abrindo o `.html` gerado em browser headless.
- *Contingência:* se o single-file passar de limite prático (alvo: < 8 MB), entregar versão single-file **só com placeholders** (sem arte pesada base64) para o grupo, e a versão completa só na URL Vercel.

**R-08 — Drift de dados (Exposição 4).**
- *Mitigação:* schemas TypeScript como fonte da verdade (ver interfaces em 15.5) + validação em runtime no carregamento (guard que rejeita dado malformado com erro claro no console). Versionar os arquivos de dados.
- *Contingência:* validador aponta o campo/arquivo exato; corrigir o dado, não relaxar o schema.

**R-09 — Imagem de pessoas reais (Exposição 4).**
- *Mitigação:* uso **interno** e com consentimento dos retratados (são os próprios fundadores/equipe/Artur). Registrar consentimento verbal/escrito. Não distribuir publicamente fora do grupo Gzero sem aval.
- *Contingência:* substituir retrato por versão estilizada não-identificável se alguém pedir.

**R-10 — Game-feel com constantes herdadas (Exposição 4).**
- *Mitigação:* começar exatamente com as constantes da base (ver bloco no CONTEXTO e seção de física) para ter algo bom de cara; ajustar por playtest. O tema "gravidade zero" é **narrativo/visual**, não significa baixar `GRAVITY` globalmente (a leveza é representada por plataformas flutuantes, portais e pelo MODO HUMANWARE que desacelera o mundo).
- *Contingência:* parametrizar física por arquivo de tuning (data-driven) para iterar sem recompilar lógica.

**R-11 — Deploy Vercel (Exposição 2, aceito).** Mitigação: usar config de SPA estática padrão do Vite; caminhos de asset relativos. Contingência: rollback para deploy anterior na Vercel.

**R-12 — Contraste do magenta (Exposição 2, aceito).** Mitigação: texto de HUD usa `#f7f3f6` (texto claro) sobre fundo escuro, não magenta puro para corpo de texto; magenta reservado para destaque/ação e elementos grandes. Conferir AA para HUD.

**R-13 — Balanceamento de habilidades (Exposição 6).** Tratado como questão em aberto Q-01 (ver 15.2) com plano de tuning data-driven.

#### 15.1.1. Marcos com Definition of Done (anti-scope-creep)

| Marco | Conteúdo mínimo | Definition of Done |
|-------|-----------------|--------------------|
| M0 — Setup | Vite + TS + Canvas booting; loop a 60 FPS; tela preta com FPS counter | App roda local e na Vercel; loop estável |
| M1 — Vertical Slice | 1 fase, 1 personagem (placeholder), física portada, moedas, 1 tipo de inimigo, goal, HUD básico | Jogável do title ao win; sem crash; 60 FPS |
| M2 — Núcleo HUMANWARE | Medidor de coração; MODO HUMANWARE (slow-mo + congelar "Tolo") | Encher e disparar o modo funciona ponta a ponta |
| M3 — Roster | 5 jogáveis + Renante (placeholders); desbloqueio via Lifecard; habilidades distintas | Cada habilidade funciona e é selecionável |
| M4 — Conteúdo | Fases-desafio dos 5 clientes; Esfinge (chefe-enigma); "O Tolo com a Ferramenta" | Jogo completável; frase de vitória aparece |
| M5 — Arte | Substituir placeholders por arte Higgsfield (quando R-01 destravar) | 6 personagens com retrato+pixel consistente |
| M6 — Polimento/Build | Áudio, partículas, single-file opcional, QA | Single-file < 8 MB abre e roda; deploy Vercel final |

Regra: **M5 (arte) não bloqueia M1–M4**. Por isso placeholders primeiro.

#### 15.1.2. Orçamento de performance (tetos travados)

| Recurso | Teto | Justificativa |
|---------|------|----------------|
| Frame budget | 16,6 ms | 60 FPS |
| Inimigos ativos por tela | 12 | margem de update+colisão por frame |
| Partículas vivas (pool) | 256 | pool pré-alocado, sem GC no loop |
| Projéteis simultâneos | 24 | pool fixo |
| Colunas de tile renderizadas | viewport (960/48 = 20) + 2 de folga = 22 | culling de câmera |
| Tamanho alvo do single-file | < 8 MB | abrir confortável no browser/compartilhar |
| Custo do overlay HUMANWARE | 1 draw de retângulo translúcido + tint, sem `shadowBlur` | manter o modo barato |

---

### 15.2. Questões em Aberto (Open Questions)

Cada questão tem uma **decisão provisória** adotada agora para não travar a produção, mais o critério de fechamento. Nenhuma fica como "TBD".

**Q-01 — Balanceamento das habilidades dos personagens.**
- *Pergunta:* como equilibrar Renan (pulo duplo/alto + revela portais), Dante (dash quebra-obstáculo), Julio (escudo de governança), Artur (criar plataforma/ferramenta temporária), Einstein (E=mc² desacelera o tempo) e Renante (amplificador), sem um dominante?
- *Decisão provisória (valores iniciais de tuning — data-driven, iteráveis):*

  | Personagem | Habilidade | Cooldown | Duração/Efeito | Custo no medidor |
  |-----------|-----------|----------|----------------|------------------|
  | Renan | Salto Visionário | — (passivo no pulo) | 2º pulo a `JUMP_VEL*0.85` = -13,1; revela portal/segredo num raio de 3 tiles por 90 frames | 0 (pulo) / 15% (revelar) |
  | Dante | Dash Criativo | 60 frames | dash 8,5 px/frame por 12 frames; quebra `brick`/`block` no caminho; i-frames durante o dash | 20% |
  | Julio | Escudo de Governança | 90 frames | bloqueia 1 dano (ou absorve por 60 frames) | 25% |
  | Artur | Builder | 75 frames | cria plataforma 1×1 tile sólida por 240 frames (4 s @60) à frente do herói | 25% |
  | Einstein | E=mc² | 120 frames | tempo do mundo a 0,4× por 120 frames (player normal) | 35% |
  | Renante | Amplificador | — | multiplica o efeito da habilidade ativa do herói em ~1,5× (alcance/duração); nunca age sozinho | passivo |

- *Critério de fechamento:* 3 sessões de playtest com o grupo Gzero; métrica = tempo-para-completar e taxa de morte por personagem dentro de ±15% entre si. Ajustar via arquivo de tuning até convergir.

**Q-02 — Nome final do jogo.**
- *Opções consideradas:* "Gravidade Zero — O Jogo" (atual, descritivo), "Super Gzero World" (nome do diretório; trocadilho Mario, interno), "GERZO: Consciência Unificada", "Gravidade Zero: Rumo à Consciência".
- *Decisão provisória (travada para builds até reavaliação):* título de produto = **"Gravidade Zero — O Jogo"**; codinome interno/repo = **"Super Gzero World"** (mantém o diretório `SuperGzeroWorld`). Subtítulo de campanha aceito: "Rumo à Consciência Unificada".
- *Critério de fechamento:* aval de Artur antes de M6; afeta apenas a tela de título e metadados, não o código.

**Q-03 — Estilo musical / direção de áudio.**
- *Pergunta:* qual trilha e SFX combinam com "espaço escuro + magenta + marca tech humana"?
- *Decisão provisória:* **synthwave/chiptune híbrido** — base chiptune (homenagem ao platformer clássico) com camada synthwave/neon coerente com o visual neon. SFX 8-bit-ish para moeda/pulo/stomp; um "stinger" grave + filtro de slow-mo (pitch-down/low-pass) ao entrar no MODO HUMANWARE; jingle de vitória sob a frase "Bora juntos.". Áudio é **M6**, opcional, com toggle de mute persistido.
- *Critério de fechamento:* escolher 1 faixa-tema antes de M6; manter loop curto (< 60 s) para caber no single-file.

**Q-04 — Renante como companheiro: presença visual.** *Decisão provisória:* Renante aparece como pequeno orbe/HUD-companheiro que pulsa em magenta quando amplifica; nunca tem hitbox nem colide. Fecha em M3.

**Q-05 — Persistência de progresso (desbloqueios/Lifecards).** *Decisão provisória:* `localStorage` com chave única `gzero.save.v1` (schema versionado, ver 15.5); sem backend. Reavaliar só se o grupo pedir ranking/online. Fecha em M3.

**Q-06 — Idioma da UI.** *Decisão provisória:* **pt-BR apenas** (público interno Gzero). i18n não entra no escopo. Strings centralizadas num único módulo para facilitar troca futura, mas sem framework de i18n.

---

### 15.3. Log de Decisões Travadas (ADR resumido)

Decisões já fechadas no CONTEXTO compartilhado e nesta seção. **Não contradizer.** Formato: ID, decisão, status.

| ID | Decisão travada | Status |
|----|-----------------|--------|
| D-01 | Plataforma-alvo: navegador, HTML5 Canvas 2D, resolução **960×528** | Travada |
| D-02 | Público **interno** Gzero; zoeira/in-jokes permitidos mas grounded na marca | Travada |
| D-03 | Stack: **Vite + TypeScript**, Canvas 2D, **sem framework pesado** (sem React no gameplay), módulos ESM | Travada |
| D-04 | Deploy primário na **Vercel**; **build single-file opcional** para o grupo | Travada |
| D-05 | Arquitetura **data-driven** (personagens/fases/assets como dados) | Travada |
| D-06 | Expandir além de 1 HTML único para **múltiplos arquivos** | Travada (aprovado pelo usuário) |
| D-07 | Direção visual **C (Híbrido)**: fundo escuro/espaço + **magenta como cor de ação**; pixel art **quadrado (radius 0)**, sombras duras com offset; fontes Outfit/Inter + mono UPPERCASE no HUD | Travada |
| D-08 | Reusar **constantes de física da base** como ponto de partida (TILE=48, GRAVITY=0.8, JUMP_VEL=-15.4, etc.) | Travada |
| D-09 | Roster: **5 jogáveis (Renan, Dante, Julio, Artur, Einstein) + Renante companheiro opcional** que só amplifica | Travada |
| D-10 | **Superpoder HUMANWARE** central e igual para todos: medidor enche → mundo desacelera, "Tolo" congela, ferramentas viram potência | Travada |
| D-11 | Desbloqueio de personagem via coletar a **Lifecard** correspondente | Travada |
| D-12 | Pipeline de arte **híbrido (abordagem 2)**: placeholders em código primeiro, arte Higgsfield depois; modelos `nano_banana_pro` (padrão) ou `soul_2` | Travada |
| D-13 | Inimigo-tema **"O Tolo com a Ferramenta"**; chefe-enigma **a Esfinge**; frase de vitória **"Você também acredita que podemos mudar o mundo? Bora juntos."** | Travada |
| D-14 | Clientes (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan) viram **fases-desafio** | Travada |
| D-15 | Mascote IA **RENANTE** (Renan+Dante); **Einstein** = pai do Renan (cabelo branco + óculos) | Travada |
| D-16 | Spec salvo em `docs/superpowers/specs/2026-06-08-gravidade-zero-game-design.md`; projeto em `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld` | Travada |
| D-17 | Nome de produto = "Gravidade Zero — O Jogo"; codinome repo = "Super Gzero World" (Q-02) | Provisória travada para builds |
| D-18 | Persistência via `localStorage` `gzero.save.v1`; sem backend (Q-05) | Provisória travada |
| D-19 | UI **pt-BR apenas**, sem i18n (Q-06) | Provisória travada |
| D-20 | Áudio = synthwave/chiptune híbrido, em M6, com mute (Q-03) | Provisória travada |

---

### 15.4. Checklist de Aceitação de Arte (consistência + fidelidade)

Aplicar a **cada** asset gerado no Higgsfield antes de integrar (mitiga R-02 e R-03). Marcar todos os itens; qualquer "não" = refazer.

- [ ] Mesma resolução de saída do lote.
- [ ] Mesma direção de luz (key superior-esquerda, sombra dura à direita).
- [ ] Paleta dentro dos tokens Gzero (fundo escuro + magenta de ação; sem cores fora da diretriz).
- [ ] Pixel art quadrado (sem cantos arredondados; radius 0).
- [ ] Silhueta cabe na grade de sprite do corpo base (mesma altura de "olho de linha"/baseline entre personagens).
- [ ] "Traço marcante" do personagem presente e legível em 48 px (ex.: cabelo branco + óculos do Einstein).
- [ ] A pessoa retratada se reconhece (teste subjetivo de fidelidade).
- [ ] Retrato key-art e corpo pixel parecem o **mesmo** personagem.
- [ ] Sem artefatos do gerador (texto espúrio, dedos extras, watermark).
- [ ] Comparação lado a lado com 1 personagem já aprovado: parecem do mesmo jogo.

---

### 15.5. Apêndice A — Interfaces TypeScript de referência

Interfaces canônicas referenciadas por esta seção (riscos R-08, Q-01, Q-05). As definições completas de gameplay vivem nas seções correspondentes; aqui ficam as que os riscos/decisões deste capítulo citam.

```typescript
// ---- Tuning de física (data-driven; mitiga R-10) — valores iniciais = base ----
export interface PhysicsTuning {
  TILE: 48;
  GRAVITY: number;        // 0.8
  MAX_FALL: number;       // 17
  WALK_ACCEL: number;     // 0.7
  RUN_ACCEL: number;      // 0.95
  WALK_MAX: number;       // 4.6
  RUN_MAX: number;        // 7.3
  GROUND_DECEL: number;   // 0.6
  AIR_DECEL: number;      // 0.18
  JUMP_VEL: number;       // -15.4
  COYOTE: number;         // 7  (frames)
  JUMP_BUFFER: number;    // 8  (frames)
  STOMP_BOUNCE: number;   // -11.5
}

// ---- Habilidade (Q-01) ----
export type AbilityId =
  | 'salto_visionario' | 'dash_criativo' | 'escudo_governanca'
  | 'builder' | 'e_mc2' | 'amplificador';

export interface AbilityConfig {
  id: AbilityId;
  ownerId: CharacterId;
  cooldownFrames: number;     // 0 = passivo
  durationFrames: number;     // 0 = instantâneo
  heartCostPct: number;       // 0..100 do medidor HUMANWARE
  params: Record<string, number>; // ex.: { dashSpeed: 8.5, dashFrames: 12 }
}

// ---- Personagem jogável (D-09, D-11) ----
export type CharacterId = 'renan' | 'dante' | 'julio' | 'artur' | 'einstein';

export interface PlayableCharacter {
  id: CharacterId;
  displayName: string;
  ability: AbilityId;
  signatureTrait: string;     // "cabelo branco + óculos" (Einstein), etc.
  unlockedByLifecard: string; // id da Lifecard que o desbloqueia
  art: {
    portraitKeyArt: string;   // caminho/atlas do retrato Higgsfield (ou placeholder)
    pixelBodyFrames: string;  // referência ao atlas do corpo pixel
    paletteRamp: string[];    // cores da rampa (tokens Gzero)
  };
}

// ---- Companheiro Renante (D-10, D-15; nunca age sozinho) ----
export interface Companion {
  id: 'renante';
  active: boolean;
  amplifyMultiplier: number;  // ~1.5 sobre alcance/duração da habilidade ativa
}

// ---- Save (Q-05 / D-18) ----
export interface SaveStateV1 {
  schemaVersion: 1;
  key: 'gzero.save.v1';
  unlockedCharacters: CharacterId[];
  collectedLifecards: string[];
  highestStageCleared: number;
  settings: { muted: boolean };
}
```

Exemplo de dado de habilidade (arquivo de tuning, valores de Q-01):

```json
{
  "dash_criativo": {
    "id": "dash_criativo", "ownerId": "dante",
    "cooldownFrames": 60, "durationFrames": 12, "heartCostPct": 20,
    "params": { "dashSpeed": 8.5, "dashFrames": 12, "breaksTiles": 1, "iFrames": 1 }
  },
  "e_mc2": {
    "id": "e_mc2", "ownerId": "einstein",
    "cooldownFrames": 120, "durationFrames": 120, "heartCostPct": 35,
    "params": { "worldTimeScale": 0.4 }
  }
}
```

Pseudo-código do validador de dados (mitiga R-08):

```
function loadAndValidate<T>(raw: unknown, schema: Validator<T>, source: string): T {
  const result = schema.check(raw)
  if (!result.ok)
    throw new Error(`[DATA] ${source}: campo "${result.field}" inválido (${result.reason})`)
  return result.value  // nunca relaxar o schema; corrigir o dado
}
```

---

### 15.6. Apêndice B — Glossário

| Termo | Definição |
|-------|-----------|
| **HUMANWARE** | Superpoder central e a doutrina da marca: "tecnologias nativas humanas; o caminho do coração". No jogo, é o medidor de coração/consciência que, cheio, dispara o MODO HUMANWARE. |
| **MODO HUMANWARE** | Estado temporário em que o mundo desacelera, inimigos "Tolo" congelam e ferramentas viram potência (ataque/pulo turbinados). |
| **Lifecard** | Carta coletável que desbloqueia um personagem jogável. Termo nativo da marca Gzero. |
| **LVL MAX / Super Skills / MISSÃO IA** | Termos de RPG já usados pela marca, reaproveitados como vocabulário do jogo. |
| **O Tolo com a Ferramenta** | Inimigo-tema. Da doutrina: "um tolo com uma ferramenta continua sendo um tolo". |
| **A Esfinge** | Chefe-enigma ("decifra-me ou te devoro"). |
| **Consciência Unificada** | Objetivo final: reunir as 3 Transformações (Existencial + Cultural + Digital) e devolver leveza ao mundo. |
| **As 3 Transformações** | Existencial, Cultural e Digital — coletáveis/macro-objetivos da campanha. |
| **Renante** | Mascote/IA (Renan + Dante); companheiro opcional que só **amplifica** a habilidade ativa do herói. |
| **Einstein** | Apelido do pai do Renan; mentor "gênio" (cabelo branco + óculos); habilidade E=mc² (desacelera o tempo). |
| **Gravidade (tema)** | A "gravidade" que esmaga o mundo = complexidade/cultura morta/automação sem alma. O herói entra em **Gravidade Zero**, o reino sem peso. |
| **Portais** | Elementos de nível do reino Gravidade Zero; o Salto Visionário do Renan pode revelá-los. |
| **Fase-desafio** | Fase temática baseada num cliente real (Vivo, Kion, Ecorodovias, Mubadala, JPMorgan). |
| **Build single-file** | Saída opcional: um único `.html` com assets embutidos (base64) para compartilhar no grupo. |
| **Placeholder (arte)** | Sprite/retrato desenhado em código, usado até a arte Higgsfield ficar pronta. |
| **Tile** | Célula de 48 px do mapa (chave `"c,r"` → ground/brick/platform/block na base). |
| **Coyote time / Jump buffer** | Tolerâncias de input do pulo (7 e 8 frames respectivamente na base). |
| **Stomp** | Pisar no inimigo para derrotá-lo (bounce de -11,5 na base). |
| **Star / STAR_TIME** | Power-up de invencibilidade temporária (480 frames na base). |
| **Frame budget** | Orçamento de tempo por quadro (16,6 ms para 60 FPS). |
| **Culling** | Renderizar só o que está dentro da câmera (colunas de tile visíveis + folga). |
| **Pool de objetos** | Pré-alocação de partículas/projéteis para evitar alocação no loop (GC). |
| **ADR** | Architecture Decision Record — registro de decisão (ver 15.3). |
| **GERZO** | Wordmark/logo principal (`LogoInteira_[Vectorized].svg`). |

---

### 15.7. Apêndice C — Referências e Caminhos

Todos os caminhos são absolutos (ambiente Windows).

**Código-fonte e jogo-base**
- Jogo-base a portar (HTML único, vanilla JS + Canvas 2D): `C:\Users\artur\Downloads\remixed-6e07a45d.html`
- Diretório do projeto: `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld`
- Spec de design (este documento): `C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld\docs\superpowers\specs\2026-06-08-gravidade-zero-game-design.md`

**Marca, design e lore**
- Dossiê do site/lore: `docs/gzero-site-dossier.md` (relativo ao projeto) — fonte da lore de `gravidadezero.space`
- Tokens de design (CSS): `C:\Users\artur\Área de Trabalho\Gzero\Diretriz_Design_Gzero\tokens.css`
- Logos SVG: `C:\Users\artur\Área de Trabalho\Gzero\Logo_Gzero_vetores\`
  - `LogoInteira_[Vectorized].svg` — wordmark "GERZO"
  - `G0_favcon_Vector.svg` — favicon/símbolo branco para fundo escuro
  - letras individuais G / Z / E / R / O

**Pipeline de arte (Higgsfield)**
- Fotos de Artur (avatar): `C:\Users\artur\Área de Trabalho\Artur-Fotos-Avatar` (100 selfies)
- Fotos da equipe: `C:\Users\artur\Área de Trabalho\Gzero\Higgsfield\Selfies` (17 selfies)
- Modelos: `nano_banana_pro` (image-to-image, foto→pixel, **padrão**) e `soul_2` (alternativa)

**Tokens de cor (referência rápida da direção visual C — ver seção de direção visual)**
- Fundos: `#09090b`, `#121216`, `#050505`
- Ação/magenta: pink operacional `#ff0055`, magenta-classic `#f43db3`, magenta-site `#e802cf`
- Neons de destaque: azul `#0099ff`, lima `#cdf140`, violeta `#7112ff` / `#612af1`
- Risco/burgundy: `#990033`
- Texto claro: `#f7f3f6`
- Tipografia: Outfit (display), Inter (corpo), mono UPPERCASE (labels/HUD)

**Deploy**
- Plataforma: Vercel (já usada pela Gzero); build estático Vite. Build single-file opcional como artefato adicional.

**Referências cruzadas internas**
- Física e constantes da base: ver seção de física/mecânicas.
- Render, câmera e performance: ver seção de motor/render.
- Roster e habilidades: ver seção de personagens.
- HUMANWARE e medidor: ver seção do superpoder central.
- Fases, clientes e chefe: ver seções de level design e inimigos.
- Pipeline de arte e placeholders: ver seção de arte/assets.

---

## Apendice — Questoes em Aberto (consolidado)
- O nome do projeto Vercel e o dominio final (custom domain Gzero vs. dominio .vercel.app) nao foram definidos no contexto; assumi Git integration padrao com previews por branch.
- Definir se o save (localStorage) precisa de versionamento/migracao de schema entre releases conforme as fases evoluem; deixei SaveStore simples por origem.
- Confirmar a lista final e nomes exatos das fases-desafio de clientes (arquivos em data/levels/) na secao 5 para alinhar os ids usados aqui.
- O formato de tilemap usa um único char por tile (grade densa de 168 colunas). Para fases muito grandes isso gera linhas longas; uma alternativa seria run-length encoding (ex.: '#x20'), mas optei por legibilidade/editabilidade. Confirmar se 168 colunas em texto plano é aceitavel para o fluxo de edicao manual.
- Assumi que a Esfinge (chefe-enigma) e um EnemyType especial cujo comportamento de enigma vive em logica de fase de chefe, nao em dados de Level — a mecanica detalhada do enigma deve ser especificada na secao de design de niveis/inimigos (seção 5+).
- O medidor Humanware foi colocado 100% no Config global (igual para todos, conforme contexto), com Character contribuindo so via ability.meterCost. Se houver desejo de variar a taxa de enchimento por personagem, seria preciso mover gainPer* para PhysicsModifiers/Character.
- Interpolacao de render (alpha) no port inicial: comecar com alpha=1 (snap, mais simples) e so ligar lerp de prevX/prevY se houver queixa de suavidade em telas 120/144 Hz? Recomendo sim, mas confirma a prioridade.
- Numero de vidas por fase e regra de respawn (checkpoint vs reinicio total) nao estavam no contexto de fisica — definir junto com a secao de progressao/fases (secao 5).
- Layout exato dos botoes virtuais de toque (posicao/tamanho) depende da secao de UI/HUD (secao 3/7) — aqui so defini quais acoes existem.
- Tom exato dos efeitos sonoros (stingers/low-pass) precisa de validacao com sound design real — os nomes de chave e descricoes sao decisoes de design, mas a producao de audio fica para a fase de implementacao.
- Se outros arquetipos de inimigo alem do 'Tolo com a Ferramenta' existirem (a definir na secao de inimigos), confirmar a regra de que so o Tolo congela e os demais apenas desaceleram (0.35).
- A tecla padrao de ativacao foi fixada em H; se a secao de controles ja reservar H para outra acao, remapear (o sistema e data-driven e suporta isso sem mudar a logica).
- Valores exatos de heartFill por inimigo dependem da calibracao final do medidor Humanware (secao 5) — assumi uma escala 0..1 do total; confirmar a capacidade do medidor para fechar os numeros.
- O texto dos enigmas da Esfinge sao exemplos canonicos; a lista final pode crescer/rotacionar conforme tom de zoeira aprovado pelo grupo Gzero (in-jokes).
- Na fase 3 do chefe final assumi 'resist' (chefe nao desacelera) para preservar a tensao do climax; se a secao 5 preferir que o Humanware desacelere TUDO sempre, esta e a unica regra a revisar.
- O numero de fases internas por pilar foi fixado em 3 (15 fases de pilar no total). Se a secao 1/escopo definir outro numero, ajustar a contagem total de 21 fases.
- O modificador 'assistMode' foi introduzido como decisao desta secao; confirmar se a secao de acessibilidade/opcoes (se existir) ja o cobre para evitar duplicacao.
- A Lifecard de Renante foi alocada em M-JPM (JPMorgan, 'cofre/seguranca') por encaixe tematico; validar contra a secao de progressao/roster se houver outra fonte prevista para o companheiro.
- targetScore por fase: defini que cada fase carrega seu proprio alvo na config (secao 8); os valores concretos por fase pertencem aquela secao e nao foram fixados aqui.
- Recompensa de skin por rank S e puramente cosmetica (troca de paleta); se quiserem efeito de gameplay, isso impactaria o balanceamento e precisaria de revisao cruzada com a secao 4.
- Persistencia esta em localStorage para o MVP/single-file; se quiserem placar compartilhado entre o grupo da Gzero (leaderboard), seria preciso backend (ex.: Supabase) — fora do escopo desta secao.
- Confirmar se o medidor Humanware no HUD deve ser barra vertical (assumido) ou um icone de coracao/arco — afeta o layout do canto inferior-esquerdo (10.4.4).
- Validar a malha de autoria de pixel (16x16/16x21 @3x sobre TILE=48) com o pipeline do Higgsfield: se a arte vier em outra densidade, ajustar os tamanhos de sprite-cell em 10.3.2.
- Definir se OPCOES > CONTROLES tera presets de gamepad por fabricante (Xbox/PlayStation/Nintendo) para os glyphs corretos, ou apenas glyphs genericos (10.7.3).
- Quantidade exata de creditos disponiveis no Higgsfield ainda nao pode ser confirmada porque balance/show_plans_and_credits estao falhando (auth/outage); validar antes do lote de 24+ geracoes.
- Confirmar se nano_banana_pro com strength 0.62 preserva semelhanca suficiente do rosto real dos 5 humanos, ou se sera necessario reduzir para ~0.55 (decisao a calibrar na primeira rodada real).
- Decidir se a derivacao das 8 poses a partir de 1 key-art (pos-processamento) entrega qualidade aceitavel, ou se algum personagem exigira rodadas extras pose-a-pose no Higgsfield (impacto em creditos).
- Confirmar se o key-art de Renante (mascote IA, sem foto) deve mesmo usar soul_2 puramente text-to-image ou partir de um conceito-base fornecido como referencia.
- Quem vai compor/produzir as faixas chiptune finais da tabela 12.4 (Artur internamente via BeepBox, ou contratar)? Ate la o modo procedural cobre tudo.
- Confirmar se o build single-file deve embutir tambem a musica em OGG curta (peso maior, ~+1.5 MB) ou manter musica procedural como decidido aqui para ficar leve.
- Validar suporte de OGG no Safari/iOS alvo do grupo Gzero — se algum membro usa iPhone/Safari, o fallback MP3 ja cobre, mas vale confirmar os navegadores reais do time.
- Maquina de referencia de performance (qual notebook/CPU define o gate de 60fps) precisa ser fixada com o time para o numero >=58fps medio ser comparavel entre maquinas; sugeri notebook mediano + Chrome mas convem cravar um aparelho concreto da Gzero.
- Confirmar se o build single-file (E12) deve abrir via file:// puro (sem servidor) — isso pode bloquear o carregamento de fontes externas Outfit/Inter; talvez seja preciso embutir as fontes em base64 no single-file para o teste e o uso real passarem.
- Os valores numericos das habilidades (jumpVelMul 1.15, dashSpeed 11, duracoes 240/180 ticks, ganhos do medidor 4/8/15) foram decididos aqui para destravar os testes; precisam de validacao cruzada com a secao 5 (roster/habilidades) e secao 6 (Humanware) para nao divergirem.
- Q-01 Balanceamento das habilidades dos 5+1 personagens (decisao provisoria com cooldowns/custos definida; fechar apos 3 playtests com metrica de tempo-para-completar e taxa de morte dentro de +-15%).
- Q-02 Nome final do jogo (provisorio: produto = 'Gravidade Zero — O Jogo', repo = 'Super Gzero World'; aval de Artur antes de M6).
- Q-03 Estilo musical/audio (provisorio: synthwave/chiptune hibrido + stinger de slow-mo no MODO HUMANWARE; escolher 1 faixa-tema antes de M6).
- Q-04 Presenca visual do companheiro Renante (provisorio: orbe/HUD pulsante magenta, sem hitbox; fecha em M3).
- Q-05 Persistencia de progresso (provisorio: localStorage 'gzero.save.v1', sem backend; reavaliar so se pedirem ranking/online).
- Q-06 Idioma da UI (provisorio: pt-BR apenas, sem i18n; strings centralizadas para troca futura).