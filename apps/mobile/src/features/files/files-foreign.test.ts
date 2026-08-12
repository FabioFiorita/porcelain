import {
  gitDiffFileQuery,
  gitFlowQuery,
  gitLogQuery,
  gitStatusQuery,
} from '@porcelain/client-runtime/git'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

// The Git public index carries hooks whose stores reach React Native; this handoff is pure
// cache work, so the seams it never calls stand in.
vi.mock('@/lib/daemon/environments-store', () => ({
  environmentActions: { recordReachabilityFailure: () => {}, recordReachabilitySuccess: () => {} },
  useActiveEnvironment: () => null,
}))
vi.mock('@/features/projects', () => ({ useActiveProject: () => null }))
vi.mock('@/features/settings/preferences-store', () => ({
  usePreferencesStore: Object.assign(() => 'luna', {
    getState: () => ({ commitModel: 'luna', pullMode: 'merge' }),
  }),
}))
vi.mock('@/features/files', () => ({
  invalidateFilesEffects: (): Promise<void> => Promise.resolve(),
}))

import { gitQueryKey } from '@/features/git'

import { applyFilesForeignDependencies } from './files-foreign'

const ENVIRONMENT = 'env-files-foreign'
const PROJECT = '/synthetic/repo'

describe('Files → Git foreign handoff', () => {
  it('moves the working tree through the public Git invalidator and nothing else', async () => {
    const queryClient = new QueryClient()
    const flow = gitQueryKey(ENVIRONMENT, gitFlowQuery(PROJECT))
    const status = gitQueryKey(ENVIRONMENT, gitStatusQuery(PROJECT))
    const diff = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))
    const log = gitQueryKey(ENVIRONMENT, gitLogQuery(PROJECT))
    const otherProject = gitQueryKey(ENVIRONMENT, gitFlowQuery('/synthetic/other'))
    for (const key of [flow, status, diff, log, otherProject]) queryClient.setQueryData(key, {})

    await applyFilesForeignDependencies(queryClient, ENVIRONMENT, PROJECT, [
      { domain: 'git', name: 'working-tree' },
    ])

    expect(queryClient.getQueryState(flow)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(status)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(diff)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(log)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherProject)?.isInvalidated).toBeFalsy()
  })
})
