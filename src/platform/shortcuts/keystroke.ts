export function normalizeKeystroke(event: KeyboardEvent) {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  const ctrl = event.ctrlKey ? 'Ctrl+' : ''
  const shift = event.shiftKey ? 'Shift+' : ''
  const alt = event.altKey ? 'Alt+' : ''
  return `${ctrl}${shift}${alt}${key}`
}
