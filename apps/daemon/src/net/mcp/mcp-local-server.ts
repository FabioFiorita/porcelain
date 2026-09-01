import { rmSync } from 'node:fs'
import { chmod, lstat, mkdir, rm } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createConnection } from 'node:net'
import { dirname } from 'node:path'

export interface LocalMcpServer {
  server: Server
  endpoint: string
  close: () => Promise<void>
  cleanupSync: () => void
}

function isNamedPipe(endpoint: string): boolean {
  return endpoint.startsWith('\\\\.\\pipe\\')
}

function socketIsListening(endpoint: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const socket = createConnection(endpoint)
    let settled = false
    const finish = (value: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(value)
    }
    const timer = setTimeout(() => finish(true), 500)
    socket.once('connect', () => finish(true))
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
        finish(false)
        return
      }
      clearTimeout(timer)
      reject(error)
    })
  })
}

async function prepareEndpoint(endpoint: string): Promise<void> {
  if (isNamedPipe(endpoint)) {
    if (await socketIsListening(endpoint)) {
      throw new Error(`another Porcelain daemon already owns the MCP channel ${endpoint}`)
    }
    return
  }

  await mkdir(dirname(endpoint), { recursive: true, mode: 0o700 })
  try {
    const existing = await lstat(endpoint)
    if (!existing.isSocket()) {
      throw new Error(`refusing to replace non-socket MCP channel path ${endpoint}`)
    }
    if (await socketIsListening(endpoint)) {
      throw new Error(`another Porcelain daemon already owns the MCP channel ${endpoint}`)
    }
    await rm(endpoint)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    throw error
  }
}

/** Expose the daemon's existing stateless MCP handler on a profile-scoped OS-local channel. */
export async function startLocalMcpServer(input: {
  endpoint: string
  serveMcp: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}): Promise<LocalMcpServer> {
  await prepareEndpoint(input.endpoint)

  const server = createServer((req, res) => {
    if (req.url !== '/mcp') {
      res.writeHead(404)
      res.end()
      return
    }
    input.serveMcp(req, res).catch((error) => {
      console.error('[daemon] local MCP request failed:', error)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error)
    server.once('error', onError)
    server.listen(input.endpoint, () => {
      server.off('error', onError)
      resolve()
    })
  })

  if (!isNamedPipe(input.endpoint)) await chmod(input.endpoint, 0o600)

  let ownsEndpoint = true
  const removeEndpoint = async (): Promise<void> => {
    if (!ownsEndpoint || isNamedPipe(input.endpoint)) return
    ownsEndpoint = false
    await rm(input.endpoint, { force: true })
  }
  const cleanupSync = (): void => {
    if (!ownsEndpoint) return
    ownsEndpoint = false
    if (!isNamedPipe(input.endpoint)) rmSync(input.endpoint, { force: true })
    try {
      server.close()
    } catch {
      // Startup recovers a stale Unix socket after proving nobody accepts it.
    }
  }

  return {
    server,
    endpoint: input.endpoint,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      )
      await removeEndpoint()
    },
    cleanupSync,
  }
}
