import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/**
 * Launch contract only: the child script path and empty argv. Importing `./daemon`
 * must not load real Electron or spawn a utilityProcess.
 */
vi.mock('electron', () => ({
  app: {
    getPath: (): string => '/synthetic/userData',
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: (): [] => [],
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}))

import { DAEMON_CHILD_ARGV, daemonChildScript } from './daemon'

describe('daemon child launch contract', () => {
  it('resolves the packaged daemon script under mainDir', () => {
    expect(daemonChildScript('/synthetic/main')).toBe('/synthetic/main/daemon/server.js')
  })

  it('freezes an empty argv so no renderer-supplied command or port can sneak in', () => {
    expect(DAEMON_CHILD_ARGV).toHaveLength(0)
    expect(Object.isFrozen(DAEMON_CHILD_ARGV)).toBe(true)
  })

  it('launch forks the helper with the frozen argv and never child_process', () => {
    const source = readFileSync(resolve(__dirname, 'daemon.ts'), 'utf8')
    expect(source).toContain('utilityProcess.fork(daemonChildScript(__dirname), DAEMON_CHILD_ARGV')
    expect(source).not.toContain("from 'node:child_process'")
    expect(source).not.toContain("from 'child_process'")
  })
})
