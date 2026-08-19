import type { DiffHunk } from '@porcelain/contracts/git'
import { collapseHunks } from '@renderer/lib/collapse-hunks'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HunksView } from './hunks-view'

vi.mock('@renderer/components/viewer/code-line', () => ({
  useHighlighter: () => null,
  CodeLine: ({ text }: { text: string }) => <span>{text}</span>,
}))

/** A whole-file diff of `total` lines with line `changed` replaced. */
function wholeFile(total: number, changed: number): DiffHunk {
  return {
    header: `@@ -1,${total} +1,${total} @@`,
    lines: Array.from({ length: total }, (_, i) =>
      i + 1 === changed
        ? { kind: 'add' as const, oldLine: null, newLine: i + 1, text: 'changed' }
        : { kind: 'context' as const, oldLine: i + 1, newLine: i + 1, text: `line ${i + 1}` },
    ),
  }
}

describe('HunksView gaps', () => {
  it('draws a gap row per collapsed run with expand controls, hiding the lines', () => {
    const collapsed = collapseHunks([wholeFile(100, 50)], { context: 3 })
    const onExpand = vi.fn()
    render(
      <HunksView
        hunks={collapsed.hunks}
        gaps={collapsed.gaps}
        onExpand={onExpand}
        filePath="src/big.ts"
        diffMode="unified"
        layout="content"
      />,
    )
    expect(screen.getByText('⋯ 46 unchanged lines')).toBeInTheDocument()
    expect(screen.getByText('⋯ 47 unchanged lines')).toBeInTheDocument()
    expect(screen.queryByText('line 20')).not.toBeInTheDocument()
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(screen.getByText('line 47')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand down from line 1'))
    expect(onExpand).toHaveBeenCalledWith(collapsed.gaps[0], 'down')
    fireEvent.click(screen.getByLabelText('Expand up from line 46'))
    expect(onExpand).toHaveBeenCalledWith(collapsed.gaps[0], 'up')
  })

  it('keeps the same rows in split mode — the gap spans both sides', () => {
    const collapsed = collapseHunks([wholeFile(60, 30)], { context: 3 })
    render(
      <HunksView
        hunks={collapsed.hunks}
        gaps={collapsed.gaps}
        onExpand={vi.fn()}
        filePath="src/big.ts"
        diffMode="split"
        layout="content"
      />,
    )
    expect(screen.getByText('⋯ 26 unchanged lines')).toBeInTheDocument()
    expect(screen.getByText('⋯ 27 unchanged lines')).toBeInTheDocument()
  })

  it('offers one control for a gap no bigger than a step', () => {
    const collapsed = collapseHunks([wholeFile(20, 1)], { context: 3 })
    render(
      <HunksView
        hunks={collapsed.hunks}
        gaps={collapsed.gaps}
        onExpand={vi.fn()}
        filePath="src/big.ts"
        diffMode="unified"
        layout="content"
      />,
    )
    expect(screen.getByLabelText('Expand 16 unchanged lines')).toBeInTheDocument()
  })

  it('renders hunks unchanged — headers and every line — when no gaps are passed', () => {
    const hunk: DiffHunk = {
      header: '@@ -1,2 +1,2 @@',
      lines: [
        { kind: 'context', oldLine: 1, newLine: 1, text: 'keep' },
        { kind: 'add', oldLine: null, newLine: 2, text: 'added' },
      ],
    }
    render(<HunksView hunks={[hunk]} filePath="src/a.ts" diffMode="unified" layout="content" />)
    expect(screen.getByText('Lines 1–2')).toBeInTheDocument()
    expect(screen.getByText('keep')).toBeInTheDocument()
    expect(screen.queryByText(/unchanged lines/)).not.toBeInTheDocument()
  })
})
