import { describe, expect, it } from 'vitest'
import { diffCanvasRows, tokenizableLines } from './canvas-rows'
import type { DiffRow } from './diff-rows'

function line(key: string, tone: 'context' | 'add' | 'del', text: string): DiffRow {
  return { gutter: '  12', key, kind: 'line', text, tone }
}

describe('diffCanvasRows', () => {
  it('maps every diff kind onto a role and pins file headers', () => {
    const rows = diffCanvasRows([
      { key: 'layer:Docs', kind: 'layer', label: 'Docs' },
      { key: 'file:README.md', kind: 'file', path: 'README.md', status: 'modified' },
      { header: '@@ -1 +1 @@', key: 'h', kind: 'hunk' },
      line('l', 'context', 'text'),
      { key: 'n', kind: 'notice', text: 'more' },
    ])

    expect(rows.map((row) => row.role)).toEqual(['layer', 'file', 'hunk', 'context', 'notice'])
    expect(rows[0].text).toBe('DOCS')
    expect(rows[1]).toMatchObject({ gutter: 'M', sticky: true })
    expect(rows[3]).toMatchObject({ gutter: '12', text: 'text' })
  })

  it('carries additions and deletions into the file row text', () => {
    const [row] = diffCanvasRows([
      { additions: 3, deletions: 1, key: 'f', kind: 'file', path: 'src/a.ts' },
    ])
    expect(row.text).toBe('src/a.ts  +3 −1')
  })

  it('highlights the words that changed across a paired delete and add', () => {
    const rows = diffCanvasRows([line('d', 'del', 'const a = 1'), line('a', 'add', 'const b = 1')])
    expect(rows[0].ranges).toEqual([{ end: 7, start: 6 }])
    expect(rows[1].ranges).toEqual([{ end: 7, start: 6 }])
  })

  it('leaves an unbalanced rewrite alone', () => {
    const rows = diffCanvasRows([
      line('d1', 'del', 'const a = 1'),
      line('a1', 'add', 'const b = 1'),
      line('a2', 'add', 'const c = 2'),
    ])
    expect(rows.every((row) => row.ranges === undefined)).toBe(true)
  })
})

describe('tokenizableLines', () => {
  it('tracks the file each code line belongs to', () => {
    const lines = tokenizableLines([
      { key: 'file:a', kind: 'file', path: 'src/a.ts' },
      line('a:1', 'add', 'one'),
      { key: 'file:b', kind: 'file', path: 'src/b.py' },
      line('b:1', 'context', 'two'),
    ])

    expect([...lines.keys()]).toEqual(['a:1', 'b:1'])
    expect(lines.get('a:1')).toEqual({ path: 'src/a.ts', text: 'one' })
    expect(lines.get('b:1')).toEqual({ path: 'src/b.py', text: 'two' })
  })

  it('falls back to the document path when there are no file rows', () => {
    const lines = tokenizableLines([line('x', 'context', 'code')], 'src/only.ts')
    expect(lines.get('x')?.path).toBe('src/only.ts')
  })
})
