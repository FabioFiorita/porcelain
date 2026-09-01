#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { request } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

function mcpChannel() {
  // Runtime-only escape hatch for connector diagnostics; it does not affect a Turbo build task.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: runtime-only connector configuration
  const override = process.env.PORCELAIN_MCP_SOCKET
  if (override) return override
  const home = process.env.PORCELAIN_HOME || join(homedir(), '.porcelain')
  if (process.platform === 'win32') {
    const profile = createHash('sha256').update(resolve(home)).digest('hex').slice(0, 20)
    return `\\\\.\\pipe\\porcelain-mcp-${profile}`
  }
  return join(home, 'mcp.sock')
}

function forward(line) {
  return new Promise((resolveForward, reject) => {
    const body = Buffer.from(line)
    const req = request(
      {
        socketPath: mcpChannel(),
        path: '/mcp',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(body.byteLength),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const response = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode === undefined || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`local daemon returned HTTP ${res.statusCode ?? 'unknown'}`))
            return
          }
          if (response !== '') process.stdout.write(`${response}\n`)
          resolveForward()
        })
      },
    )
    req.once('error', reject)
    req.end(body)
  })
}

let buffer = ''
let queue = Promise.resolve()
let failed = false

function fail(error) {
  if (failed) return
  failed = true
  const detail = error instanceof Error ? error.message : String(error)
  process.stdin.destroy()
  process.stderr.write(
    `Porcelain MCP could not reach the local daemon for this profile (${detail}). Start Porcelain on this machine and try again.\n`,
    () => process.exit(1),
  )
}

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  while (true) {
    const newline = buffer.indexOf('\n')
    if (newline === -1) break
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line === '') continue
    queue = queue.then(() => forward(line))
    queue.catch(fail)
  }
})

process.stdin.on('end', () => {
  const finalLine = buffer.trim()
  if (finalLine !== '') queue = queue.then(() => forward(finalLine))
  queue.catch(fail).finally(() => {
    if (process.exitCode === undefined) process.exitCode = 0
  })
})
