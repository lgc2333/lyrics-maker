import { onMounted, onUnmounted } from 'vue'

import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import { createShortcutRegistry } from '../platform/shortcuts/registry'
import type { ShortcutAction } from '../platform/shortcuts/registry'

export function useEditorShortcuts(options: {
  onAction: (action: ShortcutAction) => void
}) {
  const registry = createShortcutRegistry()

  registry.register('Ctrl+Z', 'history.undo')
  registry.register('Ctrl+Y', 'history.redo')
  registry.register('Ctrl+S', 'project.save')

  function onKeydown(event: KeyboardEvent) {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (event.target as HTMLElement)?.tagName ?? '',
    )
    if (inInput) return

    const key = normalizeKeystroke(event)

    registry.dispatch(key, (action) => {
      if (action === 'project.save') {
        event.preventDefault()
      }
      options.onAction(action)
    })
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
