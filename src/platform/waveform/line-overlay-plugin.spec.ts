import { afterEach, describe, expect, it, vi } from 'vitest'

import { LineOverlayPlugin } from './line-overlay-plugin'
import type { LineOverlayOptions } from './line-overlay-plugin'

function createMockCanvas(context: unknown = null) {
  const parentDiv = document.createElement('div')
  parentDiv.style.width = '800px'
  parentDiv.style.height = '200px'
  Object.defineProperty(parentDiv, 'clientWidth', { value: 800 })
  Object.defineProperty(parentDiv, 'clientHeight', { value: 200 })
  return {
    tagName: 'CANVAS',
    style: {} as Record<string, string>,
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    remove: vi.fn(),
    parentElement: parentDiv,
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

  describe('early-exit from draw', () => {
    it('does not throw when canvas is null (not yet initialized)', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() =>
        plugin.update({ lyrics: [], activeLineId: null, currentTime: 0 }),
      ).not.toThrow()
    })

    it('does not throw when wavesurfer is null', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() =>
        plugin.update({ lyrics: [], activeLineId: null, currentTime: 0 }),
      ).not.toThrow()
    })

    it('does not throw when duration is 0 or less', () => {
      const plugin = LineOverlayPlugin.create()
      const fakeWs = {
        getWrapper: vi.fn(() => {
          const wrapper = document.createElement('div')
          wrapper.style.width = '1600px'
          const parent = document.createElement('div')
          parent.style.width = '800px'
          parent.appendChild(wrapper)
          return wrapper
        }),
        getDuration: vi.fn(() => 0),
        on: vi.fn(() => vi.fn()),
      }
      Reflect.set(plugin, 'wavesurfer', fakeWs)

      const mockCanvas = createMockCanvas()
      Reflect.set(plugin, 'canvas', mockCanvas)

      expect(() =>
        plugin.update({ lyrics: [], activeLineId: null, currentTime: 0 }),
      ).not.toThrow()
    })
  })

  describe('update', () => {
    it('is callable and does not throw with valid params', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() =>
        plugin.update({
          lyrics: [],
          activeLineId: null,
          currentTime: 10,
        }),
      ).not.toThrow()
    })

    it('accepts lyrics with timing data', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() =>
        plugin.update({
          lyrics: [
            {
              id: 'line-1',
              startTime: 1.0,
              words: [
                { id: 'w1', text: 'hello', endTime: 1.5 },
                { id: 'w2', text: 'world', endTime: 2.0 },
              ],
            },
          ],
          activeLineId: 'line-1',
          currentTime: 1.2,
        }),
      ).not.toThrow()
    })

    it('draws word separator dashed lines in yellow', () => {
      const strokeStyles: string[] = []
      const ctx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        shadowColor: '',
        shadowBlur: 0,
        textAlign: '',
        textBaseline: '',
        font: '',
      }
      Object.defineProperty(ctx, 'strokeStyle', {
        get: () => strokeStyles.at(-1) ?? '',
        set: (value: string) => {
          strokeStyles.push(value)
        },
      })
      const plugin = LineOverlayPlugin.create()
      Reflect.set(plugin, 'wavesurfer', { getDuration: vi.fn(() => 4) })
      Reflect.set(plugin, 'canvas', createMockCanvas(ctx))
      Reflect.set(plugin, 'visibleStart', 0)
      Reflect.set(plugin, 'visibleEnd', 4)

      plugin.update({
        lyrics: [
          {
            id: 'line-1',
            startTime: 0,
            words: [
              { id: 'w1', text: 'hello', endTime: 1 },
              { id: 'w2', text: 'world', endTime: 2 },
            ],
          },
        ],
        activeLineId: 'line-1',
        currentTime: 0,
      })

      expect(strokeStyles).toContain('rgba(255, 214, 80, 0.85)')
    })
  })

  describe('destroy', () => {
    it('removes canvas and nulls reference', () => {
      const plugin = LineOverlayPlugin.create()
      const removeSpy = vi.fn()
      Reflect.set(plugin, 'canvas', { remove: removeSpy, style: {} })

      plugin.destroy()

      expect(removeSpy).toHaveBeenCalled()
      expect(Reflect.get(plugin, 'canvas')).toBeNull()
    })

    it('can be called before init without error', () => {
      const plugin = LineOverlayPlugin.create()
      expect(() => plugin.destroy()).not.toThrow()
    })
  })
})
