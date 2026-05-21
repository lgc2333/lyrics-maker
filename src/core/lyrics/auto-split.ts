export function autoSplitText(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ['']
  if (!trimmed.includes(' ')) return [trimmed]
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0)
  return tokens.length === 0 ? [''] : tokens
}
