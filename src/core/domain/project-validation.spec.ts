import { describe, expect, it } from 'vitest'

import type { ProjectDocument } from './project'
import { createEmptyProject } from './project'
import { validateProjectForExport } from './project-validation'

function baseProject(): ProjectDocument {
  return {
    ...createEmptyProject(),
    title: 'Song',
    timingPoints: [
      {
        id: 'tp-1',
        time: 0,
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
      },
    ],
    lyrics: [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'word-1', text: 'hello ', endTime: 2 },
          { id: 'word-2', text: 'world', endTime: 3 },
        ],
      },
    ],
  }
}

function codes(
  project: ProjectDocument,
  target: Parameters<typeof validateProjectForExport>[1],
) {
  return validateProjectForExport(project, target).map((issue) => issue.code)
}

describe('validateProjectForExport', () => {
  it('returns no issues for a timed project with monotonic lyrics', () => {
    expect(validateProjectForExport(baseProject(), 'ttml')).toEqual([])
  })

  it('reports duplicate ids and empty ids across project entities', () => {
    const project = baseProject()
    project.lyrics[0].id = 'tp-1'
    project.lyrics[0].words[0].id = '   '
    project.lyrics[0].words[1].id = 'tp-1'

    expect(codes(project, 'ttml')).toEqual(
      expect.arrayContaining(['duplicateId', 'emptyId']),
    )
  })

  it('reports non-finite and negative timing values', () => {
    const project = baseProject()
    project.lyrics[0].startTime = -1
    project.lyrics[0].words[0].endTime = Number.POSITIVE_INFINITY
    project.timingPoints[0].time = Number.NaN

    expect(codes(project, 'ttml')).toEqual(
      expect.arrayContaining(['negativeTime', 'nonFiniteTime']),
    )
  })

  it('reports invalid timing point musical values', () => {
    const project = baseProject()
    project.timingPoints[0].bpm = 0
    project.timingPoints[0].timeSignatureNumerator = 3.5
    project.timingPoints[0].timeSignatureDenominator = -4

    expect(codes(project, 'ttml')).toEqual(
      expect.arrayContaining([
        'invalidBpm',
        'invalidTimeSignatureNumerator',
        'invalidTimeSignatureDenominator',
      ]),
    )
  })

  it('reports word timing that moves backward from the previous boundary', () => {
    const project = baseProject()
    project.lyrics[0].words[0].endTime = 0.5

    expect(codes(project, 'ttml')).toContain('wordEndBeforeBoundary')
  })

  it('reports overlapping line intervals and out-of-order lyric lines', () => {
    const project = baseProject()
    project.lyrics.push({
      id: 'line-2',
      startTime: 2.5,
      words: [{ id: 'word-3', text: 'again', endTime: 4 }],
    })
    project.lyrics.push({
      id: 'line-3',
      startTime: 2,
      words: [{ id: 'word-4', text: 'back', endTime: 2.2 }],
    })

    expect(codes(project, 'ttml')).toEqual(
      expect.arrayContaining(['lineIntervalOverlap', 'lineOrderRegression']),
    )
  })

  it('allows adjacent line boundaries with the same time or tiny floating-point drift', () => {
    const project = baseProject()
    project.lyrics = [
      {
        id: 'line-1',
        startTime: 72.04,
        words: [{ id: 'word-1', text: 'storm', endTime: 75.80000000000001 }],
      },
      {
        id: 'line-2',
        startTime: 75.8,
        words: [{ id: 'word-2', text: "I'm", endTime: 76.28 }],
      },
    ]

    expect(codes(project, 'ttml')).not.toContain('lineIntervalOverlap')
  })

  it('treats timed empty words as valid placeholders but warns for untimed empty words', () => {
    const project = baseProject()
    project.lyrics[0].words.splice(1, 0, {
      id: 'gap',
      text: '',
      endTime: 2.5,
    })
    project.lyrics[0].words.push({ id: 'floating-gap', text: '' })

    const issueCodes = codes(project, 'ttml')

    expect(issueCodes).not.toContain('missingWordEndTime')
    expect(issueCodes).toContain('untimedEmptyPlaceholder')
  })

  it('warns when word-sensitive export targets would lose visible word timing', () => {
    const project = baseProject()
    project.lyrics[0].words[1].endTime = undefined

    expect(codes(project, 'ttml')).toContain('missingWordEndTime')
    expect(codes(project, 'lrc-line')).not.toContain('missingWordEndTime')
  })

  it('warns when line-sensitive export targets cannot derive a line interval', () => {
    const project = baseProject()
    project.lyrics[0].startTime = undefined

    expect(codes(project, 'srt')).toContain('missingLineTiming')
  })
})
