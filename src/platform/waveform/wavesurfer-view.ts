import WaveSurfer from 'wavesurfer.js'
import type { GenericPlugin } from 'wavesurfer.js/dist/base-plugin.js'
import WindowedSpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js'

export interface WaveSurferViewOptions {
  mode: 'waveform' | 'spectrogram'
  minPxPerSec: number
  /** Height in pixels for the spectrogram canvas (defaults to container height or 256). */
  spectrogramHeight?: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number) => void
  scrollTo: (time: number) => void
  scrollByDelta: (delta: number) => void
  getScrollTime: () => number
  on: (event: string, handler: (...args: unknown[]) => void) => () => void
  destroy: () => void
}

export function createWaveSurferView(
  container: HTMLElement,
  options: WaveSurferViewOptions,
): WaveSurferView {
  const ws = WaveSurfer.create({
    container,
    waveColor: '#4F4A85',
    // Transparent progress overlay — we draw our own playhead via GridOverlayPlugin
    progressColor: 'transparent',
    // In spectrogram mode, suppress the waveform canvas (height 0 = invisible)
    height: options.mode === 'spectrogram' ? 0 : 'auto',
    minPxPerSec: options.minPxPerSec,
    interact: true,
    // Hide WaveSurfer's built-in scrollbar — we control scrolling ourselves
    hideScrollbar: true,
  })

  if (options.mode === 'spectrogram') {
    const height = options.spectrogramHeight ?? (container.clientHeight || 256)
    ws.registerPlugin(
      WindowedSpectrogramPlugin.create({
        fftSamples: 1024,
        labels: true,
        useWebWorker: true,
        height,
      }),
    )
  }

  function _getScrollContainer(): HTMLElement | null {
    return ws.getWrapper().parentElement
  }

  return {
    registerPlugin<T extends GenericPlugin>(plugin: T): T {
      return ws.registerPlugin(plugin)
    },

    async loadBlob(blob: Blob): Promise<void> {
      await ws.loadBlob(blob)
    },

    zoom(pxPerSec: number): void {
      ws.zoom(pxPerSec)
    },

    scrollTo(time: number): void {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return
      const duration = ws.getDuration()
      if (duration <= 0) return
      const wrapper = ws.getWrapper()
      const pxPerSec = wrapper.scrollWidth / duration
      const center = scrollEl.clientWidth / 2
      scrollEl.scrollLeft = Math.max(0, time * pxPerSec - center)
    },

    scrollByDelta(delta: number): void {
      const scrollEl = _getScrollContainer()
      if (scrollEl) scrollEl.scrollLeft += delta
    },

    getScrollTime(): number {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return 0
      const duration = ws.getDuration()
      if (duration <= 0) return 0
      const wrapper = ws.getWrapper()
      return (scrollEl.scrollLeft / wrapper.scrollWidth) * duration
    },

    on(event: string, handler: (...args: unknown[]) => void): () => void {
      return ws.on(event as Parameters<typeof ws.on>[0], handler as never)
    },

    destroy(): void {
      ws.destroy()
    },
  }
}
