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
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-start-line-1-line"]')
          ?.style.width,
      ).toBe('2px')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-end-line-1-line"]')
          ?.style.width,
      ).toBe('2px')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-start-line-1"]')?.style
          .borderLeft,
      ).toBe('')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-end-line-1"]')?.style
          .borderLeft,
      ).toBe('')
      expect(
        wrapper.querySelector('[data-testid="line-start-line-1-marker-top"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector('[data-testid="line-start-line-1-marker-bottom"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector('[data-testid="line-end-line-1-marker-top"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector('[data-testid="line-end-line-1-marker-bottom"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector<HTMLElement>(
          '[data-testid="line-start-line-1-marker-top"]',
        )?.style.clipPath,
      ).toBe('polygon(0px 0px, 100% 0px, 0px 100%)')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-end-line-1-marker-top"]')
          ?.style.clipPath,
      ).toBe('polygon(0px 0px, 100% 0px, 100% 100%)')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="line-end-line-1-marker-top"]')
          ?.style.left,
      ).toBe('-9px')
      expect(wrapper.querySelector('[data-testid="word-separator-w2"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="word-label-w1"]')?.textContent).toBe(
        'hello',
      )
    })

    it('highlights the selected word range when its time range is complete', () => {
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
        activeWordIndex: 2,
      })

      const selectedRange = wrapper.querySelector<HTMLElement>(
        '[data-testid="selected-word-range-w2"]',
      )

      expect(selectedRange).not.toBeNull()
      expect(selectedRange?.style.left).toBe('100px')
      expect(selectedRange?.style.width).toBe('100px')
      expect(selectedRange?.style.background).not.toBe('')
    })

    it('does not render selected word highlight for the line start block', () => {
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
            words: [{ id: 'w1', text: 'hello', endTime: 2 }],
          },
        ],
        activeLineId: 'line-1',
        activeWordIndex: 0,
      })

      expect(wrapper.querySelector('[data-testid^="selected-word-range-"]')).toBeNull()
    })

    it('does not render selected word highlight without a complete word range', () => {
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
              { id: 'w1', text: 'hello ' },
              { id: 'w2', text: 'world', endTime: 3 },
            ],
          },
        ],
        activeLineId: 'line-1',
        activeWordIndex: 2,
      })

      expect(wrapper.querySelector('[data-testid="selected-word-range-w2"]')).toBeNull()
    })

    it('applies light waveform overlay tokens for readable lyric ranges and labels', () => {
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
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        theme: 'light',
        viewMode: 'waveform',
      })

      const range = wrapper.querySelector<HTMLElement>(
        '[data-testid="lyric-range-line-1"]',
      )
      const label = wrapper.querySelector<HTMLElement>('[data-testid="word-label-w1"]')
      const startLine = wrapper.querySelector<HTMLElement>(
        '[data-testid="line-start-line-1-line"]',
      )
      const marker = wrapper.querySelector<HTMLElement>(
        '[data-testid="line-start-line-1-marker-top"]',
      )

      expect(range?.style.background).toBe('rgba(37, 99, 235, 0.18)')
      expect(label?.style.color).toBe('rgba(3, 7, 18, 0.98)')
      expect(label?.style.textShadow).toBe(
        '0 0 1px rgba(255, 255, 255, 1), 0 0 3px rgba(255, 255, 255, 0.96), 0 1px 2px rgba(255, 255, 255, 0.88)',
      )
      expect(startLine?.style.background).toBe('rgb(190, 18, 60)')
      expect(marker?.style.filter).toContain('drop-shadow')
    })

    it('applies spectrogram overlay tokens for readable lyric ranges and labels', () => {
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
        theme: 'dark',
        viewMode: 'spectrogram',
      })

      const range = wrapper.querySelector<HTMLElement>(
        '[data-testid="lyric-range-line-1"]',
      )
      const label = wrapper.querySelector<HTMLElement>('[data-testid="word-label-w1"]')
      const separator = wrapper.querySelector<HTMLElement>(
        '[data-testid="word-separator-w2-line"]',
      )

      expect(range?.style.background).toBe('rgba(8, 13, 28, 0.5)')
      expect(label?.style.color).toBe('rgba(255, 255, 255, 0.98)')
      expect(label?.style.textShadow).toContain('rgba(0, 0, 0')
      expect(separator?.style.borderLeft).toContain('rgba(255, 236, 153')
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

    it('renders a line by skipping untimed middle words and drawing the end line when the final word is timed', () => {
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
              { id: 'w1', text: 'first ', endTime: 2 },
              { id: 'w2', text: 'missing ' },
              { id: 'w3', text: 'later', endTime: 4 },
            ],
          },
        ],
        activeLineId: null,
      })

      const range = wrapper.querySelector<HTMLElement>(
        '[data-testid="lyric-range-line-1"]',
      )

      expect(range).not.toBeNull()
      expect(range?.style.left).toBe('100px')
      expect(range?.style.width).toBe('300px')
      expect(wrapper.querySelector('[data-testid="line-start-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="line-end-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="word-label-w2"]')).toBeNull()
      expect(wrapper.querySelector('[data-testid="word-label-w3"]')?.textContent).toBe(
        'later',
      )
      expect(
        wrapper.querySelector('[data-testid="partial-line-end-line-1"]'),
      ).toBeNull()
    })

    it('uses a dashed partial boundary when the final word is still untimed', () => {
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
              { id: 'w1', text: 'first ', endTime: 2 },
              { id: 'w2', text: 'missing ' },
              { id: 'w3', text: 'later' },
            ],
          },
        ],
        activeLineId: null,
      })

      expect(wrapper.querySelector('[data-testid="lyric-range-line-1"]')).not.toBeNull()
      expect(wrapper.querySelector('[data-testid="line-end-line-1"]')).toBeNull()
      expect(
        wrapper.querySelector('[data-testid="partial-line-end-line-1"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector('[data-testid="partial-line-end-line-1-marker-top"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector('[data-testid="partial-line-end-line-1-marker-bottom"]'),
      ).not.toBeNull()
      expect(
        wrapper.querySelector<HTMLElement>(
          '[data-testid="partial-line-end-line-1-marker-top"]',
        )?.style.width,
      ).toBe('8px')
      expect(
        wrapper.querySelector<HTMLElement>(
          '[data-testid="partial-line-end-line-1-marker-top"]',
        )?.style.clipPath,
      ).toBe('polygon(0px 0px, 100% 0px, 100% 100%)')
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

    it('renders drag hit areas for line and word boundaries', () => {
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
        duration: 10,
      })

      const lineStart = wrapper.querySelector<HTMLElement>(
        '[data-testid="boundary-handle-line-start-line-1"]',
      )
      const lineEnd = wrapper.querySelector<HTMLElement>(
        '[data-testid="boundary-handle-line-end-line-1"]',
      )
      const separator = wrapper.querySelector<HTMLElement>(
        '[data-testid="boundary-handle-word-separator-w1"]',
      )

      expect(lineStart).not.toBeNull()
      expect(lineEnd).not.toBeNull()
      expect(separator).not.toBeNull()
      expect(lineStart?.style.pointerEvents).toBe('auto')
      expect(lineStart?.style.cursor).toBe('ew-resize')
      expect(Number(lineStart?.style.zIndex)).toBeGreaterThan(5)
    })

    it('does not render ambiguous separator hit area when previous word is untimed', () => {
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
              { id: 'w1', text: 'missing ' },
              { id: 'w2', text: 'later', endTime: 3 },
            ],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
      })

      expect(
        wrapper.querySelector('[data-testid="boundary-handle-word-separator-w1"]'),
      ).toBeNull()
    })

    it('moves the dragged line start and range with dragPreview', () => {
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
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
        dragPreview: {
          intent: { kind: 'line-start', lineId: 'line-1' },
          time: 1.5,
        },
      })

      const range = wrapper.querySelector<HTMLElement>(
        '[data-testid="lyric-range-line-1"]',
      )
      const preview = wrapper.querySelector<HTMLElement>(
        '[data-testid="boundary-handle-drag-preview"]',
      )

      expect(range?.style.left).toBe('150px')
      expect(range?.style.width).toBe('150px')
      expect(preview).not.toBeNull()
      expect(preview?.style.left).toBe('0px')
    })

    it('moves adjacent word label widths with word separator dragPreview', () => {
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
              { id: 'w2', text: 'world', endTime: 4 },
            ],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
        dragPreview: {
          intent: { kind: 'word-separator', lineId: 'line-1', wordId: 'w1' },
          time: 2.5,
        },
      })

      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="lyric-range-line-1"]')?.style
          .width,
      ).toBe('300px')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="word-label-w1"]')?.style
          .width,
      ).toBe('150px')
      expect(
        wrapper.querySelector<HTMLElement>('[data-testid="word-label-w2"]')?.style.left,
      ).toBe('150px')
    })
  })

  describe('drag events', () => {
    function dispatchPointer(
      target: EventTarget,
      type: string,
      init: MouseEventInit & { pointerId?: number } = {},
    ): void {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: init.clientX ?? 0,
      }) as MouseEvent & { pointerId: number }
      Object.defineProperty(event, 'pointerId', {
        configurable: true,
        value: init.pointerId ?? 1,
      })
      target.dispatchEvent(event)
    }

    it('emits drag lifecycle events with line-start intent', () => {
      const { wrapper, ws, emit } = createFakeWs()
      vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(vi.fn())
      vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(
        vi.fn(),
      )
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const startSpy = vi.fn()
      const moveSpy = vi.fn()
      const endSpy = vi.fn()
      plugin.on('boundaryDragStart', startSpy)
      plugin.on('boundaryDragMove', moveSpy)
      plugin.on('boundaryDragEnd', endSpy)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
      })

      const handle = wrapper.querySelector(
        '[data-testid="boundary-handle-line-start-line-1"]',
      )!
      dispatchPointer(handle, 'pointerdown', { clientX: 120 })
      dispatchPointer(window, 'pointermove', { clientX: 250 })
      dispatchPointer(window, 'pointerup', { clientX: 250 })

      expect(startSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
      })
      expect(moveSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
        rawTime: 2.5,
      })
      expect(endSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
        rawTime: 2.5,
      })
    })

    it('emits word-separator intent using the left word id', () => {
      const { wrapper, ws, emit } = createFakeWs()
      vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(vi.fn())
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const startSpy = vi.fn()
      plugin.on('boundaryDragStart', startSpy)

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
        duration: 10,
      })

      dispatchPointer(
        wrapper.querySelector('[data-testid="boundary-handle-word-separator-w1"]')!,
        'pointerdown',
        { clientX: 200 },
      )

      expect(startSpy).toHaveBeenCalledWith({
        intent: { kind: 'word-separator', lineId: 'line-1', wordId: 'w1' },
      })
    })

    it('does not double-count scrollLeft when converting pointer X to time', () => {
      const { wrapper, scrollContainer, ws, emit } = createFakeWs()
      scrollContainer.scrollLeft = 300
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        left: -300,
        right: 700,
        top: 0,
        bottom: 100,
        width: 1000,
        height: 100,
        x: -300,
        y: 0,
        toJSON: () => ({}),
      })
      vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(vi.fn())
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const moveSpy = vi.fn()
      plugin.on('boundaryDragMove', moveSpy)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
      })

      const handle = wrapper.querySelector(
        '[data-testid="boundary-handle-line-start-line-1"]',
      )!
      dispatchPointer(handle, 'pointerdown', { clientX: 100 })
      dispatchPointer(window, 'pointermove', { clientX: 100 })

      expect(moveSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
        rawTime: 4,
      })
    })

    it('emits cancel once when Escape is pressed during drag', () => {
      const { wrapper, ws, emit } = createFakeWs()
      vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(vi.fn())
      vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(
        vi.fn(),
      )
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const cancelSpy = vi.fn()
      plugin.on('boundaryDragCancel', cancelSpy)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
      })

      dispatchPointer(
        wrapper.querySelector('[data-testid="boundary-handle-line-start-line-1"]')!,
        'pointerdown',
        { clientX: 100 },
      )
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(cancelSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
      })
    })

    it('continues a drag from window events after preview redraw replaces the captured handle', () => {
      const { wrapper, ws, emit } = createFakeWs()
      vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(vi.fn())
      vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(
        vi.fn(),
      )
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', ws)
      Reflect.get(plugin, 'onInit').call(plugin)
      const moveSpy = vi.fn()
      const endSpy = vi.fn()
      plugin.on('boundaryDragMove', moveSpy)
      plugin.on('boundaryDragEnd', endSpy)

      emit('ready')
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
      })

      const originalHandle = wrapper.querySelector(
        '[data-testid="boundary-handle-line-start-line-1"]',
      )!
      dispatchPointer(originalHandle, 'pointerdown', { clientX: 100 })
      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 1,
            words: [{ id: 'w1', text: 'hello', endTime: 3 }],
          },
        ],
        activeLineId: 'line-1',
        duration: 10,
        dragPreview: {
          intent: { kind: 'line-start', lineId: 'line-1' },
          time: 1.25,
        },
      })

      expect(originalHandle.isConnected).toBe(false)

      dispatchPointer(window, 'pointermove', { clientX: 200 })
      dispatchPointer(window, 'pointerup', { clientX: 200 })

      expect(moveSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
        rawTime: 2,
      })
      expect(endSpy).toHaveBeenCalledWith({
        intent: { kind: 'line-start', lineId: 'line-1' },
        rawTime: 2,
      })
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
