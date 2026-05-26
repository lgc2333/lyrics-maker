import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TimingPoint } from '../../core/domain/project'
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

    it('clears previous grid lines but keeps drawing the playhead when timing points become empty', () => {
      const plugin = GridOverlayPlugin.create()
      const parentDiv = document.createElement('div')
      Object.defineProperty(parentDiv, 'clientWidth', { value: 800 })
      Object.defineProperty(parentDiv, 'clientHeight', { value: 200 })

      const clearRect = vi.fn()
      const ctx = {
        clearRect,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      }
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ctx),
        parentElement: parentDiv,
      }
      const fakeWs = {
        getDuration: vi.fn(() => 10),
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

      Reflect.set(plugin, 'wavesurfer', fakeWs)
      Reflect.set(plugin, 'canvas', canvas)
      Reflect.set(plugin, 'visibleStart', 0)
      Reflect.set(plugin, 'visibleEnd', 10)

      plugin.update({
        timingPoints,
        currentTime: 1,
        divisor: 4,
        triplets: false,
      })
      clearRect.mockClear()
      ctx.beginPath.mockClear()
      ctx.moveTo.mockClear()
      ctx.lineTo.mockClear()
      ctx.stroke.mockClear()

      plugin.update({
        timingPoints: [],
        currentTime: 1,
        divisor: 4,
        triplets: false,
      })

      expect(clearRect).toHaveBeenCalledWith(0, 0, 800, 200)
      expect(ctx.moveTo).toHaveBeenCalledWith(80.5, 0)
      expect(ctx.lineTo).toHaveBeenCalledWith(80.5, 200)
      expect(ctx.stroke).toHaveBeenCalledOnce()
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
