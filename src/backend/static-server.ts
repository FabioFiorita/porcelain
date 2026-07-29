import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { constants, createBrotliCompress, createGzip } from 'node:zlib'

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
  // Safari ignores a manifest served as octet-stream, so the home-screen name/icons
  // silently fall back to the page title + a screenshot.
  webmanifest: 'application/manifest+json',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
}

function contentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

type ContentEncoding = 'br' | 'gzip'

/**
 * Pick the best compression supported by the client. Quality weights matter:
 * an explicitly disabled encoding must never be selected, and Brotli wins ties
 * because it is materially smaller for the renderer bundle.
 */
export function preferredContentEncoding(
  header: string | string[] | undefined,
): ContentEncoding | null {
  if (header === undefined) return null

  const values = Array.isArray(header) ? header : [header]
  const qualities = new Map<string, number>()

  for (const value of values) {
    for (const entry of value.split(',')) {
      const [rawName, ...parameters] = entry.trim().toLowerCase().split(';')
      if (rawName === '') continue

      let quality = 1
      for (const parameter of parameters) {
        const [name, rawValue] = parameter.trim().split('=')
        if (name !== 'q') continue
        const parsed = Number(rawValue)
        quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0
      }
      qualities.set(rawName, Math.max(qualities.get(rawName) ?? 0, quality))
    }
  }

  const wildcard = qualities.get('*') ?? 0
  const brotli = qualities.get('br') ?? wildcard
  const gzip = qualities.get('gzip') ?? wildcard
  if (brotli <= 0 && gzip <= 0) return null
  return brotli >= gzip ? 'br' : 'gzip'
}

function isCompressible(type: string): boolean {
  return (
    type.startsWith('text/') ||
    type.startsWith('application/json') ||
    type.startsWith('application/manifest+json') ||
    type.startsWith('image/svg+xml')
  )
}

/**
 * Vite fingerprints emitted renderer assets. Only those URLs may live forever
 * in a browser cache; the app shell and stable public filenames must revalidate
 * so a release can replace them.
 */
export function isImmutableAsset(urlPath: string): boolean {
  const pathOnly = urlPath.split('?')[0].split('#')[0]
  return /^\/assets\/.+-[a-zA-Z0-9_-]{8}\.[^/]+$/.test(pathOnly)
}

function responseHeaders(
  urlPath: string,
  type: string,
  encoding: ContentEncoding | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': type,
    'cache-control': isImmutableAsset(urlPath) ? 'public, max-age=31536000, immutable' : 'no-cache',
  }
  if (isCompressible(type)) headers.vary = 'Accept-Encoding'
  if (encoding !== null) headers['content-encoding'] = encoding
  return headers
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
 * - The browser pairing entry route (`/pair`) maps to the same app shell.
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

  // A directory request ('/', or a trailing slash) serves the SPA entry. Pairing
  // is the one client-side entry route opened directly from an external link, so
  // it must also receive the shell instead of looking for a literal `pair` file.
  // Keep this explicit rather than turning every missing path into a SPA route.
  const relative =
    unixish === '/pair' || unixish === 'pair'
      ? 'index.html'
      : unixish === '' || unixish.endsWith('/')
        ? `${unixish}index.html`
        : unixish

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
 * served from. The Electron CSP allows the loopback daemon plus scheme-wide
 * `http:/https:/ws:/wss:` so a remote daemon (LAN/tailnet) is reachable from the
 * packaged app; over the tailnet the browser origin is a real host, so we narrow
 * `connect-src` to same-origin WS. We replace ONLY the connect-src directive with
 * `ws://<host> wss://<host>` (<host> = the request's Host header, host:port).
 * Same-origin HTTP is covered by 'self'; the explicit ws entries cover Safari's
 * stricter ws origin matching.
 *
 * Pure + tested. It touches connect-src ONLY — never default-src/img-src, which
 * are the agent-HTML-exfil backstop (audit invariant). Idempotent-ish: a host with
 * no matching connect-src left is a no-op.
 */
export function rewriteCsp(html: string, host: string): string {
  return html.replace(
    /connect-src 'self' http:\/\/127\.0\.0\.1:\* ws:\/\/127\.0\.0\.1:\*(?: http: https: ws: wss:)?/,
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
  const isAppShell = filePath.endsWith('index.html')
  const encoding =
    !isAppShell && isCompressible(type)
      ? preferredContentEncoding(req.headers['accept-encoding'])
      : null
  const headers = responseHeaders(req.url ?? '/', type, encoding)

  // HEAD: report the type without a body (best-effort — no stat, callers rarely
  // HEAD assets, and a 200 with no body is a valid HEAD response).
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }

  // index.html gets read whole so its CSP meta can be rewritten for this Host.
  if (isAppShell) {
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
    // The host-specific shell is tiny and deliberately uncompressed; its
    // no-cache policy makes every navigation discover a newly released asset
    // fingerprint instead of booting indefinitely from an old app shell.
    res.writeHead(200, headers)
    res.end(body)
    return
  }

  // Everything else streams straight off disk, through built-in compression
  // for text assets when negotiated. A missing file 404s.
  const stream = createReadStream(filePath)
  stream.once('error', () => {
    if (!res.headersSent) res.writeHead(404)
    res.end()
  })
  stream.once('open', () => {
    res.writeHead(200, headers)
    if (encoding === 'br') {
      const compressor = createBrotliCompress({
        params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
      })
      compressor.once('error', (error) => res.destroy(error))
      stream.pipe(compressor).pipe(res)
      return
    }
    if (encoding === 'gzip') {
      const compressor = createGzip({ level: 6 })
      compressor.once('error', (error) => res.destroy(error))
      stream.pipe(compressor).pipe(res)
      return
    }
    stream.pipe(res)
  })
}
