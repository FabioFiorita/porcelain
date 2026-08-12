import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { porcelainHomePath } from '@shared/porcelain-home'
import { z } from 'zod'

const execFileAsync = promisify(execFile)
const markerSchema = z.object({ target: z.string(), url: z.string() })

let daemonPort: number | null = null

export type FunnelState = {
  enabled: boolean
  url: string | null
  managed: boolean
  error: 'unavailable' | 'conflict' | null
}

const markerPath = (): string =>
  process.env.PORCELAIN_FUNNEL_FILE ?? porcelainHomePath('funnel.json')

export function setFunnelDaemonPort(port: number): void {
  daemonPort = port
}

function target(): string | null {
  return daemonPort === null ? null : `http://127.0.0.1:${daemonPort}`
}

async function tailscale(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('tailscale', args, {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 1_048_576,
  })
  return stdout
}

function containsString(value: unknown, expected: string): boolean {
  if (typeof value === 'string') return value === expected
  if (Array.isArray(value)) return value.some((item) => containsString(item, expected))
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) => containsString(item, expected))
  }
  return false
}

export function funnelConfigurationContains(raw: unknown, expectedTarget: string): boolean {
  return containsString(raw, expectedTarget)
}

export function funnelPublicUrl(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || !('Self' in raw)) return null
  const self = raw.Self
  if (typeof self !== 'object' || self === null || !('DNSName' in self)) return null
  const dnsName = self.DNSName
  if (typeof dnsName !== 'string' || dnsName === '') return null
  return `https://${dnsName.replace(/\.$/, '')}`
}

function hasFunnelConfiguration(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && Object.keys(raw).length > 0
}

async function readMarker(): Promise<{ target: string; url: string } | null> {
  try {
    return markerSchema.parse(JSON.parse(await readFile(markerPath(), 'utf8')))
  } catch {
    return null
  }
}

async function publicUrl(): Promise<string | null> {
  try {
    const raw: unknown = JSON.parse(await tailscale(['status', '--json']))
    return funnelPublicUrl(raw)
  } catch {
    return null
  }
}

async function rawFunnelStatus(): Promise<unknown> {
  return JSON.parse(await tailscale(['funnel', 'status', '--json']))
}

export async function funnelStatus(): Promise<FunnelState> {
  const expected = target()
  if (expected === null) {
    return { enabled: false, url: null, managed: false, error: 'unavailable' }
  }
  try {
    const raw = await rawFunnelStatus()
    const enabled = funnelConfigurationContains(raw, expected)
    const marker = await readMarker()
    const managed = marker?.target === expected
    return {
      enabled,
      url: enabled ? await publicUrl() : null,
      managed,
      error: enabled || !hasFunnelConfiguration(raw) ? null : 'conflict',
    }
  } catch {
    return { enabled: false, url: null, managed: false, error: 'unavailable' }
  }
}

export async function startFunnel(): Promise<FunnelState> {
  const expected = target()
  if (expected === null) throw new Error('The daemon is not listening yet')
  const before = await funnelStatus()
  if (before.error === 'conflict' || (before.enabled && !before.managed)) {
    throw new Error('Tailscale Funnel already serves another local target')
  }
  if (!before.enabled) {
    await tailscale(['funnel', '--bg', '--yes', expected])
  }
  const url = await publicUrl()
  if (url === null) throw new Error('Tailscale did not report a public DNS name')
  await mkdir(dirname(markerPath()), { recursive: true })
  await writeFile(markerPath(), JSON.stringify({ target: expected, url }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
  return funnelStatus()
}

export async function stopFunnel(): Promise<FunnelState> {
  const expected = target()
  const marker = await readMarker()
  const before = await funnelStatus()
  if (before.error === 'unavailable') {
    throw new Error('Tailscale Funnel is unavailable on this machine')
  }
  if (!before.enabled && before.error === null) {
    if (expected !== null && marker?.target === expected) {
      await rm(markerPath(), { force: true })
    }
    return funnelStatus()
  }
  if (expected === null || marker?.target !== expected || !before.managed) {
    throw new Error('Porcelain does not own the active Funnel configuration')
  }
  await tailscale(['funnel', '--https=443', 'off'])
  await rm(markerPath(), { force: true })
  return funnelStatus()
}
