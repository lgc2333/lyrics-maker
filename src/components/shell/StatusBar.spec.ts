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

  it('renders translated history messages for project title commands', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.setProjectTitle('Song B')
    store.undo()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('修改工程名')
  })

  it('renders translated history messages for replace-all lyrics commands', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.replaceLyricsFromImport(
      [{ startTime: 0, words: [{ text: 'hello', endTime: 1 }] }],
      { format: 'lrc', fileName: 'song.lrc' },
    )
    store.undo()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('替换歌词')
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

  it('renders audio-required messages for interval playback with action labels', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    await store.playInterval(1, 2)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('播放片段')
    expect(wrapper.get('[data-testid="status-message"]').text()).not.toContain(
      'transport.playInterval',
    )
  })

  it('renders snap enabled status without adding undo history', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.setSnapEnabled(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('吸附已关闭')
    expect(store.canUndo).toBe(false)
    expect(store.dirty).toBe(false)
  })

  it('renders localized rhythm mode names in settings status', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.setRhythmMode('triplets')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '节奏模式已切换为 三连音',
    )

    store.setRhythmMode('common')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '节奏模式已切换为 普通',
    )
  })

  it('renders localized timeline view mode names in settings status', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.showStatus('status.settings.viewMode', { mode: 'spectrogram' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain('频谱')
    expect(wrapper.get('[data-testid="status-message"]').text()).not.toContain(
      'spectrogram',
    )
  })

  it('renders temporary Alt rhythm status separately', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.showStatus('status.settings.rhythmModeTemporary', { mode: 'triplets' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '临时切换节奏模式：三连音',
    )
  })

  it('renders localized persistence failure reasons', async () => {
    const store = useEditorStore()
    const wrapper = mount(StatusBar)

    store.showStatus('status.project.openFailed', { reason: 'invalid' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="status-message"]').text()).toContain(
      '打开工程失败：数据格式无效',
    )
  })
})
