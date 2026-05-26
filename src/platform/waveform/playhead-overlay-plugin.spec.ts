import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayheadOverlayPlugin } from './playhead-overlay-plugin'

function createFakeWs(duration = 10) {
  const outerContainer = document.createElement('div')
  Object.defineProperty(outerContainer, 'clientHeight', { value: 200 })
  const scrollContainer = document.createElement('div')
  Object.defineProperty(scrollContainer, 'clientWidth', { value: 800 })
  Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1600 })
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'scrollWidth', { value: 1600, configurable: true })
  scrollContainer.appendChild(wrapper)
  outerContainer.appendChild(scrollContainer)

  return {
    outerContainer,
    scrollContainer,
    wrapper,
    ws: {
      getWrapper: vi.fn(() => wrapper),
      getDuration: vi.fn(() => duration),
      on: vi.fn(() => vi.fn()),
    },
  }
}

describe('playheadOverlayPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends a viewport-fixed playhead to the outer container', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })

    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    const line = outerContainer.querySelector('[data-testid="timeline-playhead"]')
    expect(line).toBeInstanceOf(HTMLDivElement)
    expect((line as HTMLElement).style.position).toBe('absolute')
    expect((line as HTMLElement).style.pointerEvents).toBe('none')
    expect(
      outerContainer.querySelector('[data-testid="timeline-playhead-marker-top"]'),
    ).not.toBeNull()
    expect(
      outerContainer.querySelector('[data-testid="timeline-playhead-marker-bottom"]'),
    ).not.toBeNull()
    expect(
      outerContainer.querySelector<HTMLElement>(
        '[data-testid="timeline-playhead-marker-top"]',
      )?.style.width,
    ).toBe('11px')
    expect(
      outerContainer.querySelector<HTMLElement>(
        '[data-testid="timeline-playhead-marker-top"]',
      )?.style.height,
    ).toBe('9px')
    expect(
      outerContainer.querySelector<HTMLElement>(
        '[data-testid="timeline-playhead-marker-top"]',
      )?.style.clipPath,
    ).toBe('polygon(0px 0px, 100% 0px, 50% 100%, 50% 100%)')
  })

  it('updates viewport x with transform from current time and scrollLeft', () => {
    const { outerContainer, scrollContainer, ws } = createFakeWs()
    scrollContainer.scrollLeft = 200
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.update({ currentTime: 2 })

    const line = outerContainer.querySelector(
      '[data-testid="timeline-playhead"]',
    ) as HTMLElement
    expect(line.style.transform).toBe('translateX(120px)')
    expect(line.style.display).toBe('block')
  })

  it('preserves subpixel x positions to avoid playhead jitter', () => {
    const { outerContainer, scrollContainer, wrapper, ws } = createFakeWs()
    Object.defineProperty(wrapper, 'scrollWidth', { value: 1001, configurable: true })
    scrollContainer.scrollLeft = 200.25
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.update({ currentTime: 2 })

    const line = outerContainer.querySelector(
      '[data-testid="timeline-playhead"]',
    ) as HTMLElement
    expect(line.style.transform).toBe('translateX(-0.05px)')
  })

  it('remains independent of timing points', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    expect(() => plugin.update({ currentTime: 1 })).not.toThrow()
    expect(
      outerContainer.querySelector('[data-testid="timeline-playhead"]'),
    ).not.toBeNull()
  })

  it('hides when duration is invalid', () => {
    const { outerContainer, ws } = createFakeWs(0)
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.update({ currentTime: 1 })

    const line = outerContainer.querySelector(
      '[data-testid="timeline-playhead"]',
    ) as HTMLElement
    expect(line.style.display).toBe('none')
  })

  it('removes DOM on destroy', () => {
    const { outerContainer, ws } = createFakeWs()
    const plugin = PlayheadOverlayPlugin.create({ outerContainer })
    Reflect.set(plugin, 'wavesurfer', ws)
    Reflect.get(plugin, 'onInit').call(plugin)

    plugin.destroy()

    expect(outerContainer.querySelector('[data-testid="timeline-playhead"]')).toBeNull()
  })
})
