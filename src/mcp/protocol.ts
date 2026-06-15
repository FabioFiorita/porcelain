// Minimal MCP (Model Context Protocol) over stdio: newline-delimited JSON-RPC 2.0.
// Hand-rolled rather than pulling the MCP SDK, so the standalone server stays
// DEPENDENCY-FREE — a plain `node out/mcp/server.js` the user's agent spawns, with
// nothing to resolve from node_modules (which a non-Electron `node` can't read from
// inside app.asar). The protocol surface is tiny: initialize, tools/list, tools/call.

export const SERVER_INFO = { name: 'porcelain', version: '0.3.0' }
export const PROTOCOL_VERSION = '2025-06-18'

const REVIEW_FILE_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repo-relative file path' },
    source: {
      type: 'string',
      enum: ['changed', 'context', 'shipped'],
      description:
        "Where the file sits relative to the change: 'shipped' (already landed, e.g. the server half), 'context' (unchanged but needed to follow the flow). Files in the working tree are detected as 'changed' automatically.",
    },
    note: {
      type: 'string',
      description:
        'A cross-file invariant the reviewer must check (e.g. "labels must match the service").',
    },
  },
  required: ['path'],
} as const

export const TOOLS = [
  {
    name: 'set_feature_review',
    description:
      'Define the feature review for a repo: the full set of files that make up the feature being reviewed, including server/cross-seam files the diff alone never shows, each optionally annotated with the invariant to check. Replaces any existing review set for the repo. Porcelain renders these in flow order.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        name: { type: 'string', description: 'A name for the feature (e.g. "Crew call-outs")' },
        files: { type: 'array', items: REVIEW_FILE_SCHEMA },
      },
      required: ['repoPath', 'files'],
    },
  },
  {
    name: 'add_review_files',
    description:
      'Add files to the existing feature review for a repo (creating one if none exists). Files with a path already present are replaced. Use while building a feature to grow the review incrementally.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        files: { type: 'array', items: REVIEW_FILE_SCHEMA },
      },
      required: ['repoPath', 'files'],
    },
  },
  {
    name: 'clear_feature_review',
    description:
      'Remove the feature review for a repo. Porcelain falls back to the static baseline (changed files plus what they import).',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
  {
    name: 'get_feature_review',
    description:
      'Read back the current feature review for a repo: its name, file count, and every file with its declared source and note. Use it to verify what you pushed, make an idempotent update (read → modify → set), or recover the set after losing context. Returns the stored set as declared; Porcelain still auto-detects working-tree files as "changed" when it renders.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
      },
      required: ['repoPath'],
    },
  },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function ok(id: unknown, result: Record<string, unknown>): Record<string, unknown> {
  return { jsonrpc: '2.0', id, result }
}

function fail(id: unknown, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/**
 * Handle one parsed JSON-RPC message. Returns the response object to write back,
 * or null for notifications (and unknown methods without an id) which get no reply.
 * `callTool` runs the side effect; a thrown error becomes an MCP tool error result
 * (isError) rather than a transport error, which is what clients expect.
 */
export async function handleRpc(
  message: unknown,
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
): Promise<Record<string, unknown> | null> {
  if (!isRecord(message)) return null
  const method = asString(message.method)
  const id = message.id
  if (method === undefined) return null
  const isNotification = !('id' in message) || id === null || id === undefined

  if (method === 'initialize') {
    const params = isRecord(message.params) ? message.params : {}
    return ok(id, {
      protocolVersion: asString(params.protocolVersion) ?? PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    })
  }
  if (method === 'tools/list') return ok(id, { tools: TOOLS })
  if (method === 'ping') return ok(id, {})
  if (method === 'tools/call') {
    const params = isRecord(message.params) ? message.params : {}
    const name = asString(params.name)
    const args = isRecord(params.arguments) ? params.arguments : {}
    if (name === undefined) return fail(id, -32602, 'missing tool name')
    try {
      const text = await callTool(name, args)
      return ok(id, { content: [{ type: 'text', text }] })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      return ok(id, { content: [{ type: 'text', text }], isError: true })
    }
  }
  if (isNotification) return null
  return fail(id, -32601, `method not found: ${method}`)
}
