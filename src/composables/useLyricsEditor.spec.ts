import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

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
    play: vi.fn(async () => { _playing = true }),
    pause: vi.fn(() => { _playing = false }),
    seek: vi.fn((t: number) => { _currentTime = t }),
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
    store.insertLyricLines([
      { id: 'l1', words: [{ id: 'w1', text: 'a' }] },
    ])
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
