import { describe, expect, it, vi } from 'vitest'

const { setStringAsync } = vi.hoisted(() => ({
  setStringAsync: vi.fn(async (_text: string): Promise<void> => {}),
}))

vi.mock('expo-clipboard', () => ({ setStringAsync }))

import { copyText } from './clipboard'

describe('copyText', () => {
  it('resolves true when the pasteboard write succeeds', async () => {
    await expect(copyText('hi')).resolves.toBe(true)
    expect(setStringAsync).toHaveBeenCalledWith('hi')
  })

  it('resolves false rather than throwing when the write fails', async () => {
    setStringAsync.mockRejectedValueOnce(new Error('nope'))
    await expect(copyText('hi')).resolves.toBe(false)
  })
})
