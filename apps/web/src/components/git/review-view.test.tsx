import type { FeatureReading } from '@porcelain/contracts/review'
import { useDiffReading } from '@renderer/features/git'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseReviewTabKey, ReviewView, reviewTabKey } from './review-view'

vi.mock('@renderer/features/git', () => ({
  useDiffReading: vi.fn(),
  useReviewedPaths: () => new Set(),
  useSetReviewed: () => () => {},
  useToggleReviewed: () => ({ mark: async () => {}, unmark: async () => {} }),
}))
// Reading surface pulls comments + reviewed + highlighter — stub the domain hooks, and take the
// surface itself from the real Review feature (this file only owns the scope chrome around it).
vi.mock('@renderer/features/review', async () => {
  const surface = await vi.importActual<typeof import('@renderer/features/review/reading-surface')>(
    '@renderer/features/review/reading-surface',
  )
  return { ReadingSurfaceBody: surface.ReadingSurfaceBody }
})
vi.mock('@renderer/features/review/comments', () => ({
  useReviewComments: () => [],
  useCommentActions: () => ({ add: async () => {} }),
  buildCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
}))
vi.mock('@renderer/components/viewer/code-line', () => ({
  useHighlighter: () => null,
  CodeLine: ({ text }: { text: string }) => <span>{text}</span>,
}))
vi.mock('@renderer/components/viewer/virtual-rows', () => ({
  VirtualRows: ({
    rows,
    renderRow,
  }: {
    rows: unknown[]
    renderRow: (row: unknown) => React.ReactNode
  }) => (
    <div>
      {rows.map((row) => (
        <div key={JSON.stringify(row)}>{renderRow(row)}</div>
      ))}
    </div>
  ),
}))

const reading: FeatureReading = {
  name: 'Changes',
  sections: [],
  evidence: null,
  groups: [
    {
      layer: 'Pages',
      files: [
        {
          path: 'app/page.tsx',
          source: 'changed',
          status: 'modified',
          additions: 1,
          hunks: [
            {
              header: '@@ -1 +1 @@',
              lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'hello' }],
            },
          ],
        },
      ],
    },
  ],
}

describe('reviewTabKey / parseReviewTabKey', () => {
  it('round-trips working, branch, and commit scopes', () => {
    expect(reviewTabKey({ type: 'working' })).toBe('working')
    expect(reviewTabKey({ type: 'branch' })).toBe('branch')
    expect(reviewTabKey({ type: 'commit', hash: 'abc' })).toBe('commit:abc')
    expect(parseReviewTabKey('working')).toEqual({ type: 'working' })
    expect(parseReviewTabKey('branch')).toEqual({ type: 'branch' })
    expect(parseReviewTabKey('commit:abc123')).toEqual({ type: 'commit', hash: 'abc123' })
  })
})

describe('ReviewView', () => {
  beforeEach(() => {
    vi.mocked(useDiffReading).mockReturnValue({ reading, error: null })
  })

  it('renders the stacked reading surface for a scope key', () => {
    render(<ReviewView path="working" />)
    expect(screen.getByText('app/page.tsx')).toBeInTheDocument()
    expect(screen.getByText('Pages')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('shows Loading while the reading is undefined', () => {
    vi.mocked(useDiffReading).mockReturnValue({ reading: undefined, error: null })
    render(<ReviewView path="working" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty-state when there are no files', () => {
    vi.mocked(useDiffReading).mockReturnValue({
      reading: { name: 'Changes', sections: [], groups: [], evidence: null },
      error: null,
    })
    render(<ReviewView path="working" />)
    expect(screen.getByText('No changes to review')).toBeInTheDocument()
  })
})
