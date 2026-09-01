/**
 * The MCP wire vocabulary — codes, reserved `_meta` keys, and the envelope
 * builders. Pure: no HTTP, no Porcelain domain.
 *
 * The daemon speaks TWO eras, because a real client speaks both. The 2026-07-28
 * revision is stateless: no session id and no server-initiated request; every POST
 * carries its own protocol version and client capabilities in `_meta`. A client that finds no
 * 2026 era — every SDK-based client today, and Claude Code when
 * its `server/discover` probe finds nothing — falls back to the classic
 * `initialize`/`notifications/initialized` handshake, so the daemon answers that too.
 * Statelessness survives the fallback: `initialize` mints no session id.
 */

/** The stateless revision. Its `server/discover` probe is what keeps a client here. */
export const MCP_PROTOCOL_VERSION = '2026-07-28'

/**
 * The pre-2026 revisions, newest first — the SDK's `SUPPORTED_PROTOCOL_VERSIONS`.
 * A classic client negotiates one of these through `initialize`.
 */
export const MCP_CLASSIC_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
  '2024-10-07',
] as const

/** What the daemon offers a classic client whose requested revision it does not know. */
export const MCP_CLASSIC_LATEST = MCP_CLASSIC_VERSIONS[0]

export function isClassicProtocolVersion(value: string): boolean {
  return (MCP_CLASSIC_VERSIONS as readonly string[]).includes(value)
}

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

/** A classic-era result: the plain JSON-RPC envelope, with none of the 2026 markers. */
export function classicResultOutcome(id: JsonRpcId, result: Record<string, unknown>): McpOutcome {
  return { kind: 'json', status: 200, body: { jsonrpc: '2.0', id, result } }
}

/**
 * A 2026-era result. Every one carries `resultType` — the revision's polymorphic
 * marker. Only `complete` today; `input_required` is what MRTR will return when a
 * Review blocks on an unanswered human comment.
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
