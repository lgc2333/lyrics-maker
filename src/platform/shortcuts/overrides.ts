import type { ShortcutAction } from './registry'

export type ShortcutOverrides = Partial<Record<ShortcutAction, string | null>>

export function mergeBindings(
  defaults: Record<ShortcutAction, string | null>,
  overrides: ShortcutOverrides,
): Record<ShortcutAction, string | null> {
  const result = { ...defaults }
  for (const action of Object.keys(defaults) as ShortcutAction[]) {
    if (Object.hasOwn(overrides, action)) {
      result[action] = overrides[action] ?? null
    }
  }
  return result
}

export function bindingsByKeystroke(
  effective: Record<ShortcutAction, string | null>,
): Map<string, ShortcutAction> {
  const index = new Map<string, ShortcutAction>()
  for (const [action, keystroke] of Object.entries(effective) as Array<
    [ShortcutAction, string | null]
  >) {
    if (keystroke === null) continue
    index.set(keystroke, action)
  }
  return index
}
