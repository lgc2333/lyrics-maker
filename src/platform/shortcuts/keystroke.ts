export function normalizeKeystroke(event: KeyboardEvent) {
  // Space key needs special handling: event.key is ' ', but normalized form is 'Space'
  let key: string
  if (event.key === ' ') {
    key = 'Space'
  } else {
    key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  }
  const ctrl = event.ctrlKey ? 'Ctrl+' : ''
  const shift = event.shiftKey ? 'Shift+' : ''
  const alt = event.altKey ? 'Alt+' : ''
  return `${ctrl}${shift}${alt}${key}`
}
