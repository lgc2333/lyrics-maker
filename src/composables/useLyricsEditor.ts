import { computed, ref, watch } from 'vue'

import { useEditorStore } from '../stores/editor-store'

export type LyricsEditorContext = ReturnType<typeof useLyricsEditor>

export function useLyricsEditor() {
  const store = useEditorStore()

  const activeLineId = ref<string | null>(null)
  const activeWordIndex = ref(0)
  const splitBarMode = ref<'cut' | 'select'>('select')

  const activeLine = computed(() =>
    activeLineId.value
      ? store.project.lyrics.find((l) => l.id === activeLineId.value) ?? null
      : null,
  )

  function activateLine(lineId: string): void {
    const lyrics = store.project.lyrics
    const line = lyrics.find((l) => l.id === lineId)
    if (!line) return
    activeLineId.value = lineId
    activeWordIndex.value = 0

    // Seek strategy (spec §5 priority degradation)
    if (line.startTime !== undefined) {
      store.seekPlayback(line.startTime)
    } else {
      const lineIndex = lyrics.findIndex((l) => l.id === lineId)
      if (lineIndex > 0) {
        const prevLine = lyrics[lineIndex - 1]
        const prevLastWord = prevLine.words[prevLine.words.length - 1]
        if (prevLastWord?.endTime !== undefined) {
          store.seekPlayback(prevLastWord.endTime)
        } else if (prevLine.startTime !== undefined) {
          store.seekPlayback(prevLine.startTime)
        }
      }
    }
  }

  // Undo/Redo sync: re-derive activeWordIndex from data state
  watch(
    () => activeLine.value,
    (line) => {
      if (!line) return
      if (line.startTime === undefined) {
        activeWordIndex.value = 0
        return
      }
      const firstUndef = line.words.findIndex((w) => w.endTime === undefined)
      activeWordIndex.value =
        firstUndef === -1 ? line.words.length : firstUndef + 1
    },
  )

  return {
    activeLineId,
    activeWordIndex,
    splitBarMode,
    activeLine,
    activateLine,
  }
}
