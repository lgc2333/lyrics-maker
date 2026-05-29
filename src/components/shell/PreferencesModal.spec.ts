import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { DEFAULT_SHORTCUT_BINDINGS } from '../../platform/shortcuts/defaults'
import type { ShortcutAction } from '../../platform/shortcuts/registry'
import PreferencesModal from './PreferencesModal.vue'

const baseShortcutProps = {
  shortcutBindings: DEFAULT_SHORTCUT_BINDINGS,
  shortcutOverriddenActions: new Set<ShortcutAction>(),
  capturingAction: null as ShortcutAction | null,
}

describe('preferencesModal', () => {
  it('opens on general category with only theme mode controls', () => {
    const wrapper = mount(PreferencesModal, {
      props: {
        localeMode: 'system',
        themeMode: 'system',
        effectiveTheme: 'dark',
        ...baseShortcutProps,
      },
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
    expect(wrapper.find('[data-testid="preferences-locale-select"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.get<HTMLSelectElement>('[data-testid="preferences-locale-select"]')
        .element.value,
    ).toBe('system')
    expect(wrapper.text()).toContain('系统默认')
    expect(wrapper.text()).toContain('简体中文')
    expect(wrapper.text()).toContain('跟随系统')
    expect(wrapper.text()).not.toContain('音乐音量')
    expect(wrapper.text()).not.toContain('节拍器')
    expect(wrapper.find('[data-testid="preferences-import-text"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="preferences-export-text"]').exists()).toBe(false)
  })

  it('switches categories and renders shortcut list plus backup panel', async () => {
    const wrapper = mount(PreferencesModal, {
      props: {
        localeMode: 'zh-CN',
        themeMode: 'light',
        effectiveTheme: 'light',
        ...baseShortcutProps,
      },
    })

    await wrapper.get('[data-testid="preferences-tab-shortcuts"]').trigger('click')
    expect(wrapper.find('[data-testid="preferences-shortcuts-list"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('[data-testid="preferences-shortcuts-reset-all"]').exists(),
    ).toBe(true)
    // Confirm at least one known action row renders
    expect(wrapper.text()).toContain('歌词打轴')

    await wrapper.get('[data-testid="preferences-tab-backup"]').trigger('click')
    expect(wrapper.find('[data-testid="preferences-panel-backup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preferences-backup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preferences-restore"]').exists()).toBe(true)
  })

  it('emits close only from close button and emits theme and backup actions', async () => {
    const wrapper = mount(PreferencesModal, {
      props: {
        localeMode: 'system',
        themeMode: 'light',
        effectiveTheme: 'light',
        ...baseShortcutProps,
      },
    })

    await wrapper.get('[data-testid="preferences-modal"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-testid="preferences-theme-dark"]').trigger('click')
    expect(wrapper.emitted('updateThemeMode')?.[0]).toEqual(['dark'])

    await wrapper.get('[data-testid="preferences-locale-select"]').setValue('zh-CN')
    expect(wrapper.emitted('updateLocaleMode')?.[0]).toEqual(['zh-CN'])

    await wrapper.get('[data-testid="preferences-tab-backup"]').trigger('click')
    await wrapper.get('[data-testid="preferences-backup"]').trigger('click')
    await wrapper.get('[data-testid="preferences-restore"]').trigger('click')
    expect(wrapper.emitted('backupSettings')).toHaveLength(1)
    expect(wrapper.emitted('restoreSettings')).toHaveLength(1)

    await wrapper.get('[data-testid="preferences-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits resetAllShortcuts when the reset-all button is clicked', async () => {
    const wrapper = mount(PreferencesModal, {
      props: {
        localeMode: 'system',
        themeMode: 'light',
        effectiveTheme: 'light',
        ...baseShortcutProps,
      },
    })

    await wrapper.get('[data-testid="preferences-tab-shortcuts"]').trigger('click')
    await wrapper
      .get('[data-testid="preferences-shortcuts-reset-all"]')
      .trigger('click')
    expect(wrapper.emitted('resetAllShortcuts')).toHaveLength(1)
  })

  it('forwards row events as shortcut emits', async () => {
    const wrapper = mount(PreferencesModal, {
      props: {
        localeMode: 'system',
        themeMode: 'light',
        effectiveTheme: 'light',
        shortcutBindings: DEFAULT_SHORTCUT_BINDINGS,
        shortcutOverriddenActions: new Set<ShortcutAction>(['lyrics.mark']),
        capturingAction: null,
      },
    })

    await wrapper.get('[data-testid="preferences-tab-shortcuts"]').trigger('click')
    // Click the first assign (capture) button; rows iterate over the default actions in
    // insertion order, so the first row is `history.undo`.
    await wrapper.get('[data-testid="shortcut-row-assign"]').trigger('click')
    expect(wrapper.emitted('startCaptureShortcut')?.[0]).toEqual(['history.undo'])
  })
})
