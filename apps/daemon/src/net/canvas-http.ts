import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CanvasRecord } from '@porcelain/contracts/projects'
import { CANVAS_BRIDGE_SCRIPT_HASH, type ProjectOperationResult } from '../features/projects'

const CANVAS_ROUTE_PREFIX = '/canvas/'

/**
 * Locks the served document down far tighter than the app shell's own CSP:
 * no fetch/XHR/WS (`connect-src 'none'`), no further framing, no forms — an
 * opaque-origin sandboxed script (see canvas-view.tsx: `allow-scripts`, no
 * `allow-same-origin`) that cannot reach the network cannot exfiltrate. See
 * This matters because daemon-root Canvas files are private state.
 * lets a Canvas travel with a clone.
 */
const CANVAS_DOCUMENT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src 'self'; connect-src 'none'; form-action 'none'"

/**
 * A promoted Canvas is stricter still: promotion makes an explicit decision
 * rather than an inherited one: an unpromoted Canvas was written on this machine
 * by an agent the user already trusts with a shell, while a promoted one is a
 * tracked file `git clone` can deliver from someone else's repository. So the
 * only script permitted to run is Porcelain's own external-link bridge, pinned
 * by hash — every author script, inline or external, is refused by the browser,
 * which does not depend on a server-side sanitizer being complete. Styles,
 * images, and links still work, which is the whole point of promoting a Canvas.
 */
const TRACKED_CANVAS_DOCUMENT_CSP = `default-src 'none'; script-src ${CANVAS_BRIDGE_SCRIPT_HASH}; style-src 'unsafe-inline'; img-src data:; media-src 'self'; connect-src 'none'; form-action 'none'`

export type CanvasHttpDeps = Readonly<{
  resolveAccessToken: (
    token: string,
  ) => Readonly<{ projectId: string; canvasId: string; worktreePath: string | null }> | null
  readCanvas: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
  }) => Promise<ProjectOperationResult<{ record: CanvasRecord; content: string }>>
  readCanvasAsset: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
    assetPath: string
  }) => Promise<ProjectOperationResult<{ bytes: Buffer; contentType: string }>>
}>

/** The document token without an attachment suffix. */
export function canvasTokenFromUrl(url: string): string | null {
  const pathOnly = url.split('?')[0]?.split('#')[0] ?? ''
  if (!pathOnly.startsWith(CANVAS_ROUTE_PREFIX)) return null
  const rest = pathOnly.slice(CANVAS_ROUTE_PREFIX.length)
  if (rest === '' || rest.includes('/')) return null
  return rest
}

function canvasRoute(url: string): { token: string; assetPath: string | null } | null {
  const pathOnly = url.split('?')[0]?.split('#')[0] ?? ''
  if (!pathOnly.startsWith(CANVAS_ROUTE_PREFIX)) return null
  const [token, marker, ...assetSegments] = pathOnly.slice(CANVAS_ROUTE_PREFIX.length).split('/')
  if (!token) return null
  if (marker === undefined) return { token, assetPath: null }
  if (marker !== 'assets' || assetSegments.length === 0) return null
  try {
    return { token, assetPath: decodeURIComponent(assetSegments.join('/')) }
  } catch {
    return null
  }
}

function rangedSlice(
  range: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (range === undefined) return null
  const match = /^bytes=(\d+)-(\d*)$/.exec(range)
  if (!match) return null
  const start = Number(match[1])
  const end = match[2] === '' ? size - 1 : Number(match[2])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return null
  return { start, end: Math.min(end, size - 1) }
}

function writePlainText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

/**
 * Serves ONE agent-authored HTML Canvas on the app shell's OWN origin — same
 * port as /trpc — so the sandboxed iframe (`sandbox="allow-scripts"`) it
 * loads into is `frame-src`-permitted by the app CSP's `'self'` without any
 * change to `script-src`/`default-src` (empirically verified: a document
 * loaded from an http: URL does NOT inherit the embedding page's CSP the way
 * `srcdoc`/`blob:` do — this route only works BECAUSE it is a real HTTP GET).
 *
 * The token IS the credential: a plain `<iframe src>` navigation carries no
 * Authorization header, so this route does NOT run through the daemon's
 * Bearer `authenticate()` gate — canvas-access-tokens.ts's short-lived,
 * Project+Canvas-scoped grant is the whole auth story here, minted only to
 * an already-Bearer-authenticated tRPC caller (mintCanvasAccessToken).
 *
 * GET/HEAD only. Markdown Canvases never reach this route — they render
 * through tRPC readCanvas + a Markdown component instead, no scripts needed,
 * so they stay inside the existing sandbox="" srcdoc iframe (HtmlView).
 */
export async function handleCanvasRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: CanvasHttpDeps,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  const route = canvasRoute(req.url ?? '')
  if (route === null) {
    writePlainText(res, 404, 'not found')
    return
  }
  const scope = deps.resolveAccessToken(route.token)
  if (scope === null) {
    writePlainText(res, 401, 'expired or unknown Canvas access token')
    return
  }
  if (route.assetPath !== null) {
    const result = await deps.readCanvasAsset({
      projectId: scope.projectId,
      canvasId: scope.canvasId,
      assetPath: route.assetPath,
      ...(scope.worktreePath === null ? {} : { worktreePath: scope.worktreePath }),
    })
    if (!result.ok) {
      writePlainText(res, 404, 'not found')
      return
    }
    const { bytes, contentType } = result.value
    const range = rangedSlice(req.headers.range, bytes.length)
    const headers = {
      'content-type': contentType,
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    }
    if (req.headers.range !== undefined && range === null) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${bytes.length}` })
      res.end()
      return
    }
    if (range !== null) {
      const body = bytes.subarray(range.start, range.end + 1)
      res.writeHead(206, {
        ...headers,
        'content-range': `bytes ${range.start}-${range.end}/${bytes.length}`,
        'content-length': String(body.length),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
      return
    }
    res.writeHead(200, { ...headers, 'content-length': String(bytes.length) })
    res.end(req.method === 'HEAD' ? undefined : bytes)
    return
  }
  // The grant carries the checkout the Viewer addressed, so a promoted Canvas
  // is served from the tracked bundle the human is actually looking at rather
  // than from a private record that happens to share its id.
  const result = await deps.readCanvas({
    projectId: scope.projectId,
    canvasId: scope.canvasId,
    ...(scope.worktreePath === null ? {} : { worktreePath: scope.worktreePath }),
  })
  if (!result.ok || result.value.record.kind !== 'html') {
    writePlainText(res, 404, 'not found')
    return
  }

  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': result.value.record.tracked
      ? TRACKED_CANVAS_DOCUMENT_CSP
      : CANVAS_DOCUMENT_CSP,
    'cache-control': 'no-store',
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  const base = `<base href="${CANVAS_ROUTE_PREFIX}${route.token}/assets/">`
  res.end(`${base}${result.value.content}`)
}
