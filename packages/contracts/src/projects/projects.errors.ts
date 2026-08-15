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
