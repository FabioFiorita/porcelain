import { describe, expect, it, vi } from 'vitest'

const { getImageAsync, hasImageAsync, setStringAsync } = vi.hoisted(() => ({
  getImageAsync: vi.fn(
    async (_options: { format: string }): Promise<{ data: string } | null> => null,
  ),
  hasImageAsync: vi.fn(async (): Promise<boolean> => false),
  setStringAsync: vi.fn(async (_text: string): Promise<void> => {}),
}))

vi.mock('expo-clipboard', () => ({ getImageAsync, hasImageAsync, setStringAsync }))

import { copyText, getImage, hasImage } from './clipboard'

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

describe('hasImage', () => {
  it('reflects the pasteboard state', async () => {
    hasImageAsync.mockResolvedValueOnce(true)
    await expect(hasImage()).resolves.toBe(true)
  })

  it('resolves false rather than throwing on a platform refusal', async () => {
    hasImageAsync.mockRejectedValueOnce(new Error('denied'))
    await expect(hasImage()).resolves.toBe(false)
  })
})

describe('getImage', () => {
  it('strips the data: URI prefix, keeping only the base64 payload', async () => {
    getImageAsync.mockResolvedValueOnce({ data: 'data:image/png;base64,YWJj' })
    await expect(getImage()).resolves.toEqual({ base64: 'YWJj', mime: 'image/png' })
  })

  it('passes the base64 through unchanged if there is no prefix to strip', async () => {
    getImageAsync.mockResolvedValueOnce({ data: 'YWJj' })
    await expect(getImage()).resolves.toEqual({ base64: 'YWJj', mime: 'image/png' })
  })

  it('resolves null when the pasteboard has no image', async () => {
    getImageAsync.mockResolvedValueOnce(null)
    await expect(getImage()).resolves.toBeNull()
  })

  it('resolves null rather than throwing on a platform refusal', async () => {
    getImageAsync.mockRejectedValueOnce(new Error('denied'))
    await expect(getImage()).resolves.toBeNull()
  })
})
