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

export const terminalPublicErrorSchema = z.discriminatedUnion('code', [
  terminalNotFoundErrorSchema,
  terminalExitedErrorSchema,
  terminalCapacityErrorSchema,
  terminalInvalidSizeErrorSchema,
  terminalPasteUnavailableErrorSchema,
])

export type TerminalPublicError = z.infer<typeof terminalPublicErrorSchema>
