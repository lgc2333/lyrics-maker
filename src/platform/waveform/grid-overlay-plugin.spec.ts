import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TimingPoint } from '../../core/domain/project'
import { GridOverlayPlugin } from './grid-overlay-plugin'
import type { GridOverlayOptions } from './grid-overlay-plugin'

function createFakeWs(duration = 10) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1000, configurable: true })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', {
    value: 500,
    configurable: true,
  })
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

    it('appends a hidden pointer time preview to the WaveSurfer wrapper', () => {
      const { wrapper, ws } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      const preview = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview"]',
      )

      expect(preview).toBeInstanceOf(HTMLDivElement)
      expect(preview?.style.display).toBe('none')
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

    it('applies light waveform grid tokens for readable contrast', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
        theme: 'light',
        viewMode: 'waveform',
      })

      const lines = wrapper.querySelectorAll('[data-testid="timeline-grid"] line')
      expect(lines[0]?.getAttribute('stroke')).toBe('rgba(15, 23, 42, 0.72)')
      expect(lines[0]?.getAttribute('stroke-width')).toBe('2')
      expect(lines[1]?.getAttribute('stroke')).toBe('rgba(180, 83, 9, 0.5)')
      expect(Array.from(lines, (line) => line.getAttribute('stroke'))).toContain(
        'rgba(180, 83, 9, 0.68)',
      )
    })

    it('applies spectrogram grid and preview tokens for readable contrast', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
        theme: 'dark',
        viewMode: 'spectrogram',
      })
      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 250,
          bubbles: true,
        }),
      )

      const lines = wrapper.querySelectorAll('[data-testid="timeline-grid"] line')
      const previewLine = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-line"]',
      )
      const previewLabel = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-label"]',
      )

      expect(lines[0]?.getAttribute('stroke')).toBe('rgba(255, 255, 255, 0.9)')
      expect(lines[1]?.getAttribute('stroke')).toBe('rgba(255, 255, 255, 0.32)')
      expect(Array.from(lines, (line) => line.getAttribute('stroke'))).toContain(
        'rgba(255, 255, 255, 0.58)',
      )
      expect(previewLine?.style.borderLeft).toBe('2px solid rgba(255, 236, 153, 0.98)')
      expect(previewLabel?.style.background).toBe('rgba(0, 0, 0, 0.82)')
    })

    it('virtualizes grid lines outside the buffered visible range', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs(100)
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
      expect(xs.every((x) => x >= 250 && x <= 1000)).toBe(true)
    })

    it('does not rebuild grid DOM while scrolling inside the rendered buffer', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
      })
      const svg = wrapper.querySelector('[data-testid="timeline-grid"]')!
      const replaceSpy = vi.spyOn(svg, 'replaceChildren')

      scrollContainer.scrollLeft = 10
      emit('scroll')

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('keeps a large enough scroll buffer at low zoom', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs(100)
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 4,
        triplets: false,
      })
      const svg = wrapper.querySelector('[data-testid="timeline-grid"]')!
      const replaceSpy = vi.spyOn(svg, 'replaceChildren')

      scrollContainer.scrollLeft = 10
      emit('scroll')

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('keeps dense low-zoom grid DOM bounded', () => {
      const { wrapper, ws, emit } = createFakeWs(100)
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        timingPoints,
        divisor: 16,
        triplets: false,
      })

      expect(
        wrapper.querySelectorAll('[data-testid="timeline-grid"] line').length,
      ).toBeLessThan(500)
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

      expect(
        wrapper.querySelectorAll('[data-testid="timeline-grid"] line'),
      ).toHaveLength(0)
    })

    it('shows a formatted pointer time preview in wrapper coordinates', () => {
      const { wrapper, scrollContainer, ws } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 10 }),
        configurable: true,
      })
      scrollContainer.scrollLeft = 100
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 260,
          bubbles: true,
        }),
      )

      const preview = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview"]',
      )
      const line = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-line"]',
      )
      const label = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-label"]',
      )

      expect(preview?.style.display).toBe('block')
      expect(line?.style.left).toBe('350px')
      expect(label?.style.left).toBe('350px')
      expect(label?.textContent).toBe('00:03.500')
    })

    it('refreshes pointer time preview after zoom changes wrapper geometry', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 250,
          bubbles: true,
        }),
      )

      Object.defineProperty(wrapper, 'scrollWidth', {
        value: 2000,
        configurable: true,
      })
      emit('zoom')

      const line = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-line"]',
      )
      const label = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-label"]',
      )

      expect(line?.style.left).toBe('250px')
      expect(label?.textContent).toBe('00:01.250')
    })

    it('places pointer time label to the left when it would overflow right edge', () => {
      const { wrapper, scrollContainer, ws } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const label = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-label"]',
      )!
      Object.defineProperty(label, 'offsetWidth', {
        value: 80,
        configurable: true,
      })

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 970,
          bubbles: true,
        }),
      )

      expect(label.style.transform).toBe('translateX(calc(-100% - 6px))')
    })

    it('places pointer time label to the left when it would overflow the visible viewport', () => {
      const { wrapper, scrollContainer, ws } = createFakeWs()
      Object.defineProperty(wrapper, 'scrollWidth', {
        value: 3000,
        configurable: true,
      })
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      scrollContainer.scrollLeft = 1000
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const label = wrapper.querySelector<HTMLElement>(
        '[data-testid="grid-time-preview-label"]',
      )!
      Object.defineProperty(label, 'offsetWidth', {
        value: 80,
        configurable: true,
      })

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 470,
          bubbles: true,
        }),
      )

      expect(label.style.left).toBe('1470px')
      expect(label.style.transform).toBe('translateX(calc(-100% - 6px))')
    })

    it('clamps pointer preview time to the audio duration', () => {
      const { wrapper, scrollContainer, ws } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 2000,
          bubbles: true,
        }),
      )

      expect(
        wrapper.querySelector('[data-testid="grid-time-preview-label"]')?.textContent,
      ).toBe('00:10.000')
    })

    it('hides pointer time preview on pointer leave', () => {
      const { wrapper, scrollContainer, ws } = createFakeWs()
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({ left: 0 }),
        configurable: true,
      })
      const plugin = GridOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      wrapper.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 200,
          bubbles: true,
        }),
      )
      wrapper.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))

      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="grid-time-preview"]')?.style
          .display,
      ).toBe('none')
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
