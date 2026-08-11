import { setUserActionReporter } from '@porcelain/shared/background'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openPreviewExternalLink } from './preview-open-link'

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe('openPreviewExternalLink', () => {
  afterEach(() => {
    setUserActionReporter(null)
  })

  it('routes openURL rejection to the visible error channel (never unhandled)', async () => {
    const onError = vi.fn()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      openPreviewExternalLink(
        'https://example.com/docs',
        () => Promise.reject(new Error('no handler')),
        onError,
      )
      await flush()
      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0]?.[0]).toMatchObject({ message: 'no handler' })
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('returns void from the WebView edge', () => {
    const result = openPreviewExternalLink(
      'https://example.com',
      async () => undefined,
      () => {
        throw new Error('should not run on success')
      },
    )
    expect(result).toBeUndefined()
  })
})
