import { gitDiffQuery, gitHeadQuery } from '@porcelain/client-runtime/git'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { invalidateGitEffects, legacyGitQueryMatchesEffect } from './git-legacy-cache'
import { gitWorkspaceQueryKey } from './git-query-key'

const ENVIRONMENT = 'env-git-test'
const OTHER_ENVIRONMENT = 'env-other'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Mobile Git legacy cache bridge', () => {
  it('matches per-file diff families by project without crossing environment or project', () => {
    const effect = gitDiffQuery(PROJECT)

    expect(
      legacyGitQueryMatchesEffect(
        ['daemon', ENVIRONMENT, 'gitDiffFile', { filePath: 'src/main.ts', repoPath: PROJECT }],
        effect,
        ENVIRONMENT,
      ),
    ).toBe(true)
    expect(
      legacyGitQueryMatchesEffect(
        [
          'daemon',
          ENVIRONMENT,
          'gitDiffFile',
          { filePath: 'src/main.ts', repoPath: OTHER_PROJECT },
        ],
        effect,
        ENVIRONMENT,
      ),
    ).toBe(false)
    expect(
      legacyGitQueryMatchesEffect(
        [
          'daemon',
          OTHER_ENVIRONMENT,
          'gitDiffFile',
          { filePath: 'src/main.ts', repoPath: PROJECT },
        ],
        effect,
        ENVIRONMENT,
      ),
    ).toBe(false)
  })

  it('invalidates the semantic and matching legacy entries only', async () => {
    const queryClient = new QueryClient()
    const effect = gitHeadQuery(PROJECT)
    const semantic = gitWorkspaceQueryKey(ENVIRONMENT, effect)
    const legacy = ['daemon', ENVIRONMENT, 'gitHead', PROJECT] as const
    const otherProject = ['daemon', ENVIRONMENT, 'gitHead', OTHER_PROJECT] as const
    const otherEnvironment = ['daemon', OTHER_ENVIRONMENT, 'gitHead', PROJECT] as const
    queryClient.setQueryData(semantic, {})
    queryClient.setQueryData(legacy, {})
    queryClient.setQueryData(otherProject, {})
    queryClient.setQueryData(otherEnvironment, {})

    await invalidateGitEffects(queryClient, ENVIRONMENT, [effect])

    expect(queryClient.getQueryState(semantic)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(legacy)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherProject)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherEnvironment)?.isInvalidated).toBeFalsy()
  })
})
