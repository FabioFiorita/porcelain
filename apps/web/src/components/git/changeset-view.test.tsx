import type { DiffReadingOutput } from '@porcelain/contracts/git'
import { useDiffReading } from '@renderer/features/git'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangesetView, changesetTabKey, parseChangesetTabKey } from './changeset-view'

vi.mock('@renderer/features/git', () => ({
  useDiffReading: vi.fn(),
  useReviewedPaths: () => new Set(),
  useSetReviewed: () => () => {},
  useToggleReviewed: () => ({ mark: async () => {}, unmark: async () => {} }),
}))
vi.mock('@renderer/features/review', () => ({
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
  useCommentActions: () => ({ add: async () => {} }),
}))
vi.mock('@renderer/components/viewer/code-line', () => ({
  useHighlighter: () => null,
  CodeLine: ({ text }: { text: string }) => <span>{text}</span>,
}))

// Typed to what `useDiffReading` actually returns. It was annotated `ReviewReading`, a
// wider shape whose `source` union the diff reading does not accept.
const reading: DiffReadingOutput = {
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

describe('changesetTabKey / parseChangesetTabKey', () => {
  it('round-trips working, branch, and commit scopes', () => {
    expect(changesetTabKey({ type: 'working' })).toBe('working')
    expect(changesetTabKey({ type: 'branch' })).toBe('branch')
    expect(changesetTabKey({ type: 'commit', hash: 'abc' })).toBe('commit:abc')
    expect(parseChangesetTabKey('working')).toEqual({ type: 'working' })
    expect(parseChangesetTabKey('branch')).toEqual({ type: 'branch' })
    expect(parseChangesetTabKey('commit:abc123')).toEqual({ type: 'commit', hash: 'abc123' })
  })

  it('keeps a chosen comparison base in the key, so two bases are two tabs', () => {
    expect(changesetTabKey({ type: 'branch', base: 'origin/develop' })).toBe(
      'branch:origin/develop',
    )
    expect(parseChangesetTabKey('branch:origin/develop')).toEqual({
      type: 'branch',
      base: 'origin/develop',
    })
  })
})

describe('ChangesetView', () => {
  beforeEach(() => {
    vi.mocked(useDiffReading).mockReturnValue({ reading, error: null })
  })

  it('renders the stacked reading surface for a scope key', () => {
    render(<ChangesetView path="working" />)
    expect(screen.getByText('app/page.tsx')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('Line 1')).toBeInTheDocument()
    expect(screen.queryByText('@@ -1 +1 @@')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mark reviewed')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment on file')).toBeInTheDocument()
  })

  it('hides mark-reviewed on a historical commit scope', () => {
    render(<ChangesetView path="commit:abc123" />)
    expect(screen.queryByLabelText('Mark reviewed')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Comment on file')).toBeInTheDocument()
    expect(screen.getByTestId('changeset-card-app/page.tsx').className).toContain('rounded-xl')
    expect(screen.getByTestId('changeset-card-app/page.tsx').className).toContain('bg-card')
    expect(screen.getByTestId('code-well').className).toContain('bg-muted/30')
  })

  it('shows Loading while the reading is undefined', () => {
    vi.mocked(useDiffReading).mockReturnValue({ reading: undefined, error: null })
    render(<ChangesetView path="working" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty-state when there are no files', () => {
    vi.mocked(useDiffReading).mockReturnValue({
      reading: { name: 'Changes', sections: [], groups: [], evidence: null },
      error: null,
    })
    render(<ChangesetView path="working" />)
    expect(screen.getByText('No changes to review')).toBeInTheDocument()
  })
})
