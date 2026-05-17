import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import MenuBar from './MenuBar.vue'

describe('menuBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens file menu on click and closes on second click', async () => {
    const wrapper = mount(MenuBar, { props: { mode: 'timing' } })
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(true)
    await wrapper.get('[data-testid="menu-trigger-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-popup-file"]').exists()).toBe(false)
  })

  it('emits switch-mode when lyrics mode button clicked', async () => {
    const wrapper = mount(MenuBar, { props: { mode: 'timing' } })
    await wrapper.get('[data-testid="mode-switch-lyrics"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['lyrics'])
  })

  it('emits switch-mode when timing mode button clicked', async () => {
    const wrapper = mount(MenuBar, { props: { mode: 'lyrics' } })
    await wrapper.get('[data-testid="mode-switch-timing"]').trigger('click')
    expect(wrapper.emitted('switchMode')?.[0]).toEqual(['timing'])
  })

  it('has theme toggle button', () => {
    const wrapper = mount(MenuBar, { props: { mode: 'timing' } })
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
  })
})
