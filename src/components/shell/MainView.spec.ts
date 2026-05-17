import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MainView from './MainView.vue'

describe('mainView', () => {
  it('renders with default height and resize handle', () => {
    const wrapper = mount(MainView)
    const container = wrapper.get('[data-testid="main-view-container"]')
    expect(container.element.style.height).toBe('250px')
    expect(wrapper.find('[data-testid="main-view-resize-handle"]').exists()).toBe(true)
  })

  it('resizes height via drag handle', async () => {
    const wrapper = mount(MainView)
    const handle = wrapper.get('[data-testid="main-view-resize-handle"]')

    // Start drag
    await handle.trigger('pointerdown', { clientY: 300 })

    // Move down 60px → height should increase
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 360 }))
    await wrapper.vm.$nextTick()

    const container = wrapper.get('[data-testid="main-view-container"]')
    const newHeight = parseInt((container.element as HTMLElement).style.height, 10)
    expect(newHeight).toBeGreaterThan(250)
  })

  it('keeps height within min and max bounds', async () => {
    const wrapper = mount(MainView)
    const handle = wrapper.get('[data-testid="main-view-resize-handle"]')

    // Drag way up (should clamp to min 180)
    await handle.trigger('pointerdown', { clientY: 300 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 100 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await wrapper.vm.$nextTick()

    const container = wrapper.get('[data-testid="main-view-container"]')
    const heightAfterMin = parseInt((container.element as HTMLElement).style.height, 10)
    expect(heightAfterMin).toBeGreaterThanOrEqual(180)
    expect(heightAfterMin).toBeLessThanOrEqual(250)

    // Drag way down (should clamp to max 520)
    await handle.trigger('pointerdown', { clientY: 200 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: 1000 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await wrapper.vm.$nextTick()

    const heightAfterMax = parseInt((container.element as HTMLElement).style.height, 10)
    expect(heightAfterMax).toBeLessThanOrEqual(520)
  })
})
