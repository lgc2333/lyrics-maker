export type ShortcutAction =
  | 'history.undo'
  | 'history.redo'
  | 'project.save'
  | 'transport.togglePlay'
  | 'timing.tapBpm'
  | 'metronome.toggle'

export function createShortcutRegistry() {
  const bindings = new Map<string, ShortcutAction>()

  function register(keys: string, action: ShortcutAction) {
    if (bindings.has(keys)) return { ok: false as const, reason: 'conflict' as const }
    bindings.set(keys, action)
    return { ok: true as const }
  }

  function dispatch(keys: string, handler: (action: ShortcutAction) => void) {
    const action = bindings.get(keys)
    if (action) handler(action)
  }

  return { register, dispatch }
}
