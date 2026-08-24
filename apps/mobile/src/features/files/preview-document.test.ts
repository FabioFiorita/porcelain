import { describe, expect, it } from 'vitest'

import { isHtmlPath, isMarkdownPath } from './file-kinds'
import { markdownToHtml, previewDocument, readerDocument } from './preview-document'

describe('file kinds', () => {
  it('recognises the markdown extensions the desktop viewer answers to', () => {
    expect(isMarkdownPath('docs/product.md')).toBe(true)
    expect(isMarkdownPath('README.MARKDOWN')).toBe(true)
    expect(isMarkdownPath('notes.mdx')).toBe(true)
  })

  it('recognises html files', () => {
    expect(isHtmlPath('out/index.html')).toBe(true)
    expect(isHtmlPath('legacy.HTM')).toBe(true)
  })

  it('leaves everything else to the source view', () => {
    expect(isMarkdownPath('src/app.ts')).toBe(false)
    expect(isHtmlPath('src/app.ts')).toBe(false)
    expect(isMarkdownPath('Makefile')).toBe(false)
  })

  it('reads the extension from the basename, not from a dotted directory', () => {
    expect(isMarkdownPath('docs.md/notes.ts')).toBe(false)
    expect(isMarkdownPath('docs.ts/notes.md')).toBe(true)
  })

  it('does not read a dotfile’s own name as its extension', () => {
    expect(isMarkdownPath('.md')).toBe(false)
  })
})

describe('markdownToHtml', () => {
  it('renders the usual structures', () => {
    const html = markdownToHtml('# Title\n\n- one\n- two\n')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders tables and fenced code, which is what a repo README is made of', () => {
    expect(markdownToHtml('| a | b |\n| - | - |\n| 1 | 2 |\n')).toContain('<table>')
    expect(markdownToHtml('```ts\nconst a = 1\n```\n')).toContain('<code class="language-ts">')
  })

  it('escapes raw HTML instead of passing it through — a repo file is not trusted input', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('linkifies a bare URL, like the desktop reader does', () => {
    expect(markdownToHtml('see https://example.com now')).toContain('<a href="https://example.com"')
  })
})

describe('readerDocument', () => {
  it('carries the policy that keeps a preview offline and inert', () => {
    const doc = readerDocument('<p>hi</p>', 'dark')
    expect(doc).toContain("default-src 'none'")
    expect(doc).toContain('img-src data:')
    expect(doc).not.toContain('img-src data: https:')
    expect(doc).toContain('<p>hi</p>')
  })

  it('paints with the resolved scheme', () => {
    expect(readerDocument('', 'dark')).toContain('color-scheme: dark')
    expect(readerDocument('', 'light')).toContain('color-scheme: light')
  })
})

describe('previewDocument', () => {
  it('injects the policy and a viewport into an existing head', () => {
    const doc = previewDocument('<html><head><title>T</title></head><body>x</body></html>')
    expect(doc).toContain('Content-Security-Policy')
    expect(doc).toContain('name="viewport"')
    expect(doc).toContain('<title>T</title>')
  })

  it('puts the policy before the content it governs', () => {
    const doc = previewDocument('<html><head><title>T</title></head><body>x</body></html>')
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<title>'))
  })

  it('keeps a viewport the page already declares', () => {
    const doc = previewDocument(
      '<html><head><meta name="viewport" content="width=600"></head><body>x</body></html>',
    )
    expect(doc).toContain('width=600')
    expect(doc.match(/name="viewport"/g)).toHaveLength(1)
  })

  it('gives a head to a page that has none', () => {
    const doc = previewDocument('<html><body>x</body></html>')
    expect(doc).toContain('<head>')
    expect(doc).toContain('Content-Security-Policy')
  })

  it('wraps a bare fragment into a document', () => {
    const doc = previewDocument('<p>fragment</p>')
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<p>fragment</p>')
  })

  it('allows https images, fonts, and styles, and still refuses scripts', () => {
    const doc = previewDocument('<p>x</p>')
    expect(doc).toContain('img-src data: https:')
    expect(doc).toContain('font-src data: https:')
    expect(doc).toContain("style-src 'unsafe-inline' https:")
    expect(doc).not.toContain('script-src')
  })
})
