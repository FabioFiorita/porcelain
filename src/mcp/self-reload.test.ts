import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchServerBinaryForUpgrade } from './self-reload'

describe('watchServerBinaryForUpgrade', () => {
  const dir = join(tmpdir(), 'porcelain-mcp-self-reload-test')
  const file = join(dir, 'server.js')

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, '// v1\n')
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns null for an empty path', () => {
    expect(watchServerBinaryForUpgrade('')).toBeNull()
  })

  it('exits when the watched binary mtime changes', async () => {
    const exit = vi.fn()
    const log = vi.fn()
    const stop = watchServerBinaryForUpgrade(file, exit, log, { pollMs: 30 })
    expect(stop).not.toBeNull()

    // Let the first poll observe the baseline, then replace the file.
    await new Promise((r) => setTimeout(r, 50))
    writeFileSync(file, '// v2 — new tools\n')

    await vi.waitFor(
      () => {
        expect(exit).toHaveBeenCalledWith(0)
      },
      { timeout: 2000 },
    )
    expect(log).toHaveBeenCalledWith(expect.stringContaining('server binary updated'))
    stop?.()
  })
})
