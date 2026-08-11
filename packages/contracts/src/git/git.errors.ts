import { definePublicError } from '../errors/define-public-error'

/** Git public-error members. Capability normalization is owned by GIT-002. */

export const gitNotARepositoryErrorSchema = definePublicError({
  code: 'git.not-a-repository',
  category: 'not-found',
  retryable: false,
})

export const gitBranchNotFoundErrorSchema = definePublicError({
  code: 'git.branch-not-found',
  category: 'not-found',
  retryable: false,
})

export const gitBranchAlreadyExistsErrorSchema = definePublicError({
  code: 'git.branch-already-exists',
  category: 'conflict',
  retryable: false,
})

export const gitWorktreeConflictErrorSchema = definePublicError({
  code: 'git.worktree-conflict',
  category: 'conflict',
  retryable: false,
})

export const gitWorkingTreeConflictErrorSchema = definePublicError({
  code: 'git.working-tree-conflict',
  category: 'conflict',
  retryable: false,
})
