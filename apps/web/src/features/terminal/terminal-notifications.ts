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
export function terminalPasteFailureMessage(error: unknown, kind: 'image' | 'file'): string {
  const unavailable = 'This terminal is no longer available.'
  const tooLarge =
    kind === 'image'
      ? 'That image is too large to paste.'
      : 'That file is too large to attach (8 MiB limit).'
  const writeFailed =
    kind === 'image'
      ? 'The daemon could not save the image. Try again.'
      : 'The daemon could not save the file. Try again.'
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
