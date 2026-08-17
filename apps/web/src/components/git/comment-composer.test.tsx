import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommentComposer } from './comment-composer'

vi.mock('@renderer/features/review', () => ({
  useCommentActions: () => ({ add: async () => {} }),
}))

const NAME = `$${''}{name}`
const GREET_SNIPPET = `export function farewell(name) {\n  return \`Goodbye, ${NAME}.\`\n}`

function coloredSpanColors(root: HTMLElement): string[] {
  return [...root.querySelectorAll('pre span[style]')]
    .map((span) => (span as HTMLElement).style.color)
    .filter((color) => color.length > 0)
}

describe('CommentComposer snippet', () => {
  it('highlights the selected lines the same way the file viewer does', async () => {
    render(
      <CommentComposer
        open
        onOpenChange={() => {}}
        anchor={{
          path: 'greet.js',
          startLine: 5,
          endLine: 7,
          anchorText: GREET_SNIPPET,
        }}
      />,
    )

    expect(screen.getByText('Lines 5–7 of greet.js')).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).toContain('export function farewell')

    await waitFor(() => {
      const colors = new Set(coloredSpanColors(screen.getByRole('dialog')))
      expect(colors.size).toBeGreaterThan(1)
    })

    const snippet = screen.getByRole('dialog').querySelector('.font-mono.text-xs-minus')
    expect(snippet?.className).not.toContain('text-muted-foreground')
    expect(snippet?.textContent).toContain('export function farewell')
  })

  it('still shows the snippet as plain text when the language is unknown', () => {
    render(
      <CommentComposer
        open
        onOpenChange={() => {}}
        anchor={{
          path: 'notes.txt',
          startLine: 1,
          endLine: 1,
          anchorText: 'just a note',
        }}
      />,
    )
    expect(screen.getByText('just a note')).toBeInTheDocument()
  })
})
