import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ImportConfirmModal from './ImportConfirmModal.vue'

describe('importConfirmModal', () => {
  it('shows detected format, replacement warning, and preservation note', () => {
    const wrapper = mount(ImportConfirmModal, {
      props: { fileName: 'song.lrc', format: 'lrc', displayFormat: 'lrc-line' },
    })

    expect(wrapper.text()).toContain('song.lrc')
    expect(wrapper.text()).toContain('普通逐行 LRC')
    expect(wrapper.text()).toContain('替换当前歌词')
    expect(wrapper.text()).toContain('保留当前音频和项目设置')
  })

  it('emits confirm and cancel', async () => {
    const wrapper = mount(ImportConfirmModal, {
      props: { fileName: 'song.lrc', format: 'lrc', displayFormat: 'lrc-line' },
    })

    await wrapper.get('[data-testid="import-confirm"]').trigger('click')
    await wrapper.get('[data-testid="import-cancel"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('shows enhanced LRC and ESLyric display format labels', () => {
    const enhanced = mount(ImportConfirmModal, {
      props: {
        fileName: 'enhanced.lrc',
        format: 'lrc',
        displayFormat: 'lrc-enhanced',
      },
    })
    const eslyric = mount(ImportConfirmModal, {
      props: {
        fileName: 'eslyric.lrc',
        format: 'lrc',
        displayFormat: 'lrc-eslyric',
      },
    })

    expect(enhanced.text()).toContain('增强 LRC')
    expect(eslyric.text()).toContain('ESLyric')
  })
})
