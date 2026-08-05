import { describe, expect, it } from 'vitest'

import { type ViewerOverride, viewerMode } from './viewer-mode'

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
