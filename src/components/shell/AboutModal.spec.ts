import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AboutModal from './AboutModal.vue'

describe('aboutModal', () => {
  it('shows app title, signature, version+commit, and github link', () => {
    const wrapper = mount(AboutModal, {
      props: { version: '1.2.3', commit: 'abc1234' },
    })

    expect(wrapper.text()).toContain('Lyrics Maker')
    expect(wrapper.text()).toContain('Made with ♥️ by LgCookie')
    expect(wrapper.get('[data-testid="about-version"]').text()).toBe('v1.2.3 (abc1234)')

    const link = wrapper.get('[data-testid="about-github-link"]')
    expect(link.attributes('href')).toBe('https://github.com/lgc2333/lyrics-maker')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(AboutModal, {
      props: { version: '1.2.3', commit: 'abc1234' },
    })

    await wrapper.get('[data-testid="about-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close when backdrop is clicked', async () => {
    const wrapper = mount(AboutModal, {
      props: { version: '1.2.3', commit: 'abc1234' },
    })

    await wrapper.get('[data-testid="about-modal"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not emit close when dialog body is clicked', async () => {
    const wrapper = mount(AboutModal, {
      props: { version: '1.2.3', commit: 'abc1234' },
    })

    await wrapper.get('[data-testid="about-dialog"]').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
