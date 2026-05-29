import { onMounted, onUnmounted, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import { createShortcutRegistry } from '../platform/shortcuts/registry'
import type { ShortcutAction } from '../platform/shortcuts/registry'

const TEXT_INPUT_TYPES = new Set([
  '',
  'date',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
])

export interface UseEditorShortcutsOptions {
  bindings: ComputedRef<Map<string, ShortcutAction>>
  paused: ComputedRef<boolean>
  onAction: (action: ShortcutAction) => void | Promise<void>
  onError?: (error: unknown, action: ShortcutAction) => void
}

export function useEditorShortcuts(options: UseEditorShortcutsOptions): void {
  const registry = createShortcutRegistry()

  watch(
    options.bindings,
    (next) => {
      registry.rebuild(next)
    },
    { immediate: true },
  )

  function reportActionError(error: unknown, action: ShortcutAction): void {
    if (options.onError) {
      options.onError(error, action)
      return
    }
    console.error('Unhandled shortcut action error:', error)
  }

  function onKeydown(event: KeyboardEvent) {
    if (options.paused.value) return
    if (shouldIgnoreShortcutTarget(event.target)) return

    const key = normalizeKeystroke(event)
    if (!key) return

    registry.dispatch(key, (action) => {
      event.preventDefault()
      void Promise.resolve()
        .then(() => options.onAction(action))
        .catch((error) => reportActionError(error, action))
    })
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}

function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }

  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type)
  }

  return false
}
