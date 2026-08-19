import {
  classicResultOutcome,
  errorOutcome,
  type JsonRpcId,
  isClassicProtocolVersion,
  MCP_CLASSIC_LATEST,
  MCP_ERROR,
  type McpOutcome,
} from './mcp-protocol'
import { MCP_TOOLS } from './mcp-tools'
import type { McpToolHandlers } from './mcp-types'

export type McpClassicInput = Readonly<{
  id: JsonRpcId
  method: string
  params: Record<string, unknown>
  handlers: McpToolHandlers
  serverInfo: { name: string; version: string }
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The pre-2026 handshake: `initialize` → `notifications/initialized` → work. It
 * exists because a client only reaches the 2026 era through the `server/discover`
 * probe, and every SDK-based client — plus Claude Code whenever that probe fails —
 * arrives here instead. Refusing it is what made the shipped plugin register zero
 * tools on first contact.
 *
 * Still STATELESS: `initialize` mints no session id and the daemon keeps nothing
 * between requests, so `notifications/initialized` is accepted and dropped by the
 * caller before this function is ever reached.
 */
export async function dispatchClassicMcp(input: McpClassicInput): Promise<McpOutcome> {
  const { id, method, params, handlers, serverInfo } = input

  if (method === 'initialize') {
    // Echo the client's revision when we know it; otherwise name ours and let the
    // client decide. A version we cannot honour is not a refusal in this era — the
    // handshake exists precisely to settle the disagreement.
    const requested = params.protocolVersion
    const protocolVersion =
      typeof requested === 'string' && isClassicProtocolVersion(requested)
        ? requested
        : MCP_CLASSIC_LATEST
    return classicResultOutcome(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo,
    })
  }

  if (method === 'ping') return classicResultOutcome(id, {})

  if (method === 'tools/list') return classicResultOutcome(id, { tools: MCP_TOOLS })

  if (method === 'tools/call') {
    const name = params.name
    if (typeof name !== 'string') {
      return errorOutcome(id, {
        status: 400,
        code: MCP_ERROR.invalidParams,
        message: 'params.name is required',
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
    return classicResultOutcome(id, {
      content: [{ type: 'text', text: outcome.text }],
      ...(outcome.isError === true ? { isError: true } : {}),
    })
  }

  return errorOutcome(id, {
    status: 404,
    code: MCP_ERROR.methodNotFound,
    message: `Unknown method '${method}'`,
  })
}
