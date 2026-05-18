import { onMounted, onUnmounted } from 'vue'

import { normalizeKeystroke } from '../platform/shortcuts/keystroke'
import { createShortcutRegistry } from '../platform/shortcuts/registry'
import type { ShortcutAction } from '../platform/shortcuts/registry'

export function useEditorShortcuts(options: {
  onAction: (action: ShortcutAction) => void | Promise<void>
  onError?: (error: unknown, action: ShortcutAction) => void
}) {
  const registry = createShortcutRegistry()

  registry.register('Ctrl+Z', 'history.undo')
  registry.register('Ctrl+Y', 'history.redo')
  registry.register('Ctrl+S', 'project.save')
  registry.register('Space', 'transport.togglePlay')
  registry.register('B', 'timing.tapBpm')
  registry.register('M', 'metronome.toggle')
  registry.register('ArrowLeft', 'transport.prevBeat')
  registry.register('ArrowRight', 'transport.nextBeat')
  registry.register('Shift+ArrowLeft', 'transport.prevBar')
  registry.register('Shift+ArrowRight', 'transport.nextBar')

  function reportActionError(error: unknown, action: ShortcutAction): void {
    if (options.onError) {
      options.onError(error, action)
      return
    }
    console.error('Unhandled shortcut action error:', error)
  }

  function onKeydown(event: KeyboardEvent) {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (event.target as HTMLElement)?.tagName ?? '',
    )
    if (inInput) return

    const key = normalizeKeystroke(event)

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
