import { describe, expect, it, vi } from 'vitest'
import {
  decodeWslOutput,
  discoverWslDistributions,
  parseWslDistributionList,
  type WslRunner,
} from './wsl-discovery'

const LIST = `  NAME              STATE           VERSION\r\n* Ubuntu            Running         2\r\n  Debian Dev        Stopped         2\r\n  docker-desktop    Running         2\r\n  Legacy            Stopped         1\r\n`

describe('WSL discovery', () => {
  it('decodes UTF-16LE output and excludes Docker Desktop internals', () => {
    expect(decodeWslOutput(Buffer.from(LIST, 'utf16le'))).toContain('Ubuntu')
    expect(parseWslDistributionList(Buffer.from(LIST, 'utf16le'))).toEqual([
      { name: 'Ubuntu', version: 2, isDefault: true },
      { name: 'Debian Dev', version: 2, isDefault: false },
      { name: 'Legacy', version: 1, isDefault: false },
    ])
  })

  it('reports runtime readiness per distribution', async () => {
    const run = vi.fn<WslRunner>(async (args) => {
      if (args[0] === '--list') return Buffer.from(LIST, 'utf16le')
      if (args[1] === 'Ubuntu') return 'node=v22.18.0\ngit=git version 2.50.0\nnpx=yes\n'
      if (args[1] === 'Debian Dev') return 'node=\ngit=git version 2.39.0\nnpx=no\n'
      return 'node=v20.0.0\ngit=\nnpx=yes\n'
    })

    await expect(discoverWslDistributions({ platform: 'win32', run })).resolves.toEqual([
      expect.objectContaining({ name: 'Ubuntu', ready: true, issues: [] }),
      expect.objectContaining({
        name: 'Debian Dev',
        ready: false,
        issues: ['node-missing', 'npx-missing'],
      }),
      expect.objectContaining({
        name: 'Legacy',
        ready: false,
        issues: ['unsupported-version', 'node-too-old', 'git-missing'],
      }),
    ])
  })

  it('is inert outside Windows and contains probe failures', async () => {
    const run = vi.fn<WslRunner>(async () => {
      throw new Error('not installed')
    })
    await expect(discoverWslDistributions({ platform: 'linux', run })).resolves.toEqual([])
    expect(run).not.toHaveBeenCalled()
    await expect(discoverWslDistributions({ platform: 'win32', run })).resolves.toEqual([])
  })

  it('runs a fixed probe that rejects Windows-interoperability tool shims', async () => {
    const run = vi.fn<WslRunner>(async (args) => {
      if (args[0] === '--list') return Buffer.from(LIST, 'utf16le')
      return 'node=\ngit=git version 2.53.0\nnpx=no\n'
    })

    await discoverWslDistributions({ platform: 'win32', run })

    const probeScript = String(run.mock.calls[1]?.[0][5])
    expect(probeScript).toContain('case "$node_path" in /mnt/*)')
    expect(probeScript).toContain('case "$npx_path" in \'\'|/mnt/*)')
  })
})
