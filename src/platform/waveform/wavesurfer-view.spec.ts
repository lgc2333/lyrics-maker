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

vi.mock('wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js', () => ({
  default: {
    create: vi.fn(() => ({ name: 'spectrogram-mock' })),
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
      expect(typeof view.getScrollContainer).toBe('function')
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

  describe('getScrollContainer', () => {
    it('returns the scroll container (parent of wrapper)', () => {
      const container = createContainer()
      const view = createWaveSurferView(container, defaultOptions)

      const scrollEl = view.getScrollContainer()
      expect(scrollEl).toBeInstanceOf(HTMLElement)
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
})
