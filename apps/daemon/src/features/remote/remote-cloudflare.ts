import { type ChildProcess, spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'
import { z } from 'zod'

const markerSchema = z.object({ target: z.string(), url: z.string() })
const QUICK_TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
const NAMED_READY = /registered tunnel connection/i
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

export type CloudflareLaunch =
  | { mode: 'named'; args: readonly string[]; hostname: string }
  | { mode: 'quick'; args: readonly string[] }

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

export function namedTunnelReady(output: string): boolean {
  return NAMED_READY.test(output)
}

export function isCloudflareMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/** Accept `review.example.com` or `https://review.example.com`. Reject paths. */
export function normalizeCloudflareHostname(input: string): string {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error('PORCELAIN_CLOUDFLARE_HOSTNAME must be a hostname or https:// URL')
  }
  if (url.protocol !== 'https:') {
    throw new Error('PORCELAIN_CLOUDFLARE_HOSTNAME must be https')
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new Error('PORCELAIN_CLOUDFLARE_HOSTNAME must be a bare https origin')
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('PORCELAIN_CLOUDFLARE_HOSTNAME must not include a path')
  }
  return `https://${url.host}`
}

export function readCloudflareCredentials(env: NodeJS.ProcessEnv = process.env): {
  token: string | null
  hostname: string | null
} {
  const token = env.PORCELAIN_CLOUDFLARE_TOKEN?.trim() ?? ''
  const rawHost = env.PORCELAIN_CLOUDFLARE_HOSTNAME?.trim() ?? ''
  return {
    token: token === '' ? null : token,
    hostname: rawHost === '' ? null : normalizeCloudflareHostname(rawHost),
  }
}

export function planCloudflareLaunch(input: {
  target: string
  token: string | null
  hostname: string | null
}): CloudflareLaunch {
  if (input.token !== null) {
    if (input.hostname === null) {
      throw new Error(
        'Named Cloudflare tunnels need PORCELAIN_CLOUDFLARE_HOSTNAME (the public https hostname)',
      )
    }
    return {
      mode: 'named',
      args: ['tunnel', '--no-autoupdate', 'run'],
      hostname: input.hostname,
    }
  }
  return {
    mode: 'quick',
    args: ['tunnel', '--url', input.target, '--no-autoupdate'],
  }
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
    return { enabled: false, url: marker.url, managed: true, error: 'unavailable' }
  }
  return { enabled: false, url: null, managed: false, error: null }
}

function waitForReady(process: ChildProcess, launch: CloudflareLaunch): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('cloudflared did not become ready'))
    }, START_TIMEOUT_MS)
    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString()
      if (launch.mode === 'named') {
        if (namedTunnelReady(buffer)) {
          cleanup()
          resolve(launch.hostname)
        }
        return
      }
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

  const credentials = readCloudflareCredentials()
  const launch = planCloudflareLaunch({
    target: expected,
    token: credentials.token,
    hostname: credentials.hostname,
  })

  const childEnv =
    launch.mode === 'named' && credentials.token !== null
      ? { ...process.env, TUNNEL_TOKEN: credentials.token }
      : process.env

  let started: ChildProcess
  try {
    started = spawn('cloudflared', [...launch.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv,
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
    url = await waitForReady(started, launch)
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
