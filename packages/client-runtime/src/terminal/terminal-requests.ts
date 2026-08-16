import type {
  TerminalClientFrame,
  TerminalPublicError,
  TerminalServerFrame,
} from '@porcelain/contracts/terminal'

export type TerminalCreateFrame = Extract<TerminalClientFrame, { t: 'terminal:create' }>
export type TerminalAttachFrame = Extract<TerminalClientFrame, { t: 'terminal:attach' }>
export type TerminalPasteFileFrame = Extract<TerminalClientFrame, { t: 'terminal:paste-file' }>
export type TerminalDetach = Extract<TerminalClientFrame, { t: 'terminal:detach' }>
export type TerminalWrite = Extract<TerminalClientFrame, { t: 'terminal:write' }>
export type TerminalResize = Extract<TerminalClientFrame, { t: 'terminal:resize' }>
export type TerminalKill = Extract<TerminalClientFrame, { t: 'terminal:kill' }>

export type TerminalCreateInput = Omit<TerminalCreateFrame, 'reqId'>
export type TerminalPasteFileInput = Omit<TerminalPasteFileFrame, 'reqId'>

export type TerminalCreatedFrame = Extract<TerminalServerFrame, { t: 'terminal:created' }>
export type TerminalAttachedFrame = Extract<TerminalServerFrame, { t: 'terminal:attached' }>
export type TerminalFilePastedFrame = Extract<TerminalServerFrame, { t: 'terminal:file-pasted' }>
export type TerminalRequestSuccessFrame =
  | TerminalCreatedFrame
  | TerminalAttachedFrame
  | TerminalFilePastedFrame

export type TerminalRequestKind = 'create' | 'attach' | 'paste-file'

export type TerminalRequest = {
  readonly kind: TerminalRequestKind
  readonly reqId: string
  readonly deadline: number
  readonly frame: TerminalClientFrame
}

export type TerminalRequestFailure =
  | { readonly reason: 'closed' }
  | { readonly reason: 'deadline' }
  | { readonly reason: 'server'; readonly error: TerminalPublicError }

export type TerminalRequestOutcome =
  | {
      readonly kind: 'succeeded'
      readonly request: TerminalRequest
      readonly frame: TerminalRequestSuccessFrame
    }
  | {
      readonly kind: 'failed'
      readonly request: TerminalRequest
      readonly failure: TerminalRequestFailure
    }

export type TerminalRequestRegistry = {
  readonly add: (request: TerminalRequest) => boolean
  readonly settle: (frame: TerminalServerFrame) => TerminalRequestOutcome | undefined
  readonly expire: (now: number) => readonly TerminalRequestOutcome[]
  readonly close: () => readonly TerminalRequestOutcome[]
  readonly has: (reqId: string) => boolean
}

function successKind(kind: TerminalRequestKind): TerminalRequestSuccessFrame['t'] {
  switch (kind) {
    case 'create':
      return 'terminal:created'
    case 'attach':
      return 'terminal:attached'
    case 'paste-file':
      return 'terminal:file-pasted'
  }
}

function targetForFrame(frame: TerminalClientFrame): string | undefined {
  switch (frame.t) {
    case 'terminal:create':
      return undefined
    case 'terminal:attach':
    case 'terminal:detach':
    case 'terminal:write':
    case 'terminal:resize':
    case 'terminal:kill':
    case 'terminal:paste-file':
      return frame.id
  }
}

function targetForReply(frame: TerminalRequestSuccessFrame): string | undefined {
  switch (frame.t) {
    case 'terminal:created':
      return undefined
    case 'terminal:attached':
    case 'terminal:file-pasted':
      return frame.id
  }
}

function isSuccessFrame(frame: TerminalServerFrame): frame is TerminalRequestSuccessFrame {
  return (
    frame.t === 'terminal:created' ||
    frame.t === 'terminal:attached' ||
    frame.t === 'terminal:file-pasted'
  )
}

function outcomeForFailure(
  request: TerminalRequest,
  failure: TerminalRequestFailure,
): TerminalRequestOutcome {
  return { kind: 'failed', request, failure }
}

function outcomesFor(
  requests: Iterable<TerminalRequest>,
  failure: TerminalRequestFailure,
): readonly TerminalRequestOutcome[] {
  return [...requests].map((request) => outcomeForFailure(request, failure))
}

export function createTerminalRequestRegistry(): TerminalRequestRegistry {
  const pending = new Map<string, TerminalRequest>()

  return {
    add(request) {
      if (
        request.reqId === '' ||
        request.frame.reqId !== request.reqId ||
        !Number.isFinite(request.deadline) ||
        request.deadline < 0 ||
        pending.has(request.reqId)
      ) {
        return false
      }
      pending.set(request.reqId, request)
      return true
    },

    settle(frame) {
      if (!isSuccessFrame(frame) && frame.t !== 'terminal:error') return undefined
      const reqId = frame.reqId
      const request = pending.get(reqId)
      if (!request) return undefined

      if (isSuccessFrame(frame)) {
        const expectedKind = successKind(request.kind)
        const expectedTarget = targetForFrame(request.frame)
        if (frame.t !== expectedKind || targetForReply(frame) !== expectedTarget) {
          return undefined
        }
        pending.delete(reqId)
        return { kind: 'succeeded', request, frame }
      }

      const expectedTarget = targetForFrame(request.frame)
      if (frame.id !== undefined && frame.id !== expectedTarget) return undefined
      pending.delete(reqId)
      return outcomeForFailure(request, { reason: 'server', error: frame.error })
    },

    expire(now) {
      if (!Number.isFinite(now)) return []
      const expired: TerminalRequest[] = []
      for (const request of pending.values()) {
        if (request.deadline <= now) expired.push(request)
      }
      for (const request of expired) pending.delete(request.reqId)
      return outcomesFor(expired, { reason: 'deadline' })
    },

    close() {
      const requests = [...pending.values()]
      pending.clear()
      return outcomesFor(requests, { reason: 'closed' })
    },

    has(reqId) {
      return pending.has(reqId)
    },
  }
}
