import { MAX_TERMINAL_WRITE_CODE_UNITS } from '@porcelain/contracts/terminal'
import {
  type TerminalAttachmentStatus,
  type TerminalData,
  type TerminalExit,
  type TerminalRecoveryReason,
  type TerminalStreamEffect,
  type TerminalStreamState,
  terminalRecovery,
} from './terminal-recovery'
import {
  createTerminalRequestRegistry,
  type TerminalAttachFrame,
  type TerminalCreateFrame,
  type TerminalPasteFileFrame,
  type TerminalRequest,
  type TerminalRequestOutcome,
  type TerminalRequestRegistry,
} from './terminal-requests'

type BaselineMode = 'create' | 'attach' | 'ready'

type SessionRecord = {
  readonly id: string
  status: TerminalAttachmentStatus
  epoch: string | undefined
  sequence: number | undefined
  baseline: BaselineMode
  attachRequestId: string | undefined
}

function requestTarget(request: TerminalRequest): string | undefined {
  switch (request.frame.t) {
    case 'terminal:create':
      return undefined
    case 'terminal:attach':
    case 'terminal:paste-file':
    case 'terminal:detach':
    case 'terminal:write':
    case 'terminal:resize':
    case 'terminal:kill':
      return request.frame.id
  }
}

function requestEffect(outcome: TerminalRequestOutcome): TerminalStreamEffect | undefined {
  if (outcome.kind === 'failed') {
    return {
      type: 'request-failed',
      request: outcome.request,
      failure: outcome.failure,
    }
  }
  return {
    type: 'request-succeeded',
    request: outcome.request,
    frame: outcome.frame,
  }
}

function requestRecord(
  registry: TerminalRequestRegistry,
  kind: TerminalRequest['kind'],
  frame: TerminalCreateFrame | TerminalAttachFrame | TerminalPasteFileFrame,
  requestId: string,
  deadline: number,
): TerminalRequest | undefined {
  const request: TerminalRequest = { kind, reqId: requestId, deadline, frame }
  return registry.add(request) ? request : undefined
}

function createRecord(id: string, baseline: BaselineMode): SessionRecord {
  return {
    id,
    status: baseline === 'ready' ? 'running' : 'awaiting-baseline',
    epoch: undefined,
    sequence: undefined,
    baseline,
    attachRequestId: undefined,
  }
}

export function createTerminalStreamState(): TerminalStreamState {
  const registry = createTerminalRequestRegistry()
  const sessions = new Map<string, SessionRecord>()
  const desired = new Set<string>()

  const discardPendingAttachment = (request: TerminalRequest): void => {
    if (request.kind !== 'attach') return
    const id = requestTarget(request)
    if (id === undefined) return
    const session = sessions.get(id)
    if (session?.attachRequestId !== request.reqId) return
    sessions.delete(id)
    desired.delete(id)
  }

  const applySuccess = (
    outcome: Extract<TerminalRequestOutcome, { kind: 'succeeded' }>,
  ): boolean => {
    switch (outcome.frame.t) {
      case 'terminal:created': {
        const id = outcome.frame.id
        desired.add(id)
        sessions.set(id, createRecord(id, 'create'))
        return true
      }
      case 'terminal:attached': {
        const id = outcome.frame.id
        const session = sessions.get(id)
        if (session?.attachRequestId !== outcome.request.reqId) return false
        desired.add(id)
        sessions.set(id, {
          id,
          status: outcome.frame.status,
          epoch: outcome.frame.epoch,
          sequence: outcome.frame.sequence,
          baseline: 'ready',
          attachRequestId: undefined,
        })
        return true
      }
      case 'terminal:file-pasted':
        return true
    }
  }

  const applyOutcome = (outcome: TerminalRequestOutcome): TerminalStreamEffect | undefined => {
    if (outcome.kind === 'failed') {
      discardPendingAttachment(outcome.request)
      return requestEffect(outcome)
    }
    if (!applySuccess(outcome)) return undefined
    return requestEffect(outcome)
  }

  const effectsFor = (outcomes: readonly TerminalRequestOutcome[]): TerminalStreamEffect[] => {
    const effects: TerminalStreamEffect[] = []
    for (const outcome of outcomes) {
      const effect = applyOutcome(outcome)
      if (effect) effects.push(effect)
    }
    return effects
  }

  const markRecovery = (
    session: SessionRecord,
    reason: TerminalRecoveryReason,
  ): readonly TerminalStreamEffect[] => {
    if (session.status === 'awaiting-reattach') return []
    session.status = 'awaiting-reattach'
    session.epoch = undefined
    session.sequence = undefined
    session.baseline = 'attach'
    return [
      {
        type: 'recovery-required',
        recovery: terminalRecovery(reason, [session.id]),
      },
    ]
  }

  const acceptStreamFrame = (
    frame: TerminalData | TerminalExit,
  ): readonly TerminalStreamEffect[] => {
    const session = sessions.get(frame.id)
    if (!session || !desired.has(frame.id)) return []
    if (session.status === 'awaiting-reattach') return []

    if (session.status === 'awaiting-baseline') {
      if (session.baseline !== 'create') {
        return markRecovery(session, 'sequence-gap')
      }
      session.epoch = frame.epoch
      session.sequence = frame.sequence
      session.status = frame.t === 'terminal:exit' ? 'exited' : 'running'
      session.baseline = 'ready'
      return [
        {
          type: frame.t === 'terminal:exit' ? 'exit' : 'data',
          frame,
        } as TerminalStreamEffect,
      ]
    }

    if (session.epoch !== frame.epoch || session.sequence === undefined) {
      return markRecovery(session, session.epoch === frame.epoch ? 'sequence-gap' : 'epoch-changed')
    }
    if (frame.sequence <= session.sequence) return []
    if (frame.sequence !== session.sequence + 1) {
      return markRecovery(session, 'sequence-gap')
    }

    session.sequence = frame.sequence
    if (frame.t === 'terminal:exit') session.status = 'exited'
    return [
      {
        type: frame.t === 'terminal:exit' ? 'exit' : 'data',
        frame,
      } as TerminalStreamEffect,
    ]
  }

  const markDesiredForReconnect = (): void => {
    for (const id of desired) {
      const session = sessions.get(id)
      if (!session) continue
      session.status = 'awaiting-reattach'
      session.epoch = undefined
      session.sequence = undefined
      session.baseline = 'attach'
      session.attachRequestId = undefined
    }
  }

  const requestPaste = (
    kind: 'paste-file',
    frame: TerminalPasteFileFrame,
    requestId: string,
    deadline: number,
  ): TerminalRequest | undefined => {
    const session = sessions.get(frame.id)
    if (!session || !desired.has(frame.id) || session.status !== 'running') return undefined
    return requestRecord(registry, kind, frame, requestId, deadline)
  }

  return {
    requestCreate(input, requestId, deadline) {
      return requestRecord(registry, 'create', { ...input, reqId: requestId }, requestId, deadline)
    },

    requestAttach(id, requestId, deadline) {
      if (id === '') return undefined
      const existing = sessions.get(id)
      if (
        existing &&
        (existing.baseline === 'create' ||
          existing.status === 'running' ||
          existing.status === 'exited' ||
          (existing.status === 'awaiting-baseline' && existing.attachRequestId !== undefined))
      ) {
        return undefined
      }
      const session = existing ?? createRecord(id, 'attach')
      session.baseline = 'attach'
      session.status =
        existing?.status === 'awaiting-reattach' ? 'awaiting-reattach' : 'awaiting-baseline'
      session.attachRequestId = requestId
      desired.add(id)
      sessions.set(id, session)
      const request = requestRecord(
        registry,
        'attach',
        { t: 'terminal:attach', id, reqId: requestId },
        requestId,
        deadline,
      )
      if (request) return request
      if (existing === undefined) {
        sessions.delete(id)
        desired.delete(id)
      } else {
        session.attachRequestId = undefined
      }
      return undefined
    },

    requestPasteFile(input, requestId, deadline) {
      return requestPaste('paste-file', { ...input, reqId: requestId }, requestId, deadline)
    },

    attach(id) {
      if (id === '' || sessions.has(id)) return false
      desired.add(id)
      sessions.set(id, createRecord(id, 'attach'))
      return true
    },

    detach(id, requestId) {
      const session = sessions.get(id)
      if (id === '' || requestId === '' || !session || !desired.has(id)) return undefined
      sessions.delete(id)
      desired.delete(id)
      return { t: 'terminal:detach', id, reqId: requestId }
    },

    write(id, data, requestId) {
      const session = sessions.get(id)
      if (
        id === '' ||
        requestId === '' ||
        data === '' ||
        data.length > MAX_TERMINAL_WRITE_CODE_UNITS ||
        !session ||
        !desired.has(id) ||
        session.status !== 'running'
      ) {
        return undefined
      }
      return { t: 'terminal:write', id, data, reqId: requestId }
    },

    resize(id, cols, rows, requestId) {
      const session = sessions.get(id)
      if (
        id === '' ||
        requestId === '' ||
        !Number.isInteger(cols) ||
        !Number.isInteger(rows) ||
        cols <= 0 ||
        rows <= 0 ||
        !session ||
        !desired.has(id) ||
        session.status !== 'running'
      ) {
        return undefined
      }
      return { t: 'terminal:resize', id, cols, rows, reqId: requestId }
    },

    kill(id, requestId) {
      const session = sessions.get(id)
      if (
        id === '' ||
        requestId === '' ||
        !session ||
        !desired.has(id) ||
        (session.status !== 'running' && session.status !== 'exited')
      ) {
        return undefined
      }
      sessions.delete(id)
      desired.delete(id)
      return { t: 'terminal:kill', id, reqId: requestId }
    },

    receive(frame) {
      const outcome = registry.settle(frame)
      if (outcome) {
        const effect = applyOutcome(outcome)
        return effect ? [effect] : []
      }
      if (frame.t === 'terminal:data' || frame.t === 'terminal:exit') {
        return acceptStreamFrame(frame)
      }
      return []
    },

    expire(now) {
      return effectsFor(registry.expire(now))
    },

    close() {
      const effects = effectsFor(registry.close())
      markDesiredForReconnect()
      return effects
    },

    reconnect() {
      const effects = effectsFor(registry.close())
      markDesiredForReconnect()
      effects.push({
        type: 'recovery-required',
        recovery: terminalRecovery('reconnect', desired),
      })
      return effects
    },

    state(id) {
      const session = sessions.get(id)
      if (!session || !desired.has(id)) return undefined
      return {
        id: session.id,
        status: session.status,
        epoch: session.epoch,
        sequence: session.sequence,
      }
    },

    desiredAttachments() {
      return [...desired].sort()
    },
  }
}
