# Prompt para colar em uma sessão nova

Copie o bloco abaixo e cole como primeira mensagem em um chat novo (Claude Code aberto na pasta do projeto).

---

```
Você vai CONTINUAR o desenvolvimento de um jogo já em andamento. Todo o estado e contexto estão versionados no próprio repositório — comece lendo o handoff antes de qualquer coisa. Responda em pt-BR.

PROJETO: "Gravidade Zero — O Jogo" — um platformer 2D (Vite + TypeScript + Canvas 2D, data-driven, TDD) de marca da empresa Gzero (Gravidade Zero), feito a partir de um artefato público do Claude.
DIRETÓRIO LOCAL: C:\Users\artur\Área de Trabalho\Gzero\SuperGzeroWorld  (Windows; use bash via Git Bash; caminhos com acento/espaço precisam de aspas).
REPO PRIVADO: https://github.com/Artur-Antunes-1/super-gzero-world  (branch master, conta Artur-Antunes-1).

PRIMEIRO PASSO OBRIGATÓRIO — leia, nesta ordem, antes de propor qualquer coisa:
1) docs/HANDOFF.md  (o mapa completo: estado, arquitetura, decisões travadas, método de trabalho, setup do Higgsfield, índice de docs, próximos passos, gotchas — aponta para todo o resto).
2) docs/superpowers/specs/2026-06-08-gravidade-zero-game-design.md  — a seção "§0 Cânone" é a FONTE DA VERDADE de números e decisões; NÃO a contrarie.
3) Os planos em docs/superpowers/plans/ (M0, M1, M2a) têm uma Errata no topo que prevalece sobre as tarefas.
(Há também a memória do agente em C:\Users\artur\.claude\projects\C--Users-artur--rea-de-Trabalho-Gzero-SuperGzeroWorld\memory\ — gzero-game-project.md e artur-gzero.md.)

ESTADO ATUAL (tudo concluído, testado e pushed):
- M0 = fatia vertical jogável (motor, física, fase, 1 personagem, goal/win).
- M1 = 5 personagens jogáveis + tela de seleção + superpoder Humanware + inimigos "Tolo" + dano/corações/vidas/over.
- M2a = motor de animação procedural + arte REAL animada do Artur + background parallax de ilhas flutuantes + partículas.
- 281 testes unit + E2E (select→andar→win) verdes; tsc limpo; build OK.
PRÓXIMO MARCO = M2b: gerar a arte-base dos outros 4 personagens (Renan, Dante, Julio, Einstein) com o pipeline do Higgsfield (foto + atlas original como referência de estilo) e plugar + FX por habilidade. Depois M2c (inimigos/elementos) e M2d (backgrounds por mundo + cinematográfico via vídeo).

MÉTODO (siga este padrão — detalhado no HANDOFF §5; ele funcionou muito bem):
brainstorming (NÃO implemente antes de eu aprovar o design) → spec em docs/superpowers/specs/ → plano via Workflow com CONTRATO de interfaces FIXADAS + DONO ÚNICO por arquivo + agente-crítico adversarial + Errata no topo → execução com 1 subagente por tarefa (gate por tarefa = `npm run test`) + revisão em 2 estágios (compliance de spec → qualidade) → rodar o jogo + screenshot (Playwright) → commit + push.
LIÇÃO CRÍTICA: para tarefas que COMPARTILHAM arquivos, fixe TODAS as interfaces internas no contrato e dê dono único a cada arquivo (o 1º plano do M1 falhou com 19 conflitos de ownership; o v2 corrigiu).

FERRAMENTAS:
- Higgsfield (MCP) conectado: workspace Team "Gzero" (owner), ~3,7k créditos. Imagem = modelo nano_banana_pro; vídeo = seedance_2_0. Fluxo: media_upload → curl PUT do arquivo → media_confirm → generate_image (assíncrono) → show_generations → baixar rawUrl. Pipeline de arte (abordagem D) no HANDOFF §6.
- Rodar: `npm run dev` (abre na tela de seleção). Testar: `npm run test` / `npm run test:e2e` / `npx tsc -p tsconfig.json --noEmit` / `npm run build`. Estado exposto p/ teste: window.__GAME_STATE().

GOTCHAS (HANDOFF §9): dt é em FRAMES (não segundos); no Playwright o "confirm"/edge precisa de tecla REAL (page.keyboard.press), keydown sintético só serve p/ segurar movimento; no Workflow, EMBUTA os dados no script (não passe via args string — vira undefined); favicon 404 é benigno; os PNGs em public/assets são grandes (downscale pendente — há um chip de tarefa).

PENDÊNCIA: há uma tarefa de background sugerida para fazer downscale dos 3 PNGs grandes em public/assets (~15 MB) pro tamanho de sprite.

AGORA: leia docs/HANDOFF.md (e o §0 do spec mestre), me confirme em 3–4 linhas que você entendeu o estado atual e o método, e pergunte se sigo direto pro M2b ou se quero outra coisa. NÃO comece a implementar antes da minha confirmação.
```

---

_Dica: se quiser também o diálogo verbatim desta sessão, ele está em `docs/SESSION-TRANSCRIPT.md` (e o log bruto no `.jsonl` da sessão)._
