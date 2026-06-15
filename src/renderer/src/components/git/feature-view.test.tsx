import type { FeatureReading } from '@main/feature-view'
import { describe, expect, it } from 'vitest'
import { buildRows } from './feature-view'

const reading: FeatureReading = {
  name: 'Feature',
  groups: [
    {
      layer: 'Pages',
      files: [
        {
          path: 'app/page.tsx',
          source: 'changed',
          additions: 2,
          deletions: 1,
          hunks: [
            {
              header: '@@ -1 +1 @@',
              lines: [
                { kind: 'context', oldLine: 1, newLine: 1, text: 'a' },
                { kind: 'add', oldLine: null, newLine: 2, text: 'b' },
              ],
            },
          ],
        },
      ],
    },
    {
      layer: 'Services',
      files: [
        {
          path: 'server/svc.ts',
          source: 'shipped',
          note: 'owns the labels',
          ranges: [{ startLine: 10, lines: ['export const X = 1'], gapBefore: 9 }],
          truncated: true,
        },
      ],
    },
  ],
}

describe('buildRows', () => {
  // null highlighter → plain-text fallback, so no Shiki is needed in the test
  it('flattens the reading into fixed-height rows in flow order', () => {
    expect(buildRows(reading, null).map((r) => r.type)).toEqual([
      'layer', // Pages
      'file', // app/page.tsx (changed)
      'hunkHeader',
      'diff', // context line
      'diff', // added line
      'layer', // Services
      'file', // server/svc.ts (shipped)
      'note', // owns the labels
      'gap', // 9 elided lines before the slice
      'code', // export const X = 1
      'truncated', // capped marker
    ])
  })

  it('anchors a slice row to its original 1-based line number', () => {
    const code = buildRows(reading, null).find((r) => r.type === 'code')
    expect(code).toMatchObject({ type: 'code', lineNo: 10, text: 'export const X = 1' })
  })
})
