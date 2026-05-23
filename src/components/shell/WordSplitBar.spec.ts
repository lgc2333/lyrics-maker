import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import zhCN from '../../i18n/locales/zh-CN.json'
import type { AudioTransport } from '../../platform/audio/audio-transport'
import {
  __overrideAudioTransportFactory,
  __overrideMetronomeFactory,
  useEditorStore,
} from '../../stores/editor-store'
import WordSplitBar from './WordSplitBar.vue'
import { LYRICS_EDITOR_KEY } from './injection-keys'

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
    setSfxVolume: vi.fn(),
    syncToTimeline: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': zhCN },
})

function createMockLyricsEditor(overrides = {}) {
  const activeLineId = ref(null as string | null)
  const activeWordIndex = ref(0)
  const splitBarMode = ref('timing' as 'cut' | 'timing' | 'edit')

  return {
    activeLineId,
    activeWordIndex,
    splitBarMode,
    activeLine: computed(() => {
      if (!activeLineId.value) return null
      const store = useEditorStore()
      return store.project.lyrics.find((l) => l.id === activeLineId.value) ?? null
    }),
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

function mountComponent(
  lyricsEditor = createMockLyricsEditor(),
  options: { attachTo?: HTMLElement } = {},
) {
  return {
    wrapper: mount(WordSplitBar, {
      attachTo: options.attachTo,
      global: {
        plugins: [i18n],
        provide: {
          [LYRICS_EDITOR_KEY as symbol]: lyricsEditor,
        },
      },
    }),
    lyricsEditor,
  }
}

describe('wordSplitBar', () => {
  beforeEach(() => {
    __overrideAudioTransportFactory(() => createMockAudioTransport())
    __overrideMetronomeFactory(() => createMockMetronome() as any)
    setActivePinia(createPinia())
  })

  describe('empty state', () => {
    it('shows hint text when no active line', () => {
      const { wrapper } = mountComponent()
      expect(wrapper.text()).toContain(zhCN.lyrics.emptyHint)
    })

    it('does not render start block or word blocks when no active line', () => {
      const { wrapper } = mountComponent()
      expect(wrapper.find('[data-testid="start-block"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid="word-block"]')).toHaveLength(0)
    })
  })

  describe('mode toggle', () => {
    it('starts in timing mode by default', () => {
      const { lyricsEditor } = mountComponent()
      expect(lyricsEditor.splitBarMode.value).toBe('timing')
    })

    it('switches to cut mode when cut button is clicked', async () => {
      const { wrapper, lyricsEditor } = mountComponent()
      const buttons = wrapper
        .find('[data-testid="split-bar-mode-toggle"]')
        .findAll('button')
      await buttons[0].trigger('click')
      expect(lyricsEditor.splitBarMode.value).toBe('cut')
    })

    it('switches to edit mode when edit button is clicked', async () => {
      const { wrapper, lyricsEditor } = mountComponent()
      const buttons = wrapper
        .find('[data-testid="split-bar-mode-toggle"]')
        .findAll('button')
      await buttons[2].trigger('click')
      expect(lyricsEditor.splitBarMode.value).toBe('edit')
    })
  })

  describe('start block rendering', () => {
    it('shows a start block when an active line exists', () => {
      const store = useEditorStore()
      store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'Hello' }] }])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.find('[data-testid="start-block"]').exists()).toBe(true)
    })

    it('applies active coloring when activeWordIndex is 0', () => {
      const store = useEditorStore()
      store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'Hello' }] }])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 0
      const { wrapper } = mountComponent(lyricsEditor)
      const startBlock = wrapper.find('[data-testid="start-block"]')
      expect(startBlock.classes()).toContain('bg-error/30')
      expect(startBlock.classes()).toContain('border-error')
    })

    it('applies timed coloring when startTime is defined and not active', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        { id: 'line-1', startTime: 1.5, words: [{ id: 'w1', text: 'Hello' }] },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // not 0, so start block is not active
      const { wrapper } = mountComponent(lyricsEditor)
      const startBlock = wrapper.find('[data-testid="start-block"]')
      expect(startBlock.classes()).toContain('bg-success/30')
      expect(startBlock.classes()).toContain('border-success')
    })

    it('applies untimed coloring when startTime is undefined and not active', () => {
      const store = useEditorStore()
      store.insertLyricLines([{ id: 'line-1', words: [{ id: 'w1', text: 'Hello' }] }])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // not 0
      const { wrapper } = mountComponent(lyricsEditor)
      const startBlock = wrapper.find('[data-testid="start-block"]')
      expect(startBlock.classes()).toContain('bg-base-300/50')
      expect(startBlock.classes()).toContain('border-base-300')
    })
  })

  describe('word block rendering in select mode', () => {
    it('renders word blocks for each word', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      const { wrapper } = mountComponent(lyricsEditor)
      const blocks = wrapper.findAll('[data-testid="word-block"]')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].text()).toBe('Hello')
      expect(blocks[1].text()).toBe('world')
    })

    it('clicking a word sets activeWordIndex', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      const { wrapper } = mountComponent(lyricsEditor)
      const blocks = wrapper.findAll('[data-testid="word-block"]')

      await blocks[1].trigger('click')
      // word at array index 1 → activeWordIndex 2 (index+1)
      expect(lyricsEditor.activeWordIndex.value).toBe(2)
    })
  })

  describe('word coloring', () => {
    it('applies active coloring to word matching activeWordIndex', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // first word active
      const { wrapper } = mountComponent(lyricsEditor)
      const blocks = wrapper.findAll('[data-testid="word-block"]')
      expect(blocks[0].classes()).toContain('bg-error/30')
      expect(blocks[0].classes()).toContain('border-error')
    })

    it('applies timed coloring to word with endTime', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello', endTime: 2.5 },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 2 // second word active, so first is not active
      const { wrapper } = mountComponent(lyricsEditor)
      const blocks = wrapper.findAll('[data-testid="word-block"]')
      expect(blocks[0].classes()).toContain('bg-success/30')
      expect(blocks[0].classes()).toContain('border-success')
    })

    it('applies untimed coloring to word without endTime and not active', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // first word active, second is untimed
      const { wrapper } = mountComponent(lyricsEditor)
      const blocks = wrapper.findAll('[data-testid="word-block"]')
      expect(blocks[1].classes()).toContain('bg-base-300/50')
      expect(blocks[1].classes()).toContain('border-base-300')
    })
  })

  describe('cut mode rendering', () => {
    it('shows individual characters with gap hotspots in cut mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'ABC' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)

      // Should show word-block-cut instead of word-block
      expect(wrapper.findAll('[data-testid="word-block"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid="word-block-cut"]')).toHaveLength(1)

      // Characters: A, B, C → 2 gaps between them
      const gaps = wrapper.findAll('[data-testid="char-gap"]')
      expect(gaps).toHaveLength(2)
    })

    it('does not show character gaps for single-character words', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'A' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)
      const gaps = wrapper.findAll('[data-testid="char-gap"]')
      expect(gaps).toHaveLength(0)
    })
  })

  describe('character gap click (split)', () => {
    it('calls store.splitWord when clicking a gap in cut mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'ABC' }],
        },
      ])
      const splitSpy = vi.spyOn(store, 'splitWord')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)

      const gaps = wrapper.findAll('[data-testid="char-gap"]')
      // Click gap between A and B (charIndex=1)
      await gaps[0].trigger('click')
      expect(splitSpy).toHaveBeenCalledWith('line-1', 'w1', 1)
    })

    it('does not call splitWord in select mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'ABC' }],
        },
      ])
      const splitSpy = vi.spyOn(store, 'splitWord')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)

      // Switch to select mode before clicking
      lyricsEditor.splitBarMode.value = 'timing'
      await wrapper.vm.$nextTick()

      // In select mode, no char-gaps are rendered, so nothing to click
      const gaps = wrapper.findAll('[data-testid="char-gap"]')
      expect(gaps).toHaveLength(0)
      expect(splitSpy).not.toHaveBeenCalled()
    })
  })

  describe('split line click (merge)', () => {
    it('calls store.mergeWords when clicking the split line between words in cut mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'Hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const mergeSpy = vi.spyOn(store, 'mergeWords')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)

      const splitLines = wrapper.findAll('[data-testid="split-line"]')
      expect(splitLines).toHaveLength(1) // one split line between two words
      await splitLines[0].trigger('click')
      // mergeWords is called with lineId and the ID of the previous word
      expect(mergeSpy).toHaveBeenCalledWith('line-1', 'w1')
    })
  })

  describe('numeric editor', () => {
    it('shows numeric editor when a word is active in select mode', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'Hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // first word active
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.find('[data-testid="numeric-editor"]').exists()).toBe(true)
    })

    it('does not show numeric editor when start block is active (index 0)', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'Hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 0
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.find('[data-testid="numeric-editor"]').exists()).toBe(false)
    })

    it('does not show numeric editor when no active line', () => {
      const { wrapper } = mountComponent()
      expect(wrapper.find('[data-testid="numeric-editor"]').exists()).toBe(false)
    })

    it('does not show numeric editor in cut mode', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'Hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.find('[data-testid="numeric-editor"]').exists()).toBe(false)
    })
  })

  describe('start block click', () => {
    it('sets activeWordIndex to 0 when clicking start block in select mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'Hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.activeWordIndex.value = 1 // start with word active
      const { wrapper } = mountComponent(lyricsEditor)
      const startBlock = wrapper.find('[data-testid="start-block"]')
      await startBlock.trigger('click')
      expect(lyricsEditor.activeWordIndex.value).toBe(0)
    })
  })

  describe('start block visibility per mode', () => {
    function mountWithMode(mode: 'cut' | 'timing' | 'edit') {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'Hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = mode
      return mountComponent(lyricsEditor)
    }

    it('shows start block in timing mode', () => {
      const { wrapper } = mountWithMode('timing')
      expect(wrapper.findAll('[data-testid="start-block"]')).toHaveLength(1)
    })

    it('hides start block in cut mode', () => {
      const { wrapper } = mountWithMode('cut')
      expect(wrapper.findAll('[data-testid="start-block"]')).toHaveLength(0)
    })

    it('hides start block in edit mode', () => {
      const { wrapper } = mountWithMode('edit')
      expect(wrapper.findAll('[data-testid="start-block"]')).toHaveLength(0)
    })
  })

  describe('blur commits word edit', () => {
    it('commits the edited text when the word input loses focus', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'hello' }],
        },
      ])
      const updateSpy = vi.spyOn(store, 'updateWordText')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor)

      const wordBlock = wrapper.findAll('[data-testid="word-edit-block"]')[0]
      await wordBlock.trigger('click')

      const input = wrapper.find('input[data-testid="word-edit-input"]')
      expect(input.exists()).toBe(true)
      await input.setValue('changed')
      await input.trigger('blur')

      expect(updateSpy).toHaveBeenCalledWith('line-1', 'w1', 'changed')
    })
  })

  describe('whole-line edit auto focus', () => {
    it('focuses the input after clicking the whole-line edit button', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor, {
        attachTo: document.body,
      })

      const editBtn = wrapper.find('[data-testid="whole-line-edit-btn"]')
      expect(editBtn.exists()).toBe(true)
      await editBtn.trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[data-testid="whole-line-input"]')
      expect(input.exists()).toBe(true)
      expect(document.activeElement).toBe(input.element)

      wrapper.unmount()
    })
  })

  describe('edit mode: delete word block', () => {
    it('renders a delete button on each word block in edit mode', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor)

      const deleteBtns = wrapper.findAll('[data-testid="word-delete-btn"]')
      expect(deleteBtns).toHaveLength(2)
    })

    it('does not render delete buttons in timing mode', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'timing'
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.findAll('[data-testid="word-delete-btn"]')).toHaveLength(0)
    })

    it('does not render delete buttons in cut mode', () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'hello' }],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'cut'
      const { wrapper } = mountComponent(lyricsEditor)
      expect(wrapper.findAll('[data-testid="word-delete-btn"]')).toHaveLength(0)
    })

    it('clicking the delete button removes the word via store.removeWord', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const removeSpy = vi.spyOn(store, 'removeWord')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor)

      const deleteBtns = wrapper.findAll('[data-testid="word-delete-btn"]')
      await deleteBtns[0].trigger('click')

      expect(removeSpy).toHaveBeenCalledWith('line-1', 'w1')
    })

    it('clicking the delete button does NOT open the edit input for that word', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor)

      const deleteBtns = wrapper.findAll('[data-testid="word-delete-btn"]')
      await deleteBtns[0].trigger('click')

      // After delete, no word edit input should appear (the word is removed)
      expect(wrapper.find('input[data-testid="word-edit-input"]').exists()).toBe(false)
    })

    it('right-clicking a word block removes the word via store.removeWord', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [
            { id: 'w1', text: 'hello' },
            { id: 'w2', text: 'world' },
          ],
        },
      ])
      const removeSpy = vi.spyOn(store, 'removeWord')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'edit'
      const { wrapper } = mountComponent(lyricsEditor)

      const wordBlocks = wrapper.findAll('[data-testid="word-edit-block"]')
      await wordBlocks[1].trigger('contextmenu')

      expect(removeSpy).toHaveBeenCalledWith('line-1', 'w2')
    })

    it('right-click does NOT remove words in timing mode', async () => {
      const store = useEditorStore()
      store.insertLyricLines([
        {
          id: 'line-1',
          words: [{ id: 'w1', text: 'hello' }],
        },
      ])
      const removeSpy = vi.spyOn(store, 'removeWord')
      const lyricsEditor = createMockLyricsEditor()
      lyricsEditor.activeLineId.value = 'line-1'
      lyricsEditor.splitBarMode.value = 'timing'
      const { wrapper } = mountComponent(lyricsEditor)

      const wordBlocks = wrapper.findAll('[data-testid="word-block"]')
      await wordBlocks[0].trigger('contextmenu')

      expect(removeSpy).not.toHaveBeenCalled()
    })
  })
})
