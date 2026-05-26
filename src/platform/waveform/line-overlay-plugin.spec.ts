import { afterEach, describe, expect, it, vi } from 'vitest'

import { LineOverlayPlugin } from './line-overlay-plugin'
import type { LineOverlayOptions } from './line-overlay-plugin'

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

describe('lineOverlayPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('instantiation', () => {
    it('creates with default options via static create()', () => {
      const plugin = LineOverlayPlugin.create()
      expect(plugin).toBeInstanceOf(LineOverlayPlugin)
    })

    it('creates with custom outerContainer', () => {
      const container = document.createElement('div')
      const options: LineOverlayOptions = { outerContainer: container }
      const plugin = LineOverlayPlugin.create(options)
      expect(plugin).toBeInstanceOf(LineOverlayPlugin)
    })
  })

  describe('rendering', () => {
    it('appends a lyrics layer to the WaveSurfer wrapper', () => {
      const { wrapper, ws } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      expect(wrapper.querySelector('[data-testid="timeline-lyrics"]')).toBeInstanceOf(
        HTMLDivElement,
      )
    })

    it('renders a completed timed line with current visual semantics', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [
              { id: 'w1', text: 'hello ', endTime: 2 },
              { id: 'w2', text: 'world', endTime: 3 },
            ],
          },
        ],
        activeLineId: 'line-1',
      })

      expect(wrapper.querySelector('[data-testid="lyric-range-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="line-start-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="line-end-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="word-separator-w2"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="word-label-w1"]')?.textContent).toBe(
        'hello',
      )
    })

    it('skips untimed lines', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        lyrics: [{ id: 'line-1', words: [{ id: 'w1', text: 'hello' }] }],
        activeLineId: null,
      })

      expect(wrapper.querySelector('[data-testid^="lyric-range-"]')).toBeNull()
    })

    it('virtualizes lines outside the buffered visible range', () => {
      const { wrapper, ws, emit } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'far-line',
            startTime: 8,
            words: [{ id: 'w1', text: 'later', endTime: 9 }],
          },
        ],
        activeLineId: null,
      })

      expect(wrapper.querySelector('[data-testid="lyric-range-far-line"]')).toBeNull()
    })

    it('does not rebuild lyric DOM while scrolling inside the rendered buffer', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: null,
      })
      const layer = wrapper.querySelector('[data-testid="timeline-lyrics"]')!
      const replaceSpy = vi.spyOn(layer, 'replaceChildren')

      scrollContainer.scrollLeft = 10
      emit('scroll')

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('keeps a large enough scroll buffer at low zoom', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs(100)
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: null,
      })
      const layer = wrapper.querySelector('[data-testid="timeline-lyrics"]')!
      const replaceSpy = vi.spyOn(layer, 'replaceChildren')

      scrollContainer.scrollLeft = 10
      emit('scroll')

      expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('does not throw before initialization', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() => plugin.update({ lyrics: [], activeLineId: null })).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('removes DOM layer and nulls reference', () => {
      const { ws } = createFakeWs()
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const layer = Reflect.get(plugin, 'layer') as HTMLDivElement
      const removeSpy = vi.spyOn(layer, 'remove')

      plugin.destroy()

      expect(removeSpy).toHaveBeenCalled()
      expect(Reflect.get(plugin, 'layer')).toBeNull()
    })

    it('can be called before init without error', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() => plugin.destroy()).not.toThrow()
    })
  })
})
