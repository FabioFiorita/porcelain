import {
  decodeHeaderValue,
  errorOutcome,
  type JsonRpcId,
  MCP_ERROR,
  MCP_META,
  MCP_PROTOCOL_VERSION,
  type McpOutcome,
  resultOutcome,
} from './mcp-protocol'
import { MCP_TOOLS } from './mcp-tools'

/** What a tool returns. The daemon speaks Porcelain results; this is the wire shape. */
export type McpToolResult = Readonly<{ text: string; isError?: boolean }>

/** The seam commit A leaves open: transport first, operations behind it. */
export type McpToolHandlers = Readonly<{
  call: (name: string, args: Record<string, unknown>) => Promise<McpToolResult>
}>

export type McpDispatchInput = Readonly<{
  /** Header names already lowercased by Node. */
  headers: Readonly<Record<string, string | undefined>>
  rawBody: string
  handlers: McpToolHandlers
  serverInfo: { name: string; version: string }
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function header(headers: McpDispatchInput['headers'], name: string): string | undefined {
  const value = headers[name]
  return value === undefined || value === '' ? undefined : value
}

/**
 * One POST in, one outcome out. Every refusal the spec names is decided here rather
 * than in the HTTP layer, so the whole matrix is provable without a socket.
 *
 * ORDER MATTERS. Header validation precedes dispatch because a load balancer may
 * route on `Mcp-Method` while the server executes `body.method`; if those disagree,
 * two components are acting on different sources of truth and the request is refused
 * rather than reconciled.
 */
export async function dispatchMcp(input: McpDispatchInput): Promise<McpOutcome> {
  const { headers, handlers, serverInfo } = input

  let parsed: unknown
  try {
    parsed = JSON.parse(input.rawBody)
  } catch {
    return errorOutcome(null, {
      status: 400,
      code: MCP_ERROR.parse,
      message: 'Request body is not valid JSON',
    })
  }

  if (!isRecord(parsed) || parsed.jsonrpc !== '2.0' || typeof parsed.method !== 'string') {
    return errorOutcome(null, {
      status: 400,
      code: MCP_ERROR.invalidRequest,
      message: 'Not a JSON-RPC 2.0 message',
    })
  }

  const method = parsed.method
  const rawId = parsed.id

  // A notification carries no id. The server MUST accept it with 202 and no body —
  // and MUST NOT answer it. The retired MCP server once replied to (and executed)
  // notification-shaped calls; that is the bug this branch exists to prevent.
  if (rawId === undefined) return { kind: 'accepted' }

  if (typeof rawId !== 'string' && typeof rawId !== 'number') {
    return errorOutcome(null, {
      status: 400,
      code: MCP_ERROR.invalidRequest,
      message: 'Request id must be a string or a number',
    })
  }
  const id: JsonRpcId = rawId

  const params = isRecord(parsed.params) ? parsed.params : {}
  const meta = isRecord(params._meta) ? params._meta : {}
  const bodyVersion = meta[MCP_META.protocolVersion]

  const headerVersion = header(headers, 'mcp-protocol-version')
  if (headerVersion === undefined) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.headerMismatch,
      message: 'MCP-Protocol-Version header is required',
    })
  }
  if (headerVersion !== bodyVersion) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.headerMismatch,
      message: `Header mismatch: MCP-Protocol-Version header value '${headerVersion}' does not match body value '${String(bodyVersion)}'`,
    })
  }
  if (headerVersion !== MCP_PROTOCOL_VERSION) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.unsupportedProtocolVersion,
      message: `Unsupported protocol version '${headerVersion}'`,
      data: { supported: [MCP_PROTOCOL_VERSION] },
    })
  }

  const headerMethod = header(headers, 'mcp-method')
  if (headerMethod === undefined) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.headerMismatch,
      message: 'Mcp-Method header is required',
    })
  }
  if (headerMethod !== method) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.headerMismatch,
      message: `Header mismatch: Mcp-Method header value '${headerMethod}' does not match body value '${method}'`,
    })
  }

  // Capabilities are required on every request precisely because there is no
  // handshake to have declared them once.
  if (meta[MCP_META.clientCapabilities] === undefined) {
    return errorOutcome(id, {
      status: 400,
      code: MCP_ERROR.invalidParams,
      message: `_meta.${MCP_META.clientCapabilities} is required on every request`,
    })
  }

  if (method === 'tools/list') {
    return resultOutcome(id, { tools: MCP_TOOLS }, serverInfo)
  }

  if (method === 'tools/call') {
    const name = params.name
    if (typeof name !== 'string') {
      return errorOutcome(id, {
        status: 400,
        code: MCP_ERROR.invalidParams,
        message: 'params.name is required',
      })
    }
    const headerName = header(headers, 'mcp-name')
    if (headerName === undefined) {
      return errorOutcome(id, {
        status: 400,
        code: MCP_ERROR.headerMismatch,
        message: 'Mcp-Name header is required for tools/call',
      })
    }
    if (decodeHeaderValue(headerName) !== name) {
      return errorOutcome(id, {
        status: 400,
        code: MCP_ERROR.headerMismatch,
        message: `Header mismatch: Mcp-Name header value '${decodeHeaderValue(headerName)}' does not match body value '${name}'`,
      })
    }
    if (!MCP_TOOLS.some((tool) => tool.name === name)) {
      return errorOutcome(id, {
        status: 400,
        code: MCP_ERROR.invalidParams,
        message: `Unknown tool '${name}'`,
      })
    }
    const args = isRecord(params.arguments) ? params.arguments : {}
    const outcome = await handlers.call(name, args)
    // A tool that fails is a RESULT with isError, not a JSON-RPC error: the model is
    // meant to read the failure and try again, which a transport error denies it.
    return resultOutcome(
      id,
      {
        content: [{ type: 'text', text: outcome.text }],
        ...(outcome.isError === true ? { isError: true } : {}),
      },
      serverInfo,
    )
  }

  // 404, not 400: the status is how a client tells "this endpoint does not implement
  // that method" from "this is not a modern MCP endpoint at all".
  return errorOutcome(id, {
    status: 404,
    code: MCP_ERROR.methodNotFound,
    message: `Unknown method '${method}'`,
  })
}
