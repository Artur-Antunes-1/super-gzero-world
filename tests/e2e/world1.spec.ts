// tests/e2e/world1.spec.ts
// E2E E1 — fluxo completo: TITLE -> Enter -> SELECT -> confirmar personagem ->
// andar para a direita ate vencer a fase (estado 'win').
//
// Contexto E1 (CONTRATO):
//  - O jogo INICIA em 'title' apos precarregar os assets reais (public/assets);
//    Enter (acao 'confirm') leva ao 'select'.
//  - main.ts faz await loadAssets(ASSET_MANIFEST) antes de createGame/loop.start().
//  - O timeout do teste e estendido para 60s para acomodar o preload de assets.
//  - Selecao: cursor comeca em SELECT_START_INDEX (Artur, contrato E2). Enter
//    (acao 'confirm') ou Space/ArrowUp (acao 'jump') confirmam -> 'playing'.
//    Qualquer personagem vence este nivel andando para a direita.
//  - world1-zona1 continua 40x11 com chao continuo (sem buracos) e ganhou
//    2-3 tolos ('F'). O caminho permanece VENCIVEL andando a direita: os tolos
//    sao lentos (ENEMY_SPEED 1.25) e stompaveis; o teste pula periodicamente
//    (ArrowUp) para stompar/desviar, evitando dano que reinicie a fase.
//  - Gatilho do Humanware = tecla KeyH quando o medidor enche (NAO exercitado
//    aqui; documentado para referencia). O timer da fase pausa no Modo, mas
//    fora do Modo decai (~250 'segundos' de jogo ~ varios segundos reais), e o
//    caminho ate o goal leva poucos segundos andando — sobra margem enorme.
//  - window.__GAME_STATE() (exposto em src/main.ts) reporta o estado atual.
import { test, expect, type Page } from '@playwright/test'

// M2a: preload de assets (loadAssets) atrasa o boot; 60s cobre o carregamento + jogabilidade.
test.setTimeout(60000)

// Helper compartilhado: boot completo ate 'playing'.
// Fluxo E1/E2: goto -> canvas visivel -> title -> Enter -> select -> Enter -> playing.
// Gotcha: confirm precisa de tecla REAL (page.keyboard.press), nao dispatchEvent.
async function bootToPlaying(page: Page, url: string): Promise<void> {
  await page.goto(url)

  const canvas = page.locator('canvas#game')
  await canvas.waitFor({ state: 'visible' })
  // input e anexado a window; o click e uma estabilizacao defensiva de foco
  await canvas.click()

  // Probe rico __GAME() exposto em src/main.ts (preload pode demorar em CI).
  await page.waitForFunction(
    () => typeof (window as any).__GAME === 'function',
    { timeout: 30000 },
  )
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'title',
    { timeout: 10000 },
  )
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'select',
    { timeout: 5000 },
  )
  // Confirma o personagem do cursor inicial (SELECT_START_INDEX = Artur).
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'playing',
    { timeout: 5000 },
  )
}

test('World 1 Zona 1 (E1): title -> select -> escolher personagem -> andar ate vencer', async ({
  page,
}) => {
  // C3b: a fase plana legacy agora vive no registry como 'zona1'
  // (o default '/' passou a ser a w1-1 nova, com buracos/blocos '?').
  await page.goto('/?level=zona1')

  // Canvas visivel e loop ativo
  const canvas = page.locator('canvas#game')
  await canvas.waitFor({ state: 'visible' })
  // input e anexado a window; o click e uma estabilizacao defensiva de foco
  await canvas.click()

  // Garante que o probe de estado esta exposto e o loop rodando
  await page.waitForFunction(
    () => typeof (window as any).__GAME_STATE === 'function',
    { timeout: 5000 },
  )

  // 1) E1: deve comecar no TITLE.
  await page.waitForFunction(
    () =>
      typeof (window as any).__GAME_STATE === 'function' &&
      (window as any).__GAME_STATE() === 'title',
    { timeout: 5000 },
  )

  // 2) Enter sai do title para a tela de selecao.
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'select',
    { timeout: 5000 },
  )

  // 3) Confirmar o personagem do cursor inicial (SELECT_START_INDEX = Artur).
  //    'confirm' = Enter; jump (Space) tambem confirmaria.
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'playing',
    { timeout: 5000 },
  )

  // 4) Andar para a direita ate vencer. Pulos periodicos para stompar/desviar
  //    dos tolos. Mantemos ArrowRight pressionado o tempo todo; injetamos
  //    pulsos de ArrowUp (jump) em intervalos curtos.
  await page.keyboard.down('ArrowRight')

  // Loop de pulos defensivos enquanto esperamos o estado 'win'.
  // Cada iteracao da um pulo curto e checa o estado; encerra ao vencer
  // (ou ao estourar o orcamento total de tempo).
  const deadline = Date.now() + 30000 // orcamento generoso (~30s)
  let won = false
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => (window as any).__GAME_STATE())
    if (st === 'win') {
      won = true
      break
    }
    // Se por azar tomamos dano e a fase reiniciou o personagem (mas seguimos
    // em 'playing'), continuar segurando ArrowRight + pulando resolve.
    // Se cair em 'over' (nao esperado neste nivel plano e vencivel), aborta cedo
    // para falhar com mensagem clara em vez de esperar o deadline.
    expect(st, 'estado nao deve virar over neste nivel vencivel').not.toBe('over')

    await page.keyboard.down('ArrowUp')
    await page.waitForTimeout(120)
    await page.keyboard.up('ArrowUp')
    await page.waitForTimeout(300)
  }

  await page.keyboard.up('ArrowRight')

  // 5) Assercao final
  const finalState = await page.evaluate(() => (window as any).__GAME_STATE())
  expect(won, 'esperava alcancar o estado win dentro do orcamento de tempo').toBe(
    true,
  )
  expect(finalState).toBe('win')
})

// C3b: teste leve da fase default (w1-1) — '/' sem query string.
// Entra com Enter e anda ~1s para a direita: o player deve avancar em X
// e o estado deve continuar 'playing' (sem morrer no comeco da fase).
test('W1-1 (default): entrar com Enter e andar ~1s avanca X mantendo playing', async ({
  page,
}) => {
  await page.goto('/')

  const canvas = page.locator('canvas#game')
  await canvas.waitFor({ state: 'visible' })
  await canvas.click()

  // Probe rico __GAME() exposto em src/main.ts.
  await page.waitForFunction(
    () => typeof (window as any).__GAME === 'function',
    { timeout: 5000 },
  )
  // E1: boot no TITLE; Enter leva ao select.
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'title',
    { timeout: 5000 },
  )
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'select',
    { timeout: 5000 },
  )

  // Confirma o personagem do cursor inicial (SELECT_START_INDEX, contrato E2).
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'playing',
    { timeout: 5000 },
  )

  const x0 = (await page.evaluate(() => (window as any).__GAME().playerX)) as number
  expect(x0).not.toBeNull()

  // Segura ArrowRight por ~1s.
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(1000)
  await page.keyboard.up('ArrowRight')

  const g = await page.evaluate(() => (window as any).__GAME())
  expect(g.state).toBe('playing')
  expect(g.playerX).toBeGreaterThan(x0)
})

// ---------------------------------------------------------------------------
// PAUSE (E1): Escape alterna playing <-> paused; em paused o mundo congela
// (playerX identico em duas leituras com 300ms de intervalo, mesmo segurando
// ArrowRight o tempo todo).
// ---------------------------------------------------------------------------
test('PAUSE (zona1): Escape pausa com playerX congelado; Escape retoma', async ({
  page,
}) => {
  await bootToPlaying(page, '/?level=zona1')

  // Garante movimento real antes do pause (segura ArrowRight e mantem
  // segurando DURANTE o pause — congelar com input ativo e o teste forte).
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)

  // Escape -> paused (tecla REAL; edge de 'pause' no input).
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'paused',
    { timeout: 5000 },
  )

  // playerX congelado: duas leituras iguais com 300ms de intervalo.
  const x1 = (await page.evaluate(() => (window as any).__GAME().playerX)) as number
  await page.waitForTimeout(300)
  const x2 = (await page.evaluate(() => (window as any).__GAME().playerX)) as number
  expect(x2, 'playerX deve ficar congelado durante o pause').toBe(x1)
  expect(
    await page.evaluate(() => (window as any).__GAME_STATE()),
    'estado deve continuar paused durante a espera',
  ).toBe('paused')

  // Escape de novo -> playing.
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'playing',
    { timeout: 5000 },
  )

  await page.keyboard.up('ArrowRight')
})

// ---------------------------------------------------------------------------
// DANO (w1-1): andar para a direita SEM pular ate encostar no Tolo do chao
// (patrulha cols 24-30). Contato tira 1 coracao (hearts < 3) mas com
// knockback + i-frames o jogo segue 'playing' e lives permanece 3 (nao morre).
// ---------------------------------------------------------------------------
test('DANO (w1-1): encostar no Tolo tira coracao mantendo playing e lives=3', async ({
  page,
}) => {
  await bootToPlaying(page, '/')

  // Sanity: Artur comeca com 3 coracoes e 3 vidas.
  const g0 = await page.evaluate(() => (window as any).__GAME())
  expect(g0.hearts).toBe(3)
  expect(g0.lives).toBe(3)

  // Anda reto (SEM pular) ate o Tolo: spawn col 2 -> patrulha 24-30 (~2s).
  // Poll generoso (10s) ate o primeiro hit registrar hearts < 3.
  await page.keyboard.down('ArrowRight')
  await page.waitForFunction(
    () => {
      const g = (window as any).__GAME()
      return g.hearts !== null && g.hearts < 3
    },
    { timeout: 10000 },
  )
  await page.keyboard.up('ArrowRight')

  // Dano nao-letal: knockback/i-frames, sem perder vida nem sair de playing.
  const g = await page.evaluate(() => (window as any).__GAME())
  expect(g.state, 'dano de contato nao deve encerrar a partida').toBe('playing')
  expect(g.lives, 'primeiro hit tira coracao, nao vida').toBe(3)
  expect(g.hearts).toBeLessThan(3)
})

// ---------------------------------------------------------------------------
// HUMANWARE (hw-test): gate da mecanica-assinatura. A fase de teste tem 130
// moedas no chao (130x8 = 1040 >= 1000): correr reto enche o medidor; KeyH
// ativa o Modo (hwActive=true). Decisao registrada: na campanha o Modo pleno
// entra no curriculo em W1-2/W1-3 (spec §8.2); o gate automatizado vive aqui.
// ---------------------------------------------------------------------------
test('HUMANWARE (hw-test): coletar moedas enche o medidor e H ativa o Modo', async ({
  page,
}) => {
  await bootToPlaying(page, '/?level=hw-test')

  // Sanity: medidor zerado no inicio.
  const g0 = await page.evaluate(() => (window as any).__GAME())
  expect(g0.hwMeter).toBe(0)
  expect(g0.hwActive).toBe(false)

  // Corre (Shift) para a direita coletando as 130 moedas do corredor.
  // 130 cols * 48px a ~7.3px/frame ~= 15s; poll generoso de 30s p/ CI.
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('ArrowRight')
  await page.waitForFunction(
    () => (window as any).__GAME().hwMeter >= 1000,
    { timeout: 30000 },
  )
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('ShiftLeft')

  // KeyH ativa o Modo Humanware (tecla REAL; edge no input).
  await page.keyboard.press('KeyH')
  await page.waitForFunction(
    () => (window as any).__GAME().hwActive === true,
    { timeout: 5000 },
  )
  const g = await page.evaluate(() => (window as any).__GAME())
  expect(g.hwActive).toBe(true)
  expect(g.state).toBe('playing')
})

// ---------------------------------------------------------------------------
// RESET POS-WIN (zona1): vencer andando reto (inimigos da zona1 patrulham
// plataformas altas, fora da rota do chao), esperar o delay anti-skip de
// 45 frames (~750ms), Enter -> select e Enter de novo -> playing.
// ---------------------------------------------------------------------------
test('RESET pos-win (zona1): win -> Enter -> select -> Enter -> playing', async ({
  page,
}) => {
  await bootToPlaying(page, '/?level=zona1')

  // Vence andando reto: chao continuo, goal na col 36.
  await page.keyboard.down('ArrowRight')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'win',
    { timeout: 30000 },
  )
  await page.keyboard.up('ArrowRight')

  // Delay anti-skip do resultado: Enter so conta apos 45 frames (~750ms @60fps).
  // Espera ~1s e entao pressiona Enter em loop ate sair do win (CI-friendly:
  // se um press cair cedo demais ele e ignorado pelo jogo e tentamos de novo).
  await page.waitForTimeout(1000)
  const deadline = Date.now() + 10000
  let st = await page.evaluate(() => (window as any).__GAME_STATE())
  while (st === 'win' && Date.now() < deadline) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
    st = await page.evaluate(() => (window as any).__GAME_STATE())
  }
  expect(st, 'Enter apos o delay deve voltar para a tela de select').toBe('select')

  // E da pra jogar de novo: Enter confirma o personagem -> playing.
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'playing',
    { timeout: 5000 },
  )
  expect(await page.evaluate(() => (window as any).__GAME_STATE())).toBe('playing')
})
