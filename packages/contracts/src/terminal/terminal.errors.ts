import { z } from 'zod'
import { definePublicError } from '../errors/define-public-error'

/** Terminal stream public-error members composed into the shared PorcelainError union. */

export const terminalNotFoundErrorSchema = definePublicError({
  code: 'terminal.not-found',
  category: 'not-found',
  retryable: false,
})

export const terminalExitedErrorSchema = definePublicError({
  code: 'terminal.exited',
  category: 'conflict',
  retryable: false,
})

export const terminalCapacityErrorSchema = definePublicError({
  code: 'terminal.capacity',
  category: 'unavailable',
  retryable: true,
})

export const terminalInvalidSizeErrorSchema = definePublicError({
  code: 'terminal.invalid-size',
  category: 'invalid-request',
  retryable: false,
})

export const terminalPasteUnavailableErrorSchema = definePublicError({
  code: 'terminal.paste-unavailable',
  category: 'unavailable',
  retryable: true,
})

/**
 * A development server the daemon does not hold a record for. Distinct from
 * `terminal.not-found`: that one is about a PTY session, this one about the record whose
 * lifetime the Hub is operating on.
 */
export const devServerNotFoundErrorSchema = definePublicError({
  code: 'terminal.dev-server-not-found',
  category: 'not-found',
  retryable: false,
})

/** The start target did not name a real Worktree checkout — never guessed, always rejected. */
export const devServerTargetErrorSchema = definePublicError({
  code: 'terminal.dev-server-target',
  category: 'invalid-request',
  retryable: false,
})

/** Dismiss refuses a live server: forgetting the record would orphan its process. */
export const devServerRunningErrorSchema = definePublicError({
  code: 'terminal.dev-server-running',
  category: 'conflict',
  retryable: false,
})

export const terminalPublicErrorSchema = z.discriminatedUnion('code', [
  terminalNotFoundErrorSchema,
  terminalExitedErrorSchema,
  terminalCapacityErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalPasteUnavailableErrorSchema,
  devServerNotFoundErrorSchema,
  devServerTargetErrorSchema,
  devServerRunningErrorSchema,
])

export type TerminalPublicError = z.infer<typeof terminalPublicErrorSchema>
