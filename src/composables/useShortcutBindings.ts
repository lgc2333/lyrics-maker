import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { DEFAULT_SHORTCUT_BINDINGS } from '../platform/shortcuts/defaults'
import {
  bindingsByKeystroke as buildBindingsByKeystroke,
  mergeBindings,
} from '../platform/shortcuts/overrides'
import type { ShortcutOverrides } from '../platform/shortcuts/overrides'
import type { ShortcutAction } from '../platform/shortcuts/registry'

type StatusParams = Record<string, string | number>

export interface UseShortcutBindingsOptions {
  initialOverrides: Ref<ShortcutOverrides>
  onChange: (next: ShortcutOverrides) => void
  onStatus: (key: string, params?: StatusParams) => void
}

export type AssignResult =
  | { ok: true; reassignedFrom: ShortcutAction | null }
  | { ok: false; reason: 'sameBinding' }

export interface UseShortcutBindingsReturn {
  effectiveBindings: ComputedRef<Record<ShortcutAction, string | null>>
  bindingsByKeystroke: ComputedRef<Map<string, ShortcutAction>>
  assignBinding: (action: ShortcutAction, keystroke: string) => AssignResult
  clearBinding: (action: ShortcutAction) => void
  resetAction: (action: ShortcutAction) => void
  resetAll: () => void
}

export function useShortcutBindings(
  options: UseShortcutBindingsOptions,
): UseShortcutBindingsReturn {
  const effectiveBindings = computed(() =>
    mergeBindings(DEFAULT_SHORTCUT_BINDINGS, options.initialOverrides.value),
  )
  const bindingsByKeystroke = computed(() =>
    buildBindingsByKeystroke(effectiveBindings.value),
  )

  function currentOverrides(): ShortcutOverrides {
    return options.initialOverrides.value
  }

  function assignBinding(action: ShortcutAction, keystroke: string): AssignResult {
    const existingAction = bindingsByKeystroke.value.get(keystroke) ?? null
    if (existingAction === action) {
      return { ok: false, reason: 'sameBinding' }
    }
    const next: ShortcutOverrides = { ...currentOverrides() }
    if (existingAction && existingAction !== action) {
      next[existingAction] = null
      next[action] = keystroke
      options.onChange(next)
      options.onStatus('status.shortcuts.reassigned', {
        keystroke,
        fromAction: existingAction,
        toAction: action,
      })
      return { ok: true, reassignedFrom: existingAction }
    }
    next[action] = keystroke
    options.onChange(next)
    options.onStatus('status.shortcuts.assigned', {
      action,
      keystroke,
    })
    return { ok: true, reassignedFrom: null }
  }

  function clearBinding(action: ShortcutAction): void {
    const next: ShortcutOverrides = { ...currentOverrides(), [action]: null }
    options.onChange(next)
    options.onStatus('status.shortcuts.cleared', { action })
  }

  function resetAction(action: ShortcutAction): void {
    const current = currentOverrides()
    if (!Object.hasOwn(current, action)) {
      return
    }
    const next: ShortcutOverrides = { ...current }
    delete next[action]

    // Check if restoring the default keystroke would collide with another action.
    const defaultKey = DEFAULT_SHORTCUT_BINDINGS[action]
    if (defaultKey !== null) {
      const merged = mergeBindings(DEFAULT_SHORTCUT_BINDINGS, next)
      for (const [otherAction, otherKey] of Object.entries(merged) as Array<
        [ShortcutAction, string | null]
      >) {
        if (otherAction === action) continue
        if (otherKey === defaultKey) {
          next[otherAction] = null
        }
      }
    }

    options.onChange(next)
    options.onStatus('status.shortcuts.reset', { action })
  }

  function resetAll(): void {
    if (Object.keys(currentOverrides()).length === 0) {
      return
    }
    options.onChange({})
    options.onStatus('status.shortcuts.resetAll')
  }

  return {
    effectiveBindings,
    bindingsByKeystroke,
    assignBinding,
    clearBinding,
    resetAction,
    resetAll,
  }
}
