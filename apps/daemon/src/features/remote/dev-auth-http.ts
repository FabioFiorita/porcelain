import type { IncomingMessage, ServerResponse } from 'node:http'
import { logUnexpectedError } from '../../daemon-composition/error-log'
import { publicErrorFor, writePublicError } from '../../daemon-composition/public-error'
import { createRequestId } from '../../daemon-composition/request-id'

/**
 * `GET /dev-auth` — development auto-authorization.
 *
 * A dev daemon hands the browser client a real client token so no browser context has to be
 * paired by hand. This is provisioning, not a bypass: every request behind it still passes
 * the Bearer gate in remote-http.ts, and the credential it returns is an ordinary revocable
 * client from the access store. What it removes is the pairing handshake.
 *
 * The route exists ONLY when `createRemoteHttp` receives `devAutoAuth`, which `server.ts`
 * supplies only under PORCELAIN_DEV. A production daemon never mounts it, so the path falls
 * through to the static handler and 404s like any unknown URL.
 *
 * Skipping the handshake day-to-day would leave it unproven, so `e2e/pairing.spec.ts` walks
 * the real exchange against a live daemon, and `--no-auto-auth` puts a dev daemon back on the
 * pairing flow when that flow is itself under test.
 *
 * A dev daemon binds LAN by default, so anyone on that network can claim a dev credential —
 * an accepted development trade, bounded by the fact that dev daemons open playgrounds only.
 */
export async function handleDevAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cors: Record<string, string>,
  devAutoAuth: () => Promise<string>,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, cors)
    res.end()
    return
  }
  const requestId = createRequestId()
  try {
    const body = Buffer.from(JSON.stringify({ token: await devAutoAuth() }))
    res.writeHead(200, {
      ...cors,
      'content-type': 'application/json',
      'content-length': String(body.byteLength),
      // A credential must never sit in a shared or browser cache.
      'cache-control': 'no-store',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(body)
  } catch (error) {
    logUnexpectedError({ error, requestId, path: '/dev-auth' })
    if (!res.headersSent) {
      writePublicError(res, 500, cors, publicErrorFor('internal.unexpected', requestId))
    } else if (!res.writableEnded) {
      res.end()
    }
  }
}
