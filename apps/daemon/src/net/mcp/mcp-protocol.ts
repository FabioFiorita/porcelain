/**
 * The MCP 2026-07-28 wire vocabulary — codes, reserved `_meta` keys, and the
 * envelope builders. Pure: no HTTP, no Porcelain domain.
 *
 * This revision is STATELESS. There is no `initialize`, no session id, and no
 * server-initiated request; every POST carries its own protocol version and
 * client capabilities in `_meta`, which is exactly why the daemon can serve MCP
 * as one more route instead of the stdio subprocess that made the old server
 * (retired in 7833529) a per-agent configuration problem.
 */

/** The one revision this daemon speaks. Advertised back on an unsupported-version refusal. */
export const MCP_PROTOCOL_VERSION = '2026-07-28'

export const MCP_META = {
  protocolVersion: 'io.modelcontextprotocol/protocolVersion',
  clientInfo: 'io.modelcontextprotocol/clientInfo',
  clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
  serverInfo: 'io.modelcontextprotocol/serverInfo',
} as const

/**
 * JSON-RPC codes. `-32020`/`-32022` come from the range the MCP spec reserves for
 * itself; we must not invent codes in `-32020`..`-32099`.
 */
export const MCP_ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  headerMismatch: -32020,
  unsupportedProtocolVersion: -32022,
} as const

export type JsonRpcId = string | number

export type McpFailure = Readonly<{
  status: number
  code: number
  message: string
  data?: unknown
}>

export type McpOutcome =
  | Readonly<{ kind: 'json'; status: number; body: unknown }>
  /** A notification the server accepted: 202 with NO body, and nothing executed. */
  | Readonly<{ kind: 'accepted' }>

export function errorBody(id: JsonRpcId | null, failure: McpFailure): unknown {
  const error: Record<string, unknown> = { code: failure.code, message: failure.message }
  if (failure.data !== undefined) error.data = failure.data
  // A malformed request whose id could not be read carries no id at all.
  return id === null ? { jsonrpc: '2.0', error } : { jsonrpc: '2.0', id, error }
}

export function errorOutcome(id: JsonRpcId | null, failure: McpFailure): McpOutcome {
  return { kind: 'json', status: failure.status, body: errorBody(id, failure) }
}

/**
 * Every result carries `resultType` — the spec's polymorphic marker. Only
 * `complete` today; `input_required` is what MRTR will return when a Review
 * blocks on an unanswered human comment.
 */
export function resultOutcome(
  id: JsonRpcId,
  result: Record<string, unknown>,
  serverInfo: { name: string; version: string },
): McpOutcome {
  return {
    kind: 'json',
    status: 200,
    body: {
      jsonrpc: '2.0',
      id,
      result: {
        resultType: 'complete',
        ...result,
        _meta: { [MCP_META.serverInfo]: serverInfo },
      },
    },
  }
}

const BASE64_PREFIX = '=?base64?'
const BASE64_SUFFIX = '?='

/**
 * `Mcp-Name` may arrive Base64-wrapped when the value is not header-safe. Servers
 * MUST decode before comparing to the body, or a legitimate non-ASCII name reads
 * as a mismatch.
 */
export function decodeHeaderValue(raw: string): string {
  if (!raw.startsWith(BASE64_PREFIX) || !raw.endsWith(BASE64_SUFFIX)) return raw
  const encoded = raw.slice(BASE64_PREFIX.length, raw.length - BASE64_SUFFIX.length)
  return Buffer.from(encoded, 'base64').toString('utf8')
}
