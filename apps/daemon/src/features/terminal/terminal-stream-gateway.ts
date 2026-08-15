import type { TerminalClientFrame, TerminalServerFrame } from '@porcelain/contracts/terminal'
import { settleBackground } from '@porcelain/shared/background'
import { publicErrorFor } from '../../daemon-composition/public-error'
import { createRequestId } from '../../daemon-composition/request-id'
import type { TerminalFailure, TerminalOperations, TerminalStreamSink } from './terminal-ports'

/**
 * The failures a PTY frame can actually produce. Development-server failures answer tRPC
 * calls, never this stream, so they are excluded here rather than widening the error frame.
 */
type TerminalStreamFailure = Exclude<TerminalFailure, { code: `terminal.dev-server-${string}` }>

export type TerminalStreamGateway = Readonly<{
  receive(frame: TerminalClientFrame): void
  detach(): void
}>

function sendFailure(
  sink: TerminalStreamSink,
  reqId: string,
  failure: TerminalStreamFailure,
  id?: string,
): void {
  const error = publicErrorFor(failure.code, createRequestId())
  const frame: TerminalServerFrame = {
    t: 'terminal:error',
    reqId,
    ...(id === undefined ? {} : { id }),
    error,
  }
  sink.send(frame)
}

export function createTerminalStreamGateway(options: {
  operations: TerminalOperations
  sink: TerminalStreamSink
}): TerminalStreamGateway {
  const { operations, sink } = options

  function receive(frame: TerminalClientFrame): void {
    switch (frame.t) {
      case 'terminal:create': {
        const result = operations.create(frame, sink)
        if (result.ok) {
          sink.send({ t: 'terminal:created', reqId: frame.reqId, id: result.value })
        } else {
          sendFailure(sink, frame.reqId, result.error)
        }
        return
      }
      case 'terminal:attach': {
        const result = operations.attach(frame.id, sink)
        if (result.ok) {
          sink.send({ t: 'terminal:attached', reqId: frame.reqId, ...result.value })
        } else {
          sendFailure(sink, frame.reqId, result.error, frame.id)
        }
        return
      }
      case 'terminal:detach': {
        const result = operations.detach(frame.id, sink)
        if (!result.ok) sendFailure(sink, frame.reqId, result.error, frame.id)
        return
      }
      case 'terminal:write': {
        const result = operations.write(frame.id, frame.data)
        if (!result.ok) sendFailure(sink, frame.reqId, result.error, frame.id)
        return
      }
      case 'terminal:resize': {
        const result = operations.resize(frame.id, frame.cols, frame.rows)
        if (!result.ok) sendFailure(sink, frame.reqId, result.error, frame.id)
        return
      }
      case 'terminal:kill': {
        const result = operations.kill(frame.id)
        if (!result.ok) sendFailure(sink, frame.reqId, result.error, frame.id)
        return
      }
      case 'terminal:paste-image': {
        settleBackground(handlePasteImage(frame), 'fallback')
        return
      }
      case 'terminal:paste-file': {
        settleBackground(handlePasteFile(frame), 'fallback')
        return
      }
    }
  }

  async function handlePasteImage(
    frame: Extract<TerminalClientFrame, { t: 'terminal:paste-image' }>,
  ): Promise<void> {
    const result = await operations.pasteImage(frame)
    if (result.ok) {
      sink.send({ t: 'terminal:image-pasted', reqId: frame.reqId, id: frame.id, ...result.value })
    } else {
      sendFailure(sink, frame.reqId, result.error, frame.id)
    }
  }

  async function handlePasteFile(
    frame: Extract<TerminalClientFrame, { t: 'terminal:paste-file' }>,
  ): Promise<void> {
    const result = await operations.pasteFile(frame)
    if (result.ok) {
      sink.send({ t: 'terminal:file-pasted', reqId: frame.reqId, id: frame.id, ...result.value })
    } else {
      sendFailure(sink, frame.reqId, result.error, frame.id)
    }
  }

  return Object.freeze({
    receive,
    detach: () => operations.detachSink(sink),
  })
}
