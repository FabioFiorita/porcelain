import { type ChildProcess, spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'
import { z } from 'zod'

const markerSchema = z.object({ target: z.string(), url: z.string() })
const QUICK_TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const START_TIMEOUT_MS = 20_000

let daemonPort: number | null = null
let child: ChildProcess | null = null
let publishedUrl: string | null = null

export type CloudflareState = {
  enabled: boolean
  url: string | null
  managed: boolean
  error: 'unavailable' | 'conflict' | null
}

const markerPath = (): string =>
  process.env.PORCELAIN_CLOUDFLARE_FILE ?? porcelainHomePath('cloudflare.json')

export function setCloudflareDaemonPort(port: number): void {
  daemonPort = port
}

function target(): string | null {
  return daemonPort === null ? null : `http://127.0.0.1:${daemonPort}`
}

export function parseCloudflareTunnelUrl(output: string): string | null {
  const match = QUICK_TUNNEL_URL.exec(output)
  return match?.[0] ?? null
}

export function isCloudflareMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

async function readMarker(): Promise<{ target: string; url: string } | null> {
  try {
    return markerSchema.parse(JSON.parse(await readFile(markerPath(), 'utf8')))
  } catch {
    return null
  }
}

function processAlive(): boolean {
  return child !== null && child.exitCode === null && child.signalCode === null
}

export async function cloudflareStatus(): Promise<CloudflareState> {
  if (processAlive()) {
    return { enabled: true, url: publishedUrl, managed: true, error: null }
  }
  const expected = target()
  const marker = await readMarker()
  if (expected !== null && marker?.target === expected) {
    return { enabled: false, url: null, managed: true, error: 'unavailable' }
  }
  return { enabled: false, url: null, managed: false, error: null }
}

function waitForTunnelUrl(process: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('cloudflared did not publish a tunnel URL'))
    }, START_TIMEOUT_MS)
    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString()
      const url = parseCloudflareTunnelUrl(buffer)
      if (url !== null) {
        cleanup()
        resolve(url)
      }
    }
    const onExit = (code: number | null): void => {
      cleanup()
      reject(new Error(code === null ? 'cloudflared exited' : `cloudflared exited with ${code}`))
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const cleanup = (): void => {
      clearTimeout(timer)
      process.stdout?.off('data', onData)
      process.stderr?.off('data', onData)
      process.off('exit', onExit)
      process.off('error', onError)
    }
    process.stdout?.on('data', onData)
    process.stderr?.on('data', onData)
    process.once('exit', onExit)
    process.once('error', onError)
  })
}

export async function startCloudflare(): Promise<CloudflareState> {
  const expected = target()
  if (expected === null) throw new Error('The daemon is not listening yet')
  if (processAlive()) return cloudflareStatus()

  let started: ChildProcess
  try {
    started = spawn('cloudflared', ['tunnel', '--url', expected, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (isCloudflareMissing(error)) {
      throw new Error('cloudflared is not installed or not on PATH')
    }
    throw error
  }

  started.once('error', (error) => {
    if (child === started) {
      child = null
      publishedUrl = null
    }
    if (isCloudflareMissing(error)) return
  })

  let url: string
  try {
    url = await waitForTunnelUrl(started)
  } catch (error) {
    started.kill('SIGTERM')
    if (isCloudflareMissing(error)) {
      throw new Error('cloudflared is not installed or not on PATH')
    }
    throw error
  }

  child = started
  publishedUrl = url
  await mkdir(dirname(markerPath()), { recursive: true })
  await writeFile(markerPath(), JSON.stringify({ target: expected, url }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
  started.once('exit', () => {
    if (child === started) {
      child = null
      publishedUrl = null
    }
  })
  return cloudflareStatus()
}

export async function stopCloudflare(): Promise<CloudflareState> {
  if (child !== null) {
    const stopping = child
    child = null
    publishedUrl = null
    stopping.kill('SIGTERM')
  }
  await rm(markerPath(), { force: true })
  return cloudflareStatus()
}
