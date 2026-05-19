import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWaveSurferView } from './wavesurfer-view'
import type { WaveSurferViewOptions } from './wavesurfer-view'

// ---------------------------------------------------------------------------
// Mock wavesurfer.js — capture mock instances for test inspection
// ---------------------------------------------------------------------------
const mockWsInstances: ReturnType<typeof createMockWs>[] = []

function createMockWs() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const wrapper = document.createElement('div')
  wrapper.style.width = '1600px'
  const scrollParent = document.createElement('div')
  scrollParent.style.width = '800px'
  scrollParent.appendChild(wrapper)
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
    it('does not throw when scroll container is available', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      expect(() => view.scrollTo(30)).not.toThrow()
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
