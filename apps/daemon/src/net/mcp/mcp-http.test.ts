// @vitest-environment node
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handleMcpRequest, MCP_MAX_BODY_BYTES } from './mcp-http'
import { MCP_PROTOCOL_VERSION } from './mcp-protocol'

let server: Server
let base: string

const headers: Record<string, string> = {
  'content-type': 'application/json',
  'mcp-protocol-version': MCP_PROTOCOL_VERSION,
  'mcp-method': 'tools/list',
}

function listRequest(padding = ''): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {
      _meta: {
        'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {},
      },
      ...(padding === '' ? {} : { padding }),
    },
  })
}

beforeAll(async () => {
  server = createServer((req, res) => {
    handleMcpRequest(req, res, {
      // A stub, not the real handler set: this file proves the HTTP envelope, and
      // the tools have their own tests against real operations.
      handlers: { call: async (name) => ({ text: `stub:${name}`, isError: true }) },
      serverInfo: { name: 'porcelain', version: '0.0.0-test' },
    }).catch(() => {
      res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

describe('handleMcpRequest', () => {
  it('answers a request with application/json', async () => {
    const response = await fetch(`${base}/mcp`, { method: 'POST', headers, body: listRequest() })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    const body = (await response.json()) as { result: { tools: unknown[] } }
    expect(body.result.tools).toHaveLength(8)
  })

  it('answers a notification with 202 and an empty body', async () => {
    const notification = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    })
    const response = await fetch(`${base}/mcp`, { method: 'POST', headers, body: notification })
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')
  })

  it.each(['GET', 'DELETE'])('refuses %s — the session-era verbs are gone', async (method) => {
    const response = await fetch(`${base}/mcp`, { method, headers })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('refuses a body over the cap instead of buffering it', async () => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers,
      body: listRequest('x'.repeat(MCP_MAX_BODY_BYTES + 1)),
    })
    expect(response.status).toBe(413)
    const body = (await response.json()) as { error: { message: string } }
    expect(body.error.message).toMatch(/too large/i)
  })

  it('reports a tool failure as a result, not a transport error', async () => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { ...headers, 'mcp-method': 'tools/call', 'mcp-name': 'porcelain_context' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'porcelain_context',
          arguments: { workspace: '/repo' },
          _meta: {
            'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { result: { isError: boolean } }
    expect(body.result.isError).toBe(true)
  })
})
