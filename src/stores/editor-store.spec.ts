import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AudioTransport } from '../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from './editor-store'

/**
 * Creates a mock AudioTransport with controllable state for testing.
 */
function createMockAudioTransport(): {
  transport: AudioTransport
  isPlaying: () => boolean
  pauseExternally: () => void
} {
  let _playing = false
  let _currentTime = 0
  let _volume = 1
  const _duration = 120

  const transport: AudioTransport = {
    loadFile: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(async () => {
      _playing = true
    }),
    pause: vi.fn(() => {
      _playing = false
    }),
    seek: vi.fn((time: number) => {
      _currentTime = Math.max(0, time)
    }),
    getCurrentTime: vi.fn(() => _currentTime),
    getDuration: vi.fn(() => _duration),
    setVolume: vi.fn((value: number) => {
      _volume = Math.max(0, Math.min(1, value))
    }),
    getVolume: vi.fn(() => _volume),
    getIsPlaying: vi.fn(() => _playing),
    destroy: vi.fn(),
  }

  return {
    transport,
    isPlaying: () => _playing,
    pauseExternally: () => {
      _playing = false
    },
  }
}

/**
 * Creates a mock MetronomeScheduler with controllable state for testing.
 */
function createMockMetronome(): {
  scheduler: MetronomeScheduler
  enabled: () => boolean
  latchPending: () => boolean
  setEnabledCalls: Array<boolean>
} {
  let _enabled = false
  let _latchPending = false
  const setEnabledCalls: Array<boolean> = []

  const scheduler: MetronomeScheduler = {
    setEnabled: vi.fn((value: boolean) => {
      setEnabledCalls.push(value)
      if (value) {
        _latchPending = false
      } else if (_enabled) {
        _latchPending = true
      }
      _enabled = value
    }),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    hasPendingLatch: vi.fn(() => _latchPending),
    fireLatchNow: vi.fn(() => {
      _latchPending = false
    }),
    handlePlaybackPaused: vi.fn(() => {
      _enabled = false
      _latchPending = false
    }),
    cancelPendingClicks: vi.fn(() => {
      _latchPending = false
    }),
    getLoadError: vi.fn(() => null),
    destroy: vi.fn(),
  }

  return {
    scheduler,
    enabled: () => _enabled,
    latchPending: () => _latchPending,
    setEnabledCalls,
  }
}

describe('editor store (phase 1)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes with an empty project', () => {
    const store = useEditorStore()

    expect(store.project.title).toBe('Untitled Project')
    expect(store.project.lyrics).toHaveLength(0)
    expect(store.project.version).toBe(1)
  })

  it('supports add line + undo + redo', () => {
    const store = useEditorStore()

    store.addLyricLine('hello world')
    expect(store.project.lyrics).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('hello world')

    store.undo()
    expect(store.project.lyrics).toHaveLength(0)

    store.redo()
    expect(store.project.lyrics).toHaveLength(1)
  })

  it('tracks dirty flag', () => {
    const store = useEditorStore()

    expect(store.dirty).toBe(false)

    store.addLyricLine('line 1')
    expect(store.dirty).toBe(true)
  })

  it('tracks canUndo and canRedo flags', () => {
    const store = useEditorStore()

    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)

    store.addLyricLine('line 1')
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)

    store.undo()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
  })

  it('clears redo stack after a new execute', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.undo()
    expect(store.canRedo).toBe(true)

    store.addLyricLine('line 2')
    expect(store.canRedo).toBe(false)
    expect(store.project.lyrics).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('line 2')
  })

  it('adds multiple lines', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.addLyricLine('line 2')
    store.addLyricLine('line 3')

    expect(store.project.lyrics).toHaveLength(3)
    expect(store.project.lyrics[0].words[0].text).toBe('line 1')
    expect(store.project.lyrics[1].words[0].text).toBe('line 2')
    expect(store.project.lyrics[2].words[0].text).toBe('line 3')
  })

  it('each line has a unique id', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    store.addLyricLine('line 2')

    const ids = store.project.lyrics.map((l) => l.id)

    expect(ids[0]).toMatch(/^line-/)
    expect(ids[1]).toMatch(/^line-/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('can add a lyric line when crypto.randomUUID is unavailable', () => {
    const originalRandomUUID = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    try {
      const store = useEditorStore()

      store.addLyricLine('line 1')

      expect(store.project.lyrics).toHaveLength(1)
      expect(store.project.lyrics[0].id).toMatch(/^line-/)
      expect(store.project.lyrics[0].words[0].id).toMatch(/^word-/)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: originalRandomUUID,
      })
    }
  })

  it('returns fresh snapshot after each mutation', () => {
    const store = useEditorStore()

    store.addLyricLine('first')
    const snapshot1 = store.project

    store.addLyricLine('second')
    const snapshot2 = store.project

    expect(snapshot1).not.toBe(snapshot2)
    expect(snapshot1.lyrics).toHaveLength(1)
    expect(snapshot2.lyrics).toHaveLength(2)
  })

  it('initializes lastError as null', () => {
    const store = useEditorStore()
    expect(store.lastError).toBeNull()
  })

  it('initializes status message as null', () => {
    const store = useEditorStore()
    expect(store.statusMessage).toBeNull()
  })

  it('reports no undo and no redo through status messages', () => {
    const store = useEditorStore()

    store.undo()
    expect(store.statusMessage?.key).toBe('status.history.noUndo')

    store.redo()
    expect(store.statusMessage?.key).toBe('status.history.noRedo')
  })

  it('reports undo and redo with command labels', () => {
    const store = useEditorStore()

    store.addLyricLine('hello world')
    store.undo()

    expect(store.statusMessage?.key).toBe('status.history.undo')
    expect(store.statusMessage?.params?.commandLabel).toBe('lyrics.addLine')

    store.redo()

    expect(store.statusMessage?.key).toBe('status.history.redo')
    expect(store.statusMessage?.params?.commandLabel).toBe('lyrics.addLine')
  })

  it('can show and clear a manual status message', () => {
    const store = useEditorStore()

    store.showStatus('status.audioRequired', {
      action: 'transport.playPause',
    })

    expect(store.statusMessage).toMatchObject({
      key: 'status.audioRequired',
      params: { action: 'transport.playPause' },
    })

    store.clearStatus()
    expect(store.statusMessage).toBeNull()
  })

  it('markClean sets dirty to false', () => {
    const store = useEditorStore()

    store.addLyricLine('line 1')
    expect(store.dirty).toBe(true)

    store.markClean()
    expect(store.dirty).toBe(false)
  })

  it('saveProject serializes project and calls saveAs', async () => {
    const save = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'no_cached_handle' as const,
    }))
    const saveAs = vi.fn(async (_content: string) => ({ ok: true as const }))
    const service = { save, saveAs }
    const store = useEditorStore()

    store.addLyricLine('hello world')
    const result = await store.saveProject(service)

    expect(result.ok).toBe(true)
    expect(saveAs).toHaveBeenCalledOnce()
    const json = saveAs.mock.calls[0][0]
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.lyrics).toHaveLength(1)
    expect(parsed.lyrics[0].words[0].text).toBe('hello world')
    expect(store.dirty).toBe(false)
    expect(store.statusMessage?.key).toBe('status.project.saveSuccess')
  })

  it('saveProject sets lastError on failure', async () => {
    const save = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'unsupported' as const,
    }))
    const saveAs = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'unsupported' as const,
    }))
    const service = { save, saveAs }
    const store = useEditorStore()

    const result = await store.saveProject(service)

    expect(result.ok).toBe(false)
    expect(store.lastError).toBe('unsupported')
    expect(store.statusMessage?.key).toBe('status.project.unsupportedFileApi')
  })

  it('updates project title through command history', () => {
    const store = useEditorStore()

    store.setProjectTitle('Song A')

    expect(store.project.title).toBe('Song A')
    expect(store.dirty).toBe(true)
    expect(store.statusMessage?.key).toBe('status.project.titleUpdated')

    store.undo()
    expect(store.project.title).toBe('Untitled Project')
  })

  it('loads an opened project as clean and clears undo history', () => {
    const store = useEditorStore()
    store.addLyricLine('before')

    store.loadProject({ ...store.project, title: 'Opened Project', lyrics: [] })

    expect(store.project.title).toBe('Opened Project')
    expect(store.project.lyrics).toHaveLength(0)
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
    expect(store.statusMessage?.key).toBe('status.project.openSuccess')
  })

  it('loads a restored draft as dirty', () => {
    const store = useEditorStore()

    store.loadProject({ ...store.project, title: 'Draft Project' }, { dirty: true })

    expect(store.project.title).toBe('Draft Project')
    expect(store.dirty).toBe(true)
    expect(store.statusMessage?.key).toBe('status.project.draftRestored')
  })

  it('saveProject falls back to saveAs only when no cached handle exists', async () => {
    const save = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'no_cached_handle' as const,
    }))
    const saveAs = vi.fn(async (_content: string, _title?: string) => ({
      ok: true as const,
    }))
    const service = { save, saveAs, hasCachedHandle: () => false }
    const store = useEditorStore()

    const result = await store.saveProject(service)

    expect(result.ok).toBe(true)
    expect(saveAs).toHaveBeenCalledWith(expect.any(String), 'Untitled Project')
    expect(store.statusMessage?.key).toBe('status.project.saveSuccess')
  })

  it('saveProject reports unsupported browsers without retrying saveAs forever', async () => {
    const save = vi.fn(async (_content: string) => ({
      ok: false as const,
      reason: 'unsupported' as const,
    }))
    const saveAs = vi.fn()
    const service = { save, saveAs, hasCachedHandle: () => false }
    const store = useEditorStore()

    const result = await store.saveProject(service)

    expect(result.ok).toBe(false)
    expect(saveAs).not.toHaveBeenCalled()
    expect(store.statusMessage?.key).toBe('status.project.unsupportedFileApi')
  })

  it('saveProjectAs always calls saveAs with the project title', async () => {
    const save = vi.fn()
    const saveAs = vi.fn(async (_content: string, _title?: string) => ({
      ok: true as const,
    }))
    const service = { save, saveAs, hasCachedHandle: () => false }
    const store = useEditorStore()
    store.setProjectTitle('Named Project')

    const result = await store.saveProjectAs(service)

    expect(result.ok).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(saveAs).toHaveBeenCalledWith(expect.any(String), 'Named Project')
    expect(store.dirty).toBe(false)
  })

  it('autoSaveProject writes only to an existing cached handle', async () => {
    const save = vi.fn(async (_content: string) => ({ ok: true as const }))
    const saveAs = vi.fn()
    const service = { save, saveAs, hasCachedHandle: () => true }
    const store = useEditorStore()
    store.addLyricLine('dirty')

    const result = await store.autoSaveProject(service)

    expect(result.ok).toBe(true)
    expect(save).toHaveBeenCalledOnce()
    expect(saveAs).not.toHaveBeenCalled()
    expect(store.dirty).toBe(false)
    expect(store.statusMessage?.key).toBe('status.project.autoSaveSuccess')
  })

  it('autoSaveProject does not open picker when no cached handle exists', async () => {
    const save = vi.fn()
    const saveAs = vi.fn()
    const service = { save, saveAs, hasCachedHandle: () => false }
    const store = useEditorStore()

    const result = await store.autoSaveProject(service)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_cached_handle')
    expect(save).not.toHaveBeenCalled()
    expect(saveAs).not.toHaveBeenCalled()
  })
})

describe('editor store (phase 2 - timing points)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adds and removes timing points via store', () => {
    const store = useEditorStore()

    store.addTimingPoint({
      time: 10,
      bpm: 140,
      timeSignatureNumerator: 3,
      timeSignatureDenominator: 4,
    })
    expect(store.project.timingPoints).toHaveLength(2)
    expect(store.project.timingPoints[1].bpm).toBe(140)

    store.undo()
    expect(store.project.timingPoints).toHaveLength(1)
  })

  it('updateTimingPoint modifies fields and undo restores', () => {
    const store = useEditorStore()
    const tpId = store.project.timingPoints[0].id

    store.updateTimingPoint(tpId, { bpm: 160 })
    expect(store.project.timingPoints[0].bpm).toBe(160)

    store.undo()
    expect(store.project.timingPoints[0].bpm).toBe(120)
  })

  it('removeTimingPoint removes and undo restores', () => {
    const store = useEditorStore()
    const tpId = store.project.timingPoints[0].id

    store.removeTimingPoint(tpId)
    expect(store.project.timingPoints).toHaveLength(0)

    store.undo()
    expect(store.project.timingPoints).toHaveLength(1)
    expect(store.project.timingPoints[0].id).toBe(tpId)
  })
})

describe('editor store (phase 2 - volume)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('updates musicVolume and sfxVolume independently', () => {
    const store = useEditorStore()

    store.setMusicVolume(0.2)
    store.setSfxVolume(0.7)

    expect(store.project.audio.musicVolume).toBe(0.2)
    expect(store.project.audio.sfxVolume).toBe(0.7)
  })

  it('volume commands go through command history (undo/redo works)', () => {
    const store = useEditorStore()

    store.setMusicVolume(0.3)
    expect(store.project.audio.musicVolume).toBe(0.3)

    store.undo()
    expect(store.project.audio.musicVolume).toBe(1) // default

    store.redo()
    expect(store.project.audio.musicVolume).toBe(0.3)
  })

  it('undo/redo re-syncs volume to audio hardware', () => {
    const mockAudio = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mockAudio.transport)
    const mockMetronome = createMockMetronome()
    __overrideMetronomeFactory(() => mockMetronome.scheduler)
    setActivePinia(createPinia())

    const store = useEditorStore()

    // Import audio to create the transport (which initializes volume=1)
    store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    // Toggle metronome to create the metronome instance
    store.toggleMetronome()

    // Change volumes
    store.setMusicVolume(0.3)
    store.setSfxVolume(0.5)

    // Undo music volume — transport should be notified
    store.undo()
    expect(mockAudio.transport.setVolume).toHaveBeenCalledWith(1) // restored to default
    // SFX volume should still be 0.5 (only music volume was undone)
    expect(mockMetronome.scheduler.setSfxVolume).toHaveBeenCalledWith(0.5)

    // Undo sfx volume — metronome should be notified
    store.undo()
    expect(mockMetronome.scheduler.setSfxVolume).toHaveBeenCalledWith(0.8) // restored to default
  })
})

describe('editor store (phase 5 plus part 2 - settings)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('updates snapEnabled through command history and reports status', () => {
    const store = useEditorStore()

    expect(store.project.settings.snapEnabled).toBe(true)

    store.setSnapEnabled(false)

    expect(store.project.settings.snapEnabled).toBe(false)
    expect(store.statusMessage?.key).toBe('status.settings.snapEnabled')
    expect(store.statusMessage?.params?.enabled).toBe(false)

    store.undo()
    expect(store.project.settings.snapEnabled).toBe(true)
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.project.settings.snapEnabled).toBe(false)
  })
})

describe('editor store (phase 2 - audio transport)', () => {
  let mockTransport: AudioTransport
  let transportPlaying: () => boolean

  beforeEach(() => {
    const mock = createMockAudioTransport()
    mockTransport = mock.transport
    transportPlaying = mock.isPlaying
    __overrideAudioTransportFactory(() => mockTransport)
    setActivePinia(createPinia())
  })

  it('importAudioFile creates transport and loads file', async () => {
    const store = useEditorStore()
    const file = new File(['x'], 'song.mp3', { type: 'audio/mpeg' })

    await store.importAudioFile(file)

    expect(mockTransport.loadFile).toHaveBeenCalledWith(file)
    expect(store.isPlaying).toBe(false)
  })

  it('reports load failure and does not mark audio as available when import fails', async () => {
    const failingTransport = createMockAudioTransport().transport
    failingTransport.loadFile = vi.fn(async () => {
      throw new Error('load failed')
    })
    failingTransport.getDuration = vi.fn(() => 120)
    __overrideAudioTransportFactory(() => failingTransport)
    setActivePinia(createPinia())

    const store = useEditorStore()

    await expect(
      store.importAudioFile(new File(['x'], 'broken.mp3', { type: 'audio/mpeg' })),
    ).rejects.toThrow('load failed')

    expect(store.audioFile).toBeNull()
    expect(store.hasAudio).toBe(false)
    expect(store.statusMessage?.key).toBe('status.audio.loadFailed')
  })

  it('can toggle playback after replacing audio during playback', async () => {
    // Bug: When replacing audio while playing, Chrome may cancel the queued
    // 'pause' event task when audioElement.src changes inside loadFile().
    // If getIsPlaying() relied on event-set flags, it would stay true forever
    // and togglePlayback would always hit the PAUSE branch.
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // Start playback
    await store.togglePlayback()
    expect(store.isPlaying).toBe(true)

    // Replace audio while still "playing"
    await store.importAudioFile(new File(['y'], 'song2.mp3', { type: 'audio/mpeg' }))

    // After import, playback state must be clean
    expect(store.isPlaying).toBe(false)
    expect(store.currentTime).toBe(0)

    // Toggling should start playback (not hit the PAUSE branch)
    await store.togglePlayback()
    expect(store.isPlaying).toBe(true)
  })

  it('schedules metronome latch from the old playback time before replacing audio', async () => {
    let now = 1.2
    const mock = createMockAudioTransport()
    mock.transport.getCurrentTime = vi.fn(() => now)
    const metronome = createMockMetronome()
    __overrideAudioTransportFactory(() => mock.transport)
    __overrideMetronomeFactory(() => metronome.scheduler)
    setActivePinia(createPinia())

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()
    store.toggleMetronome()

    now = 1.2
    await store.importAudioFile(new File(['y'], 'song2.mp3', { type: 'audio/mpeg' }))

    expect(metronome.scheduler.handlePlaybackPaused).toHaveBeenCalledWith(1.2, {
      at: 1.5,
      isBarStart: false,
    })
    expect(store.metronomeState).toBe('on')
    expect(store.currentTime).toBe(0)
  })

  it('togglePlayback toggles isPlaying', async () => {
    const store = useEditorStore()
    // Need to initialize transport first
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.isPlaying).toBe(false)

    await store.togglePlayback()
    expect(mockTransport.play).toHaveBeenCalled()
    expect(transportPlaying()).toBe(true)
    expect(store.isPlaying).toBe(true)

    await store.togglePlayback()
    expect(mockTransport.pause).toHaveBeenCalled()
    expect(transportPlaying()).toBe(false)
    expect(store.isPlaying).toBe(false)
  })

  it('pausePlayback sets isPlaying to false', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // Play first
    await store.togglePlayback()
    expect(transportPlaying()).toBe(true)

    // Then pause
    store.pausePlayback()
    expect(mockTransport.pause).toHaveBeenCalled()
  })

  it('togglePlayback reports missing audio when no transport loaded', async () => {
    const store = useEditorStore()

    await store.togglePlayback()
    expect(store.isPlaying).toBe(false)
    expect(store.statusMessage?.key).toBe('status.audioRequired')
    expect(store.statusMessage?.params?.action).toBe('transport.playPause')
  })

  it('pausePlayback is a no-op when no transport loaded', () => {
    const store = useEditorStore()

    // Should not throw
    store.pausePlayback()
    expect(store.isPlaying).toBe(false)
  })

  it('records explicit seek requests after a loaded-audio seek', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.seekRequest.version).toBe(0)
    expect(store.seekRequest.time).toBe(0)

    store.seekPlayback(999)

    expect(store.currentTime).toBe(120)
    expect(store.seekRequest.version).toBe(1)
    expect(store.seekRequest.time).toBe(120)
  })

  it('updates currentTime while playback loop is running', async () => {
    vi.useFakeTimers()

    let now = 0
    const mock = createMockAudioTransport()
    mock.transport.getCurrentTime = vi.fn(() => {
      now += 0.25
      return now
    })
    __overrideAudioTransportFactory(() => mock.transport)

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 0)
      return 1
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()
    await vi.runOnlyPendingTimersAsync()

    expect(store.currentTime).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it('adds timing point at progressed currentTime instead of 0', async () => {
    vi.useFakeTimers()
    let now = 0
    const mock = createMockAudioTransport()
    mock.transport.getCurrentTime = vi.fn(() => {
      now += 0.5
      return now
    })
    __overrideAudioTransportFactory(() => mock.transport)

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 0)
      return 2
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()
    await vi.runOnlyPendingTimersAsync()

    store.addTimingPoint({
      time: store.currentTime,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })

    const inserted = store.project.timingPoints[store.project.timingPoints.length - 1]
    expect(inserted.time).toBeGreaterThan(0)
    vi.useRealTimers()
  })
})

describe('editor store (phase 2 - TAP BPM)', () => {
  let mockTransport: AudioTransport
  let transportPlaying: () => boolean

  beforeEach(() => {
    const mock = createMockAudioTransport()
    mockTransport = mock.transport
    transportPlaying = mock.isPlaying
    __overrideAudioTransportFactory(() => mockTransport)
    setActivePinia(createPinia())
  })

  it('applies tap bpm to active timing point after >8 taps', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // 10 taps at 0.5s intervals → 120 BPM
    for (let i = 0; i < 10; i++) {
      store.tapBpm(i * 0.5)
    }

    expect(store.project.timingPoints[0].bpm).toBeGreaterThan(100)
  })

  it('starts playback from active timing point when tapping while paused', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // First play then pause to ensure transport exists and is paused
    await store.togglePlayback()
    store.pausePlayback()
    expect(transportPlaying()).toBe(false)

    // Tap should seek to active timing point (time 0) and start playback
    store.tapBpm(1.0)

    expect(mockTransport.seek).toHaveBeenCalled()
    expect(mockTransport.play).toHaveBeenCalled()
  })

  it('updates tapSampleCount and tapEstimatedBpm reactively', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.tapSampleCount).toBe(0)
    expect(store.tapEstimatedBpm).toBeNull()

    // 10 taps at 0.5s intervals
    for (let i = 0; i < 10; i++) {
      store.tapBpm(i * 0.5)
    }

    expect(store.tapSampleCount).toBeGreaterThan(8)
    expect(store.tapEstimatedBpm).toBeGreaterThan(100)
  })

  it('does not apply BPM before >8 taps', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    // Only 5 taps
    for (let i = 0; i < 5; i++) {
      store.tapBpm(i * 0.5)
    }

    // BPM should not have been applied yet (still default 120)
    expect(store.project.timingPoints[0].bpm).toBe(120)
    expect(store.tapEstimatedBpm).toBeNull()
  })

  it('tapCount increments on every tap', async () => {
    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))

    expect(store.tapCount).toBe(0)
    store.tapBpm(0.0)
    expect(store.tapCount).toBe(1)
    store.tapBpm(0.5)
    expect(store.tapCount).toBe(2)
  })

  it('tapBpm reports missing audio when no transport loaded', () => {
    // Use a fresh store with no audio imported
    const store = useEditorStore()

    store.tapBpm(0.5)
    expect(store.tapCount).toBe(0)
    expect(store.statusMessage?.key).toBe('status.tapBpm.noAudio')
  })
})

describe('editor store (phase 2 - metronome)', () => {
  let mockMetronome: MetronomeScheduler
  let schedulerEnabled: () => boolean
  let setEnabledCalls: Array<boolean>

  beforeEach(() => {
    const mock = createMockMetronome()
    mockMetronome = mock.scheduler
    schedulerEnabled = mock.enabled
    setEnabledCalls = mock.setEnabledCalls
    __overrideMetronomeFactory(() => mockMetronome)
    setActivePinia(createPinia())
  })

  it('toggles metronome between off and on (2 states only)', () => {
    const store = useEditorStore()

    // Initial state
    expect(store.metronomeState).toBe('off')
    expect(store.isMetronomeEnabled).toBe(false)

    // off → on
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')
    expect(store.isMetronomeEnabled).toBe(true)
    expect(schedulerEnabled()).toBe(true)

    // on → off (not playing, so no latch)
    store.toggleMetronome()
    expect(store.metronomeState).toBe('off')
    expect(store.isMetronomeEnabled).toBe(false)
    expect(setEnabledCalls).toContain(false)
  })

  it('clicking while latch_pending (playing) turns metronome back on', async () => {
    const mock = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mock.transport)
    setActivePinia(createPinia())

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback() // start playing

    // off → on
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')

    // on → latch_pending (because playing)
    store.toggleMetronome()
    expect(store.metronomeState).toBe('latch_pending')
    expect(store.isMetronomeEnabled).toBe(false)

    // latch_pending → on (clicking again turns it back on, not cycling to off)
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')
    expect(store.isMetronomeEnabled).toBe(true)
  })

  it('does not enter latch_pending when paused (goes directly to off)', () => {
    const store = useEditorStore()

    // off → on (not playing)
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')

    // on → off (not playing, should skip latch)
    store.toggleMetronome()
    expect(store.metronomeState).toBe('off')
    expect(store.isMetronomeEnabled).toBe(false)
    expect(mockMetronome.fireLatchNow).not.toHaveBeenCalled()
  })

  it('schedules latch at the next beat when manually pausing playback', async () => {
    const mock = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mock.transport)
    setActivePinia(createPinia())

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback() // start playing

    store.toggleMetronome() // off → on
    expect(store.metronomeState).toBe('on')

    store.pausePlayback()
    expect(store.metronomeState).toBe('on')
    expect(mockMetronome.handlePlaybackPaused).toHaveBeenCalledWith(0, {
      at: 0.5,
      isBarStart: false,
    })
    expect(mockMetronome.fireLatchNow).not.toHaveBeenCalled()
  })

  it('keeps metronome on without latch when pause is requested while already paused', async () => {
    const mock = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mock.transport)
    setActivePinia(createPinia())

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')

    store.pausePlayback()

    expect(store.metronomeState).toBe('on')
    expect(mockMetronome.handlePlaybackPaused).not.toHaveBeenCalled()
    expect(mockMetronome.fireLatchNow).not.toHaveBeenCalled()
  })

  it('schedules latch and clears state when upstream audio pauses unexpectedly', async () => {
    vi.useFakeTimers()
    const mock = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mock.transport)
    setActivePinia(createPinia())

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 0)
      return 3
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()
    store.toggleMetronome()

    mock.pauseExternally()
    await vi.runOnlyPendingTimersAsync()

    expect(store.isPlaying).toBe(false)
    expect(store.metronomeState).toBe('on')
    expect(mockMetronome.handlePlaybackPaused).toHaveBeenCalledWith(0, {
      at: 0.5,
      isBarStart: false,
    })
    vi.useRealTimers()
  })

  it('re-enables metronome hardware when resuming after a pause latch', async () => {
    const mock = createMockAudioTransport()
    __overrideAudioTransportFactory(() => mock.transport)
    setActivePinia(createPinia())

    const store = useEditorStore()
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    await store.togglePlayback()
    store.toggleMetronome()

    store.pausePlayback()
    await store.togglePlayback()

    expect(mockMetronome.setEnabled).toHaveBeenLastCalledWith(true)
    expect(store.metronomeState).toBe('on')
  })

  it('setSfxVolume applies volume to metronome after it is created', () => {
    const store = useEditorStore()

    // Create metronome first by toggling
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')

    // Now set SFX volume
    store.setSfxVolume(0.5)
    expect(mockMetronome.setSfxVolume).toHaveBeenCalledWith(0.5)
  })

  it('setMusicVolume does not affect metronome sfx volume', () => {
    const store = useEditorStore()

    store.setMusicVolume(0.3)
    expect(store.project.audio.musicVolume).toBe(0.3)
    expect(store.project.audio.sfxVolume).toBe(0.8) // unchanged default
  })

  it('turns metronome off silently while not playing', () => {
    const store = useEditorStore()

    // off → on
    store.toggleMetronome()
    expect(store.metronomeState).toBe('on')

    store.toggleMetronome()
    expect(store.metronomeState).toBe('off')
    expect(mockMetronome.fireLatchNow).not.toHaveBeenCalled()
    expect(mockMetronome.cancelPendingClicks).toHaveBeenCalledOnce()
  })
})

describe('editor store (phase 2 - reactive state)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('activeTimingPointId reflects current time', () => {
    const store = useEditorStore()

    // Default timing point at time=0
    expect(store.activeTimingPointId).toBe('tp-1')
  })

  it('initial reactive state has correct defaults', () => {
    const store = useEditorStore()

    expect(store.isPlaying).toBe(false)
    expect(store.currentTime).toBe(0)
    expect(store.metronomeState).toBe('off')
    expect(store.isMetronomeEnabled).toBe(false)
    expect(store.tapSampleCount).toBe(0)
    expect(store.tapEstimatedBpm).toBeNull()
  })
})

describe('lyrics actions', () => {
  let store: ReturnType<typeof useEditorStore>

  beforeEach(() => {
    const { transport } = createMockAudioTransport()
    const { scheduler } = createMockMetronome()
    __overrideAudioTransportFactory(() => transport)
    __overrideMetronomeFactory(() => scheduler)
    setActivePinia(createPinia())
    store = useEditorStore()
  })

  it('insertLyricLines appends lines and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    expect(store.project.lyrics).toHaveLength(2)
    expect(store.project.lyrics[0].id).toBe('l1')
    store.undo()
    expect(store.project.lyrics).toHaveLength(0)
  })

  it('removeLyricLine removes a line and is undoable', () => {
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    store.removeLyricLine('l1')
    expect(store.project.lyrics).toHaveLength(0)
    store.undo()
    expect(store.project.lyrics).toHaveLength(1)
  })

  it('setLineStartTime sets startTime and is undoable', () => {
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    store.setLineStartTime('l1', 1.5)
    expect(store.project.lyrics[0].startTime).toBe(1.5)
    store.undo()
    expect(store.project.lyrics[0].startTime).toBeUndefined()
  })

  it('setWordEndTime sets endTime and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    store.setWordEndTime('l1', 'w1', 2.0)
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    store.undo()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('clearWordEndTime clears endTime and is undoable', () => {
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 2.0 }], startTime: 0 },
    ])
    store.clearWordEndTime('l1', 'w1')
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
    store.undo()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('splitWord splits a word and is undoable', () => {
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    store.splitWord('l1', 'w1', 2)
    expect(store.project.lyrics[0].words).toHaveLength(2)
    expect(store.project.lyrics[0].words[0].text).toBe('he')
    expect(store.project.lyrics[0].words[1].text).toBe('llo')
    store.undo()
    expect(store.project.lyrics[0].words).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('hello')
  })

  it('mergeWords merges adjacent words and is undoable', () => {
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hel', endTime: 1.0 },
          { id: 'w2', text: 'lo', endTime: 2.0 },
        ],
      },
    ])
    store.mergeWords('l1', 'w1')
    expect(store.project.lyrics[0].words).toHaveLength(1)
    expect(store.project.lyrics[0].words[0].text).toBe('hello')
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    store.undo()
    expect(store.project.lyrics[0].words).toHaveLength(2)
  })

  it('removeWord removes a single word and is undoable', () => {
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world', endTime: 1.0 },
          { id: 'w3', text: 'big' },
        ],
      },
    ])
    store.removeWord('l1', 'w2')
    expect(store.project.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w3'])
    store.undo()
    expect(store.project.lyrics[0].words.map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
    expect(store.project.lyrics[0].words[1].endTime).toBe(1.0)
  })
})

describe('editor store (phase 2 - bar-step seek)', () => {
  let mockTransport: AudioTransport

  beforeEach(() => {
    const mock = createMockAudioTransport()
    mockTransport = mock.transport
    __overrideAudioTransportFactory(() => mockTransport)
    setActivePinia(createPinia())
  })

  it('seekToPreviousBar jumps to previous bar boundary', async () => {
    const store = useEditorStore()
    // Import audio so seekPlayback works
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })
    store.seekPlayback(2.5) // middle of bar 1 (bar 1 = beats 4-7 = 2s-4s)
    store.seekToPreviousBar()
    expect(store.currentTime).toBeLessThan(2.5)
  })

  it('seekToNextBar jumps to next bar boundary', async () => {
    const store = useEditorStore()
    // Import audio so seekPlayback works
    await store.importAudioFile(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))
    store.addTimingPoint({
      time: 0,
      bpm: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    })
    store.seekPlayback(1.0)
    store.seekToNextBar()
    expect(store.currentTime).toBeCloseTo(2.0, 3)
  })
})
