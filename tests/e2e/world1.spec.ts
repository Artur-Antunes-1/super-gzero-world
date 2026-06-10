// tests/e2e/world1.spec.ts
// E2E M2a — fluxo completo: tela SELECT -> escolher 1o personagem (Renan) ->
// andar para a direita ate vencer a fase (estado 'win').
//
// Contexto M2a (CONTRATO):
//  - O jogo INICIA em 'select' apos precarregar os assets reais (public/assets).
//  - main.ts faz await loadAssets(ASSET_MANIFEST) antes de createGame/loop.start().
//  - O timeout do teste e estendido para 60s para acomodar o preload de assets.
//  - Selecao: cursor comeca em index 0 (Renan). Enter (acao 'confirm') ou
//    Space/ArrowUp (acao 'jump') confirmam o personagem -> estado 'playing'.
//  - world1-zona1 continua 40x11 com chao continuo (sem buracos) e ganhou
//    2-3 tolos ('F'). O caminho permanece VENCIVEL andando a direita: os tolos
//    sao lentos (ENEMY_SPEED 1.25) e stompaveis; o teste pula periodicamente
//    (ArrowUp) para stompar/desviar, evitando dano que reinicie a fase.
//  - Gatilho do Humanware = tecla KeyH quando o medidor enche (NAO exercitado
//    aqui; documentado para referencia). O timer da fase pausa no Modo, mas
//    fora do Modo decai (~250 'segundos' de jogo ~ varios segundos reais), e o
//    caminho ate o goal leva poucos segundos andando — sobra margem enorme.
//  - window.__GAME_STATE() (exposto em src/main.ts) reporta o estado atual.
import { test, expect } from '@playwright/test'

// M2a: preload de assets (loadAssets) atrasa o boot; 60s cobre o carregamento + jogabilidade.
test.setTimeout(60000)

test('World 1 Zona 1 (M1): select -> escolher personagem -> andar ate vencer', async ({
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

  // 1) Deve comecar na tela de selecao
  await page.waitForFunction(
    () =>
      typeof (window as any).__GAME_STATE === 'function' &&
      (window as any).__GAME_STATE() === 'select',
    { timeout: 5000 },
  )

  // 2) Escolher o 1o personagem (Renan, index 0). 'confirm' = Enter.
  //    Pressionamos Enter; se por algum motivo nao confirmar, jump (Space)
  //    tambem confirma (updateSelect aceita pressed('jump') || pressed('confirm')).
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => (window as any).__GAME_STATE() === 'playing',
    { timeout: 5000 },
  )

  // 3) Andar para a direita ate vencer. Pulos periodicos para stompar/desviar
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

  // 4) Assercao final
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
  await page.waitForFunction(
    () => (window as any).__GAME().state === 'select',
    { timeout: 5000 },
  )

  // Confirma o 1o personagem (Renan).
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
