import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateAfterSuccess, toastUserActionError } from './mutation-error'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('toastUserActionError', () => {
  afterEach(() => {
    vi.mocked(toast.error).mockReset()
  })

  it('toasts Error messages for clipboard-style user actions', () => {
    toastUserActionError('Copy selection', new Error('clipboard denied'))
    expect(toast.error).toHaveBeenCalledWith('Copy selection failed', {
      description: 'clipboard denied',
    })
  })

  it('stringifies non-Error rejections', () => {
    toastUserActionError('Cut', 'denied')
    expect(toast.error).toHaveBeenCalledWith('Cut failed', { description: 'denied' })
  })
})

describe('invalidateAfterSuccess', () => {
  afterEach(() => {
    vi.mocked(toast.error).mockReset()
  })

  it('keeps server success durable when invalidation rejects (partial success)', async () => {
    await invalidateAfterSuccess([Promise.reject(new Error('query offline'))], 'Publish review')
    expect(toast.error).toHaveBeenCalledWith('Publish review succeeded, but the UI may be stale', {
      description: 'query offline',
    })
  })

  it('is quiet when invalidation succeeds', async () => {
    await invalidateAfterSuccess([Promise.resolve()], 'Publish review')
    expect(toast.error).not.toHaveBeenCalled()
  })
})
