import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'

import { createCommandHistory } from '../core/commands/history'
import {
  createAddLyricLineCommand,
  createAddTimingPointCommand,
  createRemoveTimingPointCommand,
  createSetAudioVolumeCommand,
  createUpdateTimingPointCommand,
} from '../core/commands/project-commands'
import { createEmptyProject } from '../core/domain/project'
import type { ProjectDocument, TimingPoint } from '../core/domain/project'
import { createTapBpmEstimator } from '../core/timing/tap-bpm'
import {
  getActiveTimingPoint,
  getBeatInfoAtTime,
  getNextBeatTime,
} from '../core/timing/timing-engine'
import type { AudioTransport } from '../platform/audio/audio-transport'
import { createAudioTransport } from '../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../platform/audio/metronome'
import { createMetronome } from '../platform/audio/metronome'
import type { SaveResult } from '../platform/persistence/project-file-service'

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export interface ProjectFileService {
  saveAs: (content: string) => Promise<SaveResult>
}

// ---------------------------------------------------------------------------
// Dependency injection for testability
// ---------------------------------------------------------------------------

/**
 * No-argument factories so that browser constructors (new Audio, new AudioContext)
 * are called inside the factory body, never at the call site. This allows tests
 * to replace the entire factory without pulling in browser-only globals.
 */
let _audioTransportFactory: () => AudioTransport = () =>
  createAudioTransport(new Audio())
let _metronomeFactory: () => MetronomeScheduler = () =>
  createMetronome(new AudioContext())

/**
 * Override the AudioTransport factory (for testing).
 * Pass a no-arg function that returns a mock AudioTransport.
 */
export function __overrideAudioTransportFactory(factory: () => AudioTransport): void {
  _audioTransportFactory = factory
}

/**
 * Override the MetronomeScheduler factory (for testing).
 * Pass a no-arg function that returns a mock MetronomeScheduler.
 */
export function __overrideMetronomeFactory(factory: () => MetronomeScheduler): void {
  _metronomeFactory = factory
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = defineStore('editor', () => {
  // ---- Phase 1: core state ----
  const history = shallowRef(
    createCommandHistory<ProjectDocument>(createEmptyProject()),
  )
  const dirty = shallowRef(false)
  const lastError = shallowRef<string | null>(null)

  // ---- Phase 2: audio + timing state ----
  const _audioTransport = shallowRef<AudioTransport | null>(null)
  const _metronome = shallowRef<MetronomeScheduler | null>(null)
  const _tapEstimator = createTapBpmEstimator()

  const _currentTime = ref(0)
  const _metronomeState = ref<'off' | 'on' | 'latch_pending'>('off')
  const _tapSampleCount = ref(0)
  const _tapEstimatedBpm = ref<number | null>(null)

  // ---- Computed (Phase 1 + Phase 2) ----
  const project = computed(() => history.value.state)
  const canUndo = computed(() => history.value.canUndo)
  const canRedo = computed(() => history.value.canRedo)

  const isPlaying = computed(() => _audioTransport.value?.getIsPlaying() ?? false)
  const currentTime = computed(() => _currentTime.value)
  const activeTimingPointId = computed(() => {
    const points = project.value.timingPoints
    if (points.length === 0) return null
    try {
      return getActiveTimingPoint(points, _currentTime.value).id
    } catch {
      return null
    }
  })
  const isMetronomeEnabled = computed(() => _metronomeState.value === 'on')
  const metronomeState = computed(() => _metronomeState.value)
  const tapSampleCount = computed(() => _tapSampleCount.value)
  const tapEstimatedBpm = computed(() => _tapEstimatedBpm.value)
  const duration = computed(() => _audioTransport.value?.getDuration() ?? 0)
  const progressRatio = computed(() =>
    duration.value > 0 ? Math.min(1, Math.max(0, _currentTime.value / duration.value)) : 0,
  )

  // ---- Helpers ----

  function execute(command: Parameters<typeof history.value.execute>[0]) {
    history.value.execute(command)
    dirty.value = true
    triggerRef(history)
  }

  function _ensureAudioTransport(): AudioTransport {
    if (!_audioTransport.value) {
      _audioTransport.value = _audioTransportFactory()
      _audioTransport.value.setVolume(project.value.audio.musicVolume)
    }
    return _audioTransport.value
  }

  function _ensureMetronome(): MetronomeScheduler {
    if (!_metronome.value) {
      _metronome.value = _metronomeFactory()
      // Sync initial SFX volume from project state
      _metronome.value.setSfxVolume(project.value.audio.sfxVolume)
    }
    return _metronome.value
  }

  // ---- Playback loop ----

  let _rafId: number | null = null

  function _tickPlayback(): void {
    const transport = _audioTransport.value
    if (!transport || !transport.getIsPlaying()) {
      _rafId = null
      return
    }

    const now = transport.getCurrentTime()
    _currentTime.value = now

    const m = _metronome.value
    if (m && project.value.timingPoints.length > 0) {
      const nextAt = getNextBeatTime(project.value.timingPoints, now)
      const nextBeat = getBeatInfoAtTime(project.value.timingPoints, nextAt)
      m.syncToTimeline(now, { at: nextAt, isBarStart: nextBeat.isBarStart })

      if (_metronomeState.value === 'latch_pending' && !m.hasPendingLatch()) {
        _metronomeState.value = 'off'
      }
    }

    _rafId = requestAnimationFrame(_tickPlayback)
  }

  function _startPlaybackLoop(): void {
    if (_rafId !== null) return
    _rafId = requestAnimationFrame(_tickPlayback)
  }

  function _stopPlaybackLoop(): void {
    if (_rafId === null) return
    cancelAnimationFrame(_rafId)
    _rafId = null
  }

  // ---- Phase 1 actions ----

  function addLyricLine(text: string) {
    execute(createAddLyricLineCommand({ id: makeId('line'), text }))
  }

  function undo() {
    history.value.undo()
    dirty.value = true
    triggerRef(history)
  }

  function redo() {
    history.value.redo()
    dirty.value = true
    triggerRef(history)
  }

  function markClean() {
    dirty.value = false
  }

  async function saveProject(service: ProjectFileService) {
    const json = JSON.stringify(project.value, null, 2)
    const result = await service.saveAs(json)

    if (result.ok) {
      markClean()
      lastError.value = null
    } else if (result.reason !== 'cancelled') {
      lastError.value = result.reason ?? 'unknown'
    }

    return result
  }

  // ---- Phase 2: Audio ----

  async function importAudioFile(file: File): Promise<void> {
    const transport = _ensureAudioTransport()
    await transport.loadFile(file)
  }

  async function togglePlayback(): Promise<void> {
    const transport = _audioTransport.value
    if (!transport) return

    if (transport.getIsPlaying()) {
      transport.pause()
      _stopPlaybackLoop()
    } else {
      await transport.play()
      _startPlaybackLoop()
    }
  }

  function pausePlayback(): void {
    _audioTransport.value?.pause()
    _stopPlaybackLoop()
  }

  // ---- Phase 2: Timing Points ----

  function addTimingPoint(input: Omit<TimingPoint, 'id'>): void {
    const point: TimingPoint = { id: makeId('tp'), ...input }
    execute(createAddTimingPointCommand(point))
  }

  function updateTimingPoint(id: string, patch: Partial<TimingPoint>): void {
    execute(createUpdateTimingPointCommand(id, patch))
  }

  function removeTimingPoint(id: string): void {
    execute(createRemoveTimingPointCommand(id))
  }

  // ---- Phase 2: TAP BPM ----

  async function tapBpm(sourceTime?: number): Promise<void> {
    const transport = _audioTransport.value

    // Determine tap timestamp
    let t: number
    if (sourceTime !== undefined) {
      t = sourceTime
    } else {
      t = transport?.getCurrentTime() ?? 0
    }

    // If paused and transport exists, start playback from active timing point
    if (transport && !transport.getIsPlaying()) {
      const activePoint = getActiveTimingPoint(
        project.value.timingPoints,
        _currentTime.value,
      )
      transport.seek(activePoint.time)
      await transport.play()
      _startPlaybackLoop()
    }

    // Feed timestamp to estimator
    const estimate = _tapEstimator.push(t)

    // Update reactive tap state
    _tapSampleCount.value = estimate?.sampleCount ?? _tapSampleCount.value
    _tapEstimatedBpm.value = estimate?.bpm ?? _tapEstimatedBpm.value

    // Apply estimated BPM to active timing point via command
    if (estimate) {
      const activePoint = getActiveTimingPoint(project.value.timingPoints, t)
      updateTimingPoint(activePoint.id, { bpm: estimate.bpm })
    }
  }

  // ---- Phase 2: Metronome ----

  function toggleMetronome(): void {
    const m = _ensureMetronome()

    if (_metronomeState.value === 'off') {
      m.setEnabled(true)
      _metronomeState.value = 'on'
    } else if (_metronomeState.value === 'on') {
      m.setEnabled(false) // arms the latch
      _metronomeState.value = 'latch_pending'
    } else {
      // latch_pending -> off
      // The latch will fire on next beat and auto-clear.
      _metronomeState.value = 'off'
    }
  }

  // ---- Phase 2: Volume ----

  function setMusicVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    execute(createSetAudioVolumeCommand('music', clamped))
    // Also apply to audio transport if loaded
    _audioTransport.value?.setVolume(clamped)
  }

  function setSfxVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    execute(createSetAudioVolumeCommand('sfx', clamped))
    // Also apply to metronome if loaded
    _metronome.value?.setSfxVolume(clamped)
  }

  function seekPlayback(time: number): void {
    const transport = _audioTransport.value
    if (!transport) return
    const d = duration.value
    const target = Math.max(0, Math.min(d || 0, time))
    transport.seek(target)
    _currentTime.value = target
  }

  // ---- Return ----

  return {
    // Phase 1
    project,
    dirty,
    canUndo,
    canRedo,
    lastError,
    addLyricLine,
    undo,
    redo,
    markClean,
    saveProject,

    // Phase 2: reactive state
    isPlaying,
    currentTime,
    activeTimingPointId,
    isMetronomeEnabled,
    metronomeState,
    tapSampleCount,
    tapEstimatedBpm,
    duration,
    progressRatio,

    // Phase 2: audio
    importAudioFile,
    togglePlayback,
    pausePlayback,

    // Phase 2: timing points
    addTimingPoint,
    updateTimingPoint,
    removeTimingPoint,

    // Phase 2: TAP BPM
    tapBpm,

    // Phase 2: metronome
    toggleMetronome,

    // Phase 2: seek
    seekPlayback,

    // Phase 2: volume
    setMusicVolume,
    setSfxVolume,
  }
})
