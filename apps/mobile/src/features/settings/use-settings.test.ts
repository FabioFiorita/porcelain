import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  connection: { kind: 'ready' } as { kind: string },
  gitCommitModels: vi.fn(),
}))

vi.mock('@/features/remote', async () => ({
  ...(await vi.importActual<typeof import('@/features/remote/remote-environment')>(
    '@/features/remote/remote-environment',
  )),
  useConnectionState: () => ctx.connection,
}))
vi.mock('@/features/git', () => ({
  useCommitModels: (enabled: boolean) => ctx.gitCommitModels(enabled),
}))

import { useCommitModels } from './use-settings'

const MODELS = [{ id: 'luna', label: 'Luna', provider: 'porcelain' }] as const

beforeEach(() => {
  ctx.connection = { kind: 'ready' }
  ctx.gitCommitModels.mockReturnValue({ error: null, isLoading: false, options: MODELS })
})

describe('Settings reads through the Git feature', () => {
  it('serves the commit models from the Git adapter', () => {
    const { result } = renderHook(() => useCommitModels())

    expect(ctx.gitCommitModels).toHaveBeenCalledWith(true)
    expect(result.current.options).toEqual(MODELS)
    expect(result.current.unreachable).toBe(false)
  })

  it('disables the Git model read while no daemon answers', () => {
    ctx.connection = { kind: 'unreachable' }
    const { result } = renderHook(() => useCommitModels())

    expect(ctx.gitCommitModels).toHaveBeenCalledWith(false)
    expect(result.current.unreachable).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })
})
