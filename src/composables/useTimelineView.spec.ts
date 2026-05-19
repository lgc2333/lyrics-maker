import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
} from '../stores/editor-store'
import { useTimelineView } from './useTimelineView'

// Mock WaveSurfer to avoid DOM/canvas errors in happy-dom
vi.mock('wavesurfer.js', () => {
  const mockWs = {
    getWrapper: vi.fn(() => {
      const wrapper = document.createElement('div')
      const parent = document.createElement('div')
      parent.appendChild(wrapper)
      return wrapper
    }),
    getDuration: vi.fn(() => 0),
    on: vi.fn(() => () => {}),
    zoom: vi.fn(),
    loadBlob: vi.fn(async () => {}),
    registerPlugin: vi.fn((p: unknown) => p),
    destroy: vi.fn(),
  }
  return {
    default: { create: vi.fn(() => mockWs) },
    BasePlugin: class {
      protected wavesurfer: unknown = null
      protected subscriptions: Array<() => void> = []
      destroy() {
        this.subscriptions.forEach((fn) => fn())
      }
    },
  }
})

// Mock the spectrogram submodule to prevent Vite import-analysis errors
vi.mock('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js', () => ({
  default: {
    create: vi.fn(() => ({})),
  },
}))

function mountHarness(setup: () => void): ReturnType<typeof mount> {
  return mount(
    defineComponent({
      setup() {
        setup()
        return () => h('div')
      },
    }),
  )
}

describe('useTimelineView', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => ({
      loadFile: vi.fn(async () => {}),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      seek: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
      setVolume: vi.fn(),
      getVolume: vi.fn(() => 1),
      getIsPlaying: vi.fn(() => false),
      destroy: vi.fn(),
    }))
    __overrideMetronomeFactory(() => ({
      setEnabled: vi.fn(),
      setSfxVolume: vi.fn(),
      syncToTimeline: vi.fn(),
      hasPendingLatch: vi.fn(() => false),
      fireLatchNow: vi.fn(),
      getLoadError: vi.fn(() => null),
      destroy: vi.fn(),
    }))
    setActivePinia(createPinia())
  })

  it('altTripletActive becomes true on Alt keydown and false on keyup', async () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    expect(timeline!.altTripletActive.value).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(timeline!.altTripletActive.value).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(timeline!.altTripletActive.value).toBe(false)

    wrapper.unmount()
  })

  it('setViewMode updates viewMode', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    expect(timeline!.viewMode.value).toBe('waveform')
    timeline!.setViewMode('spectrogram')
    expect(timeline!.viewMode.value).toBe('spectrogram')

    wrapper.unmount()
  })

  it('setViewMode does not early-return when called with the same mode', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    // Calling twice with same mode should not throw
    timeline!.setViewMode('spectrogram')
    expect(() => timeline!.setViewMode('spectrogram')).not.toThrow()
    expect(timeline!.viewMode.value).toBe('spectrogram')

    wrapper.unmount()
  })

  it('isLoading is exposed in return value', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    expect(timeline!.isLoading).toBeDefined()
    expect(timeline!.isLoading.value).toBe(false)

    wrapper.unmount()
  })

  it('plain wheel (no modifier) does not update pxPerSec', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    const initialPps = timeline!.pxPerSec.value
    const event = new WheelEvent('wheel', { deltaY: 100 })
    timeline!.onWheel(event)
    // pxPerSec should be unchanged — plain scroll just relays to WaveSurfer
    expect(timeline!.pxPerSec.value).toBe(initialPps)

    wrapper.unmount()
  })

  it('onWheel with ctrlKey updates pxPerSec', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    const initialPps = timeline!.pxPerSec.value
    // happy-dom does not forward ctrlKey via WheelEvent constructor,
    // so we set it explicitly after construction.
    const event = new WheelEvent('wheel', { deltaY: -100 })
    Object.defineProperty(event, 'ctrlKey', { value: true })
    Object.defineProperty(event, 'deltaY', { value: -100 })
    timeline!.onWheel(event)
    expect(timeline!.pxPerSec.value).toBeGreaterThan(initialPps)

    wrapper.unmount()
  })

  it('effectiveTriplets is true when rhythmMode is triplets', async () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    expect(timeline!.effectiveTriplets.value).toBe(false)
    // rhythmMode is a computed writable backed by the store
    timeline!.rhythmMode.value = 'triplets'
    await wrapper.vm.$nextTick()
    expect(timeline!.effectiveTriplets.value).toBe(true)

    wrapper.unmount()
  })
})
