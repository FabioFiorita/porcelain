import type { IncomingMessage, ServerResponse } from 'node:http'
import { dispatchMcp, type McpToolHandlers } from './mcp-dispatch'
import { errorBody, MCP_ERROR } from './mcp-protocol'

/** 1 MiB. A Review's sections are prose; a Canvas bundle travels by path, never inline. */
export const MCP_MAX_BODY_BYTES = 1024 * 1024

export type McpHttpOptions = Readonly<{
  handlers: McpToolHandlers
  serverInfo: { name: string; version: string }
}>

/**
 * The body for an Origin refusal. A local HTTP endpoint is reachable from any page
 * the human has open, so an untrusted `Origin` must be refused with 403 — the one
 * security property the retired agent CLI had for free, since a web page cannot exec
 * a binary. The Remote boundary owns the allowlist and writes this.
 */
export function mcpForbiddenOriginBody(): unknown {
  return errorBody(null, {
    status: 403,
    code: MCP_ERROR.invalidRequest,
    message: 'Origin not allowed',
  })
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size <= maxBytes) chunks.push(chunk)
      else tooLarge = true
    })
    req.on('end', () => resolve(tooLarge ? null : Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * The MCP endpoint. Mounted by the Remote boundary, which has ALREADY applied the
 * Bearer gate AND the Origin check (`mcpForbiddenOriginBody` above) — authentication
 * stays the daemon's outermost check, and this handler is never reached
 * unauthenticated or cross-origin.
 *
 * The Porcelain protocol-version header is deliberately NOT required here. That gate
 * exists so independently updated Porcelain clients cannot talk to a daemon that
 * speaks a different wire; an MCP client is not a Porcelain client and is versioned
 * by MCP's own `MCP-Protocol-Version`, which mcp-dispatch enforces instead.
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: McpHttpOptions,
): Promise<void> {
  // GET and DELETE are the session-era mechanics (standalone SSE stream, session
  // teardown). Neither era the daemon speaks keeps a session, so they are refused
  // rather than emulated; a classic client opens the GET stream optimistically after
  // `initialize` and treats the 405 as "this server has no server-initiated stream".
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' })
    res.end()
    return
  }

  const rawBody = await readBody(req, MCP_MAX_BODY_BYTES)
  if (rawBody === null) {
    writeJson(
      res,
      413,
      errorBody(null, {
        status: 413,
        code: MCP_ERROR.invalidRequest,
        message: 'Request body too large',
      }),
    )
    return
  }

  const outcome = await dispatchMcp({
    headers: req.headers as Record<string, string | undefined>,
    rawBody,
    handlers: options.handlers,
    serverInfo: options.serverInfo,
  })

  if (outcome.kind === 'accepted') {
    res.writeHead(202)
    res.end()
    return
  }
  writeJson(res, outcome.status, outcome.body)
}
