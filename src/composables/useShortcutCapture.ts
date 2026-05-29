import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

import { isCapturableKeystroke } from '../platform/shortcuts/capture'
import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import type { ShortcutAction } from '../platform/shortcuts/registry'

export interface UseShortcutCaptureOptions {
  onCaptured: (action: ShortcutAction, keystroke: string) => void
  onCancelled: (action: ShortcutAction) => void
}

export interface UseShortcutCaptureReturn {
  capturingAction: Ref<ShortcutAction | null>
  start: (action: ShortcutAction) => void
  cancel: () => void
}

export function useShortcutCapture(
  options: UseShortcutCaptureOptions,
): UseShortcutCaptureReturn {
  const capturingAction = ref<ShortcutAction | null>(null)

  function onKeydown(event: KeyboardEvent): void {
    const action = capturingAction.value
    if (!action) return

    event.preventDefault()
    event.stopPropagation()

    if (event.isComposing) return

    if (event.key === 'Escape') {
      capturingAction.value = null
      options.onCancelled(action)
      return
    }

    if (!isCapturableKeystroke(event)) {
      // Bare modifier; keep waiting.
      return
    }

    const keystroke = normalizeKeystroke(event)
    if (!keystroke) return

    capturingAction.value = null
    options.onCaptured(action, keystroke)
  }

  window.addEventListener('keydown', onKeydown, { capture: true })

  function start(action: ShortcutAction): void {
    const prev = capturingAction.value
    if (prev && prev !== action) {
      capturingAction.value = null
      options.onCancelled(prev)
    }
    capturingAction.value = action
  }

  function cancel(): void {
    const action = capturingAction.value
    if (!action) return
    capturingAction.value = null
    options.onCancelled(action)
  }

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown, { capture: true } as
      | AddEventListenerOptions
      | boolean)
  })

  return { capturingAction, start, cancel }
}
