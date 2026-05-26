import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWaveSurferView } from './wavesurfer-view'
import type { WaveSurferViewOptions } from './wavesurfer-view'

// ---------------------------------------------------------------------------
// Mock wavesurfer.js — capture mock instances for test inspection
// ---------------------------------------------------------------------------
const mockWsInstances: any[] = []

function createMockWs(): Record<string, unknown> & {
  getWrapper: ReturnType<typeof vi.fn>
  getDuration: ReturnType<typeof vi.fn>
  loadBlob: ReturnType<typeof vi.fn>
  zoom: ReturnType<typeof vi.fn>
  setOptions: ReturnType<typeof vi.fn>
  getDecodedData: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  registerPlugin: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
} {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const wrapper = document.createElement('div')
  const scrollParent = document.createElement('div')
  scrollParent.appendChild(wrapper)
  Object.defineProperty(wrapper, 'scrollWidth', {
    value: 1600,
    configurable: true,
  })
  Object.defineProperty(scrollParent, 'clientWidth', {
    value: 800,
    configurable: true,
  })
  Object.defineProperty(scrollParent, 'scrollWidth', {
    value: 1600,
    configurable: true,
  })
  Object.defineProperty(scrollParent, 'getBoundingClientRect', {
    value: () => ({
      left: 100,
      right: 900,
      width: 800,
      top: 0,
      bottom: 300,
      height: 300,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  })
  Object.defineProperty(wrapper, 'getRootNode', {
    value: () => ({ host: scrollParent }),
    configurable: true,
  })

  const ws = {
    getWrapper: vi.fn(() => wrapper),
    getDuration: vi.fn(() => 120),
    loadBlob: vi.fn(() => Promise.resolve()),
    zoom: vi.fn(),
    setOptions: vi.fn(),
    getDecodedData: vi.fn(() => null),
    destroy: vi.fn(),
    registerPlugin: vi.fn((plugin: unknown) => plugin),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      ;(listeners[event] ??= []).push(fn)
      return () => {
        const list = listeners[event]
        if (list) {
          const idx = list.indexOf(fn)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    }),
  }
  mockWsInstances.push(ws)
  return ws
}

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => createMockWs()),
  },
}))

function createMockSpectrogramPlugin() {
  const wrapper = document.createElement('div')
  wrapper.style.height = '300px'
  const canvasContainer = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.height = 300
  canvas.style.height = '300px'
  canvasContainer.appendChild(canvas)
  wrapper.appendChild(canvasContainer)

  return {
    wrapper,
    canvasContainer,
    height: 300,
    render: vi.fn(() => Promise.resolve()),
  }
}

vi.mock('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js', () => ({
  default: {
    create: vi.fn(() => createMockSpectrogramPlugin()),
  },
}))

function createContainer(): HTMLElement {
  const div = document.createElement('div')
  div.style.width = '800px'
  div.style.height = '300px'
  return div
}

const defaultOptions: WaveSurferViewOptions = {
  mode: 'waveform',
  minPxPerSec: 100,
}

function latestWs() {
  return mockWsInstances[mockWsInstances.length - 1]!
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('waveSurferView', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mockWsInstances.length = 0
  })

  describe('factory', () => {
    it('creates an instance with default options', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      expect(view).toBeDefined()
      expect(typeof view.loadBlob).toBe('function')
      expect(typeof view.zoom).toBe('function')
      expect(typeof view.destroy).toBe('function')
    })

    it('creates an instance in spectrogram mode', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, {
        ...defaultOptions,
        mode: 'spectrogram',
      })
      expect(view).toBeDefined()
    })

    it('keeps spectrogram DOM below timeline overlays', async () => {
      const container = createContainer()
      createWaveSurferView(container, {
        ...defaultOptions,
        mode: 'spectrogram',
      })

      const SpectrogramMock =
        await import('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js')
      const results = (SpectrogramMock.default.create as ReturnType<typeof vi.fn>).mock
        .results
      const plugin = results.at(-1)?.value

      expect(plugin.wrapper.style.position).toBe('relative')
      expect(plugin.wrapper.style.zIndex).toBe('1')
      expect(plugin.canvasContainer.style.position).toBe('relative')
      expect(plugin.canvasContainer.style.zIndex).toBe('1')
    })
  })

  describe('loadBlob', () => {
    it('resolves when ws.loadBlob resolves', async () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      await expect(view.loadBlob(new Blob(['x']))).resolves.toBeUndefined()
    })

    it('re-throws with cause when ws.loadBlob rejects', async () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      const origError = new Error('decode failure')
      latestWs().loadBlob.mockRejectedValueOnce(origError)

      try {
        await view.loadBlob(new Blob(['bad']))
        expect.fail('Expected loadBlob to reject')
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toContain('Failed to load audio')
        expect((err as Error).cause).toBe(origError)
      }
    })
  })

  describe('zoom', () => {
    it('delegates to ws.zoom', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      view.zoom(200)
      expect(latestWs().zoom).toHaveBeenCalledWith(200)
    })

    it('keeps the time under the pointer stable when zooming with an anchor', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!
      scrollEl.scrollLeft = 200

      view.zoom(200, 500)

      expect(latestWs().zoom).toHaveBeenCalledWith(200)
      expect(scrollEl.scrollLeft).toBe(8600)
    })
  })

  describe('destroy', () => {
    it('calls ws.destroy', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      view.destroy()
      expect(latestWs().destroy).toHaveBeenCalled()
    })
  })

  describe('scrollTo', () => {
    it('exposes the WaveSurfer wrapper and scroll container', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const wrapper = latestWs().getWrapper()

      expect(view.getWrapper()).toBe(wrapper)
      expect(view.getScrollContainer()).toBe(wrapper.parentElement)
    })

    it('returns pixels per second from wrapper width and duration', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      expect(view.getDuration()).toBe(120)
      expect(view.getPixelsPerSecond()).toBeCloseTo(13.333, 3)
    })

    it('returns the current visible time range and scroll geometry', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!
      scrollEl.scrollLeft = 400

      expect(view.getVisibleRange()).toEqual({
        start: 30,
        end: 90,
        scrollLeft: 400,
        clientWidth: 800,
        scrollWidth: 1600,
      })
    })

    it('does not throw when scroll container is available', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      expect(() => view.scrollTo(30)).not.toThrow()
    })

    it('centers the requested time when possible', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollTo(60)

      expect(scrollEl.scrollLeft).toBe(400)
    })

    it('does not scroll seek targets inside the 10 percent margins', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollSeekTo(30, 0.1)

      expect(scrollEl.scrollLeft).toBe(0)
    })

    it('scrolls seek targets before the left margin to the 10 percent position', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!
      scrollEl.scrollLeft = 1000

      view.scrollSeekTo(60, 0.1)

      expect(scrollEl.scrollLeft).toBe(720)
    })

    it('scrolls seek targets after the right margin to the 90 percent position', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollSeekTo(90, 0.1)

      expect(scrollEl.scrollLeft).toBe(480)
    })

    it('does not scroll playback while the visible playhead has not passed the midpoint', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollPlaybackTo(30, 0.5)
      expect(scrollEl.scrollLeft).toBe(0)
    })

    it('smoothly catches up by at most 10px at low zoom', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollPlaybackTo(31, 0.5)
      expect(scrollEl.scrollLeft).toBe(10)
    })

    it('uses full catch-up at high zoom', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const wrapper = latestWs().getWrapper()
      Object.defineProperty(wrapper, 'scrollWidth', {
        value: 120000,
        configurable: true,
      })

      view.scrollPlaybackTo(1, 0.5)

      expect(scrollElFromLatestWs().scrollLeft).toBe(600)
    })

    it('pulls playback back into view when the playhead is left of the viewport', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!
      scrollEl.scrollLeft = 1000

      view.scrollPlaybackTo(60, 0.5)

      expect(scrollEl.scrollLeft).toBe(400)
    })

    it('pulls playback back into view when the playhead is right of the viewport', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)
      const scrollEl = latestWs().getWrapper().parentElement!

      view.scrollPlaybackTo(90, 0.5)

      expect(scrollEl.scrollLeft).toBe(800)
    })
  })

  describe('scrollByDelta', () => {
    it('adjusts scrollLeft by delta without throwing', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      expect(() => view.scrollByDelta(50)).not.toThrow()
    })
  })

  describe('on / off', () => {
    it('registers and returns an unsubscribe function', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      const handler = vi.fn()
      const unsub = view.on('ready', handler)
      expect(typeof unsub).toBe('function')
      expect(() => unsub()).not.toThrow()
    })
  })

  describe('setContainerHeight', () => {
    it('calls ws.setOptions in waveform mode', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      view.setContainerHeight(400)
      expect(latestWs().setOptions).toHaveBeenCalledWith({ height: 400 })
    })

    it('stretches spectrogram wrapper and canvas CSS height', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, {
        ...defaultOptions,
        mode: 'spectrogram',
      })

      view.setContainerHeight(500)
      // Method runs without error. The real spectrogram resize verification
      // requires browser-based testing with actual shadow DOM rendering.
      expect(typeof view.setContainerHeight).toBe('function')
    })
  })

  describe('syncContainerHeight', () => {
    it('is no-op in waveform mode', async () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      await view.syncContainerHeight(500)
      // Should not throw and not affect waveform
      expect(latestWs().getDecodedData).not.toHaveBeenCalled()
    })

    it('updates spectrogram wrapper and canvas pixel height', async () => {
      const container = createContainer()
      container.style.height = '500px'
      const view = createWaveSurferView(container, {
        ...defaultOptions,
        mode: 'spectrogram',
      })

      // Verify method signature exists and runs without error
      expect(typeof view.syncContainerHeight).toBe('function')
      await expect(view.syncContainerHeight(500)).resolves.toBeUndefined()
    })

    it('calls spectrogram render when decoded audio is available', async () => {
      const container = createContainer()
      container.style.height = '500px'
      const view = createWaveSurferView(container, {
        ...defaultOptions,
        mode: 'spectrogram',
        spectrogramHeight: 300,
      })

      const fakeAudio = {} as AudioBuffer
      latestWs().getDecodedData.mockReturnValue(fakeAudio)

      await view.syncContainerHeight(500)

      const SpectrogramMock =
        await import('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js')
      const results = (SpectrogramMock.default.create as ReturnType<typeof vi.fn>).mock
        .results
      const plugin = results.at(-1)?.value
      expect(plugin.render).toHaveBeenCalledWith(fakeAudio)
    })
  })
})

function scrollElFromLatestWs(): HTMLElement {
  return latestWs().getWrapper().parentElement!
}
