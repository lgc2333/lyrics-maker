export type ShortcutAction =
  | 'history.undo'
  | 'history.redo'
  | 'project.save'
  | 'transport.togglePlay'
  | 'transport.prevBeat'
  | 'transport.nextBeat'
  | 'transport.prevBar'
  | 'transport.nextBar'
  | 'timing.tapBpm'
  | 'metronome.toggle'
  | 'lyrics.mark'
  | 'lyrics.markNoAdvance'
  | 'lyrics.nextLine'
  | 'lyrics.playLineInterval'
  | 'lyrics.playWordInterval'
  | 'lyrics.deleteLine'
  | 'lyrics.clearSelection'
  | 'lyrics.editWholeLine'

export function createShortcutRegistry() {
  const bindings = new Map<string, ShortcutAction>()

  function register(keys: string, action: ShortcutAction) {
    if (bindings.has(keys)) return { ok: false as const, reason: 'conflict' as const }
    bindings.set(keys, action)
    return { ok: true as const }
  }

  function unregister(keystroke: string): void {
    bindings.delete(keystroke)
  }

  function dispatch(keys: string, handler: (action: ShortcutAction) => void) {
    if (!keys) return
    const action = bindings.get(keys)
    if (action) handler(action)
  }

  return { register, unregister, dispatch }
}
