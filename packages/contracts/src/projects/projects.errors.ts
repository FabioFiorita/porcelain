import { definePublicError } from '../errors/define-public-error'

/** Project filesystem and recents failures composed into the shared public-error union. */

export const projectsNotFoundErrorSchema = definePublicError({
  code: 'projects.not-found',
  category: 'not-found',
  retryable: false,
})

export const projectsNotADirectoryErrorSchema = definePublicError({
  code: 'projects.not-a-directory',
  category: 'invalid-request',
  retryable: false,
})

export const projectsUnavailableErrorSchema = definePublicError({
  code: 'projects.unavailable',
  category: 'unavailable',
  retryable: true,
})

/** Development daemons are intentionally restricted to disposable playgrounds. */
export const projectsDevRepoForbiddenErrorSchema = definePublicError({
  code: 'projects.dev-repo-forbidden',
  category: 'invalid-request',
  retryable: false,
})

/** Canvas failures — the daemon-root Project store's agent-authored explanation surface. */

export const canvasNotFoundErrorSchema = definePublicError({
  code: 'canvas.not-found',
  category: 'not-found',
  retryable: false,
})

export const canvasUnavailableErrorSchema = definePublicError({
  code: 'canvas.unavailable',
  category: 'unavailable',
  retryable: true,
})

/**
 * Git promotion refused: the target checkout is not a live Worktree of that
 * Project (or the `worktreeId` given names a different one). Every promotion
 * takes an explicit target and an ambiguous one is rejected, never guessed —
 * writing an agent's Canvas into the wrong repository is not undone by a retry
 * so callers can distinguish private and tracked ownership failures.
 */
export const projectsOverlayTargetInvalidErrorSchema = definePublicError({
  code: 'projects.overlay-target-invalid',
  category: 'invalid-request',
  retryable: false,
})
