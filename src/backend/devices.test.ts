// @vitest-environment node
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  listDevices,
  loadDevices,
  matchDevice,
  registerDevice,
  resetDevicesForTest,
  revokeDevice,
  sanitizeLabel,
} from './devices'

let path: string

beforeEach(async () => {
  path = join(await mkdtemp(join(tmpdir(), 'porcelain-devices-')), 'devices.json')
  process.env.PORCELAIN_DEVICES = path
  resetDevicesForTest()
})

afterEach(() => {
  delete process.env.PORCELAIN_DEVICES
})

describe('device credentials', () => {
  it('authenticates the credential it minted, and nothing else', async () => {
    await loadDevices()
    const { device, credential } = await registerDevice('iPad')
    expect(matchDevice(credential)).toBe(device.id)
    expect(matchDevice(`${credential}x`)).toBeNull()
    expect(matchDevice('')).toBeNull()
  })

  it('keeps the credential off disk — a reader of the file cannot impersonate a device', async () => {
    await loadDevices()
    const { credential } = await registerDevice('iPad')
    const raw = await readFile(path, 'utf8')
    expect(raw).not.toContain(credential)
    expect(raw).toContain('credentialHash')
  })

  it('authenticates nobody until the store is loaded — the gate fails closed', async () => {
    await loadDevices()
    const { credential } = await registerDevice('iPad')
    resetDevicesForTest()
    expect(matchDevice(credential)).toBeNull()
    await loadDevices()
    expect(matchDevice(credential)).not.toBeNull()
  })

  it('revokes one device without touching the others — the whole point of phase 4', async () => {
    await loadDevices()
    const ipad = await registerDevice('iPad')
    const mac = await registerDevice('MacBook')
    expect(await revokeDevice(ipad.device.id)).toBe(true)
    expect(matchDevice(ipad.credential)).toBeNull()
    expect(matchDevice(mac.credential)).toBe(mac.device.id)
    expect(listDevices().map((d) => d.label)).toEqual(['MacBook'])
  })

  it('reports an unknown id rather than pretending it revoked something', async () => {
    await loadDevices()
    expect(await revokeDevice('nope')).toBe(false)
  })

  it('survives a restart — a paired device does not have to re-pair', async () => {
    await loadDevices()
    const { device, credential } = await registerDevice('iPad')
    resetDevicesForTest()
    await loadDevices()
    expect(matchDevice(credential)).toBe(device.id)
  })

  it('de-authenticates everyone on a corrupt file, and keeps it for forensics', async () => {
    await loadDevices()
    const { credential } = await registerDevice('iPad')
    await writeFile(path, '{ not json', 'utf8')
    resetDevicesForTest()
    await loadDevices()
    expect(matchDevice(credential)).toBeNull()
    expect(listDevices()).toEqual([])
  })

  it('never leaves a torn file when writes overlap — a corrupt roster de-auths everyone', async () => {
    await loadDevices()
    // Long labels then short ones: an unserialized writer sharing one tmp path can land a
    // short write over a long one and leave malformed JSON at the final path.
    await Promise.all([
      registerDevice('x'.repeat(60)),
      registerDevice('y'.repeat(60)),
      registerDevice('z'),
      revokeDevice('nobody'),
    ])
    const raw = await readFile(path, 'utf8')
    expect(() => JSON.parse(raw)).not.toThrow()
    expect(JSON.parse(raw)).toHaveLength(3)
  })

  it('stamps last seen when a credential is used', async () => {
    await loadDevices()
    const { device, credential } = await registerDevice('iPad')
    const before = listDevices().find((d) => d.id === device.id)?.lastSeenAt ?? 0
    await new Promise((resolve) => setTimeout(resolve, 2))
    matchDevice(credential)
    const after = listDevices().find((d) => d.id === device.id)?.lastSeenAt ?? 0
    expect(after).toBeGreaterThan(before)
  })
})

describe('sanitizeLabel', () => {
  it('caps a label so a peer cannot flood the roster', () => {
    expect(sanitizeLabel('x'.repeat(200))).toHaveLength(64)
  })

  it('strips control characters, which would otherwise land in the UI', () => {
    expect(sanitizeLabel('iPad\u001b[31m')).toBe('iPad[31m')
  })

  it('falls back rather than rendering a blank row', () => {
    expect(sanitizeLabel('   ')).toBe('Paired device')
  })
})
