// @vitest-environment node
import { once } from 'node:events'
import { constants } from 'node:fs'
import { access, chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { handleMcpRequest } from './mcp-http'
import { startLocalMcpServer, type LocalMcpServer } from './mcp-local-server'

const connector = fileURLToPath(
  new URL('../../../../../plugins/porcelain/bin/porcelain-mcp.mjs', import.meta.url),
)
const homes: string[] = []
const servers: LocalMcpServer[] = []

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-mcp-'))
  homes.push(home)
  return home
}

async function startServer(endpoint: string, marker: string): Promise<LocalMcpServer> {
  const server = await startLocalMcpServer({
    endpoint,
    serveMcp: (req, res) =>
      handleMcpRequest(req, res, {
        handlers: { call: async () => ({ text: marker }) },
        serverInfo: { name: marker, version: 'test' },
      }),
  })
  servers.push(server)
  return server
}

function startConnector(home: string): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [connector], {
    env: { ...process.env, PORCELAIN_HOME: home, PORCELAIN_MCP_SOCKET: undefined },
    stdio: 'pipe',
  })
}

function readLine(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolveLine, reject) => {
    let buffer = ''
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('utf8')
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      stream.removeListener('data', onData)
      resolveLine(buffer.slice(0, newline))
    }
    stream.on('data', onData)
    stream.once('error', reject)
  })
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close().catch(() => undefined)))
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe('profile-local MCP channel', () => {
  it('carries stdio MCP to the matching daemon without a TCP port', async () => {
    const home = await temporaryHome()
    await startServer(join(home, 'mcp.sock'), 'profile-a')
    const child = startConnector(home)
    const exit = once(child, 'exit')

    child.stdin.end(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {} },
      })}\n`,
    )

    const response = JSON.parse(await readLine(child.stdout)) as {
      result: { serverInfo: { name: string } }
    }
    expect(response.result.serverInfo.name).toBe('profile-a')
    expect(await exit).toEqual([0, null])
  })

  it('isolates two profiles owned by the same OS user', async () => {
    const firstHome = await temporaryHome()
    const secondHome = await temporaryHome()
    await startServer(join(firstHome, 'mcp.sock'), 'first')
    await startServer(join(secondHome, 'mcp.sock'), 'second')

    const request = `${JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {} },
    })}\n`
    const first = startConnector(firstHome)
    const second = startConnector(secondHome)
    const firstExit = once(first, 'exit')
    const secondExit = once(second, 'exit')
    first.stdin.end(request)
    second.stdin.end(request)

    const [firstResponse, secondResponse] = await Promise.all([
      readLine(first.stdout),
      readLine(second.stdout),
    ])
    expect(JSON.parse(firstResponse).result.serverInfo.name).toBe('first')
    expect(JSON.parse(secondResponse).result.serverInfo.name).toBe('second')
    await Promise.all([firstExit, secondExit])
  })

  it('refuses to replace an active channel or a non-socket file', async () => {
    const home = await temporaryHome()
    const endpoint = join(home, 'mcp.sock')
    await startServer(endpoint, 'owner')
    await expect(startServer(endpoint, 'intruder')).rejects.toThrow(/already owns/)

    const otherHome = await temporaryHome()
    const fileEndpoint = join(otherHome, 'mcp.sock')
    await writeFile(fileEndpoint, 'keep me')
    await expect(startServer(fileEndpoint, 'intruder')).rejects.toThrow(/non-socket/)
    expect(await readFile(fileEndpoint, 'utf8')).toBe('keep me')
  })

  it.runIf(process.platform !== 'win32')('restricts the Unix socket to its owner', async () => {
    const home = await temporaryHome()
    const endpoint = join(home, 'mcp.sock')
    await startServer(endpoint, 'private')
    expect((await stat(endpoint)).mode & 0o777).toBe(0o600)

    await chmod(endpoint, 0o600)
    await access(endpoint, constants.R_OK | constants.W_OK)
  })

  it('fails clearly when this profile has no running daemon', async () => {
    const home = await temporaryHome()
    const child = startConnector(home)
    const exit = once(child, 'exit')
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' })}\n`)

    expect(await exit).toEqual([1, null])
    expect(stderr).toMatch(/could not reach the local daemon/i)
    expect(stderr).toMatch(/start Porcelain on this machine/i)
  })

  it('fails instead of hanging when the local daemon rejects the request', async () => {
    const home = await temporaryHome()
    const server = await startLocalMcpServer({
      endpoint: join(home, 'mcp.sock'),
      serveMcp: async (_req, res) => {
        res.writeHead(500)
        res.end()
      },
    })
    servers.push(server)
    const child = startConnector(home)
    const exit = once(child, 'exit')
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'ping' })}\n`)

    expect(await exit).toEqual([1, null])
    expect(stderr).toMatch(/HTTP 500/)
  })
})
