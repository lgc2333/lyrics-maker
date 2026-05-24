import { defineStore } from 'pinia'
import { computed, shallowRef, triggerRef } from 'vue'

import { createCommandHistory } from '../core/commands/history'
import {
  createClearWordEndTimeCommand,
  createInsertLyricLinesCommand,
  createInsertWordCommand,
  createMergeWordsCommand,
  createRemoveLyricLineCommand,
  createRemoveWordCommand,
  createReplaceLineWordsCommand,
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createSplitWordCommand,
  createUpdateWordTextCommand,
} from '../core/commands/lyrics-commands'
import {
  createAddLyricLineCommand,
  createAddTimingPointCommand,
  createRemoveTimingPointCommand,
  createSetAudioVolumeCommand,
  createSetRhythmModeCommand,
  createSetSnapDivisorCommand,
  createUpdateTimingPointCommand,
} from '../core/commands/project-commands'
import { createEmptyProject } from '../core/domain/project'
import type { LyricLine, ProjectDocument, TimingPoint } from '../core/domain/project'
import { createTapBpmEstimator } from '../core/timing/tap-bpm'
import {
  getActiveTimingPoint,
  getBeatInfoAtTime,
  getNextBarBoundaryTime,
  getNextBeatTime,
  getNextSubdivisionTime,
  getPreviousBarTime,
  getPreviousSubdivisionTime,
} from '../core/timing/timing-engine'
import type { AudioTransport } from '../platform/audio/audio-transport'
import { createAudioTransport } from '../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../platform/audio/metronome'
import { createMetronome } from '../platform/audio/metronome'
import type { SaveResult } from '../platform/persistence/project-file-service'

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export interface StatusMessage {
  id: number
  key: string
  params?: Record<string, string | number | boolean>
}

export interface ProjectFileService {
  saveAs: (content: string) => Promise<SaveResult>
  save: (content: string) => Promise<SaveResult>
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
  const statusMessage = shallowRef<StatusMessage | null>(null)
  let statusMessageId = 0

  // ---- Phase 2: audio + timing state ----
  const _audioTransport = shallowRef<AudioTransport | null>(null)
  const _metronome = shallowRef<MetronomeScheduler | null>(null)
  const _tapEstimator = createTapBpmEstimator()

  const _audioFile = shallowRef<File | null>(null)
  const _currentTime = shallowRef(0)
  const _isPlaying = shallowRef(false)
  const _metronomeState = shallowRef<'off' | 'on' | 'latch_pending'>('off')
  const _tapCount = shallowRef(0) // incremented on every tap call, reset after idle timeout
  const _tapSampleCount = shallowRef(0)
  const _tapEstimatedBpm = shallowRef<number | null>(null)
  let _tapResetTimerId: number | null = null

  // ---- Computed (Phase 1 + Phase 2) ----
  const project = computed(() => history.value.state)
  const canUndo = computed(() => history.value.canUndo)
  const canRedo = computed(() => history.value.canRedo)

  const isPlaying = computed(() => _isPlaying.value)
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
  const tapCount = computed(() => _tapCount.value)
  const tapSampleCount = computed(() => _tapSampleCount.value)
  const tapEstimatedBpm = computed(() => _tapEstimatedBpm.value)
  const duration = computed(() => _audioTransport.value?.getDuration() ?? 0)
  const hasAudio = computed(() => _audioFile.value !== null && duration.value > 0)
  const progressRatio = computed(() =>
    duration.value > 0
      ? Math.min(1, Math.max(0, _currentTime.value / duration.value))
      : 0,
  )

  // ---- Helpers ----

  function showStatus(
    key: string,
    params?: Record<string, string | number | boolean>,
  ): void {
    statusMessage.value = {
      id: ++statusMessageId,
      key,
      params,
    }
  }

  function clearStatus(): void {
    statusMessage.value = null
  }

  function execute(
    command: Parameters<typeof history.value.execute>[0],
    statusKey?: string,
    statusParams?: Record<string, string | number | boolean>,
  ) {
    history.value.execute(command)
    dirty.value = true
    triggerRef(history)
    if (statusKey) {
      showStatus(statusKey, {
        commandLabel: command.label,
        ...(statusParams ?? {}),
      })
    }
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

  function _getNextBeatForMetronome(
    currentTime: number,
  ): { at: number; isBarStart: boolean } | null {
    if (project.value.timingPoints.length === 0) return null

    const nextAt = getNextBeatTime(project.value.timingPoints, currentTime)
    const nextBeat = getBeatInfoAtTime(project.value.timingPoints, nextAt)
    return { at: nextAt, isBarStart: nextBeat.isBarStart }
  }

  function _handlePlaybackStopped(previousTime: number, shouldLatch: boolean): void {
    const m = _metronome.value
    if (m && shouldLatch && _metronomeState.value === 'on') {
      m.handlePlaybackPaused(previousTime, _getNextBeatForMetronome(previousTime))
    } else if (m) {
      m.cancelPendingClicks()
    }
  }

  // ---- Playback loop ----

  let _rafId: number | null = null

  function _tickPlayback(): void {
    const transport = _audioTransport.value
    if (!transport || !transport.getIsPlaying()) {
      _handlePlaybackStopped(_currentTime.value, _isPlaying.value)
      _rafId = null
      _isPlaying.value = false
      return
    }

    const now = transport.getCurrentTime()
    _currentTime.value = now

    const m = _metronome.value
    if (m && project.value.timingPoints.length > 0) {
      m.syncToTimeline(now, _getNextBeatForMetronome(now))

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
    execute(
      createAddLyricLineCommand({
        id: makeId('line'),
        words: [{ id: makeId('word'), text }],
      }),
      'status.lyrics.addLine',
    )
  }

  function _syncAudioHardware() {
    if (_audioTransport.value) {
      _audioTransport.value.setVolume(project.value.audio.musicVolume)
    }
    if (_metronome.value) {
      _metronome.value.setSfxVolume(project.value.audio.sfxVolume)
    }
  }

  function undo() {
    const commandLabel = history.value.nextUndoLabel
    if (!commandLabel) {
      showStatus('status.history.noUndo')
      return
    }
    history.value.undo()
    dirty.value = true
    triggerRef(history)
    _syncAudioHardware()
    showStatus('status.history.undo', { commandLabel })
  }

  function redo() {
    const commandLabel = history.value.nextRedoLabel
    if (!commandLabel) {
      showStatus('status.history.noRedo')
      return
    }
    history.value.redo()
    dirty.value = true
    triggerRef(history)
    _syncAudioHardware()
    showStatus('status.history.redo', { commandLabel })
  }

  function markClean() {
    dirty.value = false
  }

  async function saveProject(service: ProjectFileService) {
    const json = JSON.stringify(project.value, null, 2)
    const result = await service.save(json)

    // Fall back to saveAs if no cached handle exists
    if (!result.ok && result.reason === 'unsupported') {
      const saveAsResult = await service.saveAs(json)
      if (saveAsResult.ok) {
        markClean()
        lastError.value = null
        showStatus('status.project.saveSuccess')
      } else if (saveAsResult.reason !== 'cancelled') {
        lastError.value = saveAsResult.reason ?? 'unknown'
        showStatus('status.project.saveFailed', {
          reason: saveAsResult.reason ?? 'unknown',
        })
      }
      if (!saveAsResult.ok && saveAsResult.reason === 'cancelled') {
        showStatus('status.project.saveCancelled')
      }
      return saveAsResult
    }

    if (result.ok) {
      markClean()
      lastError.value = null
      showStatus('status.project.saveSuccess')
    } else {
      lastError.value = result.reason ?? 'unknown'
      showStatus('status.project.saveFailed', { reason: result.reason ?? 'unknown' })
    }

    return result
  }

  // ---- Phase 2: Audio ----

  async function importAudioFile(file: File): Promise<void> {
    // Explicitly stop playback before loading new audio.
    // Setting audioElement.src does NOT reliably fire 'pause' in Chrome,
    // so transport.getIsPlaying() can remain true, causing togglePlayback
    // to hit the PAUSE branch forever instead of starting playback.
    //
    // Also reset _isPlaying / _currentTime / _rafId synchronously so the
    // UI reflects the stopped state immediately, not on the next RAF tick.
    _stopPlaybackLoop()
    const wasPlaying = _audioTransport.value?.getIsPlaying() ?? false
    const stoppedAt = wasPlaying
      ? (_audioTransport.value?.getCurrentTime() ?? _currentTime.value)
      : _currentTime.value
    _audioTransport.value?.pause()
    _isPlaying.value = false
    _handlePlaybackStopped(stoppedAt, wasPlaying)
    _currentTime.value = 0

    _audioFile.value = file
    const transport = _ensureAudioTransport()
    try {
      await transport.loadFile(file)
      triggerRef(_audioTransport)
      showStatus('status.audio.importSuccess', { fileName: file.name })
    } catch (error) {
      _audioFile.value = null
      showStatus('status.audio.loadFailed')
      throw error
    }
  }

  async function togglePlayback(): Promise<void> {
    const transport = _audioTransport.value
    if (!transport) {
      showStatus('status.audioRequired', { action: 'transport.playPause' })
      return
    }

    if (transport.getIsPlaying()) {
      const stoppedAt = transport.getCurrentTime()
      transport.pause()
      _stopPlaybackLoop()
      _isPlaying.value = false
      _currentTime.value = stoppedAt
      _handlePlaybackStopped(stoppedAt, true)
    } else {
      _isPlaying.value = true
      await transport.play()
      if (_metronomeState.value === 'on') _metronome.value?.setEnabled(true)
      _startPlaybackLoop()
    }
  }

  function pausePlayback(): void {
    const wasPlaying = _audioTransport.value?.getIsPlaying() ?? false
    const stoppedAt = wasPlaying
      ? (_audioTransport.value?.getCurrentTime() ?? _currentTime.value)
      : _currentTime.value
    _audioTransport.value?.pause()
    _stopPlaybackLoop()
    _isPlaying.value = false
    _currentTime.value = stoppedAt
    _handlePlaybackStopped(stoppedAt, wasPlaying)
  }

  // ---- Phase 2: Timing Points ----

  function addTimingPoint(input: Omit<TimingPoint, 'id'>): void {
    const point: TimingPoint = { id: makeId('tp'), ...input }
    execute(createAddTimingPointCommand(point), 'status.timing.addPoint')
  }

  function updateTimingPoint(id: string, patch: Partial<TimingPoint>): void {
    execute(createUpdateTimingPointCommand(id, patch), 'status.timing.updatePoint')
  }

  function removeTimingPoint(id: string): void {
    execute(createRemoveTimingPointCommand(id), 'status.timing.removePoint')
  }

  // ---- Phase 2: TAP BPM ----

  function _resetTapState(): void {
    _tapCount.value = 0
    _tapSampleCount.value = 0
    _tapEstimatedBpm.value = null
    _tapEstimator.reset()
    _tapResetTimerId = null
  }

  async function tapBpm(sourceTime?: number): Promise<void> {
    const transport = _audioTransport.value

    // Guard: require a loaded transport so timestamps are meaningful
    if (!transport) {
      showStatus('status.tapBpm.noAudio')
      return
    }

    // Determine tap timestamp
    let t: number
    if (sourceTime !== undefined) {
      t = sourceTime
    } else {
      t = transport.getCurrentTime()
    }

    // Always increment visible tap count immediately (before any await)
    _tapCount.value++

    // Schedule reset after 1.5 s of no tapping (matches estimator's 1 s gap reset)
    if (_tapResetTimerId !== null) clearTimeout(_tapResetTimerId)
    _tapResetTimerId = setTimeout(_resetTapState, 1500)

    // If paused, start playback from active timing point
    if (!transport.getIsPlaying()) {
      const activePoint = getActiveTimingPoint(
        project.value.timingPoints,
        _currentTime.value,
      )
      transport.seek(activePoint.time)
      _isPlaying.value = true
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
      showStatus('status.tapBpm.updated', { bpm: estimate.bpm.toFixed(1) })
    }
  }

  // ---- Phase 2: Metronome ----
  //
  // State machine:  off ──(click)──▶ on ──(click when playing)──▶ latch_pending
  //                 ▲               │                               │
  //                 │               │ (click when paused)           │ (click again)
  //                 └───────────────┘                               │
  //                 ▲                                               │
  //                 └───(latch fires or pausePlayback called)───────┘
  //
  // latch_pending schedules one final click at the next beat, then auto-clears.
  // Clicking again while latch_pending immediately re-enables (on), never goes to off.

  function toggleMetronome(): void {
    const m = _ensureMetronome()

    if (_metronomeState.value === 'on') {
      if (_isPlaying.value) {
        // Playing → schedule one latch click at next beat, then stop
        m.setEnabled(false)
        _metronomeState.value = 'latch_pending'
        showStatus('status.metronome.latchPending')
      } else {
        // Not playing → turn off silently.
        m.setEnabled(false)
        m.cancelPendingClicks()
        _metronomeState.value = 'off'
        showStatus('status.metronome.off')
      }
    } else {
      // off or latch_pending → turn on (setEnabled(true) also cancels any pending latch)
      m.setEnabled(true)
      _metronomeState.value = 'on'
      showStatus('status.metronome.on')
    }
  }

  // ---- Phase 2: Volume ----

  function setMusicVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    execute(
      createSetAudioVolumeCommand('music', clamped),
      'status.settings.musicVolume',
      {
        value: Math.round(clamped * 100),
      },
    )
    // Also apply to audio transport if loaded
    _audioTransport.value?.setVolume(clamped)
  }

  function setSfxVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    execute(createSetAudioVolumeCommand('sfx', clamped), 'status.settings.sfxVolume', {
      value: Math.round(clamped * 100),
    })
    // Also apply to metronome if loaded
    _metronome.value?.setSfxVolume(clamped)
  }

  function seekPlayback(time: number): void {
    const transport = _audioTransport.value
    if (!transport) {
      showStatus('status.audioRequired', { action: 'transport.seek' })
      return
    }
    const d = duration.value
    const target = Math.max(0, Math.min(d || 0, time))
    transport.seek(target)
    _currentTime.value = target

    // Restart RAF loop to re-sync metronome after timeline jump
    if (transport.getIsPlaying()) {
      _stopPlaybackLoop()
      _startPlaybackLoop()
    }
  }

  function seekToPreviousBar(): void {
    if (!hasAudio.value) {
      showStatus('status.audioRequired', { action: 'transport.prevBar' })
      return
    }
    if (project.value.timingPoints.length === 0) return
    const t = getPreviousBarTime(project.value.timingPoints, _currentTime.value)
    seekPlayback(Math.max(0, t))
  }

  function seekToNextBar(): void {
    if (!hasAudio.value) {
      showStatus('status.audioRequired', { action: 'transport.nextBar' })
      return
    }
    if (project.value.timingPoints.length === 0) return
    const t = getNextBarBoundaryTime(project.value.timingPoints, _currentTime.value)
    const d = duration.value
    seekPlayback(Math.min(d, t))
  }

  // ---- Phase 3: Settings ----

  function setRhythmMode(mode: 'common' | 'triplets'): void {
    execute(createSetRhythmModeCommand(mode), 'status.settings.rhythmMode', { mode })
  }

  function setSnapDivisor(divisor: 1 | 2 | 4 | 8 | 16): void {
    execute(createSetSnapDivisorCommand(divisor), 'status.settings.snapDivisor', {
      divisor,
    })
  }

  // ---- Phase 3: Subdivision seek ----

  function seekToNextBeat(divisor: number, triplets: boolean): void {
    if (!hasAudio.value) {
      showStatus('status.audioRequired', { action: 'transport.nextBeat' })
      return
    }
    if (project.value.timingPoints.length === 0) return
    const t = getNextSubdivisionTime(
      project.value.timingPoints,
      _currentTime.value,
      divisor,
      triplets,
    )
    seekPlayback(Math.min(duration.value, t))
  }

  function seekToPrevBeat(divisor: number, triplets: boolean): void {
    if (!hasAudio.value) {
      showStatus('status.audioRequired', { action: 'transport.prevBeat' })
      return
    }
    if (project.value.timingPoints.length === 0) return
    const t = getPreviousSubdivisionTime(
      project.value.timingPoints,
      _currentTime.value,
      divisor,
      triplets,
    )
    seekPlayback(Math.max(0, t))
  }

  // ---- Phase 4: Lyrics ----

  function insertLyricLines(lines: LyricLine[]): void {
    execute(createInsertLyricLinesCommand(lines), 'status.lyrics.insertLines', {
      count: lines.length,
    })
  }

  function removeLyricLine(lineId: string): void {
    execute(createRemoveLyricLineCommand(lineId), 'status.lyrics.removeLine')
  }

  function setLineStartTime(lineId: string, time: number): void {
    execute(
      createSetLineStartTimeCommand(lineId, time),
      'status.lyrics.setLineStartTime',
    )
  }

  function setWordEndTime(lineId: string, wordId: string, time: number): void {
    execute(
      createSetWordEndTimeCommand(lineId, wordId, time),
      'status.lyrics.setWordEndTime',
    )
  }

  function clearWordEndTime(lineId: string, wordId: string): void {
    execute(
      createClearWordEndTimeCommand(lineId, wordId),
      'status.lyrics.clearWordEndTime',
    )
  }

  function splitWord(lineId: string, wordId: string, charIndex: number): void {
    execute(
      createSplitWordCommand(lineId, wordId, charIndex, crypto.randomUUID()),
      'status.lyrics.splitWord',
    )
  }

  function mergeWords(lineId: string, wordId: string): void {
    execute(createMergeWordsCommand(lineId, wordId), 'status.lyrics.mergeWords')
  }

  function removeWord(lineId: string, wordId: string): void {
    execute(createRemoveWordCommand(lineId, wordId), 'status.lyrics.removeWord')
  }

  function updateWordText(lineId: string, wordId: string, newText: string): void {
    execute(
      createUpdateWordTextCommand(lineId, wordId, newText),
      'status.lyrics.updateWordText',
    )
  }

  function insertWord(
    lineId: string,
    insertIndex: number,
    word: { id: string; text: string },
  ): void {
    execute(
      createInsertWordCommand(lineId, insertIndex, word),
      'status.lyrics.insertWord',
    )
  }

  function replaceLineWords(
    lineId: string,
    newWords: { id: string; text: string }[],
  ): void {
    execute(
      createReplaceLineWordsCommand(lineId, newWords),
      'status.lyrics.replaceLineWords',
    )
  }

  // ---- Return ----

  return {
    // Phase 1
    project,
    dirty,
    canUndo,
    canRedo,
    lastError,
    statusMessage,
    showStatus,
    clearStatus,
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
    tapCount,
    tapSampleCount,
    tapEstimatedBpm,
    duration,
    hasAudio,
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
    seekToPreviousBar,
    seekToNextBar,

    // Phase 2: volume
    setMusicVolume,
    setSfxVolume,

    // Phase 3: audio file reference (for WaveSurfer)
    audioFile: computed(() => _audioFile.value),

    // Phase 3: settings
    setRhythmMode,
    setSnapDivisor,

    // Phase 3: beat-level seek
    seekToNextBeat,
    seekToPrevBeat,

    // Phase 4: lyrics
    insertLyricLines,
    removeLyricLine,
    setLineStartTime,
    setWordEndTime,
    clearWordEndTime,
    splitWord,
    mergeWords,
    removeWord,
    updateWordText,
    insertWord,
    replaceLineWords,
  }
})
