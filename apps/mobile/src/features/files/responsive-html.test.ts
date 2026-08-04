import { describe, expect, it } from 'vitest'

import { ensureResponsiveHtml } from './responsive-html'

describe('ensureResponsiveHtml', () => {
  it('injects a viewport into a head tag', () => {
    const html = ensureResponsiveHtml('<html><head><title>x</title></head><body>hi</body></html>')
    expect(html).toContain('name="viewport"')
    expect(html).toContain('<title>x</title>')
  })

  it('leaves an existing viewport alone', () => {
    const source =
      '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>'
    expect(ensureResponsiveHtml(source)).toBe(source)
  })

  it('wraps a bare fragment', () => {
    const html = ensureResponsiveHtml('<h1>Hi</h1>')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('name="viewport"')
    expect(html).toContain('<h1>Hi</h1>')
  })
})
