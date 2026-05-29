import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

import type { ShortcutAction } from '../platform/shortcuts/registry'
import { useShortcutCapture } from './useShortcutCapture'

interface Harness {
  app: ReturnType<typeof createApp>
  capture: ReturnType<typeof useShortcutCapture>
  onCaptured: ReturnType<typeof vi.fn>
  onCancelled: ReturnType<typeof vi.fn>
}

function withCapture(): Harness {
  const onCaptured = vi.fn()
  const onCancelled = vi.fn()
  let captured!: ReturnType<typeof useShortcutCapture>

  const TestHost = defineComponent({
    setup() {
      captured = useShortcutCapture({ onCaptured, onCancelled })
      return () => h('div')
    },
  })
  const app = createApp(TestHost)
  app.mount(document.createElement('div'))
  return { app, capture: captured, onCaptured, onCancelled }
}

let activeApp: ReturnType<typeof createApp> | null = null

function arm(): Harness {
  const h = withCapture()
  activeApp = h.app
  return h
}

afterEach(() => {
  activeApp?.unmount()
  activeApp = null
})

function dispatchKey(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

describe('useShortcutCapture', () => {
  it('does nothing while not capturing', () => {
    const { onCaptured, onCancelled } = arm()
    dispatchKey({ key: 'a' })
    expect(onCaptured).not.toHaveBeenCalled()
    expect(onCancelled).not.toHaveBeenCalled()
  })

  it('captures the next plain keystroke and clears state', () => {
    const { capture, onCaptured } = arm()
    capture.start('lyrics.mark2' as ShortcutAction)
    expect(capture.capturingAction.value).toBe('lyrics.mark2')

    dispatchKey({ key: 'q' })

    expect(onCaptured).toHaveBeenCalledWith('lyrics.mark2', 'Q')
    expect(capture.capturingAction.value).toBeNull()
  })

  it('keeps waiting for a non-modifier key when bare modifier is pressed', () => {
    const { capture, onCaptured } = arm()
    capture.start('lyrics.mark2' as ShortcutAction)

    dispatchKey({ key: 'Shift', shiftKey: true })

    expect(onCaptured).not.toHaveBeenCalled()
    expect(capture.capturingAction.value).toBe('lyrics.mark2')

    dispatchKey({ key: 'Q' })
    expect(onCaptured).toHaveBeenCalledWith('lyrics.mark2', 'Q')
  })

  it('cancels on Escape and clears state', () => {
    const { capture, onCancelled, onCaptured } = arm()
    capture.start('lyrics.mark2' as ShortcutAction)

    dispatchKey({ key: 'Escape' })

    expect(onCancelled).toHaveBeenCalledWith('lyrics.mark2')
    expect(onCaptured).not.toHaveBeenCalled()
    expect(capture.capturingAction.value).toBeNull()
  })

  it('ignores IME composition keydowns and stays armed', () => {
    const { capture, onCaptured } = arm()
    capture.start('lyrics.mark2' as ShortcutAction)

    dispatchKey({ key: 'a', isComposing: true })

    expect(onCaptured).not.toHaveBeenCalled()
    expect(capture.capturingAction.value).toBe('lyrics.mark2')
  })

  it('start while already capturing cancels the previous action first', () => {
    const { capture, onCancelled } = arm()
    capture.start('lyrics.mark' as ShortcutAction)
    capture.start('lyrics.mark2' as ShortcutAction)

    expect(onCancelled).toHaveBeenCalledWith('lyrics.mark')
    expect(capture.capturingAction.value).toBe('lyrics.mark2')
  })

  it('cancel() is a no-op when not capturing', () => {
    const { capture, onCancelled } = arm()
    capture.cancel()
    expect(onCancelled).not.toHaveBeenCalled()
    expect(capture.capturingAction.value).toBeNull()
  })

  it('prevents the captured key from triggering other listeners', () => {
    const { capture } = arm()
    capture.start('lyrics.mark2' as ShortcutAction)
    const event = dispatchKey({ key: 'q' })
    expect(event.defaultPrevented).toBe(true)
  })

  it('removes the listener on unmount', () => {
    const h = arm()
    h.capture.start('lyrics.mark2' as ShortcutAction)
    h.app.unmount()
    activeApp = null

    dispatchKey({ key: 'q' })
    expect(h.onCaptured).not.toHaveBeenCalled()
  })
})
