import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import TransportBar from './TransportBar.vue'
import { useEditorStore } from '../../stores/editor-store'

describe('TransportBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders playback progress slider', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="playback-progress"]').exists()).toBe(true)
  })

  it('binds slider value to store.currentTime', () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    expect(
      Number(
        (wrapper.get('[data-testid="playback-progress"]').element as HTMLInputElement)
          .value,
      ),
    ).toBe(store.currentTime)
  })
})
