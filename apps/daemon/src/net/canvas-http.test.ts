// @vitest-environment node
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { type CanvasHttpDeps, canvasTokenFromUrl, handleCanvasRequest } from './canvas-http'

function fakeReq(method: string, url: string): IncomingMessage {
  return { method, url } as IncomingMessage
}

function fakeRes(): ServerResponse & {
  statusCode: number
  headers: Record<string, string>
  body: string
} {
  const state = { statusCode: 0, headers: {} as Record<string, string>, body: '' }
  return {
    writeHead: vi.fn((status: number, headers?: Record<string, string>) => {
      state.statusCode = status
      if (headers) state.headers = headers
      return state as unknown as ServerResponse
    }),
    end: vi.fn((chunk?: string) => {
      if (typeof chunk === 'string') state.body = chunk
    }),
    get statusCode() {
      return state.statusCode
    },
    get headers() {
      return state.headers
    },
    get body() {
      return state.body
    },
  } as unknown as ServerResponse & {
    statusCode: number
    headers: Record<string, string>
    body: string
  }
}

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
  }

  function deps(overrides: Partial<CanvasHttpDeps> = {}): CanvasHttpDeps {
    return {
      resolveAccessToken: () => ({ projectId: 'proj-1', canvasId: 'canvas-1' }),
      readCanvas: async () => ({
        ok: true,
        value: { record: HTML_RECORD, content: '<script>console.log(1)</script>' },
      }),
      ...overrides,
    }
  }

  it('serves the inlined HTML with a locked-down CSP header', async () => {
    const res = fakeRes()
    await handleCanvasRequest(fakeReq('GET', '/canvas/tok'), res, deps())
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-security-policy']).toContain("connect-src 'none'")
    expect(res.headers['content-security-policy']).toContain("script-src 'unsafe-inline'")
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toBe('<script>console.log(1)</script>')
  })

  it('rejects a non-GET/HEAD method', async () => {
    const res = fakeRes()
    await handleCanvasRequest(fakeReq('POST', '/canvas/tok'), res, deps())
    expect(res.statusCode).toBe(405)
  })

  it('404s a malformed route', async () => {
    const res = fakeRes()
    await handleCanvasRequest(fakeReq('GET', '/canvas/'), res, deps())
    expect(res.statusCode).toBe(404)
  })

  it('401s an unresolvable (expired or unknown) token', async () => {
    const res = fakeRes()
    await handleCanvasRequest(
      fakeReq('GET', '/canvas/tok'),
      res,
      deps({ resolveAccessToken: () => null }),
    )
    expect(res.statusCode).toBe(401)
  })

  it('404s when the resolved Canvas no longer exists', async () => {
    const res = fakeRes()
    await handleCanvasRequest(
      fakeReq('GET', '/canvas/tok'),
      res,
      deps({ readCanvas: async () => ({ ok: false, error: { code: 'canvas.not-found' } }) }),
    )
    expect(res.statusCode).toBe(404)
  })

  it('404s a Markdown-kind Canvas — this route is HTML-only', async () => {
    const res = fakeRes()
    await handleCanvasRequest(
      fakeReq('GET', '/canvas/tok'),
      res,
      deps({
        readCanvas: async () => ({
          ok: true,
          value: { record: { ...HTML_RECORD, kind: 'markdown' }, content: '# hi' },
        }),
      }),
    )
    expect(res.statusCode).toBe(404)
  })

  it('answers HEAD with no body', async () => {
    const res = fakeRes()
    await handleCanvasRequest(fakeReq('HEAD', '/canvas/tok'), res, deps())
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('')
  })
})
