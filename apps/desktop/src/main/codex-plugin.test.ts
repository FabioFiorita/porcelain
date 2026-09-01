import { describe, expect, it, vi } from 'vitest'
import { type CommandRunner, installCodexPlugin, readCodexPluginStatus } from './codex-plugin'

const noMarketplaces = { stdout: JSON.stringify({ marketplaces: [] }), stderr: '' }
const porcelainMarketplace = {
  stdout: JSON.stringify({ marketplaces: [{ name: 'fabiofiorita' }] }),
  stderr: '',
}

describe('installCodexPlugin', () => {
  it('adds the public marketplace before installing Porcelain', async () => {
    const runner = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce({ stdout: 'codex-cli 1.0.0', stderr: '' })
      .mockResolvedValueOnce(noMarketplaces)
      .mockResolvedValue({ stdout: '', stderr: '' })

    await expect(installCodexPlugin(runner, { SHELL: '/bin/zsh' })).resolves.toEqual({
      pluginId: 'porcelain@fabiofiorita',
    })

    expect(runner.mock.calls.map(([executable, args]) => [executable, args])).toEqual([
      ['codex', ['--version']],
      ['codex', ['plugin', 'marketplace', 'list', '--json']],
      ['codex', ['plugin', 'marketplace', 'add', 'FabioFiorita/porcelain', '--json']],
      ['codex', ['plugin', 'marketplace', 'upgrade', 'fabiofiorita', '--json']],
      ['codex', ['plugin', 'add', 'porcelain@fabiofiorita', '--json']],
    ])
  })

  it('finds Codex through the login shell when the desktop PATH cannot', async () => {
    const missing = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' })
    const runner = vi
      .fn<CommandRunner>()
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/codex\n', stderr: '' })
      .mockResolvedValueOnce(porcelainMarketplace)
      .mockResolvedValue({ stdout: '', stderr: '' })

    await installCodexPlugin(runner, { SHELL: '/bin/zsh' })

    expect(runner.mock.calls[1]?.slice(0, 2)).toEqual(['/bin/zsh', ['-lc', 'command -v codex']])
    expect(runner.mock.calls[2]?.slice(0, 2)).toEqual([
      '/opt/homebrew/bin/codex',
      ['plugin', 'marketplace', 'list', '--json'],
    ])
    expect(runner.mock.calls[3]?.[0]).toBe('/opt/homebrew/bin/codex')
    expect(runner.mock.calls[4]?.[0]).toBe('/opt/homebrew/bin/codex')
  })

  it('does not attempt installation after the marketplace command fails', async () => {
    const failure = Object.assign(new Error('command failed'), { stderr: 'GitHub is unavailable' })
    const runner = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce({ stdout: 'codex-cli 1.0.0', stderr: '' })
      .mockResolvedValueOnce(noMarketplaces)
      .mockRejectedValueOnce(failure)

    await expect(installCodexPlugin(runner, { SHELL: '/bin/zsh' })).rejects.toThrow(
      'GitHub is unavailable',
    )
    expect(runner).toHaveBeenCalledTimes(3)
  })

  it('upgrades an existing marketplace without trying to add it again', async () => {
    const runner = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce({ stdout: 'codex-cli 1.0.0', stderr: '' })
      .mockResolvedValueOnce(porcelainMarketplace)
      .mockResolvedValue({ stdout: '', stderr: '' })

    await installCodexPlugin(runner, { SHELL: '/bin/zsh' })

    expect(runner.mock.calls.map(([, args]) => args)).not.toContainEqual([
      'plugin',
      'marketplace',
      'add',
      'FabioFiorita/porcelain',
      '--json',
    ])
  })

  it('reports the installed plugin version and enabled state', async () => {
    const runner = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce({ stdout: 'codex-cli 1.0.0', stderr: '' })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          installed: [
            {
              pluginId: 'porcelain@fabiofiorita',
              version: '1.6.21',
              installed: true,
              enabled: false,
            },
          ],
        }),
        stderr: '',
      })

    await expect(readCodexPluginStatus(runner, { SHELL: '/bin/zsh' })).resolves.toEqual({
      state: 'installed',
      version: '1.6.21',
      enabled: false,
      error: null,
    })
  })

  it('turns missing Codex into an honest unavailable status', async () => {
    const missing = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' })
    const runner = vi.fn<CommandRunner>().mockRejectedValueOnce(missing)

    await expect(readCodexPluginStatus(runner, {})).resolves.toMatchObject({
      state: 'unavailable',
      version: null,
      enabled: null,
      error: 'Codex CLI was not found. Install Codex and try again.',
    })
  })
})
