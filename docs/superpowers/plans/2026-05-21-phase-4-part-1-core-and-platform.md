# Phase 4 歌词打轴 — Part 1: Core & Platform Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the data model changes, lyrics commands, snap-to-nearest-grid utility, and shortcut registry extensions needed for Phase 4 lyrics timing. All pure logic, no Vue components.

**Architecture:** Three independent work streams that can be implemented in parallel: (A) domain model refactor + 7 new commands, (B) `snapToNearestGridPoint` in timing-engine, (C) shortcut registry type extensions. All follow existing patterns in `src/core/` and `src/platform/`. TDD: every function gets a failing test first.

**Tech Stack:** TypeScript, Vitest, existing Command pattern (`src/core/commands/command.ts`)

**Spec:** `docs/superpowers/specs/2026-05-20-phase-4-lyrics-timing-design.md`

---

## File Structure

### New Files
- `src/core/commands/lyrics-commands.ts` — 7 new command factories for lyrics operations
- `src/core/commands/lyrics-commands.spec.ts` — tests for all 7 commands
- `src/core/timing/timing-engine.spec.ts` — already exists, add `snapToNearestGridPoint` tests

### Modified Files
- `src/core/domain/project.ts` — refactor `LyricWord` / `LyricLine` interfaces, update `createEmptyProject()`
- `src/core/timing/timing-engine.ts` — add `snapToNearestGridPoint()` function
- `src/platform/shortcuts/registry.ts` — extend `ShortcutAction` union type
- `src/core/commands/project-commands.ts` — update existing `createAddLyricLineCommand` for new model
- `src/core/commands/project-commands.spec.ts` — update existing lyrics command tests for new model

---

## Task 1: Refactor Data Model

**Files:**
- Modify: `src/core/domain/project.ts`
- Modify: `src/core/commands/project-commands.ts`
- Modify: `src/core/commands/project-commands.spec.ts`

- [ ] **Step 1: Update the domain interfaces**

In `src/core/domain/project.ts`, replace the current `LyricWord` and `LyricLine` interfaces:

```ts
export interface LyricWord {
  id: string
  text: string
  endTime?: number
}

export interface LyricLine {
  id: string
  words: LyricWord[]
  startTime?: number
}
```

Remove the `text` field from `LyricLine` and the `startTime` field from `LyricWord`. Make `LyricWord.endTime` optional (was required `number`).

Also add `snapEnabled: boolean` to `ProjectSettings`:

```ts
export interface ProjectSettings {
  locale: LocaleCode
  snapDivisor: 1 | 2 | 4 | 8 | 16
  rhythmMode: 'common' | 'triplets'
  snapEnabled: boolean
}
```

- [ ] **Step 2: Update createEmptyProject()**

In `createEmptyProject()`, add `snapEnabled: true` to the settings object:

```ts
settings: {
  locale: 'zh-CN',
  snapDivisor: 4,
  rhythmMode: 'common',
  snapEnabled: true,
},
```

- [ ] **Step 3: Update createAddLyricLineCommand**

In `src/core/commands/project-commands.ts`, update the command to match the new model. The payload changes from `{ id, text }` to `{ id, words }`:

```ts
export function createAddLyricLineCommand(payload: {
  id: string
  words: LyricWord[]
}): Command<ProjectDocument> {
  if (payload.words.length === 0) {
    throw new Error('LyricLine words array must not be empty')
  }
  return {
    label: 'lyrics.addLine',
    do: (state) => ({
      ...state,
      lyrics: [...state.lyrics, { id: payload.id, words: payload.words }],
    }),
    undo: (state) => ({
      ...state,
      lyrics: state.lyrics.filter((line) => line.id !== payload.id),
    }),
  }
}
```

- [ ] **Step 4: Update existing tests for the new model**

In `src/core/commands/project-commands.spec.ts`, update the `add lyric line command` describe block. Every test that creates a payload with `text` must change to `words`. Example for the first test:

```ts
it('adds a lyric line via do()', () => {
  const payload = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello world' }],
  }
  const command = createAddLyricLineCommand(payload)
  const afterDo = command.do(createEmptyProject())

  expect(afterDo.lyrics).toHaveLength(1)
  expect(afterDo.lyrics[0].id).toBe('line-1')
  expect(afterDo.lyrics[0].words).toEqual([{ id: 'w-1', text: 'hello world' }])
})
```

Update all 6 tests in that describe block similarly: replace `text: '...'` with `words: [{ id: 'w-X', text: '...' }]`, and update assertions to check `words` instead of `text`. Add one test for the empty-words rejection:

```ts
it('throws when words array is empty', () => {
  expect(() => createAddLyricLineCommand({ id: 'line-1', words: [] })).toThrow(
    'LyricLine words array must not be empty',
  )
})
```

- [ ] **Step 5: Run tests to verify**

Run: `pnpm test:run "src/core/commands/project-commands.spec.ts"`
Expected: All tests pass (including the new empty-words test).

- [ ] **Step 6: Run full type check**

Run: `pnpm check`
Expected: No type errors. If there are errors in other files referencing the old `LyricLine.text` or `LyricWord.startTime`, fix them (likely only `editor-store.ts:addLyricLine` which will be updated in Task 5).

- [ ] **Step 7: Fix editor-store addLyricLine**

In `src/stores/editor-store.ts`, update `addLyricLine` (line ~192) to match the new model:

```ts
function addLyricLine(text: string) {
  execute(
    createAddLyricLineCommand({
      id: makeId('line'),
      words: [{ id: makeId('word'), text }],
    }),
  )
}
```

This wraps the text into a single word, satisfying the non-empty words constraint.

- [ ] **Step 8: Run full type check + tests again**

Run: `pnpm check && pnpm test:run`
Expected: All green.

- [ ] **Step 9: Lint + format**

Run: `pnpm lint:fix && pnpm format`

- [ ] **Step 10: Commit**

```bash
git add src/core/domain/project.ts src/core/commands/project-commands.ts src/core/commands/project-commands.spec.ts src/stores/editor-store.ts
git commit -m "refactor: update LyricWord/LyricLine data model for Phase 4

- LyricWord: remove startTime, make endTime optional
- LyricLine: remove text (derived from words), add startTime
- words array must be non-empty (enforced in command)
- Update createAddLyricLineCommand to accept words array

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Lyrics Commands — setLineStartTime, setWordEndTime, clearWordEndTime

**Files:**
- Create: `src/core/commands/lyrics-commands.ts`
- Create: `src/core/commands/lyrics-commands.spec.ts`

- [ ] **Step 1: Write failing tests for setLineStartTime**

Create `src/core/commands/lyrics-commands.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { LyricLine, ProjectDocument } from '../domain/project'
import { createEmptyProject } from '../domain/project'
import {
  createSetLineStartTimeCommand,
} from './lyrics-commands'

function projectWithLine(line: LyricLine): ProjectDocument {
  const p = createEmptyProject()
  return { ...p, lyrics: [line] }
}

describe('createSetLineStartTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello' }],
  }

  it('sets startTime on the target line', () => {
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].startTime).toBe(1.5)
  })

  it('undo restores previous startTime', () => {
    const lineWithTime: LyricLine = { ...line, startTime: 0.5 }
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(lineWithTime))
    expect(after.lyrics[0].startTime).toBe(1.5)
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].startTime).toBe(0.5)
  })

  it('undo restores undefined if line had no startTime', () => {
    const cmd = createSetLineStartTimeCommand('line-1', 1.5)
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].startTime).toBeUndefined()
  })

  it('returns state unchanged if lineId not found', () => {
    const cmd = createSetLineStartTimeCommand('nonexistent', 1.5)
    const state = projectWithLine(line)
    const after = cmd.do(state)
    expect(after.lyrics[0].startTime).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createSetLineStartTimeCommand` not found.

- [ ] **Step 3: Implement setLineStartTime**

Create `src/core/commands/lyrics-commands.ts`:

```ts
import type { ProjectDocument } from '../domain/project'
import type { Command } from './command'

export function createSetLineStartTimeCommand(
  lineId: string,
  time: number,
): Command<ProjectDocument> {
  let previousStartTime: number | undefined | null = null
  return {
    label: 'lyrics.setLineStartTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      if (previousStartTime === null) previousStartTime = line.startTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, startTime: time } : l,
        ),
      }
    },
    undo: (state) => {
      if (previousStartTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, startTime: previousStartTime! } : l,
        ),
      }
    },
  }
}
```

Note: `previousStartTime` uses `null` as sentinel for "not yet captured" (distinct from `undefined` which means "line had no startTime").

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All 4 tests PASS.

- [ ] **Step 5: Write failing tests for setWordEndTime**

Add to `src/core/commands/lyrics-commands.spec.ts`:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
} from './lyrics-commands'

describe('createSetWordEndTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hello' },
      { id: 'w-2', text: 'world' },
    ],
    startTime: 0,
  }

  it('sets endTime on the target word', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBe(1.0)
    expect(after.lyrics[0].words[1].endTime).toBeUndefined()
  })

  it('undo restores previous endTime', () => {
    const lineWithTimed: LyricLine = {
      ...line,
      words: [
        { id: 'w-1', text: 'hello', endTime: 0.5 },
        { id: 'w-2', text: 'world' },
      ],
    }
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(lineWithTimed))
    expect(after.lyrics[0].words[0].endTime).toBe(1.0)
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBe(0.5)
  })

  it('undo restores undefined if word had no endTime', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBeUndefined()
  })

  it('does not mutate other words', () => {
    const cmd = createSetWordEndTimeCommand('line-1', 'w-1', 1.0)
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[1]).toEqual({ id: 'w-2', text: 'world' })
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createSetWordEndTimeCommand` not found.

- [ ] **Step 7: Implement setWordEndTime**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createSetWordEndTimeCommand(
  lineId: string,
  wordId: string,
  time: number,
): Command<ProjectDocument> {
  let previousEndTime: number | undefined | null = null
  return {
    label: 'lyrics.setWordEndTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousEndTime === null) previousEndTime = word.endTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: time } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousEndTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: previousEndTime! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 9: Write failing tests for clearWordEndTime**

Add to the spec file:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createClearWordEndTimeCommand,
} from './lyrics-commands'

describe('createClearWordEndTimeCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hello', endTime: 1.0 },
      { id: 'w-2', text: 'world', endTime: 2.0 },
    ],
    startTime: 0,
  }

  it('clears endTime on the target word', () => {
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
    expect(after.lyrics[0].words[1].endTime).toBe(2.0)
  })

  it('undo restores the cleared endTime', () => {
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words[0].endTime).toBe(1.0)
  })

  it('do is a no-op if word already has no endTime', () => {
    const lineNoTime: LyricLine = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello' }],
    }
    const cmd = createClearWordEndTimeCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(lineNoTime))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
  })
})
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createClearWordEndTimeCommand` not found.

- [ ] **Step 11: Implement clearWordEndTime**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createClearWordEndTimeCommand(
  lineId: string,
  wordId: string,
): Command<ProjectDocument> {
  let previousEndTime: number | undefined | null = null
  return {
    label: 'lyrics.clearWordEndTime',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const word = line.words.find((w) => w.id === wordId)
      if (!word) return state
      if (previousEndTime === null) previousEndTime = word.endTime
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: undefined } : w,
                ),
              }
            : l,
        ),
      }
    },
    undo: (state) => {
      if (previousEndTime === null) return state
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId
            ? {
                ...l,
                words: l.words.map((w) =>
                  w.id === wordId ? { ...w, endTime: previousEndTime! } : w,
                ),
              }
            : l,
        ),
      }
    },
  }
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 13: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/commands/lyrics-commands.ts src/core/commands/lyrics-commands.spec.ts
git commit -m "feat: add setLineStartTime, setWordEndTime, clearWordEndTime commands

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Lyrics Commands — splitWord, mergeWords

**Files:**
- Modify: `src/core/commands/lyrics-commands.ts`
- Modify: `src/core/commands/lyrics-commands.spec.ts`

- [ ] **Step 1: Write failing tests for splitWord**

Add to `src/core/commands/lyrics-commands.spec.ts`:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createClearWordEndTimeCommand,
  createSplitWordCommand,
} from './lyrics-commands'

describe('createSplitWordCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello', endTime: 2.0 }],
    startTime: 0,
  }

  it('splits a word at charIndex into two words', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words).toHaveLength(2)
    expect(after.lyrics[0].words[0]).toEqual({ id: 'w-1', text: 'he' })
    expect(after.lyrics[0].words[1]).toEqual({ id: 'w-new', text: 'llo', endTime: 2.0 })
  })

  it('undo merges the split words back', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words).toHaveLength(1)
    expect(undone.lyrics[0].words[0]).toEqual({ id: 'w-1', text: 'hello', endTime: 2.0 })
  })

  it('uses String.prototype.slice semantics: charIndex=0 throws', () => {
    expect(() => createSplitWordCommand('line-1', 'w-1', 0, 'w-new')).toThrow()
  })

  it('uses String.prototype.slice semantics: charIndex=text.length throws on do()', () => {
    // 'hello'.length === 5, charIndex=5 passes eager check (5 > 0)
    // but do() throws because 5 >= text.length
    const cmd = createSplitWordCommand('line-1', 'w-1', 5, 'w-new')
    expect(() => cmd.do(projectWithLine(line))).toThrow()
  })

  it('front word loses endTime, back word inherits endTime', () => {
    const cmd = createSplitWordCommand('line-1', 'w-1', 3, 'w-new')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words[0].endTime).toBeUndefined()
    expect(after.lyrics[0].words[1].endTime).toBe(2.0)
  })

  it('preserves position among siblings', () => {
    const multiLine: LyricLine = {
      id: 'line-1',
      words: [
        { id: 'w-0', text: 'a', endTime: 0.5 },
        { id: 'w-1', text: 'hello', endTime: 2.0 },
        { id: 'w-2', text: 'b', endTime: 3.0 },
      ],
      startTime: 0,
    }
    const cmd = createSplitWordCommand('line-1', 'w-1', 2, 'w-new')
    const after = cmd.do(projectWithLine(multiLine))
    expect(after.lyrics[0].words.map((w) => w.id)).toEqual(['w-0', 'w-1', 'w-new', 'w-2'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createSplitWordCommand` not found.

- [ ] **Step 3: Implement splitWord**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createSplitWordCommand(
  lineId: string,
  wordId: string,
  charIndex: number,
  newId: string,
): Command<ProjectDocument> {
  // charIndex validation is done eagerly since it's a contract violation
  if (charIndex <= 0) {
    throw new Error('charIndex must be > 0 (would produce empty front word)')
  }
  return {
    label: 'lyrics.splitWord',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const wordIndex = line.words.findIndex((w) => w.id === wordId)
      if (wordIndex === -1) return state
      const word = line.words[wordIndex]
      if (charIndex >= word.text.length) {
        throw new Error('charIndex must be < text.length (would produce empty back word)')
      }
      const frontText = word.text.slice(0, charIndex)
      const backText = word.text.slice(charIndex)
      const frontWord = { id: word.id, text: frontText }
      const backWord = { id: newId, text: backText, endTime: word.endTime }
      const newWords = [...line.words]
      newWords.splice(wordIndex, 1, frontWord, backWord)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const frontIndex = line.words.findIndex((w) => w.id === wordId)
      const backIndex = line.words.findIndex((w) => w.id === newId)
      if (frontIndex === -1 || backIndex === -1) return state
      const front = line.words[frontIndex]
      const back = line.words[backIndex]
      const merged = { id: wordId, text: front.text + back.text, endTime: back.endTime }
      const newWords = [...line.words]
      newWords.splice(Math.min(frontIndex, backIndex), 2, merged)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 5: Write failing tests for mergeWords**

Add to spec file:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createClearWordEndTimeCommand,
  createSplitWordCommand,
  createMergeWordsCommand,
} from './lyrics-commands'

describe('createMergeWordsCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [
      { id: 'w-1', text: 'hel', endTime: 1.0 },
      { id: 'w-2', text: 'lo', endTime: 2.0 },
    ],
    startTime: 0,
  }

  it('merges word with its next sibling, takes back endTime', () => {
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics[0].words).toHaveLength(1)
    expect(after.lyrics[0].words[0].id).toBe('w-1')
    expect(after.lyrics[0].words[0].text).toBe('hello')
    expect(after.lyrics[0].words[0].endTime).toBe(2.0)
  })

  it('undo splits them back', () => {
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(line))
    const undone = cmd.undo(after)
    expect(undone.lyrics[0].words).toHaveLength(2)
    expect(undone.lyrics[0].words[0]).toEqual({ id: 'w-1', text: 'hel', endTime: 1.0 })
    expect(undone.lyrics[0].words[1]).toEqual({ id: 'w-2', text: 'lo', endTime: 2.0 })
  })

  it('throws when wordId is the last word (no next sibling)', () => {
    const singleLine: LyricLine = {
      id: 'line-1',
      words: [{ id: 'w-1', text: 'hello' }],
    }
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const state = projectWithLine(singleLine)
    expect(() => cmd.do(state)).toThrow()
  })

  it('preserves surrounding words', () => {
    const multiLine: LyricLine = {
      id: 'line-1',
      words: [
        { id: 'w-0', text: 'a', endTime: 0.5 },
        { id: 'w-1', text: 'hel', endTime: 1.0 },
        { id: 'w-2', text: 'lo', endTime: 2.0 },
        { id: 'w-3', text: 'b', endTime: 3.0 },
      ],
      startTime: 0,
    }
    const cmd = createMergeWordsCommand('line-1', 'w-1')
    const after = cmd.do(projectWithLine(multiLine))
    expect(after.lyrics[0].words.map((w) => w.id)).toEqual(['w-0', 'w-1', 'w-3'])
    expect(after.lyrics[0].words[1].text).toBe('hello')
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createMergeWordsCommand` not found.

- [ ] **Step 7: Implement mergeWords**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createMergeWordsCommand(
  lineId: string,
  wordId: string,
): Command<ProjectDocument> {
  let removedWord: { id: string; text: string; endTime?: number } | null = null
  let originalFrontEndTime: number | undefined | null = null
  return {
    label: 'lyrics.mergeWords',
    do: (state) => {
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const wordIndex = line.words.findIndex((w) => w.id === wordId)
      if (wordIndex === -1 || wordIndex >= line.words.length - 1) {
        throw new Error('Cannot merge: wordId is the last word or not found')
      }
      const front = line.words[wordIndex]
      const back = line.words[wordIndex + 1]
      removedWord = { id: back.id, text: back.text, endTime: back.endTime }
      originalFrontEndTime = front.endTime
      const merged = { id: front.id, text: front.text + back.text, endTime: back.endTime }
      const newWords = [...line.words]
      newWords.splice(wordIndex, 2, merged)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
    undo: (state) => {
      if (!removedWord) return state
      const line = state.lyrics.find((l) => l.id === lineId)
      if (!line) return state
      const mergedIndex = line.words.findIndex((w) => w.id === wordId)
      if (mergedIndex === -1) return state
      const merged = line.words[mergedIndex]
      const frontText = merged.text.slice(0, merged.text.length - removedWord.text.length)
      const frontWord = { id: wordId, text: frontText, endTime: originalFrontEndTime }
      const backWord = { id: removedWord.id, text: removedWord.text, endTime: removedWord.endTime }
      const newWords = [...line.words]
      newWords.splice(mergedIndex, 1, frontWord, backWord)
      return {
        ...state,
        lyrics: state.lyrics.map((l) =>
          l.id === lineId ? { ...l, words: newWords } : l,
        ),
      }
    },
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 9: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/commands/lyrics-commands.ts src/core/commands/lyrics-commands.spec.ts
git commit -m "feat: add splitWord and mergeWords lyrics commands

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Lyrics Commands — insertLyricLines, removeLyricLine

**Files:**
- Modify: `src/core/commands/lyrics-commands.ts`
- Modify: `src/core/commands/lyrics-commands.spec.ts`

- [ ] **Step 1: Write failing tests for insertLyricLines**

Add to `src/core/commands/lyrics-commands.spec.ts`:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createClearWordEndTimeCommand,
  createSplitWordCommand,
  createMergeWordsCommand,
  createInsertLyricLinesCommand,
} from './lyrics-commands'

describe('createInsertLyricLinesCommand', () => {
  it('appends lines to the end of lyrics', () => {
    const lines: LyricLine[] = [
      { id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] },
      { id: 'line-2', words: [{ id: 'w-2', text: 'world' }] },
    ]
    const cmd = createInsertLyricLinesCommand(lines)
    const after = cmd.do(createEmptyProject())
    expect(after.lyrics).toHaveLength(2)
    expect(after.lyrics[0].id).toBe('line-1')
    expect(after.lyrics[1].id).toBe('line-2')
  })

  it('appends to existing lyrics', () => {
    const existing: LyricLine = { id: 'line-0', words: [{ id: 'w-0', text: 'existing' }] }
    const state = { ...createEmptyProject(), lyrics: [existing] }
    const newLines: LyricLine[] = [
      { id: 'line-1', words: [{ id: 'w-1', text: 'new' }] },
    ]
    const cmd = createInsertLyricLinesCommand(newLines)
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(2)
    expect(after.lyrics[0].id).toBe('line-0')
    expect(after.lyrics[1].id).toBe('line-1')
  })

  it('undo removes the appended lines', () => {
    const lines: LyricLine[] = [
      { id: 'line-1', words: [{ id: 'w-1', text: 'hello' }] },
    ]
    const cmd = createInsertLyricLinesCommand(lines)
    const after = cmd.do(createEmptyProject())
    const undone = cmd.undo(after)
    expect(undone.lyrics).toHaveLength(0)
  })

  it('throws if any line has empty words array', () => {
    const lines: LyricLine[] = [
      { id: 'line-1', words: [] },
    ]
    expect(() => createInsertLyricLinesCommand(lines)).toThrow(
      'LyricLine words array must not be empty',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createInsertLyricLinesCommand` not found.

- [ ] **Step 3: Implement insertLyricLines**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
import type { LyricLine, ProjectDocument } from '../domain/project'

export function createInsertLyricLinesCommand(
  lines: readonly LyricLine[],
): Command<ProjectDocument> {
  for (const line of lines) {
    if (line.words.length === 0) {
      throw new Error('LyricLine words array must not be empty')
    }
  }
  const lineIds = lines.map((l) => l.id)
  return {
    label: 'lyrics.insertLines',
    do: (state) => ({
      ...state,
      lyrics: [...state.lyrics, ...lines],
    }),
    undo: (state) => ({
      ...state,
      lyrics: state.lyrics.filter((l) => !lineIds.includes(l.id)),
    }),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 5: Write failing tests for removeLyricLine**

Add to spec:

```ts
import {
  createSetLineStartTimeCommand,
  createSetWordEndTimeCommand,
  createClearWordEndTimeCommand,
  createSplitWordCommand,
  createMergeWordsCommand,
  createInsertLyricLinesCommand,
  createRemoveLyricLineCommand,
} from './lyrics-commands'

describe('createRemoveLyricLineCommand', () => {
  const line: LyricLine = {
    id: 'line-1',
    words: [{ id: 'w-1', text: 'hello', endTime: 1.0 }],
    startTime: 0.5,
  }

  it('removes the target line', () => {
    const cmd = createRemoveLyricLineCommand('line-1')
    const after = cmd.do(projectWithLine(line))
    expect(after.lyrics).toHaveLength(0)
  })

  it('undo re-inserts the removed line at the same position', () => {
    const line2: LyricLine = { id: 'line-2', words: [{ id: 'w-2', text: 'world' }] }
    const state = { ...createEmptyProject(), lyrics: [line, line2] }
    const cmd = createRemoveLyricLineCommand('line-1')
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(1)
    expect(after.lyrics[0].id).toBe('line-2')
    const undone = cmd.undo(after)
    expect(undone.lyrics).toHaveLength(2)
    expect(undone.lyrics[0].id).toBe('line-1')
    expect(undone.lyrics[0].startTime).toBe(0.5)
    expect(undone.lyrics[0].words[0].endTime).toBe(1.0)
  })

  it('returns state unchanged if lineId not found', () => {
    const cmd = createRemoveLyricLineCommand('nonexistent')
    const state = projectWithLine(line)
    const after = cmd.do(state)
    expect(after.lyrics).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: FAIL — `createRemoveLyricLineCommand` not found.

- [ ] **Step 7: Implement removeLyricLine**

Add to `src/core/commands/lyrics-commands.ts`:

```ts
export function createRemoveLyricLineCommand(
  lineId: string,
): Command<ProjectDocument> {
  let removedLine: LyricLine | null = null
  let removedIndex: number | null = null
  return {
    label: 'lyrics.removeLine',
    do: (state) => {
      const index = state.lyrics.findIndex((l) => l.id === lineId)
      if (index === -1) return state
      removedLine = state.lyrics[index]
      removedIndex = index
      return {
        ...state,
        lyrics: state.lyrics.filter((l) => l.id !== lineId),
      }
    },
    undo: (state) => {
      if (removedLine === null || removedIndex === null) return state
      const newLyrics = [...state.lyrics]
      newLyrics.splice(removedIndex, 0, removedLine)
      return {
        ...state,
        lyrics: newLyrics,
      }
    },
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test:run "src/core/commands/lyrics-commands.spec.ts"`
Expected: All PASS.

- [ ] **Step 9: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/commands/lyrics-commands.ts src/core/commands/lyrics-commands.spec.ts
git commit -m "feat: add insertLyricLines and removeLyricLine commands

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: snapToNearestGridPoint

**Files:**
- Modify: `src/core/timing/timing-engine.ts`
- Modify: `src/core/timing/timing-engine.spec.ts` (existing file)

- [ ] **Step 1: Write failing tests**

Add a new `describe('snapToNearestGridPoint', ...)` block to `src/core/timing/timing-engine.spec.ts`:

```ts
import {
  snapToNearestGridPoint,
  // ... existing imports
} from './timing-engine'

describe('snapToNearestGridPoint', () => {
  const points: TimingPoint[] = [
    { id: 'tp-1', time: 0, bpm: 120, timeSignatureNumerator: 4, timeSignatureDenominator: 4 },
  ]
  // 120 BPM, divisor 4 → subdivision = 0.125s (60/120/4)
  // Grid points: 0, 0.125, 0.25, 0.375, 0.5, ...

  it('snaps to nearest grid point (forward)', () => {
    const result = snapToNearestGridPoint(points, 0.06, 4, false)
    // 0.06 is closer to 0.0 than to 0.125 → snap to 0.0
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('snaps to nearest grid point (backward)', () => {
    const result = snapToNearestGridPoint(points, 0.07, 4, false)
    // 0.07 is closer to 0.125 than to 0.0 → snap to 0.125
    expect(result).toBeCloseTo(0.125, 6)
  })

  it('snaps exactly on a grid point', () => {
    const result = snapToNearestGridPoint(points, 0.25, 4, false)
    expect(result).toBeCloseTo(0.25, 6)
  })

  it('works with triplets', () => {
    // divisor=4, triplets=true → actualDivisor = round(4*3/2) = 6
    // subdivision = 60/120/6 = 0.0833...
    const result = snapToNearestGridPoint(points, 0.04, 4, true)
    // 0.04 is closer to 0.0 than to 0.0833 → snap to 0.0
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('handles time before first timing point', () => {
    const result = snapToNearestGridPoint(points, -0.01, 4, false)
    // Backward projection: grid extends before point.time
    // -0.01 is closer to 0.0 than to -0.125
    expect(result).toBeCloseTo(0.0, 6)
  })

  it('throws on empty timing points', () => {
    expect(() => snapToNearestGridPoint([], 1.0, 4, false)).toThrow()
  })

  it('respects segment boundaries with multiple timing points', () => {
    const multiPoints: TimingPoint[] = [
      { id: 'tp-1', time: 0, bpm: 120, timeSignatureNumerator: 4, timeSignatureDenominator: 4 },
      { id: 'tp-2', time: 1.0, bpm: 60, timeSignatureNumerator: 4, timeSignatureDenominator: 4 },
    ]
    // At time 0.99, grid for tp-1 (bpm=120, div=4): subdivision = 0.125s
    // Nearest grid points: 0.875, 1.0
    // But 1.0 is the boundary of tp-2, so the prev subdivision is from tp-1's grid
    const result = snapToNearestGridPoint(multiPoints, 0.99, 4, false)
    expect(result).toBeCloseTo(1.0, 6)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run "src/core/timing/timing-engine.spec.ts" -t "snapToNearestGridPoint"`
Expected: FAIL — `snapToNearestGridPoint` not exported.

- [ ] **Step 3: Implement snapToNearestGridPoint**

Add to `src/core/timing/timing-engine.ts`:

```ts
/**
 * Returns the nearest grid point to `time` (can be before or after).
 * Uses the same triplets formula as getBeatGridLines.
 * Throws if timingPoints is empty.
 */
export function snapToNearestGridPoint(
  points: readonly TimingPoint[],
  time: number,
  divisor: number,
  triplets: boolean,
): number {
  const sorted = sortTimingPoints(points)
  if (sorted.length === 0) throw new Error(TIMING_ERRORS.noTimingPoints)

  const point = getActiveTimingPointFromSorted(sorted, time)
  const beatDur = 60 / point.bpm
  const actualDivisor =
    triplets && divisor >= 2 ? Math.round((divisor * 3) / 2) : divisor
  const subDur = beatDur / actualDivisor

  const elapsed = (time - point.time) / subDur
  const subIdx = Math.floor(elapsed + BEAT_EPSILON)

  const prev = point.time + subIdx * subDur
  const next = point.time + (subIdx + 1) * subDur

  // Check segment boundary: if next crosses into the next timing point,
  // use the next timing point's start time as the "next" candidate
  const pointIndex = sorted.findIndex((p) => p.id === point.id)
  let effectiveNext = next
  if (pointIndex < sorted.length - 1) {
    const nextPoint = sorted[pointIndex + 1]
    if (next >= nextPoint.time) {
      effectiveNext = nextPoint.time
    }
  }

  return Math.abs(time - prev) <= Math.abs(time - effectiveNext) ? prev : effectiveNext
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run "src/core/timing/timing-engine.spec.ts" -t "snapToNearestGridPoint"`
Expected: All PASS.

- [ ] **Step 5: Run full timing-engine tests**

Run: `pnpm test:run "src/core/timing/timing-engine.spec.ts"`
Expected: All PASS (no regressions).

- [ ] **Step 6: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/core/timing/timing-engine.ts src/core/timing/timing-engine.spec.ts
git commit -m "feat: add snapToNearestGridPoint to timing engine

Finds the nearest grid subdivision to a given time (forward or backward).
Used by Phase 4 lyrics timing for D-key snap-to-grid.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Extend Shortcut Registry

**Files:**
- Modify: `src/platform/shortcuts/registry.ts`

- [ ] **Step 1: Add lyrics shortcut actions to the union type**

In `src/platform/shortcuts/registry.ts`, extend the `ShortcutAction` type:

```ts
export type ShortcutAction =
  | 'history.undo'
  | 'history.redo'
  | 'project.save'
  | 'transport.togglePlay'
  | 'transport.prevBeat'
  | 'transport.nextBeat'
  | 'transport.prevBar'
  | 'transport.nextBar'
  | 'timing.tapBpm'
  | 'metronome.toggle'
  | 'lyrics.mark'
  | 'lyrics.markNoAdvance'
  | 'lyrics.nextLine'
  | 'lyrics.playLineInterval'
  | 'lyrics.playWordInterval'
  | 'lyrics.deleteLine'
```

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No errors (adding union members is backwards-compatible).

- [ ] **Step 3: Lint + format + commit**

Run: `pnpm lint:fix && pnpm format`

```bash
git add src/platform/shortcuts/registry.ts
git commit -m "feat: extend ShortcutAction with lyrics mode actions

D, Shift+D, Enter, C, V, Delete key actions for Phase 4.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass, no regressions.

- [ ] **Step 2: Run type check**

Run: `pnpm check`
Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds.

---

## Verification

After completing all tasks:

1. `pnpm test:run` — all green
2. `pnpm check` — no type errors
3. `pnpm build` — succeeds
4. `pnpm lint` — clean
5. New lyrics commands tested: setLineStartTime, setWordEndTime, clearWordEndTime, splitWord, mergeWords, insertLyricLines, removeLyricLine
6. snapToNearestGridPoint tested with single/multi timing point scenarios
7. ShortcutAction type extended (no runtime changes yet — registrations happen in Part 2)
8. Data model refactored: LyricWord has optional endTime only, LyricLine has words[] + optional startTime, no text field
