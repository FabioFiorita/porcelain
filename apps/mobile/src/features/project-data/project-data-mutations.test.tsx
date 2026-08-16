import { projectDataLayersQuery } from '@porcelain/client-runtime/project-data'
import { projectDataContractFixtures } from '@porcelain/contracts/project-data'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Environment } from '@/features/remote'

const ENV = 'env-project-data-mut'

function pairedEnvironment(): Environment {
  return {
    id: ENV,
    nickname: 'test',
    icon: 'desktop',
    baseUrl: 'http://192.168.1.50:43117',
    endpoints: ['http://192.168.1.50:43117'],
    preferredEndpoint: 'http://192.168.1.50:43117',
    createdAt: 1,
    activeRepoPath: null,
    token: 'paired',
  }
}

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: null as Environment | null,
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: [], isLoading: false }),
  useInvalidateGitGrouping: () => async () => {},
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { saveProjectLayers } from './project-data-mutations'
import { projectDataQueryKey } from './project-data-query-key'

const REPO = '/synthetic/repo'

beforeEach(() => {
  ctx.environment = pairedEnvironment()
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue(undefined)
})

describe('mobile Project Data writes', () => {
  it('invalidates the layers identity, not a procedure-name repoLayers key', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const layersKey = projectDataQueryKey(ENV, projectDataLayersQuery(REPO))
    const procedureKey = ['daemon', ENV, 'repoLayers'] as const
    queryClient.setQueryData(layersKey, { layers: [], custom: false })
    queryClient.setQueryData(procedureKey, { layers: [], custom: false })

    const grouping = vi.fn(async () => {})
    await saveProjectLayers(
      ctx.environment,
      queryClient,
      grouping,
      REPO,
      projectDataContractFixtures.setRepoLayers.input.layers,
    )

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'setRepoLayers' }),
      {
        repoPath: REPO,
        layers: [{ label: ' Docs ', pattern: '(^|/)docs/' }],
      },
    )
    expect(queryClient.getQueryState(layersKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(procedureKey)?.isInvalidated).toBeFalsy()
    expect(grouping).toHaveBeenCalledWith(REPO)
  })
})
