import type { ReviewComment } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { commentIndex } from './comment-index'

function comment(id: string, path: string, startLine?: number, endLine?: number): ReviewComment {
  return {
    id,
    path,
    body: id,
    author: 'user',
    resolved: false,
    createdAt: 1,
    ...(startLine === undefined
      ? {}
      : {
          anchor: { kind: 'file', path, startLine, ...(endLine === undefined ? {} : { endLine }) },
        }),
  }
}

describe('commentIndex', () => {
  it('indexes every line in a range and keeps whole-file comments separate', () => {
    const whole = comment('whole', 'src/a.ts')
    const range = comment('range', 'src/a.ts', 2, 4)
    const other = comment('other', 'src/b.ts', 2)

    const indexed = commentIndex([whole, range, other], 'src/a.ts')

    expect(indexed.fileLevel).toEqual([whole])
    expect([...indexed.byLine]).toEqual([
      [2, [range]],
      [3, [range]],
      [4, [range]],
    ])
  })
})
