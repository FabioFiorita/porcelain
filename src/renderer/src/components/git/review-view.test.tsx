import type { FeatureReading } from '@backend/feature-view'
import { useDiffReading } from '@renderer/hooks/use-diff-reading'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseReviewTabKey, ReviewView, reviewTabKey } from './review-view'

vi.mock('@renderer/hooks/use-diff-reading', () => ({ useDiffReading: vi.fn() }))
// Reading surface pulls comments + reviewed + highlighter — stub the domain hooks.
vi.mock('@renderer/hooks/use-comments', () => ({
  useReviewComments: () => [],
  useCommentActions: () => ({ add: async () => {} }),
  buildCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
}))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => new Set(),
  useToggleReviewed: () => ({ mark: async () => {}, unmark: async () => {} }),
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
      reading: { name: 'Changes', groups: [] },
      error: null,
    })
    render(<ReviewView path="working" />)
    expect(screen.getByText('No changes to review')).toBeInTheDocument()
  })
})
