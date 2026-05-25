import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VerticalSliderPopover from './VerticalSliderPopover.vue'

describe('verticalSliderPopover', () => {
  it('emits clamped value updates from wheel input', async () => {
    const wrapper = mount(VerticalSliderPopover, {
      props: {
        modelValue: 10,
        label: 'Zoom',
        dataTestid: 'zoom-control',
        min: 0.5,
        max: 10,
        wheelStep: 0.1,
      },
      slots: {
        icon: '<span data-testid="icon" />',
      },
    })

    await wrapper.get('[data-testid="zoom-control"]').trigger('wheel', {
      deltaY: -100,
    })

    expect(wrapper.emitted('update:modelValue')).toEqual([[10]])
  })

  it('emits slider input changes', async () => {
    const wrapper = mount(VerticalSliderPopover, {
      props: {
        modelValue: 1,
        label: 'Zoom',
        dataTestid: 'zoom-control',
        min: 0.5,
        max: 10,
        sliderStep: 0.1,
      },
      slots: {
        icon: '<span data-testid="icon" />',
      },
    })

    await wrapper.get('input[type="range"]').setValue(2.5)

    expect(wrapper.emitted('update:modelValue')).toEqual([[2.5]])
  })

  it('keeps the hover path continuous between button and panel', () => {
    const wrapper = mount(VerticalSliderPopover, {
      props: {
        modelValue: 1,
        label: 'Zoom',
        dataTestid: 'zoom-control',
        panelTestid: 'zoom-panel',
      },
      slots: {
        icon: '<span data-testid="icon" />',
      },
    })

    expect(wrapper.get('[data-testid="zoom-panel"]').classes()).toContain('mb-1')
    expect(wrapper.get('[data-testid="zoom-panel"]').classes()).toContain('after:h-2')
    expect(wrapper.get('[data-testid="zoom-panel"]').classes()).toContain(
      'after:top-full',
    )
  })
})
