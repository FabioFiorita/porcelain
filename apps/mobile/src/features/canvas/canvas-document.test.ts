import { describe, expect, it } from 'vitest'

import {
  CANVAS_LINK_BRIDGE,
  canvasDocumentUrl,
  canvasLinkHref,
  canvasNavigationAllowed,
} from './canvas-document'

const DOCUMENT_URL = 'http://daemon.local:43117/canvas/abc123'

describe('canvasDocumentUrl', () => {
  it('builds the token route on the daemon that minted it', () => {
    expect(canvasDocumentUrl('http://daemon.local:43117', 'abc123')).toBe(DOCUMENT_URL)
  })

  it('tolerates a trailing slash so the route never doubles up', () => {
    expect(canvasDocumentUrl('http://daemon.local:43117/', 'abc123')).toBe(DOCUMENT_URL)
  })

  it('escapes the token rather than letting it add path segments', () => {
    expect(canvasDocumentUrl('http://d', 'a/b')).toBe('http://d/canvas/a%2Fb')
  })
})

describe('canvasLinkHref', () => {
  const message = (payload: unknown): string => JSON.stringify(payload)

  it('accepts the bootstrap message for an absolute web link', () => {
    expect(
      canvasLinkHref(message({ href: 'https://example.com/x', source: 'porcelain-canvas' })),
    ).toBe('https://example.com/x')
  })

  it('accepts http as well as https', () => {
    expect(
      canvasLinkHref(message({ href: 'http://example.com', source: 'porcelain-canvas' })),
    ).toBe('http://example.com')
  })

  it('refuses a message that does not name the Canvas bootstrap', () => {
    expect(canvasLinkHref(message({ href: 'https://example.com', source: 'somewhere-else' }))).toBe(
      null,
    )
  })

  it('refuses every scheme that is an escape rather than a link', () => {
    for (const href of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'porcelain://pair?token=x',
      'data:text/html,<script>',
      'tel:+15551234',
    ]) {
      expect(canvasLinkHref(message({ href, source: 'porcelain-canvas' }))).toBe(null)
    }
  })

  it('refuses a relative href, which would only ever address the daemon itself', () => {
    expect(canvasLinkHref(message({ href: '/trpc/daemonInfo', source: 'porcelain-canvas' }))).toBe(
      null,
    )
  })

  it('refuses a non-string href and a payload that is not an object', () => {
    expect(canvasLinkHref(message({ href: 42, source: 'porcelain-canvas' }))).toBe(null)
    expect(canvasLinkHref(message('porcelain-canvas'))).toBe(null)
    expect(canvasLinkHref(message(null))).toBe(null)
  })

  it('refuses anything that is not JSON at all', () => {
    expect(canvasLinkHref('not json')).toBe(null)
    expect(canvasLinkHref('')).toBe(null)
  })
})

describe('canvasNavigationAllowed', () => {
  it('allows the minted document and the empty frame it starts from', () => {
    expect(canvasNavigationAllowed(DOCUMENT_URL, DOCUMENT_URL)).toBe(true)
    expect(canvasNavigationAllowed('about:blank', DOCUMENT_URL)).toBe(true)
  })

  it('refuses a second Canvas token on the same daemon', () => {
    expect(canvasNavigationAllowed('http://daemon.local:43117/canvas/other', DOCUMENT_URL)).toBe(
      false,
    )
  })

  it('refuses the daemon API the document is served beside', () => {
    expect(canvasNavigationAllowed('http://daemon.local:43117/trpc/daemonInfo', DOCUMENT_URL)).toBe(
      false,
    )
  })

  it('refuses top-level navigation to anywhere else', () => {
    for (const url of ['https://example.com', 'file:///etc/passwd', 'javascript:alert(1)']) {
      expect(canvasNavigationAllowed(url, DOCUMENT_URL)).toBe(false)
    }
  })
})

describe('CANVAS_LINK_BRIDGE', () => {
  it('only forwards a message the Canvas bootstrap posted', () => {
    expect(CANVAS_LINK_BRIDGE).toContain("data.source !== 'porcelain-canvas'")
    expect(CANVAS_LINK_BRIDGE).toContain('window.ReactNativeWebView.postMessage')
  })

  it('ends in a value so iOS has nothing to warn about', () => {
    expect(CANVAS_LINK_BRIDGE.trimEnd().endsWith('true;')).toBe(true)
  })
})
