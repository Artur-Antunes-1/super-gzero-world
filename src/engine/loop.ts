// src/engine/loop.ts
// Fixed-timestep game loop (M0 Task 5).
// Per Errata E1: step receives dt in FRAMES (1 per fixed step), not in seconds.
// The accumulator uses real wall-clock time in ms:
//   every FIXED_DT seconds elapsed -> 1 fixed step -> step(1)
import { FIXED_DT, MAX_SUBSTEPS } from './constants'

export interface Loop {
  start(): void
  stop(): void
}

// FIXED_DT is in seconds; convert to ms for wall-clock accumulator comparisons
// because requestAnimationFrame / performance.now() work in milliseconds.
const FIXED_MS = FIXED_DT * 1000

// Epsilon for floating-point comparison: a step fires when the accumulator is
// within 0.1 µs of FIXED_MS, preventing rounding errors from swallowing steps
// (e.g. 3 * FIXED_MS arrives as 50.000...01 but after 2 steps the remainder
// may be 16.666...6 which is just barely below FIXED_MS = 16.666...7).
const EPSILON = 1e-4 // 0.1 µs in ms units

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

  // Processes a single frame given the current instant (in ms).
  // Exposed as a property for deterministic testing — in runtime it is called
  // from the requestAnimationFrame callback.
  function tick(tMs: number): void {
    if (!started) {
      // First tick: prime the time base without accumulating any prior delta.
      // Render with alpha=0 as the initial frame (per plan "priming" note).
      lastTime = tMs
      started = true
      render(0)
      return
    }

    let frameTime = tMs - lastTime
    lastTime = tMs
    if (frameTime < 0) frameTime = 0

    accumulator += frameTime

    // Anti-death-spiral clamp: at most MAX_SUBSTEPS fixed steps per frame.
    // Discard any backlog that exceeds the cap so the loop never spirals.
    let substeps = 0
    while (accumulator >= FIXED_MS - EPSILON && substeps < MAX_SUBSTEPS) {
      // Errata E1: pass 1 (one frame), not FIXED_DT (seconds).
      // Physics constants are per-frame; dt=1 means "advance one frame".
      step(1)
      accumulator = Math.max(0, accumulator - FIXED_MS)
      substeps++
    }

    // Clamp hit (substeps === MAX_SUBSTEPS): discard the over-cap backlog so a
    // long freeze/tab-switch cannot spiral. Only reached when the while-loop
    // exited on the substep cap.
    if (accumulator >= FIXED_MS - EPSILON) {
      accumulator = 0
    }

    // alpha is the interpolation fraction for the renderer: [0, 1)
    const alpha = accumulator / FIXED_MS
    render(alpha)
  }

  // Internal rAF callback — uses the injected now() to get current time,
  // then delegates to tick. This keeps the clock source unified between
  // runtime (performance.now default) and tests (injected now).
  function frame(_rafTs: number): void {
    if (!running) return
    tick(now())
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

  // Cast: tick is an internal testing hook not listed on the public Loop
  // interface but exposed so tests can call it without touching rAF.
  return { start, stop, tick } as Loop & { tick(tMs: number): void }
}
