// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { CANVAS_BRIDGE_SCRIPT_HASH } from '../features/projects'
import { type CanvasHttpDeps, canvasTokenFromUrl, handleCanvasRequest } from './canvas-http'

describe('canvasTokenFromUrl', () => {
  it('extracts the token from the exact route shape', () => {
    expect(canvasTokenFromUrl('/canvas/abc123')).toBe('abc123')
  })

  it('rejects a missing token', () => {
    expect(canvasTokenFromUrl('/canvas/')).toBeNull()
  })

  it('rejects an extra path segment', () => {
    expect(canvasTokenFromUrl('/canvas/abc/def')).toBeNull()
  })

  it('rejects a path outside the canvas route', () => {
    expect(canvasTokenFromUrl('/trpc/readCanvas')).toBeNull()
  })

  it('ignores a query string on the token', () => {
    expect(canvasTokenFromUrl('/canvas/abc123?x=1')).toBe('abc123')
  })
})

describe('handleCanvasRequest', () => {
  const HTML_RECORD = {
    id: 'canvas-1',
    worktreeId: null,
    title: 'Intent',
    kind: 'html' as const,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    tracked: false,
  }

  function deps(overrides: Partial<CanvasHttpDeps> = {}): CanvasHttpDeps {
    return {
      resolveAccessToken: () => ({
        projectId: 'proj-1',
        canvasId: 'canvas-1',
        worktreePath: null,
      }),
      readCanvas: async () => ({
        ok: true,
        value: { record: HTML_RECORD, content: '<script>console.log(1)</script>' },
      }),
      readCanvasAsset: async () => ({
        ok: true,
        value: { bytes: Buffer.from('0123456789'), contentType: 'video/mp4' },
      }),
      ...overrides,
    }
  }

  async function withServer(
    routeDeps: CanvasHttpDeps,
    run: (base: string) => Promise<void>,
  ): Promise<void> {
    const server: Server = createServer((req, res) => {
      handleCanvasRequest(req, res, routeDeps).catch((error: unknown) => {
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

  it('serves the inlined HTML with a locked-down CSP header', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/canvas/tok`)
      expect(res.status).toBe(200)
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain("connect-src 'none'")
      expect(csp).toContain("script-src 'unsafe-inline'")
      expect(csp).toContain("media-src 'self'")
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(await res.text()).toBe(
        '<base href="/canvas/tok/assets/"><script>console.log(1)</script>',
      )
    })
  })

  it('serves a Canvas media asset with byte-range semantics', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/canvas/tok/assets/capture.mp4`, {
        headers: { range: 'bytes=2-5' },
      })
      expect(res.status).toBe(206)
      expect(res.headers.get('content-type')).toBe('video/mp4')
      expect(res.headers.get('accept-ranges')).toBe('bytes')
      expect(res.headers.get('content-range')).toBe('bytes 2-5/10')
      expect(await res.text()).toBe('2345')
    })
  })

  it('pins script-src to the link bridge alone for a promoted Canvas', async () => {
    // A tracked Canvas can arrive by clone from another repository (ADR 0002),
    // so the browser — not a server-side sanitizer — refuses its author scripts.
    const routeDeps = deps({
      readCanvas: async () => ({
        ok: true,
        value: {
          record: { ...HTML_RECORD, tracked: true },
          content: '<script>console.log(1)</script>',
        },
      }),
    })
    await withServer(routeDeps, async (base) => {
      const csp = (await fetch(`${base}/canvas/tok`)).headers.get('content-security-policy')
      expect(csp).toContain(`script-src ${CANVAS_BRIDGE_SCRIPT_HASH}`)
      expect(csp).not.toContain("script-src 'unsafe-inline'")
    })
  })

  it('carries the addressed checkout from the grant into the Canvas read', async () => {
    // A promoted and a private Canvas can share an id; the token says which one.
    const readCanvas = vi.fn<CanvasHttpDeps['readCanvas']>(async () => ({
      ok: true as const,
      value: { record: HTML_RECORD, content: '<p>hi</p>' },
    }))
    const routeDeps = deps({
      resolveAccessToken: () => ({
        projectId: 'proj-1',
        canvasId: 'canvas-1',
        worktreePath: '/projects/alpha',
      }),
      readCanvas,
    })
    await withServer(routeDeps, async (base) => {
      await fetch(`${base}/canvas/tok`)
    })
    expect(readCanvas).toHaveBeenCalledWith({
      projectId: 'proj-1',
      canvasId: 'canvas-1',
      worktreePath: '/projects/alpha',
    })
  })

  it('rejects a non-GET/HEAD method', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/canvas/tok`, { method: 'POST' })
      expect(res.status).toBe(405)
    })
  })

  it('404s a malformed route', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/canvas/`)
      expect(res.status).toBe(404)
    })
  })

  it('401s an unresolvable (expired or unknown) token', async () => {
    await withServer(deps({ resolveAccessToken: () => null }), async (base) => {
      const res = await fetch(`${base}/canvas/tok`)
      expect(res.status).toBe(401)
    })
  })

  it('404s when the resolved Canvas no longer exists', async () => {
    await withServer(
      deps({ readCanvas: async () => ({ ok: false, error: { code: 'canvas.not-found' } }) }),
      async (base) => {
        const res = await fetch(`${base}/canvas/tok`)
        expect(res.status).toBe(404)
      },
    )
  })

  it('404s a Markdown-kind Canvas — this route is HTML-only', async () => {
    await withServer(
      deps({
        readCanvas: async () => ({
          ok: true,
          value: { record: { ...HTML_RECORD, kind: 'markdown' }, content: '# hi' },
        }),
      }),
      async (base) => {
        const res = await fetch(`${base}/canvas/tok`)
        expect(res.status).toBe(404)
      },
    )
  })

  it('answers HEAD with no body', async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/canvas/tok`, { method: 'HEAD' })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('')
    })
  })

  it('calls readCanvas with the token-resolved scope, not caller-supplied values', async () => {
    const readCanvas = vi.fn<CanvasHttpDeps['readCanvas']>(async () => ({
      ok: true,
      value: { record: HTML_RECORD, content: '<p>hi</p>' },
    }))
    await withServer(
      deps({
        resolveAccessToken: () => ({
          projectId: 'proj-9',
          canvasId: 'canvas-9',
          worktreePath: null,
        }),
        readCanvas,
      }),
      async (base) => {
        await fetch(`${base}/canvas/tok`)
        expect(readCanvas).toHaveBeenCalledWith({ projectId: 'proj-9', canvasId: 'canvas-9' })
      },
    )
  })
})
