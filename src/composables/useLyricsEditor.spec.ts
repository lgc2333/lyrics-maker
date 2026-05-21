import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import type { AudioTransport } from '../platform/audio/audio-transport'
import type { MetronomeScheduler } from '../platform/audio/metronome'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../stores/editor-store'
import { useLyricsEditor } from './useLyricsEditor'

function createMockAudioTransport(): AudioTransport {
  let _playing = false
  let _currentTime = 0
  return {
    loadFile: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(async () => {
      _playing = true
    }),
    pause: vi.fn(() => {
      _playing = false
    }),
    seek: vi.fn((t: number) => {
      _currentTime = t
    }),
    getCurrentTime: vi.fn(() => _currentTime),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => _playing),
    destroy: vi.fn(),
  }
}

function createMockMetronome(): MetronomeScheduler {
  return {
    setEnabled: vi.fn(),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    hasPendingLatch: vi.fn(() => false),
    fireLatchNow: vi.fn(),
    getLoadError: vi.fn(() => null),
    destroy: vi.fn(),
  }
}

function mountEditor() {
  let editor: ReturnType<typeof useLyricsEditor>
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = useLyricsEditor()
        return editor
      },
      template: '<div />',
    }),
  )
  return { wrapper, editor: editor! }
}

describe('useLyricsEditor', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('initializes with null activeLineId and index 0', () => {
    const { editor } = mountEditor()
    expect(editor.activeLineId.value).toBeNull()
    expect(editor.activeWordIndex.value).toBe(0)
    expect(editor.splitBarMode.value).toBe('select')
  })

  it('activateLine sets activeLineId and resets activeWordIndex', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 1.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(editor.activeLineId.value).toBe('l1')
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('activateLine seeks to line startTime when available', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 5.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(store.currentTime).toBe(5.0)
  })

  it('activateLine seeks to prev line last word endTime when no startTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a', endTime: 3.0 }], startTime: 0 },
      { id: 'l2', words: [{ id: 'w2', text: 'b' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    expect(store.currentTime).toBe(3.0)
  })

  it('activateLine seeks to prev line startTime when prev has no word endTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a' }], startTime: 2.0 },
      { id: 'l2', words: [{ id: 'w2', text: 'b' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    expect(store.currentTime).toBe(2.0)
  })

  it('activateLine does not seek when no time info available', () => {
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'a' }] }])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    expect(store.currentTime).toBe(0)
  })

  it('activateLine with invalid id does nothing', () => {
    const { editor } = mountEditor()
    editor.activateLine('nonexistent')
    expect(editor.activeLineId.value).toBeNull()
  })
})

describe('handleMarkKey (D)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleMarkKey()
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('at index 0: sets line startTime and advances to 1', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleMarkKey(1.0)
    await nextTick()
    expect(store.project.lyrics[0].startTime).toBe(1.0)
    expect(editor.activeWordIndex.value).toBe(1)
  })

  it('at index 1: sets word[0].endTime and advances to 2', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(1.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(1.5)
    expect(editor.activeWordIndex.value).toBe(2)
  })

  it('at index N (last word): does nothing', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('overwrites existing endTime (re-timing)', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello', endTime: 1.0 },
          { id: 'w2', text: 'world' },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('clears endTime of subsequent words when time exceeds them', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a' },
          { id: 'w2', text: 'b', endTime: 1.5 },
          { id: 'w3', text: 'c', endTime: 2.0 },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkKey(2.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.5)
    expect(store.project.lyrics[0].words[1].endTime).toBeUndefined()
    expect(store.project.lyrics[0].words[2].endTime).toBeUndefined()
  })
})

describe('handleNextLineKey (Enter)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleNextLineKey()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing on last line', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(editor.activeLineId.value).toBe('l1')
  })

  it('skips to next line without modifying current line if startTime undefined', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(editor.activeLineId.value).toBe('l2')
    expect(editor.activeWordIndex.value).toBe(0)
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('sets last word endTime and advances to next line', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleNextLineKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(2.0)
    expect(editor.activeLineId.value).toBe('l2')
    expect(editor.activeWordIndex.value).toBe(0)
  })
})

describe('handleMarkNoAdvanceKey (Shift+D)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('sets endTime but does NOT advance activeWordIndex', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkNoAdvanceKey(1.5)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBe(1.5)
    expect(editor.activeWordIndex.value).toBe(1)
  })

  it('at index 0: sets startTime but does NOT advance', async () => {
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleMarkNoAdvanceKey(1.0)
    await nextTick()
    expect(store.project.lyrics[0].startTime).toBe(1.0)
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('at index N: does nothing', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1
    editor.handleMarkNoAdvanceKey(2.0)
    await nextTick()
    expect(store.project.lyrics[0].words[0].endTime).toBeUndefined()
  })
})

describe('handleDeleteLine (Delete)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('removes active line and activates next', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(1)
    expect(editor.activeLineId.value).toBe('l2')
  })

  it('activates previous line if deleting last', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }] },
      { id: 'l2', words: [{ id: 'w2', text: 'world' }] },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l2')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(1)
    expect(editor.activeLineId.value).toBe('l1')
  })

  it('sets activeLineId to null if list becomes empty', async () => {
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleDeleteLine()
    await nextTick()
    expect(store.project.lyrics).toHaveLength(0)
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handleDeleteLine()
    expect(editor.activeLineId.value).toBeNull()
  })
})

describe('handlePlayLineInterval (C)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handlePlayLineInterval()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing when line has no startTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([{ id: 'l1', words: [{ id: 'w1', text: 'hello' }] }])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handlePlayLineInterval()
  })

  it('seeks to line startTime when line has time range', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 3.0 }], startTime: 1.0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handlePlayLineInterval()
    expect(store.currentTime).toBe(1.0)
  })
})

describe('handlePlayWordInterval (V)', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('does nothing when activeLineId is null', () => {
    const { editor } = mountEditor()
    editor.handlePlayWordInterval()
    expect(editor.activeLineId.value).toBeNull()
  })

  it('does nothing at index 0 (start block)', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello', endTime: 2.0 }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handlePlayWordInterval()
  })

  it('seeks to word start when word has endTime', () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a', endTime: 1.0 },
          { id: 'w2', text: 'b', endTime: 2.0 },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 2
    editor.handlePlayWordInterval()
    expect(store.currentTime).toBe(1.0)
  })
})

describe('undo/redo activeWordIndex sync', () => {
  beforeEach(async () => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome())
    setActivePinia(createPinia())
    const store = useEditorStore()
    await store.importAudioFile(new File([], 'test.mp3'))
  })

  it('resets to 0 when line startTime is undone', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'hello' },
          { id: 'w2', text: 'world' },
        ],
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.handleMarkKey(1.0)
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)

    store.undo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(0)
  })

  it('derives index from first undefined endTime after undo', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      {
        id: 'l1',
        words: [
          { id: 'w1', text: 'a' },
          { id: 'w2', text: 'b' },
          { id: 'w3', text: 'c' },
        ],
        startTime: 0,
      },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1

    editor.handleMarkKey(1.0)
    await nextTick()
    editor.handleMarkKey(2.0)
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(3)

    store.undo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(2)

    store.undo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)
  })

  it('sets index to N when all words have endTime (redo)', async () => {
    const store = useEditorStore()
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'hello' }], startTime: 0 },
    ])
    const { editor } = mountEditor()
    editor.activateLine('l1')
    editor.activeWordIndex.value = 1

    editor.handleMarkKey(1.0)
    await nextTick()
    store.undo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)

    store.redo()
    await nextTick()
    expect(editor.activeWordIndex.value).toBe(1)
  })
})
