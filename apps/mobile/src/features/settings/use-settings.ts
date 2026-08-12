import type { CommitModelOption } from '@porcelain/contracts'
import { useCommitModels as useGitCommitModels } from '@/features/git'
import { useConnectionState } from '@/features/remote'

/**
 * Settings tab helpers that stay in Settings: commit-model picker (Git-owned).
 * Notes, layers, and companion dispositions live in `@/features/project-data`.
 */

export type CommitModels = {
  options: readonly CommitModelOption[]
  isLoading: boolean
  error: Error | null
  /** No daemon to ask — the picker says so rather than printing an empty list. */
  unreachable: boolean
}

/** The commit-message providers installed on the active daemon. */
export function useCommitModels(): CommitModels {
  const connection = useConnectionState()
  const unreachable = connection.kind !== 'ready'
  const models = useGitCommitModels(!unreachable)

  return {
    error: models.error,
    isLoading: models.isLoading && !unreachable,
    options: models.options,
    unreachable,
  }
}
