import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../stores/editor-store'
import { useTimelineView } from './useTimelineView'

const mockViews: Array<{
  registerPlugin: ReturnType<typeof vi.fn>
  loadBlob: ReturnType<typeof vi.fn>
  zoom: ReturnType<typeof vi.fn>
  scrollTo: ReturnType<typeof vi.fn>
  scrollSeekTo: ReturnType<typeof vi.fn>
  scrollPlaybackTo: ReturnType<typeof vi.fn>
  scrollByDelta: ReturnType<typeof vi.fn>
  getScrollTime: ReturnType<typeof vi.fn>
  setContainerHeight: ReturnType<typeof vi.fn>
  syncContainerHeight: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}> = []

const mockGridPlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []
const mockLinePlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []
const mockPlayheadPlugins: Array<{ update: ReturnType<typeof vi.fn> }> = []
const mockViewListeners: Array<Record<string, Array<(...args: unknown[]) => void>>> = []

function emitViewEvent(index: number, event: string, ...args: unknown[]) {
  for (const fn of mockViewListeners[index]?.[event] ?? []) fn(...args)
}

vi.mock('../platform/waveform/grid-overlay-plugin', () => ({
  GridOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockGridPlugins.push(plugin)
      return plugin
    }),
  },
}))

vi.mock('../platform/waveform/line-overlay-plugin', () => ({
  LineOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockLinePlugins.push(plugin)
      return plugin
    }),
  },
}))

vi.mock('../platform/waveform/playhead-overlay-plugin', () => ({
  PlayheadOverlayPlugin: {
    create: vi.fn(() => {
      const plugin = { update: vi.fn() }
      mockPlayheadPlugins.push(plugin)
      return plugin
    }),
  },
}))

vi.mock('../platform/waveform/wavesurfer-view', () => ({
  createWaveSurferView: vi.fn(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    mockViewListeners.push(listeners)
    const view = {
      registerPlugin: vi.fn((plugin: unknown) => plugin),
      loadBlob: vi.fn(async () => {}),
      zoom: vi.fn(),
      scrollTo: vi.fn(),
      scrollSeekTo: vi.fn(),
      scrollPlaybackTo: vi.fn(),
      scrollByDelta: vi.fn(),
      getScrollTime: vi.fn(() => 0),
      setContainerHeight: vi.fn(),
      syncContainerHeight: vi.fn(async () => {}),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        ;(listeners[event] ??= []).push(fn)
        return () => {}
      }),
      destroy: vi.fn(),
    }
    mockViews.push(view)
    return view
  }),
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
    mockViews.length = 0
    mockGridPlugins.length = 0
    mockLinePlugins.length = 0
    mockPlayheadPlugins.length = 0
    mockViewListeners.length = 0
    __overrideAudioTransportFactory(() => ({
      loadFile: vi.fn(async () => {}),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      seek: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 120),
      setVolume: vi.fn(),
      getVolume: vi.fn(() => 1),
      getIsPlaying: vi.fn(() => false),
      destroy: vi.fn(),
    }))
    __overrideMetronomeFactory(() => ({
      setEnabled: vi.fn(),
      setSfxVolume: vi.fn(),
      syncToTimeline: vi.fn(),
      handlePlaybackPaused: vi.fn(),
      cancelPendingClicks: vi.fn(),
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

  it('shift wheel reports missing audio before changing subdivision', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const containerRef = shallowRef<HTMLElement | null>(null)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })
    const store = useEditorStore()
    const initialDivisor = store.project.settings.snapDivisor

    const event = new WheelEvent('wheel', { deltaY: -100 })
    Object.defineProperty(event, 'shiftKey', { value: true })
    Object.defineProperty(event, 'deltaY', { value: -100 })
    timeline!.onWheel(event)

    expect(store.project.settings.snapDivisor).toBe(initialDivisor)
    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.nextBeat')

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

  it('passes the wheel cursor position to WaveSurfer when ctrl-zooming', () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    const event = new WheelEvent('wheel', { deltaY: -100, clientX: 321 })
    Object.defineProperty(event, 'ctrlKey', { value: true })
    Object.defineProperty(event, 'deltaY', { value: -100 })
    Object.defineProperty(event, 'clientX', { value: 321 })

    timeline!.onWheel(event)

    expect(mockViews[0].zoom).toHaveBeenCalledWith(timeline!.pxPerSec.value, 321)

    wrapper.unmount()
  })

  it('scrolls to explicit seek requests even during user-scroll cooldown', async () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    timeline!.onWheel(new WheelEvent('wheel', { deltaY: 100 }))
    store.seekPlayback(5)
    await wrapper.vm.$nextTick()

    expect(mockViews[0].scrollSeekTo).toHaveBeenCalledWith(5, 0.1)

    wrapper.unmount()
  })

  it('uses threshold playback follow while playing', async () => {
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      useTimelineView(containerRef)
    })
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()

    store.seekPlayback(8)
    await wrapper.vm.$nextTick()

    expect(mockViews[0].scrollPlaybackTo).toHaveBeenCalledWith(8, 0.5)
    expect(mockViews[0].scrollSeekTo).toHaveBeenCalledWith(8, 0.1)

    wrapper.unmount()
  })

  it('currentTime updates only move the playhead and playback follow', async () => {
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      useTimelineView(containerRef)
    })
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()

    mockGridPlugins[0].update.mockClear()
    mockLinePlugins[0].update.mockClear()
    mockPlayheadPlugins[0].update.mockClear()
    mockViews[0].scrollPlaybackTo.mockClear()

    store.seekPlayback(7)
    await wrapper.vm.$nextTick()

    expect(mockPlayheadPlugins[0].update).toHaveBeenCalledWith({ currentTime: 7 })
    expect(mockGridPlugins[0].update).not.toHaveBeenCalled()
    expect(mockLinePlugins[0].update).not.toHaveBeenCalled()
    expect(mockViews[0].scrollPlaybackTo).toHaveBeenCalledWith(7, 0.5)

    wrapper.unmount()
  })

  it('refreshes playhead after playback auto-follow scrolls', async () => {
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      useTimelineView(containerRef)
    })
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()

    mockPlayheadPlugins[0].update.mockClear()
    mockViews[0].scrollPlaybackTo.mockClear()

    store.seekPlayback(7)
    await wrapper.vm.$nextTick()

    expect(mockViews[0].scrollPlaybackTo).toHaveBeenCalledWith(7, 0.5)
    expect(mockPlayheadPlugins[0].update).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('refreshes playhead on WaveSurfer ready scroll zoom redraw and resize', async () => {
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      useTimelineView(containerRef)
    })

    mockPlayheadPlugins[0].update.mockClear()

    emitViewEvent(0, 'ready')
    emitViewEvent(0, 'scroll')
    emitViewEvent(0, 'zoom')
    emitViewEvent(0, 'redraw')
    emitViewEvent(0, 'resize')
    await wrapper.vm.$nextTick()

    expect(mockPlayheadPlugins[0].update).toHaveBeenCalledTimes(5)

    wrapper.unmount()
  })

  it('recreates the playhead plugin when switching view modes', async () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })

    expect(mockPlayheadPlugins).toHaveLength(1)
    timeline!.setViewMode('spectrogram')
    await wrapper.vm.$nextTick()

    expect(mockViews[0].destroy).toHaveBeenCalled()
    expect(mockPlayheadPlugins).toHaveLength(2)

    wrapper.unmount()
  })

  it('can disable playback auto-follow without disabling explicit seek scroll', async () => {
    let timeline: ReturnType<typeof useTimelineView> | undefined
    const container = document.createElement('div')
    const containerRef = shallowRef<HTMLElement | null>(container)
    const wrapper = mountHarness(() => {
      timeline = useTimelineView(containerRef)
    })
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    timeline!.setAutoFollowPlayback(false)
    await store.togglePlayback()
    store.seekPlayback(6)
    await wrapper.vm.$nextTick()

    expect(timeline!.autoFollowPlayback.value).toBe(false)
    expect(mockViews[0].scrollPlaybackTo).not.toHaveBeenCalled()
    expect(mockViews[0].scrollSeekTo).toHaveBeenCalledWith(6, 0.1)

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
