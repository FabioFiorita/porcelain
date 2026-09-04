import { describe, expect, it, vi } from 'vitest'
import { waitForDaemonReady } from './daemon-readiness'

describe('waitForDaemonReady', () => {
  it('keeps polling the selected daemon until it answers after restart', async () => {
    const read = vi
      .fn<() => Promise<{ version: string }>>()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue({ version: '0.62.0' })
    const delay = vi.fn(async () => undefined)

    await expect(waitForDaemonReady(read, { attempts: 3, delay })).resolves.toEqual({
      version: '0.62.0',
    })
    expect(read).toHaveBeenCalledTimes(3)
    expect(delay).toHaveBeenCalledTimes(2)
  })

  it('reports readiness failure after its bounded retry window', async () => {
    const read = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(
      waitForDaemonReady(read, { attempts: 2, delay: async () => undefined }),
    ).rejects.toThrow('offline')
  })
})
