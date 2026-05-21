import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import MenuBar from './MenuBar.vue'

describe('menuBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens file menu on click and closes on second click', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
  })

  it('emits switch-mode when lyrics mode button clicked', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['lyrics'])
  })

  it('emits switch-mode when timing mode button clicked', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'lyrics', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="mode-switch-timing"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['timing'])
  })

  it('has theme toggle button', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
  })

  it('uses left-menu center-title right-controls layout', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="menu-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-right"]').exists()).toBe(true)
  })

  it('renders mode switch in segmented switch style container', () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    expect(wrapper.find('[data-testid="mode-switch-group"]').exists()).toBe(true)
  })

  it('emits toggleTheme when theme button clicked', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="theme-toggle"]').trigger('click')
    expect(wrapper.emitted('toggleTheme')).toHaveLength(1)
  })

  it('closes open menu when clicking another menu trigger', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-trigger-edit"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-popup-edit"]').exists()).toBe(true)
  })

  it('closes menu on click outside', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    // Click on body — should close the menu since it's outside menu triggers/popups
    document.body.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
  })

  it('emits openAudioFile from file menu action', async () => {
    const wrapper = mount(MenuBar, {
      props: { mode: 'timing', theme: 'light', audioLoaded: true },
    })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    await wrapper.get('[data-testid="menu-open-audio"]').trigger('click')
    expect(wrapper.emitted('openAudioFile')).toHaveLength(1)
  })
})
