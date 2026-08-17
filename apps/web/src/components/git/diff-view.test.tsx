import { useDiffFile } from '@renderer/features/git'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
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
})
