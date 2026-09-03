import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\porcelain-test'),
    getVersion: vi.fn(() => '0.61.5'),
    on: vi.fn(),
  },
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false },
}))

const { availableWslPort, preferredWslPort } = await import('./wsl-environments')

describe('managed WSL Environments', () => {
  it('assigns a stable port from the reserved WSL range', () => {
    const port = preferredWslPort('Ubuntu')
    expect(preferredWslPort('Ubuntu')).toBe(port)
    expect(port).toBeGreaterThanOrEqual(44_000)
    expect(port).toBeLessThan(45_000)
  })

  it('skips a port already served by another profile', async () => {
    const preferred = preferredWslPort('Ubuntu')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('connection refused'))
    vi.stubGlobal('fetch', fetch)

    await expect(availableWslPort('Ubuntu', new Set())).resolves.toBe(
      44_000 + ((preferred - 44_000 + 1) % 1_000),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `http://127.0.0.1:${preferred}/`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
