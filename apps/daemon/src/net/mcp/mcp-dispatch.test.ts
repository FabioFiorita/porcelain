// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { dispatchMcp, type McpToolHandlers } from './mcp-dispatch'
import { MCP_CLASSIC_LATEST, MCP_ERROR, MCP_META, MCP_PROTOCOL_VERSION } from './mcp-protocol'
import { MCP_TOOLS } from './mcp-tools'

const serverInfo = { name: 'porcelain', version: '0.0.0-test' }

function handlers(text = 'ok'): McpToolHandlers {
  return { call: vi.fn(async () => ({ text })) }
}

function meta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [MCP_META.protocolVersion]: MCP_PROTOCOL_VERSION,
    [MCP_META.clientCapabilities]: {},
    ...overrides,
  }
}

function request(method: string, params: Record<string, unknown> = {}): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { _meta: meta(), ...params } })
}

function headers(overrides: Record<string, string | undefined> = {}) {
  return {
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    'mcp-method': 'tools/list',
    ...overrides,
  }
}

async function run(
  rawBody: string,
  headerOverrides: Record<string, string | undefined> = {},
  tools = handlers(),
) {
  return dispatchMcp({ headers: headers(headerOverrides), rawBody, handlers: tools, serverInfo })
}

/** The error code carried by a json outcome, for terse assertions. */
function codeOf(outcome: Awaited<ReturnType<typeof dispatchMcp>>): number | undefined {
  if (outcome.kind !== 'json') return undefined
  const body = outcome.body as { error?: { code?: number } }
  return body.error?.code
}

describe('dispatchMcp', () => {
  it('lists every tool with a schema', async () => {
    const outcome = await run(request('tools/list'))
    expect(outcome.kind).toBe('json')
    if (outcome.kind !== 'json') return
    const body = outcome.body as { result: { tools: { name: string; inputSchema: unknown }[] } }
    expect(body.result.tools.length).toBe(MCP_TOOLS.length)
    expect(body.result.tools.map((t) => t.name)).toContain('porcelain_comment')
    expect(body.result.tools.map((t) => t.name)).toContain('porcelain_review')
    expect(body.result.tools.map((t) => t.name)).toContain('porcelain_profile')
    for (const tool of body.result.tools) expect(tool.inputSchema).toBeTypeOf('object')
  })

  it('marks every result complete and names the server', async () => {
    const outcome = await run(request('tools/list'))
    if (outcome.kind !== 'json') throw new Error('expected json')
    const body = outcome.body as { result: { resultType: string; _meta: Record<string, unknown> } }
    expect(body.result.resultType).toBe('complete')
    expect(body.result._meta[MCP_META.serverInfo]).toEqual(serverInfo)
  })

  it('accepts a notification without answering or executing it', async () => {
    const tools = handlers()
    const outcome = await dispatchMcp({
      headers: headers({ 'mcp-method': 'tools/call', 'mcp-name': 'porcelain_project' }),
      rawBody: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'porcelain_project', _meta: meta() },
      }),
      handlers: tools,
      serverInfo,
    })
    expect(outcome.kind).toBe('accepted')
    expect(tools.call).not.toHaveBeenCalled()
  })

  it('refuses a body that is not JSON', async () => {
    expect(codeOf(await run('{oops'))).toBe(MCP_ERROR.parse)
  })

  it('refuses a message that is not JSON-RPC 2.0', async () => {
    expect(codeOf(await run(JSON.stringify({ id: 1, method: 'tools/list' })))).toBe(
      MCP_ERROR.invalidRequest,
    )
  })

  describe('header validation', () => {
    it('treats a missing protocol version header as the classic era, not a refusal', async () => {
      const outcome = await run(request('tools/list'), {
        'mcp-protocol-version': undefined,
        'mcp-method': undefined,
      })
      expect(outcome.kind === 'json' && outcome.status).toBe(200)
      if (outcome.kind !== 'json') throw new Error('expected json')
      const body = outcome.body as { result: { tools: unknown[] } }
      expect(body.result.tools.length).toBe(MCP_TOOLS.length)
    })

    it('refuses a protocol version header that disagrees with the body', async () => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: meta({ [MCP_META.protocolVersion]: '2025-06-18' }) },
      })
      expect(codeOf(await run(body))).toBe(MCP_ERROR.headerMismatch)
    })

    it('refuses a protocol version it does not speak, and says what it speaks', async () => {
      const outcome = await run(request('tools/list'), { 'mcp-protocol-version': '2019-01-01' })
      expect(codeOf(outcome)).toBe(MCP_ERROR.unsupportedProtocolVersion)
      if (outcome.kind !== 'json') throw new Error('expected json')
      const parsed = outcome.body as { error: { data: { supported: string[] } } }
      expect(parsed.error.data.supported).toContain(MCP_PROTOCOL_VERSION)
      expect(parsed.error.data.supported).toContain(MCP_CLASSIC_LATEST)
    })

    it('refuses an Mcp-Method header that disagrees with the body', async () => {
      expect(codeOf(await run(request('tools/list'), { 'mcp-method': 'tools/call' }))).toBe(
        MCP_ERROR.headerMismatch,
      )
    })

    it('requires client capabilities on every request', async () => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { [MCP_META.protocolVersion]: MCP_PROTOCOL_VERSION } },
      })
      expect(codeOf(await run(body))).toBe(MCP_ERROR.invalidParams)
    })
  })

  describe('tools/call', () => {
    const callHeaders = { 'mcp-method': 'tools/call', 'mcp-name': 'porcelain_project' }
    const callBody = request('tools/call', {
      name: 'porcelain_project',
      arguments: { op: 'list' },
    })

    it('runs the named tool and returns its text', async () => {
      const tools = handlers('oriented')
      const outcome = await run(callBody, callHeaders, tools)
      expect(tools.call).toHaveBeenCalledWith('porcelain_project', { op: 'list' })
      if (outcome.kind !== 'json') throw new Error('expected json')
      const body = outcome.body as { result: { content: { text: string }[] } }
      expect(body.result.content[0]?.text).toBe('oriented')
    })

    it('reports a tool failure as a result, not a transport error', async () => {
      const tools: McpToolHandlers = {
        call: async () => ({ text: 'no such worktree', isError: true }),
      }
      const outcome = await run(callBody, callHeaders, tools)
      if (outcome.kind !== 'json') throw new Error('expected json')
      expect(outcome.status).toBe(200)
      expect((outcome.body as { result: { isError: boolean } }).result.isError).toBe(true)
    })

    it('requires the Mcp-Name header', async () => {
      expect(codeOf(await run(callBody, { 'mcp-method': 'tools/call' }))).toBe(
        MCP_ERROR.headerMismatch,
      )
    })

    it('decodes a base64 Mcp-Name before comparing it', async () => {
      const encoded = `=?base64?${Buffer.from('porcelain_project', 'utf8').toString('base64')}?=`
      const outcome = await run(callBody, { ...callHeaders, 'mcp-name': encoded })
      expect(outcome.kind === 'json' && outcome.status).toBe(200)
    })

    it('refuses an unknown tool', async () => {
      const body = request('tools/call', { name: 'porcelain_delete_everything' })
      const outcome = await run(body, {
        'mcp-method': 'tools/call',
        'mcp-name': 'porcelain_delete_everything',
      })
      expect(codeOf(outcome)).toBe(MCP_ERROR.invalidParams)
    })
  })

  it('answers the era probe so a client stays on the stateless revision', async () => {
    const outcome = await run(request('server/discover'), { 'mcp-method': 'server/discover' })
    if (outcome.kind !== 'json') throw new Error('expected json')
    expect(outcome.status).toBe(200)
    const body = outcome.body as {
      result: { supportedVersions: string[]; capabilities: Record<string, unknown> }
    }
    expect(body.result.supportedVersions).toEqual([MCP_PROTOCOL_VERSION])
    expect(body.result.capabilities).toHaveProperty('tools')
  })

  it('says how long a tool list may be cached and for whom', async () => {
    const outcome = await run(request('tools/list'))
    if (outcome.kind !== 'json') throw new Error('expected json')
    const body = outcome.body as { result: { ttlMs: number; cacheScope: string } }
    expect(body.result.ttlMs).toBe(0)
    expect(body.result.cacheScope).toBe('private')
  })

  describe('classic era', () => {
    /** A classic client sends none of the 2026 headers and no `_meta` envelope. */
    async function classic(
      method: string,
      params: Record<string, unknown> = {},
      version?: string,
      tools = handlers(),
    ) {
      return dispatchMcp({
        headers: version === undefined ? {} : { 'mcp-protocol-version': version },
        rawBody: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        handlers: tools,
        serverInfo,
      })
    }

    it('completes initialize without an MCP-Protocol-Version header', async () => {
      const outcome = await classic('initialize', { protocolVersion: '2025-06-18' })
      if (outcome.kind !== 'json') throw new Error('expected json')
      expect(outcome.status).toBe(200)
      const body = outcome.body as {
        result: { protocolVersion: string; capabilities: { tools: unknown }; serverInfo: unknown }
      }
      expect(body.result.protocolVersion).toBe('2025-06-18')
      expect(body.result.capabilities.tools).toBeTypeOf('object')
      expect(body.result.serverInfo).toEqual(serverInfo)
    })

    it('offers its newest classic revision when the client names one it does not know', async () => {
      const outcome = await classic('initialize', { protocolVersion: '1999-01-01' })
      if (outcome.kind !== 'json') throw new Error('expected json')
      const body = outcome.body as { result: { protocolVersion: string } }
      expect(body.result.protocolVersion).toBe(MCP_CLASSIC_LATEST)
    })

    it('accepts notifications/initialized without answering it', async () => {
      const outcome = await dispatchMcp({
        headers: { 'mcp-protocol-version': '2025-06-18' },
        rawBody: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        handlers: handlers(),
        serverInfo,
      })
      expect(outcome.kind).toBe('accepted')
    })

    it('lists tools in a plain envelope, with none of the 2026 markers', async () => {
      const outcome = await classic('tools/list', {}, '2025-06-18')
      if (outcome.kind !== 'json') throw new Error('expected json')
      const body = outcome.body as { result: Record<string, unknown> }
      expect((body.result.tools as unknown[]).length).toBe(MCP_TOOLS.length)
      expect(body.result.resultType).toBeUndefined()
      expect(body.result._meta).toBeUndefined()
    })

    it('runs a tool without the Mcp-Name header the 2026 era requires', async () => {
      const tools = handlers('oriented')
      const outcome = await classic(
        'tools/call',
        { name: 'porcelain_project', arguments: { op: 'list' } },
        '2025-06-18',
        tools,
      )
      expect(tools.call).toHaveBeenCalledWith('porcelain_project', { op: 'list' })
      if (outcome.kind !== 'json') throw new Error('expected json')
      const body = outcome.body as { result: { content: { text: string }[] } }
      expect(body.result.content[0]?.text).toBe('oriented')
    })

    it('refuses an unknown tool', async () => {
      const outcome = await classic('tools/call', { name: 'porcelain_nope' }, '2025-06-18')
      expect(codeOf(outcome)).toBe(MCP_ERROR.invalidParams)
    })
  })

  it('answers an unknown method with 404 so a client can tell it from a legacy endpoint', async () => {
    const outcome = await run(request('resources/read'), { 'mcp-method': 'resources/read' })
    expect(codeOf(outcome)).toBe(MCP_ERROR.methodNotFound)
    expect(outcome.kind === 'json' && outcome.status).toBe(404)
  })
})
