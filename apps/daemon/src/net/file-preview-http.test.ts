// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import {
  type FilePreviewHttpDeps,
  filePreviewTokenFromUrl,
  handleFilePreviewRequest,
  responsivePreviewDocument,
} from './file-preview-http'

describe('filePreviewTokenFromUrl', () => {
  it('extracts the token from the exact route shape', () => {
    expect(filePreviewTokenFromUrl('/file-preview/abc123')).toBe('abc123')
  })

  it('rejects a missing token, an extra segment, and a foreign path', () => {
    expect(filePreviewTokenFromUrl('/file-preview/')).toBeNull()
    expect(filePreviewTokenFromUrl('/file-preview/abc/style.css')).toBeNull()
    expect(filePreviewTokenFromUrl('/trpc/previewHtml')).toBeNull()
  })

  it('ignores a query string on the token', () => {
    expect(filePreviewTokenFromUrl('/file-preview/abc123?v=2')).toBe('abc123')
  })
})

describe('responsivePreviewDocument', () => {
  it('injects a viewport meta into an existing head, once', () => {
    const out = responsivePreviewDocument(
      '<html><head><title>t</title></head><body>x</body></html>',
    )
    expect(out).toContain('name="viewport"')
    expect(out.match(/name="viewport"/g)).toHaveLength(1)
  })

  it('leaves an authored viewport alone', () => {
    const authored = '<html><head><meta name="viewport" content="width=500"></head></html>'
    expect(responsivePreviewDocument(authored)).toBe(authored)
  })
})

describe('handleFilePreviewRequest', () => {
  const DOCUMENT =
    '<html><head><style>h1{color:red}</style></head><body><script>1</script></body></html>'

  function deps(overrides: Partial<FilePreviewHttpDeps> = {}): FilePreviewHttpDeps {
    return {
      resolveAccessToken: () => ({ projectPath: '/synthetic/repo', path: 'docs/index.html' }),
      readPreviewDocument: async () => ({ ok: true, value: DOCUMENT }),
      ...overrides,
    }
  }

  async function withServer(
    routeDeps: FilePreviewHttpDeps,
    run: (base: string) => Promise<void>,
  ): Promise<void> {
    const server: Server = createServer((req, res) => {
      handleFilePreviewRequest(req, res, routeDeps).catch((error: unknown) => {
        res.destroy(error instanceof Error ? error : new Error(String(error)))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('missing test port')
      await run(`http://127.0.0.1:${address.port}`)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  }

  it("serves the document with a CSP that runs the author's scripts but reaches no network", async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/file-preview/tok`)
      expect(res.status).toBe(200)
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain("script-src 'unsafe-inline'")
      expect(csp).toContain("style-src 'unsafe-inline'")
      expect(csp).toContain("connect-src 'none'")
      expect(csp).toContain("default-src 'none'")
      expect(csp).not.toContain('https:')
      expect(res.headers.get('content-type')).toContain('text/html')
      const body = await res.text()
      expect(body).toContain('<style>h1{color:red}</style>')
      expect(body).toContain('name="viewport"')
    })
  })

  it('refuses an unknown or expired token', async () => {
    await withServer(deps({ resolveAccessToken: () => null }), async (base) => {
      const res = await fetch(`${base}/file-preview/tok`)
      expect(res.status).toBe(401)
    })
  })

  it('404s when the file has no preview (missing or too large)', async () => {
    await withServer(
      deps({ readPreviewDocument: async () => ({ ok: true, value: null }) }),
      async (base) => {
        expect((await fetch(`${base}/file-preview/tok`)).status).toBe(404)
      },
    )
  })

  it('404s when the path escaped the project', async () => {
    await withServer(
      deps({
        readPreviewDocument: async () => ({ ok: false, error: { code: 'path-outside-project' } }),
      }),
      async (base) => {
        expect((await fetch(`${base}/file-preview/tok`)).status).toBe(404)
      },
    )
  })

  it('rejects methods other than GET/HEAD', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/file-preview/tok`, { method: 'POST' })
      expect(res.status).toBe(405)
    })
  })
})
