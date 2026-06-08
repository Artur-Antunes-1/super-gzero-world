// tests/e2e/world1.spec.ts
// E2E M1 — fluxo completo: tela SELECT -> escolher 1o personagem (Renan) ->
// andar para a direita ate vencer a fase (estado 'win').
//
// Contexto M1 (CONTRATO):
//  - O jogo agora INICIA em 'select' (antes era 'playing' no M0).
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

test('World 1 Zona 1 (M1): select -> escolher personagem -> andar ate vencer', async ({
  page,
}) => {
  await page.goto('/')

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
