import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AudioTransport } from '../../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../../stores/editor-store'
import TimingPointsPanel from './TimingPointsPanel.vue'

function createMockTransport(): AudioTransport {
  let playing = false
  let currentTime = 0
  return {
    loadFile: vi.fn(async () => {}),
    play: vi.fn(async () => {
      playing = true
    }),
    pause: vi.fn(() => {
      playing = false
    }),
    seek: vi.fn((time: number) => {
      currentTime = time
    }),
    getCurrentTime: vi.fn(() => currentTime),
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
    hasPendingLatch: vi.fn(() => false),
    destroy: vi.fn(),
  }
}

describe('timingPointsPanel', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
  })

  /**
   * Removes the default timing point from createEmptyProject (tp-1) and adds
   * two custom points so the panel has exactly 2 rows.
   */
  function addTwoPoints() {
    const store = useEditorStore()
    // Remove the default point (tp-1 at time 0) so we start clean
    store.removeTimingPoint(store.project.timingPoints[0].id)
    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })
    store.addTimingPoint({
      time: 5,
      bpm: 140,
      timeSignatureNumerator: 3,
      timeSignatureDenominator: 4,
    })
  }

  it('renders timing point rows', () => {
    addTwoPoints()
    const wrapper = mount(TimingPointsPanel)
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    expect(rows).toHaveLength(2)
  })

  it('applies is-selected class on row click', async () => {
    addTwoPoints()
    const wrapper = mount(TimingPointsPanel)
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    await rows[0].trigger('click')
    expect(rows[0].classes()).toContain('is-selected')
    expect(rows[1].classes()).not.toContain('is-selected')
  })

  it('shows offset adjust buttons and applies time changes', async () => {
    addTwoPoints()
    const wrapper = mount(TimingPointsPanel)
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    await rows[0].trigger('click')

    const store = useEditorStore()
    const pointId = store.project.timingPoints[0].id
    const before = store.project.timingPoints.find((p) => p.id === pointId)!.time

    await wrapper.get('[data-testid="offset-plus-5"]').trigger('click')
    const after = store.project.timingPoints.find((p) => p.id === pointId)!.time
    expect(after - before).toBeCloseTo(0.005, 6)
  })

  it('applies is-active class when playback time matches a timing point', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    addTwoPoints()
    store.seekPlayback(5.1)
    const wrapper = mount(TimingPointsPanel)
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    // Row at index 1 is the 5s timing point which should be active
    expect(rows[1].classes()).toContain('is-active')
  })

  it('shows add-at-current-time button', () => {
    const wrapper = mount(TimingPointsPanel)
    expect(wrapper.find('[data-testid="add-point-at-current-time"]').exists()).toBe(
      true,
    )
  })

  it('shows clone-selected-at-current-time button', () => {
    const wrapper = mount(TimingPointsPanel)
    expect(
      wrapper.find('[data-testid="clone-selected-point-at-current-time"]').exists(),
    ).toBe(true)
  })

  it('has tap bpm button that triggers store action', async () => {
    const wrapper = mount(TimingPointsPanel)
    const store = useEditorStore()

    // set up a timing point so getActiveTimingPoint doesn't throw
    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })

    // Import audio so tapBpm can access the mock transport (getCurrentTime)
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // Tap multiple times to accumulate > 8 samples for the estimator to produce a result.
    // The mock transport's getCurrentTime returns 0, but the estimator only needs N taps.
    for (let i = 0; i < 9; i++) {
      await wrapper.get('[data-testid="tap-bpm-button"]').trigger('click')
    }

    expect(store.tapSampleCount).toBeGreaterThan(0)
  })
})
