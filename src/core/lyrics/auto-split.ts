export function autoSplitText(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ['']
  if (!trimmed.includes(' ') && !trimmed.includes('\t')) return [trimmed]
  const tokens: string[] = []
  for (const match of trimmed.matchAll(/(\S+)(\s*)/g)) {
    tokens.push(match[1] + match[2])
  }
  if (tokens.length === 0) return ['']
  // Trim trailing whitespace from the last token
  tokens[tokens.length - 1] = tokens[tokens.length - 1].trimEnd()
  return tokens
}
