import type { TerminalServerFrame } from '@porcelain/contracts/terminal'
import type {
  TerminalCreateInput,
  TerminalDetach,
  TerminalKill,
  TerminalPasteFileInput,
  TerminalRequest,
  TerminalRequestFailure,
  TerminalRequestSuccessFrame,
  TerminalResize,
  TerminalWrite,
} from './terminal-requests'

export type TerminalRecoveryReason = 'reconnect' | 'epoch-changed' | 'sequence-gap'

export type TerminalRecovery = {
  readonly reason: TerminalRecoveryReason
  readonly reattach: readonly string[]
  readonly refreshRoster: true
}

export type TerminalData = Extract<TerminalServerFrame, { t: 'terminal:data' }>
export type TerminalExit = Extract<TerminalServerFrame, { t: 'terminal:exit' }>

export type TerminalStreamEffect =
  | {
      readonly type: 'request-succeeded'
      readonly request: TerminalRequest
      readonly frame: TerminalRequestSuccessFrame
    }
  | {
      readonly type: 'request-failed'
      readonly request: TerminalRequest
      readonly failure: TerminalRequestFailure
    }
  | { readonly type: 'data'; readonly frame: TerminalData }
  | { readonly type: 'exit'; readonly frame: TerminalExit }
  | { readonly type: 'recovery-required'; readonly recovery: TerminalRecovery }

export type TerminalAttachmentStatus =
  | 'awaiting-baseline'
  | 'running'
  | 'exited'
  | 'awaiting-reattach'

export type TerminalAttachmentState = {
  readonly id: string
  readonly status: TerminalAttachmentStatus
  readonly epoch: string | undefined
  readonly sequence: number | undefined
}

export type TerminalStreamState = {
  readonly requestCreate: (
    input: TerminalCreateInput,
    requestId: string,
    deadline: number,
  ) => TerminalRequest | undefined
  readonly requestAttach: (
    id: string,
    requestId: string,
    deadline: number,
  ) => TerminalRequest | undefined
  readonly requestPasteFile: (
    input: TerminalPasteFileInput,
    requestId: string,
    deadline: number,
  ) => TerminalRequest | undefined
  readonly attach: (id: string) => boolean
  readonly detach: (id: string, requestId: string) => TerminalDetach | undefined
  readonly write: (id: string, data: string, requestId: string) => TerminalWrite | undefined
  readonly resize: (
    id: string,
    cols: number,
    rows: number,
    requestId: string,
  ) => TerminalResize | undefined
  readonly kill: (id: string, requestId: string) => TerminalKill | undefined
  readonly receive: (frame: TerminalServerFrame) => readonly TerminalStreamEffect[]
  readonly expire: (now: number) => readonly TerminalStreamEffect[]
  readonly close: () => readonly TerminalStreamEffect[]
  readonly reconnect: () => readonly TerminalStreamEffect[]
  readonly state: (id: string) => TerminalAttachmentState | undefined
  readonly desiredAttachments: () => readonly string[]
}

export function terminalRecovery(
  reason: TerminalRecoveryReason,
  ids: Iterable<string>,
): TerminalRecovery {
  const reattach = [...new Set(ids)].sort()
  return Object.freeze({
    reason,
    reattach: Object.freeze(reattach),
    refreshRoster: true,
  })
}
