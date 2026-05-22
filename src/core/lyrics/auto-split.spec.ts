import { describe, expect, it } from 'vitest'

import { autoSplitText } from './auto-split'

describe('autoSplitText', () => {
  it('splits English text by spaces, preserving trailing space', () => {
    expect(autoSplitText('hello world')).toEqual(['hello ', 'world'])
  })

  it('preserves multiple trailing spaces between tokens', () => {
    expect(autoSplitText('hello  world')).toEqual(['hello  ', 'world'])
  })

  it('does not split Chinese text (no spaces)', () => {
    expect(autoSplitText('想起你那笑容')).toEqual(['想起你那笑容'])
  })

  it('does not split Japanese text', () => {
    expect(autoSplitText('きみのこえ')).toEqual(['きみのこえ'])
  })

  it('handles mixed CJK and space-separated words', () => {
    expect(autoSplitText('hello 世界')).toEqual(['hello ', '世界'])
  })

  it('returns single-element array for empty string', () => {
    expect(autoSplitText('')).toEqual([''])
  })

  it('returns single-element array for whitespace-only string', () => {
    expect(autoSplitText('   ')).toEqual([''])
  })

  it('trims leading whitespace but preserves internal trailing spaces', () => {
    expect(autoSplitText(' hello world ')).toEqual(['hello ', 'world'])
  })

  it('last token has no trailing space', () => {
    const result = autoSplitText('a b c')
    expect(result).toEqual(['a ', 'b ', 'c'])
    expect(result[result.length - 1]).toBe('c')
  })

  it('handles tab and mixed whitespace', () => {
    expect(autoSplitText('hello\tworld')).toEqual(['hello\t', 'world'])
  })
})
