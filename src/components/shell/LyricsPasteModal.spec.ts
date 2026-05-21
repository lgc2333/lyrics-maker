import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LyricsPasteModal from './LyricsPasteModal.vue'

function mountModal() {
  return mount(LyricsPasteModal)
}

describe('lyricsPasteModal', () => {
  it('renders textarea and buttons', () => {
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="lyrics-paste-textarea"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="paste-confirm-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="paste-cancel-btn"]').exists()).toBe(true)
  })

  it('confirm button is disabled when textarea is empty', () => {
    const wrapper = mountModal()
    const btn = wrapper.get('[data-testid="paste-confirm-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('confirm button emits confirm event with textarea content', async () => {
    const wrapper = mountModal()
    const textarea = wrapper.get('[data-testid="lyrics-paste-textarea"]')
    await textarea.setValue('line one\nline two')
    await wrapper.get('[data-testid="paste-confirm-btn"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]).toEqual(['line one\nline two'])
  })

  it('cancel button emits cancel event', async () => {
    const wrapper = mountModal()
    await wrapper.get('[data-testid="paste-cancel-btn"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('confirm clears textarea after emit', async () => {
    const wrapper = mountModal()
    const textarea = wrapper.get('[data-testid="lyrics-paste-textarea"]')
    await textarea.setValue('some text')
    await wrapper.get('[data-testid="paste-confirm-btn"]').trigger('click')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('backdrop click emits cancel', async () => {
    const wrapper = mountModal()
    await wrapper.get('.modal-backdrop').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
