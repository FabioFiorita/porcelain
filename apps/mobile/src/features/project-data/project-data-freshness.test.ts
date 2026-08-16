import {
  projectDataDispositionsQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { applyProjectDataFreshnessRequirement } from './project-data-freshness'
import { projectDataQueryKey } from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const ENV = 'env-project-data-fresh'

describe('Project Data freshness', () => {
  it('project freshness invalidates both identities for the project', async () => {
    const queryClient = new QueryClient()
    const dispositions = projectDataQueryKey(ENV, projectDataDispositionsQuery(PROJECT))
    const visibility = projectDataQueryKey(ENV, projectDataVisibilityQuery(PROJECT))
    queryClient.setQueryData(dispositions, [])
    queryClient.setQueryData(visibility, { hidden: false })

    await applyProjectDataFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENV, queryClient },
    )

    expect(queryClient.getQueryState(dispositions)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(visibility)?.isInvalidated).toBe(true)
  })
})
