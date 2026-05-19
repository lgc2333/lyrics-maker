import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TimingPoint } from '../../core/domain/project'
import type { AudioTransport } from '../../platform/audio/audio-transport'
import {
  __overrideAudioTransportFactory,
  useEditorStore,
} from '../../stores/editor-store'
import TimingPointControls from './TimingPointControls.vue'

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

function makePoint(overrides: Partial<TimingPoint> = {}): TimingPoint {
  return {
    id: 'tp-test-1',
    time: 10.5,
    bpm: 140,
    timeSignatureNumerator: 3,
    timeSignatureDenominator: 8,
    ...overrides,
  }
}

describe('timingPointControls', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockTransport())
    setActivePinia(createPinia())
  })

  it('renders focused point time, bpm, and time signature', () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    // Offset input (first number input) shows focusedPoint.time with 3 decimals
    const allNumberInputs = wrapper.findAll('input[type="number"]')
    expect((allNumberInputs[0].element as HTMLInputElement).value).toBe('10.500')
    // BPM input shows focusedPoint.bpm with 1 decimal
    const bpmInput = wrapper.find('input[step="0.1"]')
    expect((bpmInput.element as HTMLInputElement).value).toBe('140.0')
    // Time signature numerator (3) and denominator (8)
    const numeratorInput = wrapper.find('input[min="1"].w-14')
    if (numeratorInput.exists()) {
      expect((numeratorInput.element as HTMLInputElement).value).toBe('3')
    }
    const select = wrapper.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('8')
  })

  it('renders with default values when focusedPoint is null', () => {
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: null, activePoint: null },
    })

    // Offset input falls back to store.currentTime (0) → "0.000"
    const offsetInput = wrapper.findAll('input[type="number"]')[0]
    expect((offsetInput.element as HTMLInputElement).value).toBe('0.000')
  })

  it('emits adjustTime with positive delta when +5ms button clicked', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    await wrapper.get('[data-testid="offset-plus-5"]').trigger('click')
    expect(wrapper.emitted('adjustTime')).toBeTruthy()
    expect(wrapper.emitted('adjustTime')![0]).toEqual([5])
  })

  it('emits adjustTime with negative delta when -10ms button clicked', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    await wrapper.get('[data-testid="offset-minus-10"]').trigger('click')
    expect(wrapper.emitted('adjustTime')![0]).toEqual([-10])
  })

  it('emits setOffsetToCurrentTime when button clicked', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    await wrapper.get('[data-testid="set-offset-to-current-time"]').trigger('click')
    expect(wrapper.emitted('setOffsetToCurrentTime')).toBeTruthy()
  })

  it('bpm input change emits setBpm', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    // Find the BPM input (type=number, step=0.1)
    const inputs = wrapper.findAll('input[type="number"]')
    const bpmInput = inputs.find((i) => i.attributes('step') === '0.1')!
    await bpmInput.setValue(160)

    expect(wrapper.emitted('setBpm')).toBeTruthy()
    expect(wrapper.emitted('setBpm')![0]).toEqual([160])
  })

  it('time signature numerator change emits updateNumerator', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    // Find numerator input: type=number with w-14 class (not step=0.001 or step=0.1)
    const inputs = wrapper.findAll('input[type="number"]')
    const numeratorInput = inputs.find(
      (i) => i.attributes('step') !== '0.001' && i.attributes('step') !== '0.1',
    )!
    await numeratorInput.setValue(5)

    expect(wrapper.emitted('updateNumerator')).toBeTruthy()
    expect(wrapper.emitted('updateNumerator')![0]).toEqual([5])
  })

  it('time signature denominator change emits updateDenominator', async () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    const select = wrapper.find('select')
    await select.setValue('2')

    expect(wrapper.emitted('updateDenominator')).toBeTruthy()
    expect(wrapper.emitted('updateDenominator')![0]).toEqual([2])
  })

  it('tap bpm button is disabled when no audio loaded', () => {
    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    const btn = wrapper.get('[data-testid="tap-bpm-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('tap bpm button is enabled and emits tapBpm when audio loaded', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    const point = makePoint()
    const wrapper = mount(TimingPointControls, {
      props: { focusedPoint: point, activePoint: null },
    })

    const btn = wrapper.get('[data-testid="tap-bpm-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)

    await btn.trigger('click')
    expect(wrapper.emitted('tapBpm')).toBeTruthy()
  })
})
