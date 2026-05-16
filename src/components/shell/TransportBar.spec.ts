import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TransportBar from './TransportBar.vue'
import {
  __overrideAudioTransportFactory,
  useEditorStore,
} from '../../stores/editor-store'
import type { AudioTransport } from '../../platform/audio/audio-transport'

function createMockTransport(): AudioTransport {
  let playing = false
  return {
    loadFile: vi.fn(async () => {}),
    play: vi.fn(async () => {
      playing = true
    }),
    pause: vi.fn(() => {
      playing = false
    }),
    seek: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => playing),
    destroy: vi.fn(),
  }
}

describe('TransportBar', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    setActivePinia(createPinia())
  })

  it('renders playback progress slider', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="playback-progress"]').exists()).toBe(true)
  })

  it('binds slider value to store.currentTime', () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    const slider = wrapper.get('[data-testid="playback-progress"]')
    expect(Number((slider.element as HTMLInputElement).value)).toBe(
      store.currentTime,
    )
  })

  it('disables slider when no audio loaded (duration=0)', () => {
    // Override to return duration 0
    const transport = createMockTransport()
    transport.getDuration = vi.fn(() => 0)
    __overrideAudioTransportFactory(() => transport)

    const wrapper = mount(TransportBar)
    const slider = wrapper.get('[data-testid="playback-progress"]')
    expect((slider.element as HTMLInputElement).disabled).toBe(true)
  })

  it('calls store.seekPlayback and updates currentTime', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    // Import audio so duration > 0 (unlocks slider)
    await store.importAudioFile(
      new File(['x'], 'song.mp3', { type: 'audio/mpeg' }),
    )

    store.seekPlayback(5)
    expect(store.currentTime).toBe(5)
  })
})
