import type { DiffHunk } from '@porcelain/contracts/git'
import { collapseHunks } from '@renderer/lib/collapse-hunks'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HunksView } from './hunks-view'

vi.mock('@renderer/components/viewer/code-line', () => ({
  useHighlighter: () => null,
  // Surface `wrap` so the tests can pin that diff lines ask to soft-wrap. The real
  // classes are pinned in code-line.test.tsx.
  CodeLine: ({ text, wrap }: { text: string; wrap?: boolean }) => (
    <span data-wrap={wrap === true}>{text}</span>
  ),
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

/**
 * Reading a diff must never need horizontal scrolling: a long line wraps to the
 * viewport, in both layouts and both modes. The row then has to be free to be taller
 * than one line, so nothing may pin or clip its height.
 *
 * These render `layout="content"`, which is all jsdom can see: the `pane` layout goes
 * through the real virtualizer, which measures a 0-tall scroll element here and mounts
 * no rows at all. The shipped `fitWidth dynamicHeight` path is gated by
 * `e2e/diff-wrap.spec.ts` on the browser lane instead.
 */
describe('HunksView wrapping', () => {
  const longLine: DiffHunk = {
    header: '@@ -1,2 +1,2 @@',
    lines: [
      { kind: 'context', oldLine: 1, newLine: 1, text: '  indented context' },
      { kind: 'add', oldLine: null, newLine: 2, text: 'a'.repeat(400) },
    ],
  }

  it('asks every unified line to wrap', () => {
    render(<HunksView hunks={[longLine]} filePath="a.md" diffMode="unified" layout="content" />)
    const lines = screen.getAllByText(/indented context|a{400}/)
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(line).toHaveAttribute('data-wrap', 'true')
  })

  it('asks every split cell to wrap, and never clips the cell that grew taller', () => {
    const { container } = render(
      <HunksView hunks={[longLine]} filePath="a.md" diffMode="split" layout="content" />,
    )
    for (const line of screen.getAllByText(/indented context|a{400}/)) {
      expect(line).toHaveAttribute('data-wrap', 'true')
    }
    // Scoped to the cell holding the long added line, not the whole subtree: the cell
    // is what used to carry `overflow-hidden`, and pinning its absence anywhere would
    // break on unrelated chrome later.
    const cell = container.querySelector('[data-line="2"]')
    expect(cell).not.toBeNull()
    expect(cell?.className).not.toContain('overflow-hidden')
  })

  it('lets a split row grow to its taller side instead of pinning it to the parent', () => {
    const { container } = render(
      <HunksView hunks={[longLine]} filePath="a.md" diffMode="split" layout="content" />,
    )
    // `h-full` resolved against a parent that is now auto-height, so it sized the row to
    // the shorter side and cut the divider off beside a wrapped cell. Flex's default
    // `align-items: stretch` is what should size the cells.
    const rows = container.querySelectorAll('.divide-x')
    expect(rows).not.toHaveLength(0)
    for (const row of rows) expect(row.className).not.toContain('h-full')
  })
})
