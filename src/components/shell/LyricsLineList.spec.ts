import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import zhCN from '../../i18n/locales/zh-CN.json'
import type { AudioTransport } from '../../platform/audio/audio-transport'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../../stores/editor-store'
import LyricsLineList from './LyricsLineList.vue'
import { LYRICS_EDITOR_KEY } from './injection-keys'

// Mock @iconify/vue (project convention — Icon triggers CDN fetches in happy-dom)
vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({ props: ['icon'], template: '<span />' }),
}))

function createMockAudioTransport(): AudioTransport {
  let currentTime = 0
  return {
    loadFile: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    seek: vi.fn((time: number) => {
      currentTime = time
    }),
    getCurrentTime: vi.fn(() => currentTime),
    getDuration: vi.fn(() => 120),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 1),
    getIsPlaying: vi.fn(() => false),
    destroy: vi.fn(),
  }
}

function createMockMetronome() {
  return {
    setGain: vi.fn(),
    setEnabled: vi.fn(),
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    handlePlaybackPaused: vi.fn(),
    cancelPendingClicks: vi.fn(),
    hasPendingLatch: vi.fn(() => false),
    fireLatchNow: vi.fn(),
    getLoadError: vi.fn(() => null),
    stop: vi.fn(),
    destroy: vi.fn(),
  }
}

function createMockLyricsEditor(overrides = {}) {
  return {
    activeLineId: ref(null as string | null),
    activeWordIndex: ref(0),
    splitBarMode: ref('select' as 'cut' | 'select'),
    activeLine: ref(null),
    activateLine: vi.fn(),
    handleMarkKey: vi.fn(),
    handleNextLineKey: vi.fn(),
    handleMarkNoAdvanceKey: vi.fn(),
    handleDeleteLine: vi.fn(),
    handlePlayLineInterval: vi.fn(),
    handlePlayWordInterval: vi.fn(),
    ...overrides,
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': zhCN },
})

function mountComponent(lyricsEditor = createMockLyricsEditor()) {
  return mount(LyricsLineList, {
    global: {
      plugins: [i18n],
      provide: {
        [LYRICS_EDITOR_KEY as symbol]: lyricsEditor,
      },
    },
  })
}

describe('lyricsLineList', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome() as any)
    setActivePinia(createPinia())
  })

  describe('empty state', () => {
    it('does not render the line list when lyrics is empty', () => {
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      expect(rows).toHaveLength(0)
    })
  })

  describe('line rendering', () => {
    function addTestLines() {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: ' world' },
          ],
          startTime: 1.5,
        },
        {
          id: 'line-2',
          words: [{ id: 'w3', text: 'Second line' }],
        },
      ])
    }

    it('renders one row per lyric line', () => {
      addTestLines()
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      expect(rows).toHaveLength(2)
    })

    it('shows 1-based index number for each line', () => {
      addTestLines()
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      expect(rows[0].text()).toContain('1')
      expect(rows[1].text()).toContain('2')
    })

    it('shows formatted start time when startTime is defined', () => {
      addTestLines()
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      // 1.5 seconds → "00:01.500"
      expect(rows[0].text()).toContain('00:01.500')
    })

    it('shows "--:--" when startTime is undefined', () => {
      addTestLines()
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      expect(rows[1].text()).toContain('--:--')
    })

    it('displays all words in line text area', () => {
      addTestLines()
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      const text = rows[0].text()
      expect(text).toContain('Hello')
      expect(text).toContain('world')
    })
  })

  describe('word status', () => {
    it('shows timed/total count when line has startTime', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          startTime: 0,
          words: [
            { id: 'w1', text: 'A', endTime: 1 },
            { id: 'w2', text: 'B', endTime: 2 },
            { id: 'w3', text: 'C' },
          ],
        },
      ])
      const wrapper = mountComponent()
      const row = wrapper.find('[data-testid="lyrics-line-row"]')
      expect(row.text()).toContain('2/3')
    })

    it('shows total/total when all words are timed', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          startTime: 0,
          words: [
            { id: 'w1', text: 'A', endTime: 1 },
            { id: 'w2', text: 'B', endTime: 2 },
          ],
        },
      ])
      const wrapper = mountComponent()
      const row = wrapper.find('[data-testid="lyrics-line-row"]')
      expect(row.text()).toContain('2/2')
    })

    it('shows empty word status when line has no startTime', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'A' }],
        },
      ])
      const wrapper = mountComponent()
      const row = wrapper.find('[data-testid="lyrics-line-row"]')
      // Should not contain "0/1" or any fraction
      expect(row.text()).not.toMatch(/\d+\/\d+/)
    })
  })

  describe('selected state', () => {
    it('applies bg-primary/10 to line matching activeLineId', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        { id: 'line-1', words: [{ id: 'w1', text: 'A' }] },
        { id: 'line-2', words: [{ id: 'w2', text: 'B' }] },
      ])
      const lyricsEditor = createMockLyricsEditor({
        activeLineId: ref('line-1'),
      })
      const wrapper = mountComponent(lyricsEditor)
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      expect(rows[0].classes()).toContain('bg-primary/10')
      expect(rows[1].classes()).not.toContain('bg-primary/10')
    })

    it('does not apply selected class when no line is active', () => {
      const store = useEditorStore()
      store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'A' }] }])
      const wrapper = mountComponent()
      const row = wrapper.find('[data-testid="lyrics-line-row"]')
      expect(row.classes()).not.toContain('bg-primary/10')
    })
  })

  describe('active state (playback cursor)', () => {
    /** Initialize the audio transport so seekPlayback actually sets currentTime */
    async function initAudio() {
      const store = useEditorStore()
      await store.importAudioFile(new File([], 'test.wav'))
    }

    it('applies border-l-success to last line whose startTime <= currentTime', async () => {
      await initAudio()
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          startTime: 0,
          words: [{ id: 'w1', text: 'A' }],
        },
        {
          id: 'line-2',
          startTime: 5,
          words: [{ id: 'w2', text: 'B' }],
        },
        {
          id: 'line-3',
          startTime: 10,
          words: [{ id: 'w3', text: 'C' }],
        },
      ])
      // Seek to time 7 — between line-2 (5) and line-3 (10)
      store.seekPlayback(7)
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')

      expect(rows[0].classes()).toContain('border-l-transparent')
      expect(rows[0].classes()).not.toContain('border-l-success')

      expect(rows[1].classes()).toContain('border-l-success')
      expect(rows[1].classes()).not.toContain('border-l-transparent')

      expect(rows[2].classes()).toContain('border-l-transparent')
      expect(rows[2].classes()).not.toContain('border-l-success')
    })

    it('applies border-l-transparent to all lines when none has startTime <= currentTime', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          startTime: 10,
          words: [{ id: 'w1', text: 'A' }],
        },
      ])
      // currentTime defaults to 0, which is < 10
      const wrapper = mountComponent()
      const row = wrapper.find('[data-testid="lyrics-line-row"]')
      expect(row.classes()).toContain('border-l-transparent')
      expect(row.classes()).not.toContain('border-l-success')
    })

    it('skips lines without startTime in active determination', async () => {
      await initAudio()
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          startTime: 0,
          words: [{ id: 'w1', text: 'A' }],
        },
        {
          id: 'line-2',
          words: [{ id: 'w2', text: 'B' }],
          // No startTime
        },
      ])
      store.seekPlayback(5)
      const wrapper = mountComponent()
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')
      // line-1 has startTime=0 <= 5, so it should be active
      expect(rows[0].classes()).toContain('border-l-success')
      // line-2 has no startTime, should not be active
      expect(rows[1].classes()).toContain('border-l-transparent')
    })
  })

  describe('click handler', () => {
    it('calls lyricsEditor.activateLine with the line id when clicked', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        { id: 'line-1', words: [{ id: 'w1', text: 'A' }] },
        { id: 'line-2', words: [{ id: 'w2', text: 'B' }] },
      ])
      const lyricsEditor = createMockLyricsEditor()
      const wrapper = mountComponent(lyricsEditor)
      const rows = wrapper.findAll('[data-testid="lyrics-line-row"]')

      await rows[1].trigger('click')
      expect(lyricsEditor.activateLine).toHaveBeenCalledWith('line-2')
    })

    it('calls activateLine with correct id for the first line', async () => {
      const store = useEditorStore()
      store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'A' }] }])
      const lyricsEditor = createMockLyricsEditor()
      const wrapper = mountComponent(lyricsEditor)
      const row = wrapper.find('[data-testid="lyrics-line-row"]')

      await row.trigger('click')
      expect(lyricsEditor.activateLine).toHaveBeenCalledWith('line-1')
    })
  })
})
