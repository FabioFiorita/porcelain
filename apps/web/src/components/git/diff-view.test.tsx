import { useDiffFile } from '@renderer/features/git'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DiffView } from './diff-view'

vi.mock('@renderer/features/git', () => ({
  useDiffFile: vi.fn(),
  useReviewedPaths: () => new Set(),
  useToggleReviewed: () => ({ mark: () => {}, unmark: () => {} }),
}))
vi.mock('@renderer/features/review', () => ({
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
  useCommentActions: () => ({ add: async () => {} }),
}))

vi.mock('@renderer/components/viewer/code-line', () => ({
  useHighlighter: () => null,
  CodeLine: ({ text }: { text: string }) => <span>{text}</span>,
}))

vi.mock('@renderer/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

describe('DiffView', () => {
  it('fills the Viewer as one inset raised card', () => {
    vi.mocked(useDiffFile).mockReturnValue({
      hunks: [
        {
          header: '@@ -1 +1 @@',
          lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'hello' }],
        },
      ],
      status: 'modified',
      image: undefined,
      binary: false,
      error: null,
    })
    render(<DiffView filePath="src/app.ts" />)
    expect(screen.getByTestId(TestIds.codeWell).className).toContain('bg-muted/30')
    expect(screen.getByTestId(TestIds.codeCard).className).toContain('rounded-xl')
    expect(screen.getByTestId(TestIds.codeCard).className).toContain('h-full')
    expect(screen.getByText('src/app.ts')).toBeInTheDocument()
    expect(screen.getByLabelText('Mark reviewed')).toBeInTheDocument()
    expect(screen.getByLabelText('Comment on file')).toBeInTheDocument()
  })

  it('offers expand-all only while context is collapsed, and collapse once it is not', () => {
    // What the page fetches: the file whole (context 100000), one change at line 50.
    const lines = Array.from({ length: 100 }, (_, i) => ({
      kind: 'context' as const,
      oldLine: i + 1,
      newLine: i + 1,
      text: `line ${i + 1}`,
    }))
    lines[49] = { kind: 'add' as const, oldLine: null, newLine: 50, text: 'changed' } as never
    vi.mocked(useDiffFile).mockReturnValue({
      hunks: [{ header: '@@ -1,100 +1,100 @@', lines }],
      status: 'modified',
      image: undefined,
      binary: false,
      error: null,
    })
    render(<DiffView filePath="src/big.ts" />)

    expect(screen.queryByLabelText('Collapse context')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Expand all context'))
    expect(screen.queryByLabelText('Expand all context')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Collapse context')).toBeInTheDocument()
  })

  it('leaves a diff with nothing to collapse without expand controls', () => {
    vi.mocked(useDiffFile).mockReturnValue({
      hunks: [
        {
          header: '@@ -1 +1 @@',
          lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'hello' }],
        },
      ],
      status: 'modified',
      image: undefined,
      binary: false,
      error: null,
    })
    render(<DiffView filePath="src/app.ts" />)
    expect(screen.queryByLabelText('Expand all context')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Collapse context')).not.toBeInTheDocument()
  })
})
