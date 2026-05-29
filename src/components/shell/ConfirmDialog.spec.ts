import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConfirmDialog from './ConfirmDialog.vue'

function mountDialog(
  overrides: Partial<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    tone: 'neutral' | 'danger'
  }> = {},
) {
  return mount(ConfirmDialog, {
    props: {
      title: '确定要重置吗？',
      message: '此操作不可撤销。',
      ...overrides,
    },
  })
}

describe('confirmDialog', () => {
  it('renders title and message', () => {
    const wrapper = mountDialog()
    expect(wrapper.get('[data-testid="confirm-dialog-title"]').text()).toBe(
      '确定要重置吗？',
    )
    expect(wrapper.get('[data-testid="confirm-dialog-message"]').text()).toBe(
      '此操作不可撤销。',
    )
  })

  it('uses i18n defaults for confirm/cancel labels when not provided', () => {
    const wrapper = mountDialog()
    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').text()).toBe('确定')
    expect(wrapper.get('[data-testid="confirm-dialog-cancel"]').text()).toBe('取消')
  })

  it('renders custom button labels when provided', () => {
    const wrapper = mountDialog({ confirmLabel: '清空', cancelLabel: '保留' })
    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').text()).toBe('清空')
    expect(wrapper.get('[data-testid="confirm-dialog-cancel"]').text()).toBe('保留')
  })

  it('applies btn-error styling for danger tone', () => {
    const wrapper = mountDialog({ tone: 'danger' })
    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').classes()).toContain(
      'btn-error',
    )
  })

  it('applies btn-primary styling for neutral tone (default)', () => {
    const wrapper = mountDialog()
    expect(wrapper.get('[data-testid="confirm-dialog-confirm"]').classes()).toContain(
      'btn-primary',
    )
  })

  it('emits confirm when confirm button is clicked', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[]])
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('emits cancel when cancel button is clicked', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits cancel when Escape is pressed', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-testid="confirm-dialog"]').trigger('keydown.escape')
    expect(wrapper.emitted('cancel')).toEqual([[]])
  })

  it('does not emit when clicking the dialog backdrop area without buttons', async () => {
    const wrapper = mountDialog()
    await wrapper.get('[data-testid="confirm-dialog"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })
})
