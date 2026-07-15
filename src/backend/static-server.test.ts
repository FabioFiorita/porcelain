import { sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveStaticPath, rewriteCsp } from './static-server'

// A POSIX-style root for readable assertions; the helper is separator-aware.
const ROOT = `${sep}app${sep}out${sep}renderer`

describe('resolveStaticPath', () => {
  it("maps '/' to index.html", () => {
    expect(resolveStaticPath(ROOT, '/')).toBe(`${ROOT}${sep}index.html`)
  })

  it('maps a trailing-slash dir request to its index.html', () => {
    expect(resolveStaticPath(ROOT, '/sub/')).toBe(`${ROOT}${sep}sub${sep}index.html`)
  })

  it('resolves a normal nested asset', () => {
    expect(resolveStaticPath(ROOT, '/assets/main.js')).toBe(`${ROOT}${sep}assets${sep}main.js`)
  })

  it('strips the query string before resolving', () => {
    expect(resolveStaticPath(ROOT, '/assets/main.js?v=abc123')).toBe(
      `${ROOT}${sep}assets${sep}main.js`,
    )
  })

  it('strips the hash before resolving', () => {
    expect(resolveStaticPath(ROOT, '/index.html#/foo')).toBe(`${ROOT}${sep}index.html`)
  })

  it('rejects a parent traversal with ../', () => {
    expect(resolveStaticPath(ROOT, '/../secret')).toBeNull()
  })

  it('rejects a deep traversal that climbs above root', () => {
    expect(resolveStaticPath(ROOT, '/assets/../../../etc/passwd')).toBeNull()
  })

  it('rejects an encoded traversal (%2e%2e)', () => {
    expect(resolveStaticPath(ROOT, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull()
  })

  it('rejects a backslash traversal', () => {
    expect(resolveStaticPath(ROOT, '/..\\..\\secret')).toBeNull()
  })

  it('rejects malformed percent-encoding', () => {
    expect(resolveStaticPath(ROOT, '/%zz')).toBeNull()
  })

  it('rejects a sibling dir sharing the root prefix', () => {
    // `<root>-evil` starts with `<root>` but is NOT inside it.
    expect(resolveStaticPath(ROOT, '/../renderer-evil/x')).toBeNull()
  })

  it('keeps a nested path that normalizes back inside root', () => {
    expect(resolveStaticPath(ROOT, '/assets/./main.js')).toBe(`${ROOT}${sep}assets${sep}main.js`)
  })
})

describe('rewriteCsp', () => {
  const META = (connect: string) =>
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; ${connect}" />`

  // Matches the Electron index.html CSP: loopback entries + scheme-wide sources so a
  // remote daemon (LAN/tailnet) is reachable from the packaged app (Phase 4).
  const ORIGINAL = "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http: https: ws: wss:"
  // Legacy loopback-only form still rewrites (older packaged dist / partial builds).
  const LEGACY = "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*"

  it('rewrites connect-src to same-origin ws for the request host', () => {
    const out = rewriteCsp(META(ORIGINAL), '100.64.0.1:43117')
    expect(out).toBe(META("connect-src 'self' ws://100.64.0.1:43117 wss://100.64.0.1:43117"))
  })

  it('also rewrites the legacy loopback-only connect-src', () => {
    const out = rewriteCsp(META(LEGACY), '100.64.0.1:43117')
    expect(out).toBe(META("connect-src 'self' ws://100.64.0.1:43117 wss://100.64.0.1:43117"))
  })

  it('leaves default-src, script-src, style-src, and img-src byte-identical', () => {
    const out = rewriteCsp(META(ORIGINAL), 'host:1234')
    expect(out).toContain("default-src 'self'")
    expect(out).toContain("script-src 'self'")
    expect(out).toContain("style-src 'self' 'unsafe-inline'")
    expect(out).toContain("img-src 'self' data:")
  })

  it('touches only connect-src — the rest of the document is unchanged', () => {
    const doc = `<html><head>${META(ORIGINAL)}</head><body>x</body></html>`
    const out = rewriteCsp(doc, 'host:1234')
    expect(out).toBe(
      `<html><head>${META("connect-src 'self' ws://host:1234 wss://host:1234")}</head><body>x</body></html>`,
    )
  })

  it('is a no-op when there is no matching connect-src to rewrite', () => {
    const noMatch = "connect-src 'self' ws://host:1234 wss://host:1234"
    expect(rewriteCsp(META(noMatch), 'host:1234')).toBe(META(noMatch))
  })
})
