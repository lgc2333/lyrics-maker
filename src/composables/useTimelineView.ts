import { useDebounceFn, watchDebounced } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import type { InjectionKey, ShallowRef } from 'vue'

import { GridOverlayPlugin } from '../platform/waveform/grid-overlay-plugin'
import { LineOverlayPlugin } from '../platform/waveform/line-overlay-plugin'
import { PlayheadOverlayPlugin } from '../platform/waveform/playhead-overlay-plugin'
import { createWaveSurferView } from '../platform/waveform/wavesurfer-view'
import type { WaveSurferView } from '../platform/waveform/wavesurfer-view'
import { useEditorStore } from '../stores/editor-store'

export type TimelineViewContext = ReturnType<typeof useTimelineView>
export const TIMELINE_VIEW_KEY: InjectionKey<TimelineViewContext> =
  Symbol('timelineView')

const DEFAULT_PX_PER_SEC = 100
const PLAYBACK_FOLLOW_THRESHOLD_RATIO = 0.5
const SEEK_SCROLL_MARGIN_RATIO = 0.1

export function useTimelineView(containerRef: ShallowRef<HTMLElement | null>) {
  const store = useEditorStore()

  // ---- Local UI state ----
  const viewMode = ref<'waveform' | 'spectrogram'>('waveform')
  const pxPerSec = ref(DEFAULT_PX_PER_SEC)
  const verticalZoom = ref(1)
  const autoFollowPlayback = ref(true)
  const altTripletActive = ref(false)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  // ---- Project-persisted state (via store/commands) ----
  const divisor = computed({
    get: () => store.project.settings.snapDivisor,
    set: (v: 1 | 2 | 4 | 8 | 16) => store.setSnapDivisor(v),
  })

  const rhythmMode = computed({
    get: () => store.project.settings.rhythmMode,
    set: (v: 'common' | 'triplets') => store.setRhythmMode(v),
  })

  const effectiveTriplets = computed(
    () => rhythmMode.value === 'triplets' || altTripletActive.value,
  )

  // ---- WaveSurfer state ----
  let wavesurferView: WaveSurferView | null = null
  let gridPlugin: GridOverlayPlugin | null = null
  let lineOverlayPlugin: LineOverlayPlugin | null = null
  let playheadPlugin: PlayheadOverlayPlugin | null = null
  let lastUserScrollAt = 0
  let resizeObserver: ResizeObserver | null = null
  const USER_SCROLL_COOLDOWN_MS = 500

  function _buildOverlayParams() {
    return {
      timingPoints: store.project.timingPoints,
      divisor: divisor.value,
      triplets: effectiveTriplets.value,
    }
  }

  function _buildLineOverlayParams() {
    return {
      lyrics: store.project.lyrics,
      activeLineId: null as string | null,
      currentTime: store.currentTime,
    }
  }

  function _buildPlayheadParams() {
    return {
      currentTime: store.currentTime,
    }
  }

  function _initWaveSurfer(container: HTMLElement): WaveSurferView {
    const view = createWaveSurferView(container, {
      mode: viewMode.value,
      minPxPerSec: pxPerSec.value,
      spectrogramHeight: container.clientHeight || 256,
      verticalZoom: verticalZoom.value,
    })
    wavesurferView = view
    gridPlugin = view.registerPlugin(
      GridOverlayPlugin.create({ outerContainer: container }),
    )
    lineOverlayPlugin = view.registerPlugin(
      LineOverlayPlugin.create({ outerContainer: container }),
    )
    playheadPlugin = view.registerPlugin(
      PlayheadOverlayPlugin.create({ outerContainer: container }),
    )

    // Click-to-seek: WaveSurfer fires 'interaction' with newTime when interact: true
    view.on('interaction', (time: unknown) => {
      store.seekPlayback(time as number)
    })

    // When audio is ready: hide loading spinner and draw the initial grid
    view.on('ready', () => {
      isLoading.value = false
      gridPlugin?.update(_buildOverlayParams())
      lineOverlayPlugin?.update(_buildLineOverlayParams())
      playheadPlugin?.update(_buildPlayheadParams())
    })

    // Observe container height changes so spectrogram/waveform canvases
    // resize with the drag handle.
    resizeObserver?.disconnect()
    const debouncedSync = useDebounceFn((h: number) => {
      wavesurferView?.syncContainerHeight(h).catch((err) => {
        console.error('Failed to sync spectrogram height:', err)
      })
    }, 300)
    resizeObserver = new ResizeObserver((entries) => {
      const h = entries[0]?.contentBoxSize[0]?.blockSize
      if (h && h > 0) {
        // CSS stretch immediately for smooth visual feedback during drag
        wavesurferView?.setContainerHeight(h)
        // Pixel-accurate resize + spectrogram re-render debounced to 300ms
        debouncedSync(h)
      }
    })
    resizeObserver.observe(container)

    if (store.audioFile) {
      isLoading.value = true
      void view.loadBlob(store.audioFile).catch((err) => {
        console.error('Failed to load audio in initWaveSurfer:', err)
        loadError.value = err instanceof Error ? err.message : 'Unknown error'
        isLoading.value = false
      })
    }

    return view
  }

  // Initialize when container becomes available
  // wavesurferView is a plain variable (not reactive).
  // This watchEffect only re-runs when containerRef changes, preventing a double-init race
  // when setViewMode() sets wavesurferView = null before re-initializing.
  watchEffect(() => {
    const container = containerRef.value
    if (container && !wavesurferView) {
      _initWaveSurfer(container)
    }
  })

  // Re-load audio when a new file is imported
  watch(
    () => store.audioFile,
    (file) => {
      if (file && wavesurferView) {
        isLoading.value = true
        void wavesurferView.loadBlob(file).catch((err) => {
          console.error('Failed to load audio on file change:', err)
          loadError.value = err instanceof Error ? err.message : 'Unknown error'
          isLoading.value = false
        })
      }
    },
  )

  // Sync playhead + auto-scroll on every currentTime tick.
  // Grid and lyric overlays are static relative to timeline content.
  watch(
    () => store.currentTime,
    (t) => {
      playheadPlugin?.update(_buildPlayheadParams())
      if (
        autoFollowPlayback.value &&
        store.isPlaying &&
        Date.now() - lastUserScrollAt > USER_SCROLL_COOLDOWN_MS
      ) {
        wavesurferView?.scrollPlaybackTo(t, PLAYBACK_FOLLOW_THRESHOLD_RATIO)
      }
    },
  )

  watch(
    () => store.seekRequest.version,
    (version) => {
      if (version === 0) return
      wavesurferView?.scrollSeekTo(store.seekRequest.time, SEEK_SCROLL_MARGIN_RATIO)
    },
  )

  // Redraw grid when timing points or divisor/triplets change
  watch(
    [() => store.project.timingPoints, divisor, effectiveTriplets],
    () => {
      gridPlugin?.update(_buildOverlayParams())
      lineOverlayPlugin?.update(_buildLineOverlayParams())
    },
    { deep: true },
  )

  // Redraw line overlay when lyrics data changes
  watch(
    () => store.project.lyrics,
    () => {
      lineOverlayPlugin?.update(_buildLineOverlayParams())
    },
    { deep: true },
  )

  // Reinitialize spectrogram when verticalZoom changes (debounced to avoid rapid rebuilds)
  watchDebounced(
    verticalZoom,
    () => {
      if (viewMode.value === 'spectrogram') {
        setViewMode('spectrogram')
      }
    },
    { debounce: 300 },
  )

  // ---- Alt key tracking ----
  function _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Alt') {
      // Prevent browser from intercepting Alt (e.g. Windows menu bar focus),
      // which would steal focus and block subsequent Alt keydown events.
      e.preventDefault()
      altTripletActive.value = true
    }
  }
  function _onKeyup(e: KeyboardEvent): void {
    if (e.key === 'Alt') altTripletActive.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', _onKeydown)
    window.addEventListener('keyup', _onKeyup)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', _onKeydown)
    window.removeEventListener('keyup', _onKeyup)
    resizeObserver?.disconnect()
    resizeObserver = null
    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null
    lineOverlayPlugin = null
    playheadPlugin = null
  })

  // ---- Public API ----

  function setViewMode(mode: 'waveform' | 'spectrogram'): void {
    const container = containerRef.value
    const scrollTime = wavesurferView?.getScrollTime() ?? 0

    resizeObserver?.disconnect()
    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null
    lineOverlayPlugin = null
    playheadPlugin = null

    viewMode.value = mode

    if (container) {
      const view = _initWaveSurfer(container)
      // Restore scroll position after audio reloads
      if (store.audioFile) {
        void view
          .loadBlob(store.audioFile)
          .then(() => view.scrollTo(scrollTime))
          .catch((err) => {
            console.error('Failed to load audio in setViewMode:', err)
            loadError.value = err instanceof Error ? err.message : 'Unknown error'
            isLoading.value = false
          })
      }
    }
  }

  function setVerticalZoom(v: number): void {
    verticalZoom.value = Math.max(0.5, Math.min(10, v))
  }

  function setAutoFollowPlayback(enabled: boolean): void {
    autoFollowPlayback.value = enabled
  }

  /**
   * Wheel event handler for the waveform container.
   * Ctrl+wheel → horizontal zoom; Shift+wheel → subdivision divisor change;
   * plain wheel → horizontal scroll relay to WaveSurfer scroll container.
   */
  function onWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      const newPps = Math.max(10, Math.min(2000, pxPerSec.value * factor))
      pxPerSec.value = newPps
      wavesurferView?.zoom(newPps, e.clientX)
    } else if (e.shiftKey) {
      if (!store.hasAudio) {
        store.showStatus('status.audioRequired', {
          action: e.deltaY < 0 ? 'transport.nextBeat' : 'transport.prevBeat',
        })
        return
      }
      const options = [1, 2, 4, 8, 16] as const
      const idx = options.indexOf(divisor.value as (typeof options)[number])
      if (e.deltaY < 0 && idx < options.length - 1) {
        store.setSnapDivisor(options[idx + 1])
      } else if (e.deltaY > 0 && idx > 0) {
        store.setSnapDivisor(options[idx - 1])
      }
    } else {
      // Plain scroll: relay vertical deltaY as horizontal scroll
      lastUserScrollAt = Date.now()
      wavesurferView?.scrollByDelta(e.deltaY)
    }
  }

  return {
    viewMode,
    pxPerSec,
    verticalZoom,
    autoFollowPlayback,
    divisor,
    rhythmMode,
    effectiveTriplets,
    altTripletActive,
    isLoading,
    loadError,
    setViewMode,
    setVerticalZoom,
    setAutoFollowPlayback,
    onWheel,
  }
}
