import {
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Files' Git handoff is a seam here — `git-files-handoff.test.ts` proves the real wiring, and
// loading the Git feature would drag React Native into a pure cache test.
vi.mock('@/features/git', () => ({
  invalidateGitWorkingTree: (): Promise<void> => Promise.resolve(),
}))

import { applyFilesFreshnessRequirement, applyFilesNotification } from './files-notifications'
import { filesQueryKey } from './files-query-key'

const ENV = 'env-files-notification'
const PROJECT = '/synthetic/repo'

function client(): QueryClient {
  return new QueryClient()
}

describe('mobile Files notification adapter', () => {
  beforeEach(() => {
    // Keep each cache independent: invalidation state is intentionally the proof surface.
  })

  it('applies a tree notification only to the active project', async () => {
    const queryClient = client()
    const tree = filesQueryKey(ENV, filesTreeQuery(PROJECT, 'src', false))
    const content = filesQueryKey(ENV, fileContentQuery(PROJECT, 'src/main.ts'))
    const other = filesQueryKey(ENV, filesPinsQuery('/other/repo'))
    for (const key of [tree, content, other]) queryClient.setQueryData(key, 'cached')

    applyFilesNotification(
      { kind: 'files.tree-changed', paths: ['src'], projectPath: PROJECT },
      { activeProjectPath: PROJECT, environmentId: ENV, queryClient },
    )
    await queryClient.getQueryCache().find({ queryKey: tree })?.promise

    expect(queryClient.getQueryState(tree)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(content)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false)
  })

  it('recovers the requirement project and leaves another project and environment fresh', async () => {
    const queryClient = client()
    const target = filesQueryKey(ENV, filesPinsQuery(PROJECT))
    const otherProject = filesQueryKey(ENV, filesPinsQuery('/other/repo'))
    const otherEnvironment = filesQueryKey('other-env', filesPinsQuery(PROJECT))
    const preview = filesQueryKey(ENV, filePreviewQuery(PROJECT, 'docs/index.html'))
    for (const key of [target, otherProject, otherEnvironment, preview]) {
      queryClient.setQueryData(key, 'cached')
    }

    applyFilesFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENV, queryClient },
    )
    await queryClient.getQueryCache().find({ queryKey: target })?.promise

    expect(queryClient.getQueryState(target)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(preview)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherProject)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(otherEnvironment)?.isInvalidated).toBe(false)
  })
})
