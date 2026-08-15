import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CanvasRecord } from '@porcelain/contracts/projects'
import { CANVAS_BRIDGE_SCRIPT_HASH, type ProjectOperationResult } from '../features/projects'

const CANVAS_ROUTE_PREFIX = '/canvas/'

/**
 * Locks the served document down far tighter than the app shell's own CSP:
 * no fetch/XHR/WS (`connect-src 'none'`), no further framing, no forms — an
 * opaque-origin sandboxed script (see canvas-view.tsx: `allow-scripts`, no
 * `allow-same-origin`) that cannot reach the network cannot exfiltrate. See
 * docs/adr/0002-daemon-root-project-store.md for why this matters once #26
 * lets a Canvas travel with a clone.
 */
const CANVAS_DOCUMENT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'"

/**
 * A PROMOTED Canvas is stricter still. ADR 0002 makes this an explicit decision
 * rather than an inherited one: an unpromoted Canvas was written on this machine
 * by an agent the user already trusts with a shell, while a promoted one is a
 * tracked file `git clone` can deliver from someone else's repository. So the
 * only script permitted to run is Porcelain's own external-link bridge, pinned
 * by hash — every author script, inline or external, is refused by the browser,
 * which does not depend on a server-side sanitizer being complete. Styles,
 * images, and links still work, which is the whole point of promoting a Canvas.
 */
const TRACKED_CANVAS_DOCUMENT_CSP = `default-src 'none'; script-src ${CANVAS_BRIDGE_SCRIPT_HASH}; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'`

export type CanvasHttpDeps = Readonly<{
  resolveAccessToken: (
    token: string,
  ) => Readonly<{ projectId: string; canvasId: string; worktreePath: string | null }> | null
  readCanvas: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
  }) => Promise<ProjectOperationResult<{ record: CanvasRecord; content: string }>>
}>

/**
 * `/canvas/<token>` only — no further path segments. The document readCanvas
 * returns is already fully self-contained (images, stylesheets, and scripts
 * inlined by inlineLocalAssets), so there is never a second request for a
 * sibling asset, and no relative-path resolution to get right here.
 */
export function canvasTokenFromUrl(url: string): string | null {
  const pathOnly = url.split('?')[0]?.split('#')[0] ?? ''
  if (!pathOnly.startsWith(CANVAS_ROUTE_PREFIX)) return null
  const rest = pathOnly.slice(CANVAS_ROUTE_PREFIX.length)
  if (rest === '' || rest.includes('/')) return null
  return rest
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
  const token = canvasTokenFromUrl(req.url ?? '')
  if (token === null) {
    writePlainText(res, 404, 'not found')
    return
  }
  const scope = deps.resolveAccessToken(token)
  if (scope === null) {
    writePlainText(res, 401, 'expired or unknown Canvas access token')
    return
  }
  // The grant carries the checkout the Viewer addressed, so a promoted Canvas
  // is served from the tracked bundle the human is actually looking at rather
  // than from a private record that happens to share its id (#26).
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
  res.end(result.value.content)
}
