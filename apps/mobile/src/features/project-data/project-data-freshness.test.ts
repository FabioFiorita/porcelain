import {
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataNotesQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  applyProjectDataFreshnessRequirement,
  applyProjectDataReviewChange,
} from './project-data-freshness'
import { projectDataQueryKey } from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV = 'env-project-data-fresh'

function seed(queryClient: QueryClient, projectPath: string): void {
  queryClient.setQueryData(projectDataQueryKey(ENV, projectDataNotesQuery(projectPath)), '')
  queryClient.setQueryData(projectDataQueryKey(ENV, projectDataLayersQuery(projectPath)), {
    layers: [],
    custom: false,
  })
  queryClient.setQueryData(projectDataQueryKey(ENV, projectDataDispositionsQuery(projectPath)), [])
  queryClient.setQueryData(projectDataQueryKey(ENV, projectDataVisibilityQuery(projectPath)), {
    hidden: false,
  })
}

describe('Project Data freshness', () => {
  it('review.changed invalidates layers only for that project', async () => {
    const queryClient = new QueryClient()
    seed(queryClient, PROJECT)
    seed(queryClient, OTHER)

    await applyProjectDataReviewChange(PROJECT, { environmentId: ENV, queryClient })

    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataLayersQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataNotesQuery(PROJECT)))
        ?.isInvalidated,
    ).toBeFalsy()
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataDispositionsQuery(PROJECT)))
        ?.isInvalidated,
    ).toBeFalsy()
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataVisibilityQuery(PROJECT)))
        ?.isInvalidated,
    ).toBeFalsy()
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataLayersQuery(OTHER)))
        ?.isInvalidated,
    ).toBeFalsy()
  })

  it('project freshness invalidates all four identities and leaves a foreign project', async () => {
    const queryClient = new QueryClient()
    seed(queryClient, PROJECT)
    seed(queryClient, OTHER)

    await applyProjectDataFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENV, queryClient },
    )

    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataNotesQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataLayersQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataDispositionsQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataVisibilityQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(projectDataQueryKey(ENV, projectDataNotesQuery(OTHER)))
        ?.isInvalidated,
    ).toBeFalsy()
  })
})
