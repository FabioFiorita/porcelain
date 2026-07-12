import { describe, expect, it, vi } from 'vitest'

// Capture the argv codexbarLimits spawns with. promisify(execFile) calls execFile with a
// trailing (err, { stdout, stderr }) callback, so the mock resolves that way.
// A synchronous factory (not async/importOriginal): codexbar.ts runs `promisify(execFile)` at
// module load, which races an async factory's resolution and would silently use the real binary.
const execFileMock = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}))

import { codexbarLimits, mapCodexbarUsage, resolveCodexbarBin } from './codexbar'

describe('codexbarLimits', () => {
  it('spawns codexbar with --source cli so it reads the CLI account, not web cookies', async () => {
    execFileMock.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: null, out: { stdout: string }) => void
      cb(null, {
        stdout: JSON.stringify([
          { provider: 'claude', usage: { primary: { windowMinutes: 300, usedPercent: 47 } } },
        ]),
      })
    })
    const limits = await codexbarLimits('claude', '/opt/homebrew/bin/codexbar')
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 47 }] })
    expect(execFileMock).toHaveBeenCalledWith(
      '/opt/homebrew/bin/codexbar',
      ['--provider', 'claude', '--source', 'cli', '--format', 'json', '--no-color'],
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('queries opencodego first for opencode, without --source cli, and short-circuits', async () => {
    execFileMock.mockReset()
    execFileMock.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: null, out: { stdout: string }) => void
      cb(null, {
        stdout: JSON.stringify([
          {
            provider: 'opencodego',
            usage: {
              primary: { windowMinutes: 300, usedPercent: 1 },
              secondary: { windowMinutes: 10080, usedPercent: 73 },
              tertiary: { windowMinutes: 43200, usedPercent: 36 },
            },
          },
        ]),
      })
    })
    const limits = await codexbarLimits('opencode', '/opt/homebrew/bin/codexbar')
    expect(limits).toEqual({
      windows: [
        { id: '5h', label: '5-hour', usedPercent: 1 },
        { id: 'weekly', label: 'Weekly', usedPercent: 73 },
        { id: 'window-43200', label: '30-day', usedPercent: 36 },
      ],
    })
    expect(execFileMock).toHaveBeenCalledTimes(1)
    expect(execFileMock).toHaveBeenCalledWith(
      '/opt/homebrew/bin/codexbar',
      ['--provider', 'opencodego', '--format', 'json', '--no-color'],
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('falls back to the opencode id when opencodego yields nothing', async () => {
    execFileMock.mockReset()
    execFileMock.mockImplementation((...args: unknown[]) => {
      const provider = (args[1] as string[])[1]
      const cb = args[args.length - 1] as (err: Error | null, out?: { stdout: string }) => void
      // opencodego fails upstream (the observed HTTP 500 surfaces as a non-zero exit).
      if (provider === 'opencodego') {
        cb(new Error('exit 1'))
        return
      }
      cb(null, {
        stdout: JSON.stringify([
          { provider: 'opencode', usage: { primary: { windowMinutes: 300, usedPercent: 8 } } },
        ]),
      })
    })
    const limits = await codexbarLimits('opencode', '/opt/homebrew/bin/codexbar')
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 8 }] })
    expect(execFileMock.mock.calls.map((call) => call[1])).toEqual([
      ['--provider', 'opencodego', '--format', 'json', '--no-color'],
      ['--provider', 'opencode', '--format', 'json', '--no-color'],
    ])
  })
})

describe('resolveCodexbarBin', () => {
  const home = '/Users/x'

  it('prefers PORCELAIN_CODEXBAR_BIN when it exists', () => {
    const bin = resolveCodexbarBin({
      env: { PORCELAIN_CODEXBAR_BIN: '/custom/codexbar', PATH: '/usr/bin' },
      home,
      exists: (p) => p === '/custom/codexbar',
    })
    expect(bin).toBe('/custom/codexbar')
  })

  it('finds codexbar on PATH before the well-known locations', () => {
    const bin = resolveCodexbarBin({
      env: { PATH: '/a:/b:/c' },
      home,
      exists: (p) => p === '/b/codexbar',
    })
    expect(bin).toBe('/b/codexbar')
  })

  it('falls back to a well-known location (the bundled app helper)', () => {
    const bin = resolveCodexbarBin({
      env: { PATH: '/nope' },
      home,
      exists: (p) => p === '/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI',
    })
    expect(bin).toBe('/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI')
  })

  it('returns null when nothing exists', () => {
    expect(resolveCodexbarBin({ env: { PATH: '/nope' }, home, exists: () => false })).toBeNull()
  })
})

describe('mapCodexbarUsage', () => {
  it('maps the real captured shape (no resetsAt) into 5-hour + weekly windows', () => {
    const limits = mapCodexbarUsage(
      [
        {
          provider: 'claude',
          source: 'web',
          version: '2.1.207',
          usage: {
            primary: { windowMinutes: 300, usedPercent: 0 },
            secondary: { windowMinutes: 10080, usedPercent: 0 },
            tertiary: null,
            // Extra fields the payload carries and we ignore.
            accountEmail: 'redacted@example.com',
            updatedAt: '2026-07-12T16:15:03Z',
          },
        },
      ],
      'claude',
    )
    expect(limits).toEqual({
      windows: [
        { id: '5h', label: '5-hour', usedPercent: 0 },
        { id: 'weekly', label: 'Weekly', usedPercent: 0 },
      ],
    })
  })

  it('accepts a single object and converts an ISO resetsAt to epoch ms', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        usage: {
          primary: { windowMinutes: 300, usedPercent: 42, resetsAt: '2025-12-04T19:15:00Z' },
        },
      },
      'claude',
    )
    expect(limits).toEqual({
      windows: [
        {
          id: '5h',
          label: '5-hour',
          usedPercent: 42,
          resetsAt: Date.parse('2025-12-04T19:15:00Z'),
        },
      ],
    })
  })

  it('picks the item matching the requested provider out of an array', () => {
    const limits = mapCodexbarUsage(
      [
        { provider: 'codex', usage: { primary: { windowMinutes: 300, usedPercent: 5 } } },
        { provider: 'claude', usage: { primary: { windowMinutes: 300, usedPercent: 9 } } },
      ],
      'claude',
    )
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 9 }] })
  })

  it('labels an off-catalog window by days or hours', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        usage: {
          primary: { windowMinutes: 1440, usedPercent: 3 },
          secondary: { windowMinutes: 90, usedPercent: 7 },
        },
      },
      'claude',
    )
    expect(limits).toEqual({
      windows: [
        { id: 'window-1440', label: '1-day', usedPercent: 3 },
        { id: 'window-90', label: '2-hour', usedPercent: 7 },
      ],
    })
  })

  it('keeps a window whose resetsAt is unparseable, omitting resetsAt', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        usage: { primary: { windowMinutes: 300, usedPercent: 1, resetsAt: 'not-a-date' } },
      },
      'claude',
    )
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 1 }] })
  })

  it('maps extraRateWindows after the primary/secondary slots, labeled by title', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        source: 'cli',
        usage: {
          primary: { windowMinutes: 300, usedPercent: 47 },
          secondary: { windowMinutes: 10080, usedPercent: 50 },
          extraRateWindows: [
            {
              window: {
                windowMinutes: 10080,
                usedPercent: 67,
                resetsAt: '2026-07-15T00:00:00Z',
              },
              title: 'Fable only',
              id: 'claude-weekly-scoped-fable',
            },
          ],
        },
      },
      'claude',
    )
    expect(limits).toEqual({
      windows: [
        { id: '5h', label: '5-hour', usedPercent: 47 },
        { id: 'weekly', label: 'Weekly', usedPercent: 50 },
        {
          id: 'claude-weekly-scoped-fable',
          label: 'Fable only',
          usedPercent: 67,
          resetsAt: Date.parse('2026-07-15T00:00:00Z'),
        },
      ],
    })
  })

  it('skips an extraRateWindows entry whose window is unparseable', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        usage: {
          primary: { windowMinutes: 300, usedPercent: 47 },
          extraRateWindows: [
            { window: { windowMinutes: 10080 }, title: 'Fable only', id: 'scoped' },
          ],
        },
      },
      'claude',
    )
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 47 }] })
  })

  it('skips an extraRateWindows entry whose id collides with an already-mapped window', () => {
    const limits = mapCodexbarUsage(
      {
        provider: 'claude',
        usage: {
          primary: { windowMinutes: 300, usedPercent: 47 },
          extraRateWindows: [
            { window: { windowMinutes: 300, usedPercent: 99 }, title: 'Dup', id: '5h' },
          ],
        },
      },
      'claude',
    )
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 47 }] })
  })

  it('leaves behavior unchanged when extraRateWindows is absent', () => {
    const limits = mapCodexbarUsage(
      { provider: 'claude', usage: { primary: { windowMinutes: 300, usedPercent: 47 } } },
      'claude',
    )
    expect(limits).toEqual({ windows: [{ id: '5h', label: '5-hour', usedPercent: 47 }] })
  })

  it('returns null when only a different provider is present', () => {
    expect(
      mapCodexbarUsage(
        [{ provider: 'codex', usage: { primary: { windowMinutes: 300, usedPercent: 5 } } }],
        'claude',
      ),
    ).toBeNull()
  })

  it('returns null for junk, missing usage, or all-null windows', () => {
    expect(mapCodexbarUsage('nope', 'claude')).toBeNull()
    expect(mapCodexbarUsage({ provider: 'claude' }, 'claude')).toBeNull()
    expect(
      mapCodexbarUsage(
        { provider: 'claude', usage: { primary: null, secondary: null, tertiary: null } },
        'claude',
      ),
    ).toBeNull()
  })
})
