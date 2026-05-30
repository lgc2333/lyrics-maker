import { useDebounceFn, watchDebounced } from '@vueuse/core'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'
import type { InjectionKey, MaybeRefOrGetter, ShallowRef } from 'vue'

import type { BoundaryDragIntent } from '../core/lyrics/boundary-bounds'
import {
  BOUNDARY_DRAG_EPSILON,
  getDragClampBounds,
} from '../core/lyrics/boundary-bounds'
import { computeSnappedTime } from '../core/lyrics/snap-time'
import { formatTimestamp } from '../core/utils/format-timestamp'
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

interface UseTimelineViewOptions {
  onExplicitSeek?: (time: number) => void
  onBoundaryDragStart?: (intent: BoundaryDragIntent) => void
  activeLyricSelection?: MaybeRefOrGetter<{
    lineId: string | null
    wordIndex: number
  }>
}

export function useTimelineView(
  containerRef: ShallowRef<HTMLElement | null>,
  options: UseTimelineViewOptions = {},
) {
  const store = useEditorStore()
  const activeTheme = ref<'light' | 'dark'>('light')

  // ---- Local UI state ----
  const viewMode = ref<'waveform' | 'spectrogram'>('waveform')
  const pxPerSec = ref(DEFAULT_PX_PER_SEC)
  const verticalZoom = ref(1)
  const autoFollowPlayback = ref(true)
  const altTripletActive = ref(false)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const activeLyricSelection = toRef(
    options.activeLyricSelection ?? { lineId: null, wordIndex: 0 },
  )

  // ---- Project-persisted state (via store/commands) ----
  const divisor = computed({
    get: () => store.snapDivisor,
    set: (v: 1 | 2 | 4 | 8 | 16) => store.setSnapDivisor(v),
  })

  const rhythmMode = computed({
    get: () => store.rhythmMode,
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
  let dragSession: {
    intent: BoundaryDragIntent
    originalTime: number
    lastSnappedTime: number
  } | null = null
  let suppressAutoFollow = false
  let lineOverlayDragUnsubscribers: Array<() => void> = []
  const USER_SCROLL_COOLDOWN_MS = 1000

  function _buildOverlayParams() {
    return {
      timingPoints: store.project.timingPoints,
      divisor: divisor.value,
      triplets: effectiveTriplets.value,
      theme: activeTheme.value,
      viewMode: viewMode.value,
      visible: store.gridVisible,
    }
  }

  function _buildLineOverlayParams() {
    const selection = toValue(activeLyricSelection)
    return {
      lyrics: store.project.lyrics,
      activeLineId: selection.lineId,
      activeWordIndex: selection.wordIndex,
      theme: activeTheme.value,
      viewMode: viewMode.value,
      duration: store.duration,
    }
  }

  function _buildPlayheadParams() {
    return {
      currentTime: store.currentTime,
      theme: activeTheme.value,
      viewMode: viewMode.value,
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
    _subscribeLineOverlayDragEvents(lineOverlayPlugin)
    playheadPlugin = view.registerPlugin(
      PlayheadOverlayPlugin.create({ outerContainer: container }),
    )

    // Click-to-seek: WaveSurfer fires 'interaction' with newTime when interact: true
    view.on('interaction', (time: unknown) => {
      const seekTime = time as number
      options.onExplicitSeek?.(seekTime)
      store.seekPlayback(seekTime)
    })

    // When audio is ready: hide loading spinner and draw the initial grid
    view.on('ready', () => {
      isLoading.value = false
      gridPlugin?.update(_buildOverlayParams())
      lineOverlayPlugin?.update(_buildLineOverlayParams())
      playheadPlugin?.update(_buildPlayheadParams())
    })

    const refreshPlayhead = () => {
      playheadPlugin?.update(_buildPlayheadParams())
    }

    view.on('scroll', refreshPlayhead)
    view.on('zoom', refreshPlayhead)
    view.on('redraw', refreshPlayhead)
    view.on('resize', refreshPlayhead)

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
        !suppressAutoFollow &&
        store.isPlaying &&
        Date.now() - lastUserScrollAt > USER_SCROLL_COOLDOWN_MS
      ) {
        wavesurferView?.scrollPlaybackTo(t, PLAYBACK_FOLLOW_THRESHOLD_RATIO)
        playheadPlugin?.update(_buildPlayheadParams())
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
    [
      () => store.project.timingPoints,
      divisor,
      effectiveTriplets,
      () => store.gridVisible,
    ],
    () => {
      gridPlugin?.update(_buildOverlayParams())
      lineOverlayPlugin?.update(_buildLineOverlayParams())
    },
    { deep: true },
  )

  watch(
    [activeTheme, viewMode],
    () => {
      gridPlugin?.update(_buildOverlayParams())
      lineOverlayPlugin?.update(_buildLineOverlayParams())
      playheadPlugin?.update(_buildPlayheadParams())
    },
    { immediate: false },
  )

  // Redraw line overlay when lyrics data changes
  watch(
    [() => store.project.lyrics, activeLyricSelection],
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
      if (altTripletActive.value) return
      altTripletActive.value = true
      store.showStatus('status.settings.rhythmModeTemporary', { mode: 'triplets' })
    }
  }
  function _onKeyup(e: KeyboardEvent): void {
    if (e.key === 'Alt' && altTripletActive.value) {
      altTripletActive.value = false
      store.showStatus('status.settings.rhythmMode', { mode: rhythmMode.value })
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', _onKeydown)
    window.addEventListener('keyup', _onKeyup)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', _onKeydown)
    window.removeEventListener('keyup', _onKeyup)
    _clearDragSession()
    _teardownLineOverlayDragSubscriptions()
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

    _clearDragSession()
    _teardownLineOverlayDragSubscriptions()
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

  function setTheme(nextTheme: 'light' | 'dark'): void {
    activeTheme.value = nextTheme
  }

  function _readTimeForIntent(intent: BoundaryDragIntent): number | undefined {
    const line = store.project.lyrics.find((item) => item.id === intent.lineId)
    if (!line) return undefined
    if (intent.kind === 'line-start') return line.startTime
    return line.words.find((word) => word.id === intent.wordId)?.endTime
  }

  function _collectExistingEndTimes(intent: BoundaryDragIntent): number[] {
    const line = store.project.lyrics.find((item) => item.id === intent.lineId)
    if (!line) return []
    return line.words
      .filter((word) => {
        if (intent.kind === 'line-start') return true
        return word.id !== intent.wordId
      })
      .map((word) => word.endTime)
      .filter((time): time is number => time !== undefined)
  }

  function _teardownLineOverlayDragSubscriptions(): void {
    for (const off of lineOverlayDragUnsubscribers) off()
    lineOverlayDragUnsubscribers = []
  }

  function _subscribeLineOverlayDragEvents(plugin: LineOverlayPlugin): void {
    _teardownLineOverlayDragSubscriptions()
    lineOverlayDragUnsubscribers = [
      plugin.on('boundaryDragStart', _handleBoundaryDragStart),
      plugin.on('boundaryDragMove', _handleBoundaryDragMove),
      plugin.on('boundaryDragEnd', _handleBoundaryDragEnd),
      plugin.on('boundaryDragCancel', _handleBoundaryDragCancel),
    ]
  }

  function _handleBoundaryDragStart({ intent }: { intent: BoundaryDragIntent }): void {
    const originalTime = _readTimeForIntent(intent)
    if (originalTime === undefined || store.duration <= 0) return
    dragSession = {
      intent,
      originalTime,
      lastSnappedTime: Number.NaN,
    }
    suppressAutoFollow = true
    options.onBoundaryDragStart?.(intent)
  }

  function _handleBoundaryDragMove({
    intent,
    rawTime,
  }: {
    intent: BoundaryDragIntent
    rawTime: number
  }): void {
    if (!dragSession || !_isSameIntent(dragSession.intent, intent)) return
    const clamped = _computeBoundaryDragTime(intent, rawTime)
    if (clamped === dragSession.lastSnappedTime) return
    dragSession.lastSnappedTime = clamped
    lineOverlayPlugin?.update({
      ..._buildLineOverlayParams(),
      dragPreview: { intent, time: clamped },
    })
  }

  function _computeBoundaryDragTime(
    intent: BoundaryDragIntent,
    rawTime: number,
  ): number {
    const snapped = computeSnappedTime({
      rawTime,
      snapEnabled: store.snapEnabled,
      timingPoints: store.project.timingPoints,
      divisor: divisor.value,
      triplets: effectiveTriplets.value,
      existingEndTimes: _collectExistingEndTimes(intent),
    })
    const { min, max } = getDragClampBounds(
      intent,
      store.project.lyrics,
      store.duration,
    )
    return Math.max(min, Math.min(max, snapped))
  }

  function _handleBoundaryDragEnd({
    intent,
    rawTime,
  }: {
    intent: BoundaryDragIntent
    rawTime: number
  }): void {
    if (!dragSession || !_isSameIntent(dragSession.intent, intent)) return
    const session = dragSession
    dragSession = null
    suppressAutoFollow = false
    if (_readTimeForIntent(session.intent) === undefined) {
      lineOverlayPlugin?.update(_buildLineOverlayParams())
      return
    }

    const finalTime = _computeBoundaryDragTime(session.intent, rawTime)
    lineOverlayPlugin?.update(_buildLineOverlayParams())
    if (Math.abs(finalTime - session.originalTime) < BOUNDARY_DRAG_EPSILON) return
    _commitBoundary(session.intent, finalTime)
  }

  function _handleBoundaryDragCancel(): void {
    _clearDragSession()
    lineOverlayPlugin?.update(_buildLineOverlayParams())
  }

  function _clearDragSession(): void {
    dragSession = null
    suppressAutoFollow = false
  }

  function _commitBoundary(intent: BoundaryDragIntent, time: number): void {
    if (intent.kind === 'line-start') {
      store.setLineStartTime(intent.lineId, time)
      store.showStatus('status.lyrics.dragLineStart', {
        time: formatTimestamp(time),
      })
      return
    }

    store.setWordEndTime(intent.lineId, intent.wordId, time)
    store.showStatus(
      intent.kind === 'line-end'
        ? 'status.lyrics.dragLineEnd'
        : 'status.lyrics.dragWordEnd',
      { time: formatTimestamp(time) },
    )
  }

  function _isSameIntent(a: BoundaryDragIntent, b: BoundaryDragIntent): boolean {
    if (a.kind !== b.kind || a.lineId !== b.lineId) return false
    if ('wordId' in a || 'wordId' in b) {
      return 'wordId' in a && 'wordId' in b && a.wordId === b.wordId
    }
    return true
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
    setTheme,
    onWheel,
  }
}
