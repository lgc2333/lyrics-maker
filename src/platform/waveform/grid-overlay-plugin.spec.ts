import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TimingPoint } from '../../core/domain/project'
import { GridOverlayPlugin } from './grid-overlay-plugin'
import type { GridOverlayOptions } from './grid-overlay-plugin'

function createFakeWs(duration = 10) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1000, configurable: true })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', { value: 500, configurable: true })
  Object.defineProperty(scrollContainer, 'scrollWidth', {
    value: 1000,
    configurable: true,
  })
  scrollContainer.appendChild(wrapper)
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}

  return {
    wrapper,
    scrollContainer,
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners[event] ?? []) fn(...args)
    },
    ws: {
      getWrapper: vi.fn(() => wrapper),
      getDuration: vi.fn(() => duration),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        ;(listeners[event] ??= []).push(fn)
        return () => {}
      }),
    },
  }
}

const timingPoints: TimingPoint[] = [
  {
    id: 'tp-1',
    time: 0,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
  },
]

describe('gridOverlayPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('instantiation', () => {
    it('creates with default options', () => {
      const plugin = GridOverlayPlugin.create()
      expect(plugin).toBeInstanceOf(GridOverlayPlugin)
    })

    it('creates with custom outerContainer', () => {
      const container = document.createElement('div')
      const options: GridOverlayOptions = { outerContainer: container }
      const plugin = GridOverlayPlugin.create(options)
      expect(plugin).toBeInstanceOf(GridOverlayPlugin)
    })
  })

  describe('rendering', () => {
    it('appends an SVG grid layer to the WaveSurfer wrapper', () => {
      const { wrapper, ws } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      expect(wrapper.querySelector('[data-testid="timeline-grid"]')).toBeInstanceOf(
        SVGSVGElement,
      )
    })

    it('renders beat lines using absolute wrapper coordinates', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
      })

      const line = wrapper.querySelector('[data-testid="timeline-grid"] line')
      expect(line?.getAttribute('x1')).toBe('0')
      expect(line?.getAttribute('y2')).toBe('100%')
    })

    it('virtualizes grid lines outside the buffered visible range', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      scrollContainer.scrollLeft = 500
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
      })

      const xs = Array.from(
        wrapper.querySelectorAll('[data-testid="timeline-grid"] line'),
        (line) => Number(line.getAttribute('x1')),
      )
      expect(xs.length).toBeGreaterThan(0)
      expect(xs.every((x) => x >= 450 && x <= 1000)).toBe(true)
    })

    it('clears grid lines when timing points become empty', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
      })
      expect(
        wrapper.querySelectorAll('[data-testid="timeline-grid"] line').length,
      ).toBeGreaterThan(0)

      plugin.update({
        timingPoints: [],
        divisor: 4,
        triplets: false,
      })

      expect(wrapper.querySelectorAll('[data-testid="timeline-grid"] line')).toHaveLength(
        0,
      )
    })

    it('does not throw before initialization', () => {
      const plugin = GridOverlayPlugin.create()
      expect(() =>
        plugin.update({
          timingPoints,
          divisor: 4,
          triplets: false,
        }),
      ).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('removes SVG and nulls reference', () => {
      const { ws } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const svg = Reflect.get(plugin, 'svg') as SVGSVGElement
      const removeSpy = vi.spyOn(svg, 'remove')

      plugin.destroy()

      expect(removeSpy).toHaveBeenCalled()
      expect(Reflect.get(plugin, 'svg')).toBeNull()
    })
  })
})
