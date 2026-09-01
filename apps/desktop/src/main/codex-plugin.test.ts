import { describe, expect, it, vi } from 'vitest'
import { type CommandRunner, installCodexPlugin } from './codex-plugin'

describe('installCodexPlugin', () => {
  it('adds the public marketplace before installing Porcelain', async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({ stdout: '', stderr: '' })

    await expect(installCodexPlugin(runner, { SHELL: '/bin/zsh' })).resolves.toEqual({
      pluginId: 'porcelain@fabiofiorita',
    })

    expect(runner.mock.calls.map(([executable, args]) => [executable, args])).toEqual([
      ['codex', ['--version']],
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
      .mockResolvedValue({ stdout: '', stderr: '' })

    await installCodexPlugin(runner, { SHELL: '/bin/zsh' })

    expect(runner.mock.calls[1]?.slice(0, 2)).toEqual(['/bin/zsh', ['-lc', 'command -v codex']])
    expect(runner.mock.calls[2]?.[0]).toBe('/opt/homebrew/bin/codex')
    expect(runner.mock.calls[3]?.[0]).toBe('/opt/homebrew/bin/codex')
    expect(runner.mock.calls[4]?.[0]).toBe('/opt/homebrew/bin/codex')
  })

  it('does not attempt installation after the marketplace command fails', async () => {
    const failure = Object.assign(new Error('command failed'), { stderr: 'GitHub is unavailable' })
    const runner = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce({ stdout: 'codex-cli 1.0.0', stderr: '' })
      .mockRejectedValueOnce(failure)

    await expect(installCodexPlugin(runner, { SHELL: '/bin/zsh' })).rejects.toThrow(
      'GitHub is unavailable',
    )
    expect(runner).toHaveBeenCalledTimes(2)
  })
})
