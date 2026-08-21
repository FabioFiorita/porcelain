import type { IncomingMessage, ServerResponse } from 'node:http'
import { mcpForbiddenOriginBody } from '../../net/mcp'

/**
 * POST /mcp — the local agent tool surface.
 *
 * Installing the plugin is the user's authorization for a local agent, so this
 * route deliberately has no admin-token requirement. It is only reachable from a
 * direct loopback TCP connection, though: LAN, Tailscale, and Cloudflare requests
 * are refused even when they carry an admin credential. Forwarded/proxy headers are
 * refused because a tunnel or reverse proxy can otherwise make a remote request
 * look loopback-local. Origin checking remains important because arbitrary browser
 * pages can also POST to a loopback listener.
 *
 * MCP's own protocol headers are enforced by `net/mcp`; Porcelain's app protocol
 * header is intentionally not required here.
 */
export async function serveMcpRoute(input: {
  req: IncomingMessage
  res: ServerResponse
  cors: Record<string, string>
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
  if (!isDirectLoopbackRequest(req)) {
    // 404 intentionally avoids advertising the MCP surface to a remote caller.
    res.writeHead(404, cors)
    res.end()
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
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

function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function isDirectLoopbackRequest(req: IncomingMessage): boolean {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return false
  // A direct MCP client does not send these. Rejecting them prevents a local proxy
  // (including a Cloudflare tunnel) from laundering a remote request as loopback.
  const forwardedHeaders = [
    'forwarded',
    'via',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'cf-connecting-ip',
    'cf-ray',
    'cf-visitor',
  ]
  return forwardedHeaders.every((name) => {
    const value = req.headers[name]
    return value === undefined || value === ''
  })
}
