const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

export function isCapturableKeystroke(event: KeyboardEvent): boolean {
  if (event.isComposing) return false
  if (MODIFIER_KEYS.has(event.key)) return false
  if (event.key === 'Escape') return false
  return true
}
