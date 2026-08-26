import type { DiffHunk, DiffReadingOutput } from '@porcelain/contracts/git'
import { useDiffReading } from '@renderer/features/git'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangesetView, changesetTabKey, parseChangesetTabKey } from './changeset-view'
import { useChangesetCollapseStore } from '@renderer/stores/changeset-collapse'

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
    useChangesetCollapseStore.getState().clear()
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

  it('keeps a collapsed file collapsed after the changeset remounts', () => {
    const first = render(<ChangesetView path="working" />)
    fireEvent.click(screen.getByLabelText('Collapse diff'))
    expect(screen.queryByText('hello')).not.toBeInTheDocument()

    first.unmount()
    render(<ChangesetView path="working" />)
    expect(screen.getByLabelText('Expand diff')).toBeInTheDocument()
    expect(screen.queryByText('hello')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand diff'))
    expect(screen.getByText('hello')).toBeInTheDocument()
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

  it('offers expand-all on a stacked file while context is collapsed', () => {
    const lines = Array.from({ length: 100 }, (_, i) => ({
      kind: 'context' as const,
      oldLine: i + 1,
      newLine: i + 1,
      text: `line ${i + 1}`,
    }))
    lines[49] = { kind: 'add' as const, oldLine: null, newLine: 50, text: 'changed' }
    const hunks: DiffHunk[] = [{ header: '@@ -1,100 +1,100 @@', lines }]
    vi.mocked(useDiffReading).mockReturnValue({
      reading: {
        ...reading,
        groups: [
          {
            layer: 'Pages',
            files: [{ ...reading.groups[0].files[0], hunks }],
          },
        ],
      },
      error: null,
    })
    render(<ChangesetView path="working" />)

    expect(screen.queryByLabelText('Collapse context')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Expand all context'))
    expect(screen.queryByLabelText('Expand all context')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Collapse context')).toBeInTheDocument()
  })
})
