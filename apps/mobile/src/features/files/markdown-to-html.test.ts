import { describe, expect, it } from 'vitest'

import { markdownToHtml, wrapMarkdownReaderHtml } from './markdown-to-html'

describe('markdownToHtml', () => {
  it('renders headings, emphasis, links and fenced code', () => {
    const html = markdownToHtml(
      [
        '# Title',
        '',
        'A **bold** and *italic* word with `code`.',
        '',
        '```ts',
        'const x = 1',
        '```',
        '',
        '- one',
        '- two',
        '',
        '1. first',
        '',
        '> quote',
        '',
        'See [docs](https://example.com).',
        '',
        '---',
      ].join('\n'),
    )

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<pre><code class="language-ts">const x = 1</code></pre>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<li>first</li>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('<hr>')
  })

  it('escapes raw HTML in the source', () => {
    const html = markdownToHtml('Hello <script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('wrapMarkdownReaderHtml', () => {
  it('wraps the body in a themed document with a viewport', () => {
    const document = wrapMarkdownReaderHtml('<p>Hi</p>', 'dark')
    expect(document).toContain('name="viewport"')
    expect(document).toContain('color-scheme: dark')
    expect(document).toContain('<article><p>Hi</p></article>')
  })
})
