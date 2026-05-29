export type ShortcutAction =
  | 'history.undo'
  | 'history.redo'
  | 'project.save'
  | 'transport.togglePlay'
  | 'transport.prevBeat'
  | 'transport.nextBeat'
  | 'transport.prevBar'
  | 'transport.nextBar'
  | 'transport.increasePlaybackRate'
  | 'transport.decreasePlaybackRate'
  | 'transport.resetPlaybackRate'
  | 'timing.tapBpm'
  | 'metronome.toggle'
  | 'lyrics.mark'
  | 'lyrics.mark2'
  | 'lyrics.markNoAdvance'
  | 'lyrics.nextLine'
  | 'lyrics.playLineInterval'
  | 'lyrics.playWordInterval'
  | 'lyrics.deleteLine'
  | 'lyrics.clearSelection'
  | 'lyrics.editWholeLine'
  | 'lyrics.pasteClipboard'
  | 'lyrics.insertLineAbove'
  | 'lyrics.insertLineBelow'

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

  function rebuild(next: Map<string, ShortcutAction>): void {
    bindings.clear()
    for (const [keystroke, action] of next) {
      if (bindings.has(keystroke)) {
        console.warn(`[shortcuts] Duplicate keystroke during rebuild: ${keystroke}`)
        continue
      }
      bindings.set(keystroke, action)
    }
  }

  function dispatch(keys: string, handler: (action: ShortcutAction) => void) {
    if (!keys) return
    const action = bindings.get(keys)
    if (action) handler(action)
  }

  return { register, unregister, rebuild, dispatch }
}
