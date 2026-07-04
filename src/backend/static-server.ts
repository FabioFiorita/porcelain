import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute, join, normalize, resolve, sep } from 'node:path'

/**
 * Serves the built renderer (the app shell) to the browser client — everything
 * that isn't /trpc or /session. Introduced in remote-envs Phase 3 so a plain
 * browser on the tailnet gets the same dist the Electron window loads.
 *
 * SECURITY (audit skill): the static assets are UNAUTHENTICATED by design — the
 * app shell is not secret, and the real gate stays on the dynamic endpoints
 * (/trpc + /session keep the token). This server therefore MUST NOT widen the
 * attack surface: it only ever reads files INSIDE the renderer dist root
 * (resolveStaticPath rejects any path escaping it — tested), never user files,
 * and adds no write surface (GET/HEAD only). The dist root has no user data.
 */

// The renderer dist lives beside the daemon bundle: out/main/daemon/server.js →
// out/renderer. Resolved from __dirname (the daemon is a CJS bundle, so __dirname
// is available) so it's correct regardless of cwd.
const RENDERER_ROOT = resolve(__dirname, '..', '..', 'renderer')

/**
 * Whether the built renderer dist exists. The dev daemon runs before any build,
 * so callers log this once (don't crash) — static requests then just 404.
 */
export function rendererDistExists(): boolean {
  return existsSync(join(RENDERER_ROOT, 'index.html'))
}

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
}

function contentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * Resolve a request URL path to an absolute file under `root`, or `null` if it
 * escapes the root (directory traversal) or is otherwise unsafe. Pure so it's
 * unit-tested against `../`, encoded `%2e%2e`, absolute paths, backslashes, and
 * query strings.
 *
 * - The query string (and hash) is stripped — only the path names a file.
 * - The path is percent-decoded so `%2e%2e` can't smuggle a `..` past the check.
 * - '/' (and any path ending in '/') maps to index.html.
 * - After join+normalize the result MUST stay within `root` (prefix check with a
 *   trailing separator, so a sibling dir sharing a prefix can't sneak through).
 */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  // Drop query + hash: only the path selects a file.
  const pathOnly = urlPath.split('?')[0].split('#')[0]

  let decoded: string
  try {
    decoded = decodeURIComponent(pathOnly)
  } catch {
    // Malformed percent-encoding — reject rather than guess.
    return null
  }

  // Backslashes are path separators on Windows and a common traversal trick;
  // normalize them to forward slashes before we reason about the path.
  const unixish = decoded.replace(/\\/g, '/')

  // A directory request ('/', or a trailing slash) serves the SPA entry.
  const relative = unixish === '' || unixish.endsWith('/') ? `${unixish}index.html` : unixish

  // An absolute request path can't be trusted to stay under root once joined.
  // Strip a leading slash so join treats it as relative to root; a still-absolute
  // decoded segment (e.g. a Windows drive) is caught by the prefix check below.
  const withoutLeadingSlash = relative.replace(/^\/+/, '')
  if (isAbsolute(withoutLeadingSlash)) return null

  const candidate = normalize(join(root, withoutLeadingSlash))

  // The candidate must live inside root. Compare against root + separator so a
  // sibling like `<root>-evil` can't pass a bare startsWith(root) check. The root
  // itself resolving to a file is impossible (it's a dir), so requiring the
  // separator is safe.
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null

  return candidate
}

/**
 * Rewrite index.html's CSP meta so the browser client can reach the daemon it was
 * served from. The dev/Electron CSP only allows the loopback daemon
 * (`http://127.0.0.1:* ws://127.0.0.1:*`); over the tailnet the origin is a real
 * host, so `connect-src` must allow same-origin WS. We replace ONLY the
 * connect-src directive's daemon entries with `ws://<host> wss://<host>`
 * (<host> = the request's Host header, host:port). Same-origin HTTP is already
 * covered by 'self'; the explicit ws entries cover Safari's stricter ws origin
 * matching.
 *
 * Pure + tested. It touches connect-src ONLY — never default-src/img-src, which
 * are the artifact-exfil backstop (audit invariant). Idempotent-ish: a host with
 * no 127.0.0.1 entries left is a no-op beyond appending its own (harmless).
 */
export function rewriteCsp(html: string, host: string): string {
  return html.replace(
    /connect-src 'self' http:\/\/127\.0\.0\.1:\* ws:\/\/127\.0\.0\.1:\*/,
    `connect-src 'self' ws://${host} wss://${host}`,
  )
}

/**
 * Serve a GET/HEAD request for a static asset from the renderer dist. Returns
 * true if it handled the request (2xx or 404), false only when the request isn't
 * a GET/HEAD it should own (the caller then does its own thing). index.html is
 * read and its CSP rewritten for the request Host; everything else streams.
 *
 * Missing dist dir (the dev daemon runs before any build) surfaces as a 404 per
 * request — logged once by the caller, never a crash.
 */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root = RENDERER_ROOT,
): Promise<void> {
  const filePath = resolveStaticPath(root, req.url ?? '/')
  if (filePath === null) {
    res.writeHead(404)
    res.end()
    return
  }

  const type = contentType(filePath)

  // HEAD: report the type without a body (best-effort — no stat, callers rarely
  // HEAD assets, and a 200 with no body is a valid HEAD response).
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': type })
    res.end()
    return
  }

  // index.html gets read whole so its CSP meta can be rewritten for this Host.
  if (filePath.endsWith('index.html')) {
    let html: string
    try {
      html = await readFile(filePath, 'utf8')
    } catch {
      res.writeHead(404)
      res.end()
      return
    }
    const host = req.headers.host ?? '127.0.0.1'
    const body = rewriteCsp(html, host)
    res.writeHead(200, { 'content-type': type })
    res.end(body)
    return
  }

  // Everything else streams straight off disk; a missing file 404s.
  const stream = createReadStream(filePath)
  stream.once('error', () => {
    if (!res.headersSent) res.writeHead(404)
    res.end()
  })
  stream.once('open', () => {
    res.writeHead(200, { 'content-type': type })
  })
  stream.pipe(res)
}
