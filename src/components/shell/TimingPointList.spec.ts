import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AudioTransport } from '../../platform/audio/audio-transport'
import {
  __overrideAudioTransportFactory,
  useEditorStore,
} from '../../stores/editor-store'
import TimingPointList from './TimingPointList.vue'

function createMockTransport(): AudioTransport {
  let currentTime = 0
  return {
    loadFile: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn((time: number) => {
      currentTime = time
    }),
    getCurrentTime: vi.fn(() => currentTime),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => false),
    destroy: vi.fn(),
  }
}

describe('timingPointList', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    setActivePinia(createPinia())
  })

  function addTwoPoints() {
    const store = useEditorStore()
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

  it('renders all timing points from store', () => {
    addTwoPoints()
    const wrapper = mount(TimingPointList, { props: { selectedId: null } })
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    expect(rows).toHaveLength(2)
  })

  it('applies selected background class when selectedId matches', () => {
    addTwoPoints()
    const store = useEditorStore()
    const firstId = store.project.timingPoints[0].id
    const wrapper = mount(TimingPointList, { props: { selectedId: firstId } })

    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    expect(rows[0].classes()).toContain('bg-primary/10')
    expect(rows[1].classes()).not.toContain('bg-primary/10')
  })

  it('applies active border when timing point is active (playback at its time)', async () => {
    const store = useEditorStore()
    addTwoPoints()
    // Seek to a time between 0 and 5, so the first timing point (at time=0) is active
    store.seekPlayback(2.0)

    const wrapper = mount(TimingPointList, { props: { selectedId: null } })
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    expect(rows[0].classes()).toContain('border-l-success')
    expect(rows[1].classes()).not.toContain('border-l-success')
  })

  it('emits select event when a row is clicked', async () => {
    addTwoPoints()
    const store = useEditorStore()
    const firstId = store.project.timingPoints[0].id

    const wrapper = mount(TimingPointList, { props: { selectedId: null } })
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    await rows[0].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([firstId])
  })

  it('emits remove event with correct point id when delete button clicked', async () => {
    addTwoPoints()
    const store = useEditorStore()
    const firstId = store.project.timingPoints[0].id

    const wrapper = mount(TimingPointList, { props: { selectedId: null } })
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    const deleteBtn = rows[0].get('[data-testid="remove-timing-point"]')
    await deleteBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([firstId])
  })

  it('renders delete action as an icon button', () => {
    addTwoPoints()
    const wrapper = mount(TimingPointList, { props: { selectedId: null } })

    const deleteBtn = wrapper.get('[data-testid="remove-timing-point"]')

    expect(deleteBtn.text()).toBe('')
    expect(deleteBtn.find('[data-icon]').exists()).toBe(true)
    expect(deleteBtn.attributes('title')).toBe('删除')
  })

  it('isActive() returns false when store has no timing points', () => {
    // Remove the default timing point, leaving an empty array
    const store = useEditorStore()
    store.removeTimingPoint(store.project.timingPoints[0].id)

    const wrapper = mount(TimingPointList, { props: { selectedId: null } })
    const rows = wrapper.findAll('[data-testid="timing-point-row"]')
    expect(rows).toHaveLength(0)
  })
})
