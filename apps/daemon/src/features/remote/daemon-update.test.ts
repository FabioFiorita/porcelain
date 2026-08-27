import type { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { daemonRestartable, fetchPublishedVersion, restartPorcelainService } from './daemon-update'

describe('daemonRestartable', () => {
  it('is true only for a non-dev systemd invocation', () => {
    expect(daemonRestartable({ INVOCATION_ID: 'abc' })).toBe(true)
    expect(daemonRestartable({ INVOCATION_ID: 'abc', PORCELAIN_DEV: '1' })).toBe(false)
    expect(daemonRestartable({})).toBe(false)
    expect(daemonRestartable({ INVOCATION_ID: '' })).toBe(false)
  })
})

describe('fetchPublishedVersion', () => {
  it('reads version from the npm latest document', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ version: '0.60.0' }), { status: 200 })
    })
    await expect(fetchPublishedVersion(fetchImpl)).resolves.toBe('0.60.0')
  })

  it('returns null when the registry is unreachable or malformed', async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new Error('network')
    })
    await expect(fetchPublishedVersion(failing)).resolves.toBeNull()
    const bad = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }))
    await expect(fetchPublishedVersion(bad)).resolves.toBeNull()
  })
})

describe('restartPorcelainService', () => {
  function childProcess() {
    return Object.assign(new EventEmitter(), { unref: vi.fn() })
  }

  it('resolves only after systemctl launches', async () => {
    const child = childProcess()
    const spawnImpl = vi.fn(() => child) as unknown as typeof spawn
    const restarting = restartPorcelainService(spawnImpl)

    child.emit('spawn')

    await expect(restarting).resolves.toBeUndefined()
    expect(child.unref).toHaveBeenCalledOnce()
  })

  it('rejects when systemctl cannot launch', async () => {
    const child = childProcess()
    const spawnImpl = vi.fn(() => child) as unknown as typeof spawn
    const restarting = restartPorcelainService(spawnImpl)

    child.emit('error', new Error('systemctl not found'))

    await expect(restarting).rejects.toThrow('systemctl not found')
  })
})
