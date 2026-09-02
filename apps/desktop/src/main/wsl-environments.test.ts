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

const { preferredWslPort } = await import('./wsl-environments')

describe('managed WSL Environments', () => {
  it('assigns a stable port from the reserved WSL range', () => {
    const port = preferredWslPort('Ubuntu')
    expect(preferredWslPort('Ubuntu')).toBe(port)
    expect(port).toBeGreaterThanOrEqual(44_000)
    expect(port).toBeLessThan(45_000)
  })
})
