import { afterEach, describe, expect, it, vi } from 'vitest'

import { GridOverlayPlugin } from './grid-overlay-plugin'
import type { GridOverlayOptions } from './grid-overlay-plugin'

function createMockCanvas() {
  const parentDiv = document.createElement('div')
  parentDiv.style.width = '800px'
  parentDiv.style.height = '200px'
  return {
    tagName: 'CANVAS',
    style: {} as Record<string, string>,
    width: 0,
    height: 0,
    getContext: vi.fn(() => null),
    remove: vi.fn(),
    parentElement: parentDiv,
  }
}

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

  describe('early-exit from draw', () => {
    it('does not throw when canvas is null (not yet initialized)', () => {
      const plugin = GridOverlayPlugin.create()
      expect(() =>
        plugin.update({
          timingPoints: [],
          currentTime: 0,
          divisor: 4,
          triplets: false,
        }),
      ).not.toThrow()
    })

    it('does not throw when wavesurfer is null', () => {
      const plugin = GridOverlayPlugin.create()
      expect(() =>
        plugin.update({
          timingPoints: [],
          currentTime: 0,
          divisor: 4,
          triplets: false,
        }),
      ).not.toThrow()
    })

    it('does not throw when duration is 0 or less', () => {
      const plugin = GridOverlayPlugin.create()
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
        plugin.update({
          timingPoints: [],
          currentTime: 0,
          divisor: 4,
          triplets: false,
        }),
      ).not.toThrow()
    })
  })

  describe('update', () => {
    it('is callable and does not throw with valid params', () => {
      const plugin = GridOverlayPlugin.create()
      expect(() =>
        plugin.update({
          timingPoints: [],
          currentTime: 10,
          divisor: 4,
          triplets: false,
        }),
      ).not.toThrow()
    })
  })

  describe('destroy', () => {
    it('removes canvas and nulls reference', () => {
      const plugin = GridOverlayPlugin.create()
      const removeSpy = vi.fn()
      Reflect.set(plugin, 'canvas', { remove: removeSpy, style: {} })

      plugin.destroy()

      expect(removeSpy).toHaveBeenCalled()
      expect(Reflect.get(plugin, 'canvas')).toBeNull()
    })
  })
})
