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
