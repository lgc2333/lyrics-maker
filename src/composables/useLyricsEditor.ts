import { computed, ref, watch } from 'vue'

import { clampWordTime, computeSnappedTime } from '../core/lyrics/snap-time'
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

  function _getSnappedTime(rawTime: number): number {
    const line = activeLine.value
    if (!line) return rawTime
    const existingEndTimes = line.words
      .map((w) => w.endTime)
      .filter((t): t is number => t !== undefined)
    return computeSnappedTime({
      rawTime,
      snapEnabled: store.project.settings.snapEnabled,
      timingPoints: store.project.timingPoints,
      divisor: store.project.settings.snapDivisor,
      triplets: store.project.settings.rhythmMode === 'triplets',
      existingEndTimes,
    })
  }

  function _getPrevEndTime(wordIndex: number): number | undefined {
    const line = activeLine.value
    if (!line) return undefined
    if (wordIndex === 0) return line.startTime
    return line.words[wordIndex - 1]?.endTime
  }

  function handleMarkKey(currentTime?: number): void {
    if (!activeLineId.value) return
    const line = activeLine.value
    if (!line) return
    const N = line.words.length

    if (activeWordIndex.value >= N) return

    const rawTime = currentTime ?? store.currentTime

    if (activeWordIndex.value === 0) {
      const time = _getSnappedTime(rawTime)
      const clamped = clampWordTime(time, undefined, store.duration)
      store.setLineStartTime(activeLineId.value, clamped)
      activeWordIndex.value = 1
      if (!store.isPlaying) store.togglePlayback()
      return
    }

    const wordIndex = activeWordIndex.value - 1
    const word = line.words[wordIndex]
    if (!word) return

    const time = _getSnappedTime(rawTime)
    const prevEnd = _getPrevEndTime(wordIndex)
    const clamped = clampWordTime(time, prevEnd, store.duration)

    // Overflow check: clear subsequent words whose endTime <= clamped
    for (let k = wordIndex + 1; k < line.words.length; k++) {
      const w = line.words[k]
      if (w.endTime !== undefined && w.endTime <= clamped) {
        store.clearWordEndTime(activeLineId.value, w.id)
      } else {
        break
      }
    }

    store.setWordEndTime(activeLineId.value, word.id, clamped)
    activeWordIndex.value += 1
  }

  return {
    activeLineId,
    activeWordIndex,
    splitBarMode,
    activeLine,
    activateLine,
    handleMarkKey,
  }
}
