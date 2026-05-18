import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MainView from './MainView.vue'

function getHeight(wrapper: ReturnType<typeof mount>): number {
  const el = wrapper.get<HTMLElement>('[data-testid="main-view-container"]').element
  return Number.parseInt(el.style.height, 10)
}

describe('mainView', () => {
  it('renders with default height and resize handle', () => {
    const wrapper = mount(MainView)
    expect(getHeight(wrapper)).toBe(250)
    expect(wrapper.find('[data-testid="main-view-resize-handle"]').exists()).toBe(true)
  })

  it('resizes height via drag handle', async () => {
    const wrapper = mount(MainView)
    const handle = wrapper.get('[data-testid="main-view-resize-handle"]')

    await handle.trigger('pointerdown', { clientY: 300 })

    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 360 }))
    await wrapper.vm.$nextTick()

    expect(getHeight(wrapper)).toBeGreaterThan(250)
  })

  it('keeps height within min and max bounds', async () => {
    const wrapper = mount(MainView)
    const handle = wrapper.get('[data-testid="main-view-resize-handle"]')

    await handle.trigger('pointerdown', { clientY: 300 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 100 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await wrapper.vm.$nextTick()

    const heightAfterMin = getHeight(wrapper)
    expect(heightAfterMin).toBeGreaterThanOrEqual(180)
    expect(heightAfterMin).toBeLessThanOrEqual(250)

    await handle.trigger('pointerdown', { clientY: 200 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 1000 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await wrapper.vm.$nextTick()

    const heightAfterMax = getHeight(wrapper)
    expect(heightAfterMax).toBeLessThanOrEqual(520)
  })

  it('renders waveform-container div', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="waveform-container"]').exists()).toBe(true)
  })

  it('renders word-timeline-bar-slot placeholder', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="word-timeline-bar-slot"]').exists()).toBe(true)
  })

  it('vertical-zoom-slider is not rendered in waveform mode (default)', () => {
    const wrapper = mount(MainView)
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').exists()).toBe(false)
  })
})
