// tests/e2e/world1.spec.ts
// Smoke E2E: walk right from spawn → reach goal → state becomes 'win'.
// The flat level (no pits) ensures walking right always reaches the goal (~7s).
import { test, expect } from '@playwright/test'

test('World 1 Zona 1: walking right reaches the goal (win state)', async ({ page }) => {
  await page.goto('/')

  // Focus the canvas so keyboard events are captured
  const canvas = page.locator('canvas#game')
  await canvas.waitFor({ state: 'visible' })
  await canvas.click()

  // Ensure the game loop is running and state is exposed
  await page.waitForFunction(() => typeof (window as any).__GAME_STATE === 'function', {
    timeout: 5000,
  })

  // Hold ArrowRight to walk toward the goal
  await page.keyboard.down('ArrowRight')

  // Wait until the state machine reports 'win' (timeout: 20s; ~7s expected)
  await page.waitForFunction(
    () =>
      typeof (window as any).__GAME_STATE === 'function' &&
      (window as any).__GAME_STATE() === 'win',
    { timeout: 20000 },
  )

  await page.keyboard.up('ArrowRight')

  // Final assertion
  const state = await page.evaluate(() => (window as any).__GAME_STATE())
  expect(state).toBe('win')
})
