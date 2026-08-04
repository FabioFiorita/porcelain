import { describe, expect, it } from 'vitest'

import {
  buildSourceRows,
  sourceLineId,
  sourceLineIndex,
  sourceTokenizableLines,
} from './source-rows'

describe('source line ids', () => {
  it('round-trips a 1-based gutter id', () => {
    expect(sourceLineId(0)).toBe('L1')
    expect(sourceLineId(9)).toBe('L10')
    expect(sourceLineIndex('L1')).toBe(0)
    expect(sourceLineIndex('L10')).toBe(9)
    expect(sourceLineIndex('file')).toBeUndefined()
  })
})

describe('buildSourceRows', () => {
  it('emits one row per line with a line-number gutter', () => {
    const rows = buildSourceRows('const a = 1\nconst b = 2\n')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ gutter: '1', id: 'L1', role: 'line', text: 'const a = 1' })
    expect(rows[1]).toMatchObject({ gutter: '2', id: 'L2', text: 'const b = 2' })
    expect(rows[2]).toMatchObject({ gutter: '3', id: 'L3', text: '' })
  })
})

describe('sourceTokenizableLines', () => {
  it('keys every line by its source id and shares the file path', () => {
    const lines = sourceTokenizableLines('src/a.ts', 'a\nb')
    expect(lines.get('L1')).toEqual({ path: 'src/a.ts', text: 'a' })
    expect(lines.get('L2')).toEqual({ path: 'src/a.ts', text: 'b' })
    expect(lines.size).toBe(2)
  })
})
