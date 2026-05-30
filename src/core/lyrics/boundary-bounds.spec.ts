import { describe, expect, it } from 'vitest'

import type { LyricLine } from '../domain/project'
import { BOUNDARY_DRAG_EPSILON, getDragClampBounds } from './boundary-bounds'

function expectBoundsCloseTo(
  actual: { min: number; max: number },
  expected: { min: number; max: number },
): void {
  expect(actual.min).toBeCloseTo(expected.min, 6)
  expect(actual.max).toBeCloseTo(expected.max, 6)
}

describe('getDragClampBounds', () => {
  it('bounds first line start between zero and first timed word', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'word-1', text: 'hello', endTime: 4 },
          { id: 'word-2', text: 'world' },
        ],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, lyrics, 10),
      {
        min: BOUNDARY_DRAG_EPSILON,
        max: 4 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('uses previous line last timed word as min for line start', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-0',
        startTime: 0,
        words: [
          { id: 'word-0a', text: 'prev', endTime: 1 },
          { id: 'word-0b', text: 'line', endTime: 2.5 },
        ],
      },
      {
        id: 'line-1',
        startTime: 3,
        words: [{ id: 'word-1', text: 'next', endTime: 4 }],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, lyrics, 10),
      {
        min: 2.5 + BOUNDARY_DRAG_EPSILON,
        max: 4 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('uses next line start as max when line start has no timed words', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 3,
        words: [{ id: 'word-1', text: 'untimed' }],
      },
      {
        id: 'line-2',
        startTime: 7,
        words: [{ id: 'word-2', text: 'next', endTime: 8 }],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, lyrics, 10),
      {
        min: BOUNDARY_DRAG_EPSILON,
        max: 7 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('bounds word separator between neighboring timed boundaries', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'word-1', text: 'hello', endTime: 2 },
          { id: 'word-2', text: 'world', endTime: 4 },
          { id: 'word-3', text: 'again', endTime: 6 },
        ],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds(
        { kind: 'word-separator', lineId: 'line-1', wordId: 'word-2' },
        lyrics,
        10,
      ),
      {
        min: 2 + BOUNDARY_DRAG_EPSILON,
        max: 6 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('bounds line end between previous word and next line start', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'word-1', text: 'hello', endTime: 2 },
          { id: 'word-2', text: 'world', endTime: 4 },
        ],
      },
      {
        id: 'line-2',
        startTime: 7,
        words: [{ id: 'word-3', text: 'next', endTime: 8 }],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds(
        { kind: 'line-end', lineId: 'line-1', wordId: 'word-2' },
        lyrics,
        10,
      ),
      {
        min: 2 + BOUNDARY_DRAG_EPSILON,
        max: 7 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('uses duration as fallback max for final editable boundaries', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 1,
        words: [{ id: 'word-1', text: 'hello', endTime: 2 }],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds(
        { kind: 'line-end', lineId: 'line-1', wordId: 'word-1' },
        lyrics,
        10,
      ),
      {
        min: 1 + BOUNDARY_DRAG_EPSILON,
        max: 10 - BOUNDARY_DRAG_EPSILON,
      },
    )
  })

  it('returns zero bounds when duration is unavailable', () => {
    expect(getDragClampBounds({ kind: 'line-start', lineId: 'line-1' }, [], 0)).toEqual(
      {
        min: 0,
        max: 0,
      },
    )
  })

  it('returns full duration for missing targets', () => {
    expect(
      getDragClampBounds({ kind: 'line-start', lineId: 'missing' }, [], 10),
    ).toEqual({
      min: 0,
      max: 10,
    })
  })

  it('normalizes intervals narrower than two epsilons to their midpoint', () => {
    const lyrics: LyricLine[] = [
      {
        id: 'line-1',
        startTime: 1,
        words: [
          { id: 'word-1', text: 'hello', endTime: 1.0005 },
          { id: 'word-2', text: 'world', endTime: 1.001 },
        ],
      },
    ]

    expectBoundsCloseTo(
      getDragClampBounds(
        { kind: 'word-separator', lineId: 'line-1', wordId: 'word-1' },
        lyrics,
        10,
      ),
      {
        min: 1.0005,
        max: 1.0005,
      },
    )
  })
})
