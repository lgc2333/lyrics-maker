import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import MainView from './MainView.vue'
import { MAIN_VIEW_HEIGHT_KEY } from './injection-keys'

describe('mainView', () => {
  it('renders with provided height', () => {
    const mainViewHeight = ref(250)
    const wrapper = mount(MainView, {
      global: { provide: { [MAIN_VIEW_HEIGHT_KEY as symbol]: mainViewHeight } },
    })
    const el = wrapper.get<HTMLElement>('[data-testid="main-view-container"]').element
    expect(Number.parseInt(el.style.height, 10)).toBe(250)
  })

  it('reflects updated height from injection', async () => {
    const mainViewHeight = ref(250)
    const wrapper = mount(MainView, {
      global: { provide: { [MAIN_VIEW_HEIGHT_KEY as symbol]: mainViewHeight } },
    })
    mainViewHeight.value = 350
    await wrapper.vm.$nextTick()
    const el = wrapper.get<HTMLElement>('[data-testid="main-view-container"]').element
    expect(Number.parseInt(el.style.height, 10)).toBe(350)
  })

  it('renders waveform-container div', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="waveform-container"]').exists()).toBe(true)
  })

  it('renders word-timeline-bar-slot placeholder', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="word-timeline-bar-slot"]').exists()).toBe(true)
  })

  it('waveform-loading overlay is not rendered without a timeline injection', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="waveform-loading"]').exists()).toBe(false)
  })
})
