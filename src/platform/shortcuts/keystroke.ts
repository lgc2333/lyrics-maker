export function normalizeKeystroke(event: KeyboardEvent): string | null {
  if (event.isComposing) return null
  const parts: string[] = []
  if (event.metaKey) parts.push('Meta')
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.key === ' ') {
    parts.push('Space')
  } else if (event.key.length === 1) {
    parts.push(event.key.toUpperCase())
  } else {
    parts.push(event.key)
  }
  return parts.join('+')
}
