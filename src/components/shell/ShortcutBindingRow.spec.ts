import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ShortcutAction } from '../../platform/shortcuts/registry'
import ShortcutBindingRow from './ShortcutBindingRow.vue'

function mountRow(
  overrides: Partial<{
    action: ShortcutAction
    effectiveKeystroke: string | null
    isOverridden: boolean
    capturing: boolean
  }> = {},
) {
  return mount(ShortcutBindingRow, {
    props: {
      action: 'lyrics.mark' as ShortcutAction,
      effectiveKeystroke: 'D',
      isOverridden: false,
      capturing: false,
      ...overrides,
    },
  })
}

describe('shortcutBindingRow', () => {
  it('renders the action label and current keystroke', () => {
    const wrapper = mountRow()
    expect(wrapper.get('[data-testid="shortcut-row-action"]').text()).toContain(
      '歌词打轴',
    )
    expect(wrapper.get('[data-testid="shortcut-row-keystroke"]').text()).toBe('D')
  })

  it('shows the unbound label when keystroke is null', () => {
    const wrapper = mountRow({ effectiveKeystroke: null })
    expect(wrapper.get('[data-testid="shortcut-row-keystroke"]').text()).toBe('未绑定')
  })

  it('disables the reset button when not overridden', () => {
    const wrapper = mountRow({ isOverridden: false })
    const reset = wrapper.get('[data-testid="shortcut-row-reset"]')
      .element as HTMLButtonElement
    expect(reset.disabled).toBe(true)
  })

  it('enables the reset button when overridden', () => {
    const wrapper = mountRow({ isOverridden: true })
    const reset = wrapper.get('[data-testid="shortcut-row-reset"]')
      .element as HTMLButtonElement
    expect(reset.disabled).toBe(false)
  })

  it('emits startCapture when assign button is clicked in idle state', async () => {
    const wrapper = mountRow()
    await wrapper.get('[data-testid="shortcut-row-assign"]').trigger('click')
    expect(wrapper.emitted('startCapture')).toEqual([['lyrics.mark']])
  })

  it('shows capturing hint and Cancel/Clear buttons when capturing', () => {
    const wrapper = mountRow({ capturing: true })
    expect(wrapper.get('[data-testid="shortcut-row-keystroke"]').text()).toContain(
      '按下键位',
    )
    expect(wrapper.find('[data-testid="shortcut-row-cancel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="shortcut-row-clear"]').exists()).toBe(true)
  })

  it('emits cancelCapture when cancel button is clicked', async () => {
    const wrapper = mountRow({ capturing: true })
    await wrapper.get('[data-testid="shortcut-row-cancel"]').trigger('click')
    expect(wrapper.emitted('cancelCapture')).toEqual([[]])
  })

  it('emits clear when clear button is clicked', async () => {
    const wrapper = mountRow({ capturing: true })
    await wrapper.get('[data-testid="shortcut-row-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([['lyrics.mark']])
  })

  it('emits reset when reset button is clicked', async () => {
    const wrapper = mountRow({ isOverridden: true })
    await wrapper.get('[data-testid="shortcut-row-reset"]').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([['lyrics.mark']])
  })
})
