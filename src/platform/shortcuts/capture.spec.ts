import { describe, expect, it } from 'vitest'

import { isCapturableKeystroke } from './capture'

function ev(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init)
}

describe('isCapturableKeystroke', () => {
  it('rejects bare Shift', () => {
    expect(isCapturableKeystroke(ev({ key: 'Shift', shiftKey: true }))).toBe(false)
  })

  it('rejects bare Control', () => {
    expect(isCapturableKeystroke(ev({ key: 'Control', ctrlKey: true }))).toBe(false)
  })

  it('rejects bare Alt', () => {
    expect(isCapturableKeystroke(ev({ key: 'Alt', altKey: true }))).toBe(false)
  })

  it('rejects bare Meta', () => {
    expect(isCapturableKeystroke(ev({ key: 'Meta', metaKey: true }))).toBe(false)
  })

  it('rejects Escape (reserved for cancelling capture)', () => {
    expect(isCapturableKeystroke(ev({ key: 'Escape' }))).toBe(false)
  })

  it('rejects IME composing key events', () => {
    expect(isCapturableKeystroke(ev({ key: 'a', isComposing: true }))).toBe(false)
  })

  it('accepts a plain letter', () => {
    expect(isCapturableKeystroke(ev({ key: 'a' }))).toBe(true)
  })

  it('accepts a letter with shift modifier', () => {
    expect(isCapturableKeystroke(ev({ key: 'A', shiftKey: true }))).toBe(true)
  })

  it('accepts named keys like Enter, Tab, ArrowLeft', () => {
    expect(isCapturableKeystroke(ev({ key: 'Enter' }))).toBe(true)
    expect(isCapturableKeystroke(ev({ key: 'Tab' }))).toBe(true)
    expect(isCapturableKeystroke(ev({ key: 'ArrowLeft' }))).toBe(true)
  })

  it('accepts Space', () => {
    expect(isCapturableKeystroke(ev({ key: ' ' }))).toBe(true)
  })
})
