import { render } from '@testing-library/react'
import type { ThemedToken } from 'shiki'
import { describe, expect, it, vi } from 'vitest'
import { CodeLine } from './code-line'

vi.mock('@renderer/hooks/use-theme', () => ({ useResolvedTheme: () => 'dark' }))

const tokens = (...contents: string[]): ThemedToken[] =>
  contents.map((content) => ({ content, offset: 0, color: '#fff' }) as ThemedToken)

function pre(node: HTMLElement): HTMLPreElement {
  const el = node.querySelector('pre')
  if (!el) throw new Error('CodeLine rendered no <pre>')
  return el
}

describe('CodeLine wrapping', () => {
  it('keeps one line per row by default — the horizontally scrolling surfaces', () => {
    const { container } = render(<CodeLine tokens={null} text="  const x = 1" />)
    expect(pre(container).className).toContain('whitespace-pre')
    expect(pre(container).className).not.toContain('whitespace-pre-wrap')
    expect(pre(container).className).not.toContain('wrap-anywhere')
  })

  it('soft-wraps to the container when asked, breaking a token that still will not fit', () => {
    const { container } = render(<CodeLine tokens={null} text="  const x = 1" wrap />)
    const className = pre(container).className
    // pre-wrap (never `normal`) so indentation survives; wrap-anywhere + min-w-0 so a
    // URL/base64 blob breaks instead of re-widening the row past the viewport.
    expect(className).toContain('whitespace-pre-wrap')
    expect(className).toContain('wrap-anywhere')
    expect(className).toContain('min-w-0')
  })

  it('preserves leading whitespace when wrapping', () => {
    const { container } = render(<CodeLine tokens={null} text="      deeply.indented()" wrap />)
    expect(pre(container).textContent).toBe('      deeply.indented()')
  })

  it('wraps the highlighted (tokenized) line too, not just the plain-text fallback', () => {
    const { container } = render(<CodeLine tokens={tokens('  const', ' x = 1')} text="" wrap />)
    expect(pre(container).className).toContain('whitespace-pre-wrap')
    expect(pre(container).textContent).toBe('  const x = 1')
  })

  it('wraps a word-diff emphasized line too', () => {
    const { container } = render(
      <CodeLine
        tokens={tokens('const x = 1')}
        text="const x = 1"
        emphasis={{ ranges: [{ start: 6, end: 7 }], className: 'bg-diff-add-emphasis' }}
        wrap
      />,
    )
    expect(pre(container).className).toContain('wrap-anywhere')
    expect(container.querySelector('.bg-diff-add-emphasis')?.textContent).toBe('x')
  })
})
