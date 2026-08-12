import {
  projectDataLayersQuery,
  projectDataNotesQuery,
} from '@porcelain/client-runtime/project-data'
import { projectDataContractFixtures } from '@porcelain/contracts/project-data'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-project-data-mut', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
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

import { saveProjectLayers, saveProjectNotes } from './project-data-mutations'
import { projectDataQueryKey } from './project-data-query-key'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV = 'env-project-data-mut'

beforeEach(() => {
  ctx.environment = { id: ENV, token: 'paired' }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue(undefined)
})

describe('mobile Project Data writes', () => {
  it('invalidates the notes identity, not a procedure-name repoNotes key', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const notesKey = projectDataQueryKey(ENV, projectDataNotesQuery(REPO))
    const procedureKey = ['daemon', ENV, 'repoNotes'] as const
    const otherKey = projectDataQueryKey(ENV, projectDataNotesQuery(OTHER))
    queryClient.setQueryData(notesKey, 'old')
    queryClient.setQueryData(procedureKey, 'legacy')
    queryClient.setQueryData(otherKey, 'other')

    await saveProjectNotes(
      ctx.environment,
      queryClient,
      REPO,
      projectDataContractFixtures.setRepoNotes.input.notes,
    )

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'setRepoNotes' }),
      projectDataContractFixtures.setRepoNotes.input,
    )
    expect(queryClient.getQueryState(notesKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(procedureKey)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })

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
