import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  connection: { kind: 'ready' } as { kind: string },
  gitCommitModels: vi.fn(),
  gitFlow: vi.fn(),
  invalidateGrouping: vi.fn(),
  order: [] as string[],
  saveLayers: vi.fn(),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useConnectionState: () => ctx.connection,
}))
vi.mock('@/features/git', () => ({
  useCommitModels: (enabled: boolean) => ctx.gitCommitModels(enabled),
  useGitFlow: (options: unknown) => ctx.gitFlow(options),
  useInvalidateGitGrouping: () => ctx.invalidateGrouping,
}))
vi.mock('@/lib/daemon/queries', () => ({
  useDaemonMutation: (procedure: { name: string }) => ({
    data: undefined,
    error: null,
    isPending: false,
    mutateAsync: (input: unknown) => ctx.saveLayers(procedure.name, input),
  }),
  useDaemonQuery: () => ({ data: undefined, error: null, isLoading: false }),
}))

import { useCommitModels, useReviewLayers } from './use-settings'

const MODELS = [{ id: 'luna', label: 'Luna', provider: 'porcelain' }] as const

beforeEach(() => {
  ctx.connection = { kind: 'ready' }
  ctx.order = []
  ctx.gitCommitModels.mockReturnValue({ error: null, isLoading: false, options: MODELS })
  ctx.gitFlow.mockReturnValue({
    error: null,
    groups: [{ files: [{ connects: [], path: 'src/a.ts', status: 'modified' }], layer: 'Other' }],
    isLoading: false,
  })
  ctx.invalidateGrouping.mockImplementation(async () => {
    ctx.order.push('invalidate')
  })
  ctx.saveLayers.mockImplementation(async () => {
    ctx.order.push('write')
  })
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

  it('previews layer patterns against the Git flow at the slow settings rate', () => {
    const { result } = renderHook(() => useReviewLayers('/synthetic/repo'))

    expect(ctx.gitFlow).toHaveBeenCalledWith({ pollMs: 15_000 })
    expect(result.current.changedPaths).toEqual(['src/a.ts'])
  })

  it('regroups the Git flows only after the layer write lands', async () => {
    const { result } = renderHook(() => useReviewLayers('/synthetic/repo'))

    await act(async () => {
      expect(await result.current.save([{ label: 'Docs', pattern: 'docs/**' }])).toBe(true)
    })

    await waitFor(() => expect(ctx.order).toEqual(['write', 'invalidate']))
    expect(ctx.invalidateGrouping).toHaveBeenCalledWith('/synthetic/repo')
  })
})
