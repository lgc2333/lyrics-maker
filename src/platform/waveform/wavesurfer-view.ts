import WaveSurfer from 'wavesurfer.js'
import type { GenericPlugin } from 'wavesurfer.js/dist/base-plugin.js'

export interface WaveSurferViewOptions {
  mode: 'waveform' | 'spectrogram'
  minPxPerSec: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number) => void
  scrollTo: (time: number) => void
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
    progressColor: '#383351',
    height: 'auto',
    minPxPerSec: options.minPxPerSec,
    interact: false,
    hideScrollbar: false,
  })

  if (options.mode === 'spectrogram') {
    void _initSpectrogram(ws)
  }

  async function _initSpectrogram(instance: WaveSurfer): Promise<void> {
    try {
      const { default: SpectrogramPlugin } = await import(
        /* @vite-ignore */ 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
      )
      instance.registerPlugin(
        SpectrogramPlugin.create({
          fftSamples: 1024,
          labels: true,
        }),
      )
    } catch {
      // Spectrogram plugin unavailable; gracefully degrade to waveform only
    }
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
