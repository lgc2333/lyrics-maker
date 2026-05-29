import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LyricsClipboardConfirmModal from './LyricsClipboardConfirmModal.vue'

function mountModal(
  props: {
    lines?: string[]
    insertionPosition?: 'selected-line-below' | 'list-bottom'
  } = {},
) {
  return mount(LyricsClipboardConfirmModal, {
    props: {
      lines: props.lines ?? ['first line', 'second line'],
      insertionPosition: props.insertionPosition ?? 'selected-line-below',
    },
  })
}

describe('lyricsClipboardConfirmModal', () => {
  it('renders selected-line-below insertion position text', () => {
    const wrapper = mountModal({ insertionPosition: 'selected-line-below' })

    expect(wrapper.text()).toContain('选中行下方')
  })

  it('renders list-bottom insertion position text', () => {
    const wrapper = mountModal({ insertionPosition: 'list-bottom' })

    expect(wrapper.text()).toContain('列表底部')
  })

  it('shows all preview lines', () => {
    const wrapper = mountModal({ lines: ['alpha', 'beta', 'gamma'] })

    expect(wrapper.get('[data-testid="clipboard-preview-list"]').text()).toContain(
      'alpha',
    )
    expect(wrapper.get('[data-testid="clipboard-preview-list"]').text()).toContain(
      'beta',
    )
    expect(wrapper.get('[data-testid="clipboard-preview-list"]').text()).toContain(
      'gamma',
    )
  })

  it('emits confirm and cancel', async () => {
    const wrapper = mountModal()

    await wrapper.get('[data-testid="clipboard-confirm"]').trigger('click')
    await wrapper.get('[data-testid="clipboard-cancel"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
