import { describe, expect, it } from 'vitest'
import { mapCodexbarUsage, resolveCodexbarBin } from './codexbar'

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
