import type { TerminalRecovery } from '@porcelain/client-runtime/terminal'
import { settleBackground } from '@shared/background'
import type { TerminalAdapterFailure } from './terminal-stream-adapter'

export type TerminalRecoveryOptions = {
  readonly refetchRoster: () => Promise<unknown>
}

/** Reconnect/gap recovery refreshes authoritative roster truth; it never fabricates stream data. */
export function applyTerminalRecovery(
  recovery: TerminalRecovery,
  options: TerminalRecoveryOptions,
): void {
  if (!recovery.refreshRoster) return
  settleBackground(options.refetchRoster(), 'lifecycle')
}

/**
 * A Terminal request failure, as an `Error`.
 *
 * The stream adapter used to reject with the bare typed failure object. Everything that
 * catches a rejection ends in a toast whose description is `String(error)`, and on a plain
 * object that reads "[object Object]" — which is what "New terminal failed" showed the human
 * instead of a reason. Rejecting with this instead gives every current and future call site a
 * sentence, while the `reason` (and `error`) own properties keep the typed classifiers below
 * working on the same value.
 */
export class TerminalRequestError extends Error {
  readonly reason: TerminalAdapterFailure['reason']
  readonly error?: Extract<TerminalAdapterFailure, { reason: 'server' }>['error']

  constructor(failure: TerminalAdapterFailure) {
    super(terminalFailureMessage(failure))
    this.name = 'TerminalRequestError'
    this.reason = failure.reason
    if (failure.reason === 'server') this.error = failure.error
  }
}

/** One human sentence per way a Terminal request can fail. */
export function terminalFailureMessage(failure: TerminalAdapterFailure): string {
  switch (failure.reason) {
    case 'not-requestable':
    case 'closed':
      return 'The connection to this Environment is not open. Reconnect and try again.'
    case 'deadline':
      return 'The daemon did not answer in time.'
    case 'server':
      return failure.error.message === ''
        ? `The daemon refused the request (${failure.error.code}).`
        : failure.error.message
  }
}

function isTerminalFailure(error: unknown): error is TerminalAdapterFailure {
  if (typeof error !== 'object' || error === null || !('reason' in error)) return false
  if (
    error.reason === 'closed' ||
    error.reason === 'deadline' ||
    error.reason === 'not-requestable'
  )
    return true
  if (error.reason !== 'server' || !('error' in error)) return false
  return typeof error.error === 'object' && error.error !== null && 'code' in error.error
}

/** Preserve the existing paste UX while exposing typed Terminal failures to callers. */
export function terminalPasteFailureMessage(error: unknown): string {
  const unavailable = 'This terminal is no longer available.'
  const tooLarge = 'That file is too large to attach (8 MiB limit).'
  const writeFailed = 'The daemon could not save the file. Try again.'
  if (!isTerminalFailure(error)) return writeFailed
  if (error.reason === 'not-requestable' || error.reason === 'closed') return unavailable
  if (error.reason === 'deadline') return writeFailed
  switch (error.error.code) {
    case 'terminal.not-found':
    case 'terminal.exited':
      return unavailable
    case 'terminal.capacity':
      return tooLarge
    case 'terminal.invalid-size':
      return tooLarge
    case 'terminal.paste-unavailable':
    case 'terminal.dev-server-not-found':
    case 'terminal.dev-server-target':
    case 'terminal.dev-server-running':
      // Development-server failures never answer a paste; they arrive on tRPC. Listed so the
      // switch stays exhaustive over the Terminal error union.
      return writeFailed
  }
}
