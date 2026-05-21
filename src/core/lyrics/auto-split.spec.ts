import { describe, expect, it } from 'vitest'

import { autoSplitText } from './auto-split'

describe('autoSplitText', () => {
  it('splits English text by spaces', () => {
    expect(autoSplitText('hello world')).toEqual(['hello', 'world'])
  })

  it('splits text with multiple spaces into tokens (no empty strings)', () => {
    expect(autoSplitText('hello  world')).toEqual(['hello', 'world'])
  })

  it('does not split Chinese text (no spaces)', () => {
    expect(autoSplitText('想起你那笑容')).toEqual(['想起你那笑容'])
  })

  it('does not split Japanese text', () => {
    expect(autoSplitText('きみのこえ')).toEqual(['きみのこえ'])
  })

  it('handles mixed CJK and space-separated words', () => {
    expect(autoSplitText('hello 世界')).toEqual(['hello', '世界'])
  })

  it('returns single-element array for empty string', () => {
    expect(autoSplitText('')).toEqual([''])
  })

  it('returns single-element array for whitespace-only string', () => {
    expect(autoSplitText('   ')).toEqual([''])
  })

  it('preserves leading/trailing content when splitting', () => {
    expect(autoSplitText(' hello world ')).toEqual(['hello', 'world'])
  })
})
