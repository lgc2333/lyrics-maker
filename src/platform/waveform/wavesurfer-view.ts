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

export interface TimelineVisibleRange {
  start: number
  end: number
  scrollLeft: number
  clientWidth: number
  scrollWidth: number
}

export interface WaveSurferView {
  registerPlugin: <T extends GenericPlugin>(plugin: T) => T
  loadBlob: (blob: Blob) => Promise<void>
  zoom: (pxPerSec: number, anchorClientX?: number) => void
  getWrapper: () => HTMLElement
  getScrollContainer: () => HTMLElement | null
  getDuration: () => number
  getPixelsPerSecond: () => number
  getVisibleRange: () => TimelineVisibleRange | null
  scrollTo: (time: number) => void
  scrollSeekTo: (time: number, marginRatio: number) => void
  scrollPlaybackTo: (time: number, thresholdRatio: number) => void
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
      fftSamples: 512,
      labels: true,
      useWebWorker: true,
      progressiveLoading: true,
      height,
      frequencyMax,
    })
    ws.registerPlugin(spectrogramPlugin)
  }

  function _getWrapper(): HTMLElement {
    return ws.getWrapper()
  }

  function _getScrollContainer(): HTMLElement | null {
    return _getWrapper().parentElement
  }

  function _getDuration(): number {
    return ws.getDuration()
  }

  function _getPixelsPerSecond(): number {
    const duration = _getDuration()
    if (duration <= 0) return 0
    return _getWrapper().scrollWidth / duration
  }

  function _getVisibleRange(): TimelineVisibleRange | null {
    const scrollEl = _getScrollContainer()
    const pxPerSec = _getPixelsPerSecond()
    if (!scrollEl || pxPerSec <= 0) return null

    return {
      start: scrollEl.scrollLeft / pxPerSec,
      end: (scrollEl.scrollLeft + scrollEl.clientWidth) / pxPerSec,
      scrollLeft: scrollEl.scrollLeft,
      clientWidth: scrollEl.clientWidth,
      scrollWidth: scrollEl.scrollWidth,
    }
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

    zoom(pxPerSec: number, anchorClientX?: number): void {
      const scrollEl = _getScrollContainer()
      const oldPxPerSec = _getPixelsPerSecond()
      const anchorOffset =
        scrollEl && anchorClientX !== undefined
          ? anchorClientX - scrollEl.getBoundingClientRect().left
          : null
      const anchorTime =
        scrollEl && anchorOffset !== null && oldPxPerSec > 0
          ? (scrollEl.scrollLeft + anchorOffset) / oldPxPerSec
          : null

      ws.zoom(pxPerSec)

      if (scrollEl && anchorOffset !== null && anchorTime !== null) {
        scrollEl.scrollLeft = Math.max(0, anchorTime * pxPerSec - anchorOffset)
      }
    },

    getWrapper: _getWrapper,
    getScrollContainer: _getScrollContainer,
    getDuration: _getDuration,
    getPixelsPerSecond: _getPixelsPerSecond,
    getVisibleRange: _getVisibleRange,

    scrollTo(time: number): void {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return
      const pxPerSec = _getPixelsPerSecond()
      if (pxPerSec <= 0) return
      const center = scrollEl.clientWidth / 2
      scrollEl.scrollLeft = Math.max(0, time * pxPerSec - center)
    },

    scrollSeekTo(time: number, marginRatio: number): void {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return
      const pxPerSec = _getPixelsPerSecond()
      if (pxPerSec <= 0) return
      const margin = scrollEl.clientWidth * marginRatio
      const targetX = time * pxPerSec
      const visibleX = targetX - scrollEl.scrollLeft
      const rightMargin = scrollEl.clientWidth - margin

      if (visibleX < margin) {
        scrollEl.scrollLeft = Math.max(0, targetX - margin)
      } else if (visibleX > rightMargin) {
        scrollEl.scrollLeft = Math.max(0, targetX - rightMargin)
      }
    },

    scrollPlaybackTo(time: number, thresholdRatio: number): void {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return
      const pxPerSec = _getPixelsPerSecond()
      if (pxPerSec <= 0) return

      const targetX = time * pxPerSec
      const playheadX = targetX - scrollEl.scrollLeft
      const isBeforeViewport = playheadX < 0
      const isAfterViewport = playheadX > scrollEl.clientWidth

      if (isBeforeViewport || isAfterViewport) {
        scrollEl.scrollLeft = Math.max(0, targetX - scrollEl.clientWidth / 2)
        return
      }

      const threshold = scrollEl.clientWidth * thresholdRatio
      const overflow = playheadX - threshold
      if (overflow <= 0) return

      const delta = pxPerSec <= 600 ? Math.min(overflow, 10) : overflow
      scrollEl.scrollLeft += delta
    },

    scrollByDelta(delta: number): void {
      const scrollEl = _getScrollContainer()
      if (scrollEl) scrollEl.scrollLeft += delta
    },

    getScrollTime(): number {
      const scrollEl = _getScrollContainer()
      if (!scrollEl) return 0
      const pxPerSec = _getPixelsPerSecond()
      if (pxPerSec <= 0) return 0
      return scrollEl.scrollLeft / pxPerSec
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
