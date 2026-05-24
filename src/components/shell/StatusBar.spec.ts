import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '../../stores/editor-store'
import StatusBar from './StatusBar.vue'

describe('statusBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows saved state when project is clean and no transient message exists', () => {
    const wrapper = mount(StatusBar)

    expect(wrapper.get('[data-testid="status-persistent"]').text()).toContain('已保存')
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('就绪')
  })

  it('shows dirty state after a command mutates the project', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.addLyricLine('hello')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-persistent"]').text()).toContain(
      '未保存更改',
    )
  })

  it('renders translated history messages with command labels', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.addLyricLine('hello')
    store.undo()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('已撤销')
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('添加歌词行')
  })

  it('renders audio-required messages with action labels', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    await store.togglePlayback()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '需要先导入音频',
    )
    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('播放/暂停')
  })
})
