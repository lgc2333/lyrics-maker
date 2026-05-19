import { watchDebounced } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import type { InjectionKey, ShallowRef } from 'vue'

import { GridOverlayPlugin } from '../platform/waveform/grid-overlay-plugin'
import { createWaveSurferView } from '../platform/waveform/wavesurfer-view'
import type { WaveSurferView } from '../platform/waveform/wavesurfer-view'
import { useEditorStore } from '../stores/editor-store'

export type TimelineViewContext = ReturnType<typeof useTimelineView>
export const TIMELINE_VIEW_KEY: InjectionKey<TimelineViewContext> =
  Symbol('timelineView')

const DEFAULT_PX_PER_SEC = 100

export function useTimelineView(containerRef: ShallowRef<HTMLElement | null>) {
  const store = useEditorStore()

  // ---- Local UI state ----
  const viewMode = ref<'waveform' | 'spectrogram'>('waveform')
  const pxPerSec = ref(DEFAULT_PX_PER_SEC)
  const verticalZoom = ref(1)
  const altTripletActive = ref(false)
  const isLoading = ref(false)

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
  let lastUserScrollAt = 0
  const USER_SCROLL_COOLDOWN_MS = 500

  function _buildOverlayParams() {
    return {
      timingPoints: store.project.timingPoints,
      currentTime: store.currentTime,
      divisor: divisor.value,
      triplets: effectiveTriplets.value,
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

    // Click-to-seek: WaveSurfer fires 'interaction' with newTime when interact: true
    view.on('interaction', (time: unknown) => {
      store.seekPlayback(time as number)
    })

    // When audio is ready: hide loading spinner and draw the initial grid
    view.on('ready', () => {
      isLoading.value = false
      gridPlugin?.update(_buildOverlayParams())
    })

    if (store.audioFile) {
      isLoading.value = true
      void view.loadBlob(store.audioFile)
    }

    return view
  }

  // Initialize when container becomes available
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
        void wavesurferView.loadBlob(file)
      }
    },
  )

  // Sync grid + auto-scroll on every currentTime tick
  watch(
    () => store.currentTime,
    (t) => {
      gridPlugin?.update(_buildOverlayParams())
      if (store.isPlaying && Date.now() - lastUserScrollAt > USER_SCROLL_COOLDOWN_MS) {
        wavesurferView?.scrollTo(t)
      }
    },
  )

  // Redraw grid when timing points or divisor/triplets change
  watch(
    [() => store.project.timingPoints, divisor, effectiveTriplets],
    () => {
      gridPlugin?.update(_buildOverlayParams())
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
    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null
  })

  // ---- Public API ----

  function setViewMode(mode: 'waveform' | 'spectrogram'): void {
    const container = containerRef.value
    const scrollTime = wavesurferView?.getScrollTime() ?? 0

    wavesurferView?.destroy()
    wavesurferView = null
    gridPlugin = null

    viewMode.value = mode

    if (container) {
      const view = _initWaveSurfer(container)
      // Restore scroll position after audio reloads
      if (store.audioFile) {
        void view.loadBlob(store.audioFile).then(() => view.scrollTo(scrollTime))
      }
    }
  }

  function setVerticalZoom(v: number): void {
    verticalZoom.value = Math.max(0.5, Math.min(10, v))
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
      wavesurferView?.zoom(newPps)
    } else if (e.shiftKey) {
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
    divisor,
    rhythmMode,
    effectiveTriplets,
    altTripletActive,
    isLoading,
    setViewMode,
    setVerticalZoom,
    onWheel,
  }
}
