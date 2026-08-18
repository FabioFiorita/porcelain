import type { IncomingMessage, ServerResponse } from 'node:http'
import { publicErrorFor, writePublicError } from '../../daemon-composition/public-error'
import { createRequestId } from '../../daemon-composition/request-id'
import { mcpForbiddenOriginBody } from '../../net/mcp'
import type { AuthIdentity } from './access-store'

/**
 * POST /mcp — the agent tool surface, gated.
 *
 * Two gates, in this order. **Bearer first**, because authentication is the daemon's
 * outermost fail-closed check everywhere else and an anonymous caller must not be
 * able to probe which origins a daemon trusts. **Origin second**, because a loopback
 * bind is not privacy: any page the human has open can POST to 127.0.0.1, and MCP
 * requires local servers to refuse an untrusted `Origin` with 403 for exactly that
 * reason. The retired agent CLI needed neither — a web page cannot exec a binary —
 * so this is the security property the move to a network transport must pay for.
 *
 * The Porcelain protocol header is deliberately not required here: an MCP client is
 * not a Porcelain client and carries MCP's own `MCP-Protocol-Version` instead, which
 * `net/mcp` enforces against the request body.
 */
export async function serveMcpRoute(input: {
  req: IncomingMessage
  res: ServerResponse
  cors: Record<string, string>
  authenticate: () => Promise<AuthIdentity | null>
  allowedOrigins: readonly string[]
  /** Undefined means the daemon does not wire MCP at all, and the route 404s. */
  serveMcp: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | undefined
}): Promise<void> {
  const { req, res, cors, serveMcp } = input
  if (serveMcp === undefined) {
    res.writeHead(404, cors)
    res.end()
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }
  if ((await input.authenticate()) === null) {
    writePublicError(res, 401, cors, publicErrorFor('auth.unauthenticated', createRequestId()))
    return
  }
  const origin = req.headers.origin
  if (origin !== undefined && !input.allowedOrigins.includes(origin)) {
    const payload = JSON.stringify(mcpForbiddenOriginBody())
    res.writeHead(403, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    })
    res.end(payload)
    return
  }
  await serveMcp(req, res)
}
