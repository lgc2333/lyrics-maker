import WaveSurfer from 'wavesurfer.js'
import type { GenericPlugin } from 'wavesurfer.js/dist/base-plugin.js'
import WindowedSpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js'

export interface WaveSurferViewOptions {
  mode: 'waveform' | 'spectrogram'
  minPxPerSec: number
  /** Height in pixels for the spectrogram canvas (defaults to container height or 256). */
  spectrogramHeight?: number
  /**
   * Vertical zoom multiplier for the spectrogram.
   * Divides the Nyquist frequency to narrow the displayed frequency range.
   * 1 = full range (~22 kHz); 2 = lower half (~11 kHz), etc.
   */
  verticalZoom?: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number) => void
  scrollTo: (time: number) => void
  scrollByDelta: (delta: number) => void
  getScrollTime: () => number
  /** CSS-only resize for smooth visual updates during drag. */
  setContainerHeight: (height: number) => void
  /** Pixel-accurate resize + spectrogram re-render. Debounce to ~300ms. */
  syncContainerHeight: (height: number) => Promise<void>
  on: (event: string, handler: (...args: unknown[]) => void) => () => void
  destroy: () => void
}

export function createWaveSurferView(
  container: HTMLElement,
  options: WaveSurferViewOptions,
): WaveSurferView {
  const ws = WaveSurfer.create({
    container,
    // In spectrogram mode, collapse and hide the waveform canvas entirely
    waveColor: options.mode === 'spectrogram' ? 'transparent' : '#4F4A85',
    // In waveform mode, match waveColor so the "played" overlay is invisible —
    // GridOverlayPlugin draws the playhead. In spectrogram mode transparent is fine.
    progressColor: options.mode === 'spectrogram' ? 'transparent' : '#4F4A85',
    // In spectrogram mode, suppress the waveform canvas (height 0 = invisible)
    height: options.mode === 'spectrogram' ? 0 : 'auto',
    minPxPerSec: options.minPxPerSec,
    interact: true,
    // Hide WaveSurfer's built-in scrollbar — we control scrolling ourselves
    hideScrollbar: true,
  })

  let spectrogramPlugin: WindowedSpectrogramPlugin | null = null

  if (options.mode === 'spectrogram') {
    const height = options.spectrogramHeight ?? (container.clientHeight || 256)
    const nyquist = 22050
    const frequencyMax = Math.round(nyquist / (options.verticalZoom ?? 1))
    spectrogramPlugin = WindowedSpectrogramPlugin.create({
      fftSamples: 1024,
      labels: true,
      useWebWorker: true,
      height,
      frequencyMax,
    })
    ws.registerPlugin(spectrogramPlugin)
  }

  function _getScrollContainer(): HTMLElement | null {
    return ws.getWrapper().parentElement
  }

  return {
    registerPlugin<T extends GenericPlugin>(plugin: T): T {
      return ws.registerPlugin(plugin)
    },

    async loadBlob(blob: Blob): Promise<void> {
      try {
        await ws.loadBlob(blob)
      } catch (error) {
        throw new Error(
          `Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { cause: error },
        )
      }
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

    setContainerHeight(height: number): void {
      if (options.mode === 'waveform') {
        ws.setOptions({ height })
      } else if (spectrogramPlugin) {
        // CSS-only stretch for smooth visual feedback during drag
        const plugin = spectrogramPlugin as unknown as {
          wrapper: HTMLElement
          canvasContainer: HTMLElement
        }
        plugin.wrapper.style.height = `${height}px`
        const canvas = plugin.canvasContainer.querySelector('canvas')
        if (canvas) canvas.style.height = `${height}px`
      }
    },

    async syncContainerHeight(height: number): Promise<void> {
      if (options.mode !== 'spectrogram' || !spectrogramPlugin) return

      const plugin = spectrogramPlugin as unknown as {
        height: number
        wrapper: HTMLElement
        canvasContainer: HTMLElement
      }
      plugin.height = height
      plugin.wrapper.style.height = `${height}px`

      const canvas = plugin.canvasContainer.querySelector('canvas')
      if (canvas) {
        canvas.height = height
        canvas.style.height = `${height}px`
      }

      const audio = ws.getDecodedData()
      if (audio) {
        await spectrogramPlugin.render(audio)
      }
    },

    destroy(): void {
      ws.destroy()
    },
  }
}
