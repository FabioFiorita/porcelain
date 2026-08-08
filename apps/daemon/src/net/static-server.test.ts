import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import {
  createServer,
  get,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isImmutableAsset,
  preferredContentEncoding,
  resolveStaticPath,
  rewriteCsp,
  serveStatic,
} from './static-server'

// A POSIX-style root for readable assertions; the helper is separator-aware.
const ROOT = `${sep}app${sep}out${sep}renderer`

describe('resolveStaticPath', () => {
  it("maps '/' to index.html", () => {
    expect(resolveStaticPath(ROOT, '/')).toBe(`${ROOT}${sep}index.html`)
  })

  it('maps the browser pairing route to the app shell', () => {
    expect(resolveStaticPath(ROOT, '/pair')).toBe(`${ROOT}${sep}index.html`)
    expect(resolveStaticPath(ROOT, '/pair?grant=secret')).toBe(`${ROOT}${sep}index.html`)
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
  const META = (connect: string): string =>
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; ${connect}" />`

  // Matches the Electron index.html CSP: loopback entries + scheme-wide sources so a
  // remote daemon (LAN/tailnet) is reachable from the packaged app (Phase 4).
  const ORIGINAL = "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http: https: ws: wss:"

  it('rewrites connect-src to same-origin ws for the request host', () => {
    const out = rewriteCsp(META(ORIGINAL), '100.64.0.1:43117')
    expect(out).toBe(META("connect-src 'self' ws://100.64.0.1:43117 wss://100.64.0.1:43117"))
  })

  it('leaves default-src, script-src, style-src, and img-src byte-identical', () => {
    const out = rewriteCsp(META(ORIGINAL), 'host:1234')
    expect(out).toContain("default-src 'self'")
    expect(out).toContain("script-src 'self' 'wasm-unsafe-eval'")
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

describe('preferredContentEncoding', () => {
  it('prefers Brotli when the client gives it equal priority', () => {
    expect(preferredContentEncoding('gzip, deflate, br')).toBe('br')
  })

  it('honors quality weights and disabled encodings', () => {
    expect(preferredContentEncoding('br;q=0.5, gzip;q=0.9')).toBe('gzip')
    expect(preferredContentEncoding('br;q=0, gzip')).toBe('gzip')
    expect(preferredContentEncoding('br;q=0, gzip;q=0')).toBeNull()
  })

  it('uses an accepted wildcard but never compresses without negotiation', () => {
    expect(preferredContentEncoding('*;q=0.5')).toBe('br')
    expect(preferredContentEncoding(undefined)).toBeNull()
  })
})

describe('isImmutableAsset', () => {
  it('recognizes Vite content-hashed assets', () => {
    expect(isImmutableAsset('/assets/index-BPRkBP7Q.js')).toBe(true)
    expect(isImmutableAsset('/assets/font-DDncdh2F.woff2?v=1')).toBe(true)
  })

  it('keeps stable filenames and the app shell revalidating', () => {
    expect(isImmutableAsset('/assets/index.js')).toBe(false)
    expect(isImmutableAsset('/assets/descriptive-longfilename.js')).toBe(false)
    expect(isImmutableAsset('/manifest.webmanifest')).toBe(false)
    expect(isImmutableAsset('/')).toBe(false)
  })
})

describe('serveStatic content types', () => {
  const dist = join(tmpdir(), 'porcelain-static-server-test')
  const javascript = `const porcelain = ${JSON.stringify('trusted-work-'.repeat(8_000))};`

  beforeEach(() => {
    mkdirSync(dist, { recursive: true })
    mkdirSync(join(dist, 'assets'), { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<html><body>Porcelain</body></html>')
    writeFileSync(join(dist, 'manifest.webmanifest'), '{"name":"Porcelain"}')
    writeFileSync(join(dist, 'apple-touch-icon.png'), 'png-bytes')
    writeFileSync(join(dist, 'assets', 'index-BPRkBP7Q.js'), javascript)
    writeFileSync(join(dist, 'assets', 'index.js'), javascript)
  })

  afterEach(() => rmSync(dist, { recursive: true, force: true }))

  // HEAD is enough to assert the type mapping and keeps the test off streams.
  const headType = async (url: string): Promise<string | undefined> => {
    let headers: Record<string, string> | undefined
    const res = {
      writeHead: (_status: number, h?: Record<string, string>) => {
        headers = h
      },
      end: () => {},
      headersSent: false,
    } as unknown as ServerResponse
    await serveStatic({ url, method: 'HEAD', headers: {} } as IncomingMessage, res, dist)
    return headers?.['content-type']
  }

  // Safari ignores a manifest served as octet-stream, so the home-screen name and
  // icons silently fall back to the page title + a screenshot.
  it('serves the web app manifest as application/manifest+json', async () => {
    expect(await headType('/manifest.webmanifest')).toBe('application/manifest+json')
  })

  it('serves the apple touch icon as image/png', async () => {
    expect(await headType('/apple-touch-icon.png')).toBe('image/png')
  })

  it('serves the app shell for a direct browser pairing request', async () => {
    const server = createServer(async (req, res) => {
      await serveStatic(req, res, dist)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('missing test port')
      const response = await fetch(`http://127.0.0.1:${address.port}/pair`)

      expect(response.status).toBe(200)
      expect(await response.text()).toContain('Porcelain')
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  })

  const request = async (
    url: string,
    headers: IncomingHttpHeaders = {},
  ): Promise<{ body: Buffer; headers: IncomingHttpHeaders; status: number | undefined }> => {
    const server = createServer(async (req, res) => {
      await serveStatic(req, res, dist)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('missing test port')
      return await new Promise((resolve, reject) => {
        get({ host: '127.0.0.1', port: address.port, path: url, headers }, (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => chunks.push(chunk))
          response.once('end', () => {
            resolve({
              body: Buffer.concat(chunks),
              headers: response.headers,
              status: response.statusCode,
            })
          })
          response.once('error', reject)
        }).once('error', reject)
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }

  it('serves Brotli-compressed text assets and marks hashed files immutable', async () => {
    const response = await request('/assets/index-BPRkBP7Q.js', {
      'accept-encoding': 'gzip, br',
    })

    expect(response.status).toBe(200)
    expect(response.headers['content-encoding']).toBe('br')
    expect(response.headers.vary).toBe('Accept-Encoding')
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(brotliDecompressSync(response.body).toString()).toBe(javascript)
    expect(response.body.byteLength).toBeLessThan(Buffer.byteLength(javascript) / 5)
  })

  it('falls back to gzip when Brotli is unavailable', async () => {
    const response = await request('/assets/index-BPRkBP7Q.js', {
      'accept-encoding': 'gzip',
    })

    expect(response.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(response.body).toString()).toBe(javascript)
  })

  it('keeps the host-rewritten app shell and stable assets fresh', async () => {
    const shell = await request('/pair', { 'accept-encoding': 'br' })
    const stableAsset = await request('/assets/index.js', { 'accept-encoding': 'br' })

    expect(shell.headers['cache-control']).toBe('no-cache')
    expect(shell.headers['content-encoding']).toBeUndefined()
    expect(stableAsset.headers['cache-control']).toBe('no-cache')
  })
})
