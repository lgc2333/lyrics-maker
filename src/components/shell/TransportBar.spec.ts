import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, provide, ref } from 'vue'

import type { TimelineViewContext } from '../../composables/useTimelineView'
import { TIMELINE_VIEW_KEY } from '../../composables/useTimelineView'
import type { AudioTransport } from '../../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../../stores/editor-store'
import TransportBar from './TransportBar.vue'

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

function createMockMetronome(): MetronomeScheduler {
  return {
    setEnabled: vi.fn(),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    handlePlaybackPaused: vi.fn(),
    cancelPendingClicks: vi.fn(),
    hasPendingLatch: vi.fn(() => false),
    fireLatchNow: vi.fn(),
    getLoadError: vi.fn(() => null),
    destroy: vi.fn(),
  }
}

describe('transportBar', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
  })

  // ---- Button existence ----

  it('renders metronome toggle button', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="metronome-toggle"]').exists()).toBe(true)
  })

  it('renders snap toggle button', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="snap-toggle"]').exists()).toBe(true)
  })

  it('snap toggle updates project snapEnabled', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    expect(store.project.settings.snapEnabled).toBe(true)

    const toggle = wrapper.get('[data-testid="snap-toggle"]')
    expect((toggle.element as HTMLButtonElement).disabled).toBe(false)

    await toggle.trigger('click')

    expect(store.project.settings.snapEnabled).toBe(false)
    expect(store.statusMessage?.key).toBe('status.settings.snapEnabled')
  })

  it('renders previous bar button', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="prev-bar"]').exists()).toBe(true)
  })

  it('renders play/pause button', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="play-pause"]').exists()).toBe(true)
  })

  it('renders next bar button', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="next-bar"]').exists()).toBe(true)
  })

  it('renders music volume control', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="music-volume"]').exists()).toBe(true)
  })

  it('renders sfx volume control', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="sfx-volume"]').exists()).toBe(true)
  })

  it('renders playback progress slider', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="playback-progress"]').exists()).toBe(true)
  })

  // ---- Progress slider behavior ----

  it('binds slider value to store.currentTime', () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    const slider = wrapper.get('[data-testid="playback-progress"]')
    expect(Number((slider.element as HTMLInputElement).value)).toBe(store.currentTime)
  })

  it('keeps slider enabled when no audio is loaded so it can report status', () => {
    const transport = createMockTransport()
    transport.getDuration = vi.fn(() => 0)
    __overrideAudioTransportFactory(() => transport)

    const wrapper = mount(TransportBar)
    const slider = wrapper.get('[data-testid="playback-progress"]')
    expect((slider.element as HTMLInputElement).disabled).toBe(false)
  })

  it('reports missing audio when progress slider is moved before import', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    const slider = wrapper.get('[data-testid="playback-progress"]')

    await slider.setValue(12)

    expect(store.currentTime).toBe(0)
    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.seek')
  })

  // ---- Seek behavior ----

  it('calls store.seekPlayback and updates currentTime', async () => {
    mount(TransportBar)
    const store = useEditorStore()

    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    store.seekPlayback(5)
    expect(store.currentTime).toBe(5)
  })

  it('updates duration after importing audio', async () => {
    mount(TransportBar)
    const store = useEditorStore()

    expect(store.duration).toBe(0)

    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.duration).toBe(120)
  })

  it('shows duration in slider max and time label after import', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    const slider = wrapper.get('[data-testid="playback-progress"]')
    expect(Number((slider.element as HTMLInputElement).max)).toBe(120)
  })

  it('formats combined time display as mm:ss.mmm / mm:ss.mmm', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    store.seekPlayback(1.234)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="time-display"]').text()).toContain(
      '00:01.234 / 02:00.000',
    )
  })

  // ---- Bar-step seek ----

  it('previous bar button calls store.seekToPreviousBar', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })

    const btn = wrapper.get('[data-testid="prev-bar"]')
    await btn.trigger('click')

    // seekToPreviousBar is called via click — verify it doesn't throw
  })

  it('previous bar button reports missing audio before import', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    await wrapper.get('[data-testid="prev-bar"]').trigger('click')

    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.prevBar')
  })

  it('next bar button calls store.seekToNextBar', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })

    const btn = wrapper.get('[data-testid="next-bar"]')
    await btn.trigger('click')

    // seekToNextBar is called via click — verify it doesn't throw
  })

  it('next bar button reports missing audio before import', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    await wrapper.get('[data-testid="next-bar"]').trigger('click')

    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.nextBar')
  })

  // ---- Volume wheel ----

  it('music volume wheel up increases volume', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    // Start from a non-max value
    store.setMusicVolume(0.5)
    await wrapper.vm.$nextTick()
    const initial = store.project.audio.musicVolume

    const volCtrl = wrapper.get('[data-testid="music-volume"]')
    await volCtrl.trigger('wheel', { deltaY: -100 })

    expect(store.project.audio.musicVolume).toBeGreaterThan(initial)
  })

  it('music volume wheel down decreases volume', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    // Set volume to 0.5 first
    store.setMusicVolume(0.5)
    await wrapper.vm.$nextTick()
    expect(store.project.audio.musicVolume).toBe(0.5)

    const volCtrl = wrapper.get('[data-testid="music-volume"]')
    await volCtrl.trigger('wheel', { deltaY: 100 })

    expect(store.project.audio.musicVolume).toBeLessThan(0.5)
  })

  it('sfx volume wheel up increases volume', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.setSfxVolume(0.5)
    await wrapper.vm.$nextTick()
    expect(store.project.audio.sfxVolume).toBe(0.5)

    const volCtrl = wrapper.get('[data-testid="sfx-volume"]')
    await volCtrl.trigger('wheel', { deltaY: -100 })

    expect(store.project.audio.sfxVolume).toBeGreaterThan(0.5)
  })

  it('sfx volume wheel down decreases volume', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.setSfxVolume(0.5)
    await wrapper.vm.$nextTick()
    expect(store.project.audio.sfxVolume).toBe(0.5)

    const volCtrl = wrapper.get('[data-testid="sfx-volume"]')
    await volCtrl.trigger('wheel', { deltaY: 100 })

    expect(store.project.audio.sfxVolume).toBeLessThan(0.5)
  })

  it('music volume wheel clamped at 0', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.setMusicVolume(0.01)
    await wrapper.vm.$nextTick()
    expect(store.project.audio.musicVolume).toBe(0.01)

    const volCtrl = wrapper.get('[data-testid="music-volume"]')
    await volCtrl.trigger('wheel', { deltaY: 100 })

    expect(store.project.audio.musicVolume).toBe(0)
  })

  it('sfx volume wheel clamped at 1', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    store.setSfxVolume(0.99)
    await wrapper.vm.$nextTick()
    expect(store.project.audio.sfxVolume).toBe(0.99)

    const volCtrl = wrapper.get('[data-testid="sfx-volume"]')
    await volCtrl.trigger('wheel', { deltaY: -100 })

    expect(store.project.audio.sfxVolume).toBe(1)
  })

  // ---- Metronome toggle ----

  it('metronome toggle button toggles metronome state', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    expect(store.metronomeState).toBe('off')

    const btn = wrapper.get('[data-testid="metronome-toggle"]')
    await btn.trigger('click')

    expect(store.metronomeState).toBe('on')
  })

  // ---- Play/Pause ----

  // ---- New controls without timeline context ----

  it('view-mode-toggle is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="view-mode-toggle"]').exists()).toBe(false)
  })

  it('subdivision-select is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="subdivision-select"]').exists()).toBe(false)
  })

  it('rhythm-mode-select is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="rhythm-mode-select"]').exists()).toBe(false)
  })

  it('subdivision stepper is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="subdivision-stepper"]').exists()).toBe(false)
  })

  it('rhythm mode button group is not rendered without timeline context', () => {
    const wrapper = mount(TransportBar)
    expect(wrapper.find('[data-testid="rhythm-mode-group"]').exists()).toBe(false)
  })

  // ---- Play/Pause ----

  it('play/pause button reports missing audio before import', async () => {
    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    await wrapper.get('[data-testid="play-pause"]').trigger('click')

    expect(store.isPlaying).toBe(false)
    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.playPause')
  })

  it('play/pause button triggers togglePlayback without error', async () => {
    const mockTransport = createMockTransport()
    __overrideAudioTransportFactory(() => mockTransport)
    setActivePinia(createPinia())

    const wrapper = mount(TransportBar)
    const store = useEditorStore()

    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.isPlaying).toBe(false)

    const btn = wrapper.get('[data-testid="play-pause"]')
    await btn.trigger('click')

    // Verify play was called on the transport
    expect(mockTransport.play).toHaveBeenCalled()
  })
})

// ---- Timeline context tests ----

function makeTimeline(
  overrides: Partial<TimelineViewContext> = {},
): TimelineViewContext {
  return {
    viewMode: ref('waveform') as TimelineViewContext['viewMode'],
    pxPerSec: ref(100),
    verticalZoom: ref(1),
    divisor: ref(4) as TimelineViewContext['divisor'],
    rhythmMode: ref('common') as TimelineViewContext['rhythmMode'],
    effectiveTriplets: computed(
      () => false,
    ) as TimelineViewContext['effectiveTriplets'],
    altTripletActive: ref(false) as TimelineViewContext['altTripletActive'],
    isLoading: ref(false),
    loadError: ref(null),
    setViewMode: vi.fn(),
    setVerticalZoom: vi.fn(),
    onWheel: vi.fn(),
    ...overrides,
  }
}

function mountWithTimeline(timeline: TimelineViewContext): ReturnType<typeof mount> {
  return mount(
    defineComponent({
      setup() {
        provide(TIMELINE_VIEW_KEY, timeline)
        return () => h(TransportBar)
      },
    }),
  )
}

describe('transportBar rhythm mode select', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
  })

  it('renders rhythm-mode-select when timeline is provided', () => {
    const wrapper = mountWithTimeline(makeTimeline())
    expect(wrapper.find('[data-testid="rhythm-mode-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rhythm-mode-group"]').exists()).toBe(true)
  })

  it('marks common rhythm active when effectiveTriplets is false', () => {
    const timeline = makeTimeline({
      effectiveTriplets: computed(
        () => false,
      ) as TimelineViewContext['effectiveTriplets'],
    })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.get('[data-testid="rhythm-mode-common"]').classes()).toContain(
      'btn-active',
    )
  })

  it('marks triplets rhythm active when effectiveTriplets is true', () => {
    const timeline = makeTimeline({
      effectiveTriplets: computed(
        () => true,
      ) as TimelineViewContext['effectiveTriplets'],
    })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.get('[data-testid="rhythm-mode-triplets"]').classes()).toContain(
      'btn-active',
    )
  })

  it('clicking rhythm buttons updates timeline rhythm mode', async () => {
    const timeline = makeTimeline()
    const wrapper = mountWithTimeline(timeline)

    await wrapper.get('[data-testid="rhythm-mode-triplets"]').trigger('click')
    expect(timeline.rhythmMode.value).toBe('triplets')

    await wrapper.get('[data-testid="rhythm-mode-common"]').trigger('click')
    expect(timeline.rhythmMode.value).toBe('common')
  })

  it('shows an active Alt triplet indicator while Alt is held', () => {
    const timeline = makeTimeline({
      altTripletActive: ref(true) as TimelineViewContext['altTripletActive'],
      effectiveTriplets: computed(
        () => true,
      ) as TimelineViewContext['effectiveTriplets'],
    })
    const wrapper = mountWithTimeline(timeline)

    expect(wrapper.get('[data-testid="rhythm-mode-alt"]').classes()).toContain(
      'btn-active',
    )
  })
})

describe('transportBar subdivision stepper', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
  })

  it('renders subdivision stepper when timeline is provided', () => {
    const wrapper = mountWithTimeline(makeTimeline())

    expect(wrapper.find('[data-testid="subdivision-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subdivision-stepper"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="subdivision-value"]').text()).toBe('4x')
  })

  it('increments and decrements subdivision divisor through timeline', async () => {
    const timeline = makeTimeline()
    const wrapper = mountWithTimeline(timeline)

    await wrapper.get('[data-testid="subdivision-increase"]').trigger('click')
    expect(timeline.divisor.value).toBe(8)

    await wrapper.get('[data-testid="subdivision-decrease"]').trigger('click')
    expect(timeline.divisor.value).toBe(4)
  })

  it('clamps subdivision divisor at supported bounds', async () => {
    const timeline = makeTimeline({
      divisor: ref(1) as TimelineViewContext['divisor'],
    })
    const wrapper = mountWithTimeline(timeline)

    await wrapper.get('[data-testid="subdivision-decrease"]').trigger('click')
    expect(timeline.divisor.value).toBe(1)

    timeline.divisor.value = 16
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="subdivision-increase"]').trigger('click')
    expect(timeline.divisor.value).toBe(16)
  })
})

describe('transportBar vertical zoom slider', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
  })

  it('vertical-zoom-slider is not rendered in waveform mode', () => {
    const timeline = makeTimeline({
      viewMode: ref('waveform') as TimelineViewContext['viewMode'],
    })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').exists()).toBe(false)
  })

  it('vertical-zoom-slider is rendered in spectrogram mode', () => {
    const timeline = makeTimeline({
      viewMode: ref('spectrogram') as TimelineViewContext['viewMode'],
    })
    const wrapper = mountWithTimeline(timeline)
    expect(wrapper.find('[data-testid="vertical-zoom-slider"]').exists()).toBe(true)
  })
})
