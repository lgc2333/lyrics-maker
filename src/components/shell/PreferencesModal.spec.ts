import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PreferencesModal from './PreferencesModal.vue'

describe('preferencesModal', () => {
  it('opens on general category with only theme mode controls', () => {
    const wrapper = mount(PreferencesModal, {
      props: { themeMode: 'system', effectiveTheme: 'dark' },
    })

    expect(wrapper.get('[data-testid="preferences-tab-general"]').text()).toContain(
      '常规',
    )
    expect(wrapper.find('[data-testid="preferences-panel-general"]').exists()).toBe(
      true,
    )
    expect(wrapper.get('[data-testid="preferences-theme-system"]').classes()).toContain(
      'btn-active',
    )
    expect(wrapper.text()).toContain('跟随系统')
    expect(wrapper.text()).not.toContain('音乐音量')
    expect(wrapper.text()).not.toContain('节拍器')
    expect(wrapper.find('[data-testid="preferences-import-text"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="preferences-export-text"]').exists()).toBe(false)
  })

  it('switches categories and shows placeholders for shortcuts and backup restore', async () => {
    const wrapper = mount(PreferencesModal, {
      props: { themeMode: 'light', effectiveTheme: 'light' },
    })

    await wrapper.get('[data-testid="preferences-tab-shortcuts"]').trigger('click')
    expect(wrapper.get('[data-testid="preferences-panel-shortcuts"]').text()).toContain(
      '快捷键设置将在后续版本中实现',
    )

    await wrapper.get('[data-testid="preferences-tab-backup"]').trigger('click')
    expect(wrapper.find('[data-testid="preferences-panel-backup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preferences-backup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preferences-restore"]').exists()).toBe(true)
  })

  it('emits close only from close button and emits theme and backup actions', async () => {
    const wrapper = mount(PreferencesModal, {
      props: { themeMode: 'light', effectiveTheme: 'light' },
    })

    await wrapper.get('[data-testid="preferences-modal"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-testid="preferences-theme-dark"]').trigger('click')
    expect(wrapper.emitted('updateThemeMode')?.[0]).toEqual(['dark'])

    await wrapper.get('[data-testid="preferences-tab-backup"]').trigger('click')
    await wrapper.get('[data-testid="preferences-backup"]').trigger('click')
    await wrapper.get('[data-testid="preferences-restore"]').trigger('click')
    expect(wrapper.emitted('backupSettings')).toHaveLength(1)
    expect(wrapper.emitted('restoreSettings')).toHaveLength(1)

    await wrapper.get('[data-testid="preferences-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
