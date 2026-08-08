import { describe, expect, it } from 'vitest'

import { anchorableRange, type ViewerOverride, viewerFace, viewerMode } from './viewer-mode'

type MarkdownMode = 'reader' | 'source'

describe('viewerMode', () => {
  it('shows the Settings default when the reader has not overridden anything', () => {
    expect(viewerMode<MarkdownMode>('reader', null, 'docs/product.md')).toBe('reader')
  })

  it('shows the override on the file it was chosen for', () => {
    const override: ViewerOverride<MarkdownMode> = { mode: 'source', path: 'docs/product.md' }
    expect(viewerMode<MarkdownMode>('reader', override, 'docs/product.md')).toBe('source')
  })

  it('does not leak one file’s override onto the next file opened', () => {
    const override: ViewerOverride<MarkdownMode> = { mode: 'source', path: 'docs/product.md' }
    // The bug this exists to stop: peeking at one file's source used to redefine the app-wide
    // default, so every markdown file after it opened in Source.
    expect(viewerMode<MarkdownMode>('reader', override, 'README.md')).toBe('reader')
  })

  it('follows the default when Settings changes, since the override never wrote to it', () => {
    expect(viewerMode<MarkdownMode>('source', null, 'README.md')).toBe('source')
  })
})

describe('viewerFace', () => {
  const plain = {
    html: false,
    htmlMode: 'preview',
    isText: true,
    markdown: false,
    markdownMode: 'reader',
  } as const

  it('renders markdown and HTML in the face their mode asks for', () => {
    expect(viewerFace({ ...plain, markdown: true })).toBe('reader')
    expect(viewerFace({ ...plain, html: true })).toBe('preview')
  })

  it('reads source when the mode for that kind says source', () => {
    expect(viewerFace({ ...plain, markdown: true, markdownMode: 'source' })).toBe('source')
    expect(viewerFace({ ...plain, html: true, htmlMode: 'source' })).toBe('source')
  })

  it('has no rendered face for a file that is not text', () => {
    // An image, a binary, or a file past the read cap: the daemon answered something the
    // reader cannot render, and no preference makes that a page.
    expect(viewerFace({ ...plain, isText: false, markdown: true })).toBe('source')
    expect(viewerFace({ ...plain, html: true, isText: false })).toBe('source')
  })

  it('ignores the mode of a kind the file is not', () => {
    expect(viewerFace({ ...plain, htmlMode: 'source', markdownMode: 'source' })).toBe('source')
    expect(viewerFace({ ...plain, htmlMode: 'source', markdown: true })).toBe('reader')
  })
})

describe('anchorableRange', () => {
  const range = { endLine: 12, startLine: 9 }

  it('anchors to the selection while source is on screen', () => {
    expect(anchorableRange(range, 'source')).toBe(range)
  })

  it('falls back to the whole file on a rendered page, which has no lines', () => {
    expect(anchorableRange(range, 'reader')).toBeNull()
    expect(anchorableRange(range, 'preview')).toBeNull()
  })

  it('has nothing to anchor to without a selection', () => {
    expect(anchorableRange(null, 'source')).toBeNull()
  })
})
