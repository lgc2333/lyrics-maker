import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AppShell from './AppShell.vue'
import { useEditorStore } from '../../stores/editor-store'

describe('appShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders all phase-1 shell sections', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('[data-testid="menu-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transport-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="main-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mode-panel"]').exists()).toBe(true)
  })

  it('dispatches undo on Ctrl+Z', () => {
    mount(AppShell)
    const store = useEditorStore()
    store.addLyricLine('test')
    expect(store.project.lyrics).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(store.project.lyrics).toHaveLength(0)
  })
})
