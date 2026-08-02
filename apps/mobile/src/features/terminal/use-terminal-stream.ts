import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DaemonError } from '@/lib/daemon/errors'
import { useDaemonSession } from '@/lib/daemon/session'

import { TerminalOutputBuffer } from './terminal-output-buffer'

export type TerminalAttachment = {
  generation: number
  scrollback: string
  status: 'running' | 'exited'
  exitCode?: number
  found: boolean
}

type StreamPhase = 'idle' | 'attaching' | 'attached' | 'missing' | 'error'

type StreamState = {
  phase: StreamPhase
  attachment: TerminalAttachment | null
  error: DaemonError | null
}

type CreateOptions = {
  name: string
  cwd: string
  initialInput?: string
  cols?: number
  rows?: number
}

const WRITE_CHUNK_SIZE = 8 * 1024

function streamError(procedure: string, cause: unknown): DaemonError {
  if (cause instanceof DaemonError) return cause
  return new DaemonError('unreachable', procedure, 'The daemon connection dropped.', { cause })
}

/** Owns one visible daemon PTY stream; the daemon remains the PTY owner. */
export function useTerminalStream(
  id: string | null,
  onOutput?: (data: string) => void,
): {
  readonly phase: StreamPhase
  readonly attachment: TerminalAttachment | null
  readonly error: DaemonError | null
  readonly attach: (force?: boolean) => Promise<TerminalAttachment | null>
  readonly detach: () => void
  readonly write: (data: string) => void
  readonly resize: (cols: number, rows: number) => void
  readonly kill: () => void
  readonly create: (options: CreateOptions) => Promise<string>
} {
  const session = useDaemonSession()
  const [state, setState] = useState<StreamState>({
    attachment: null,
    error: null,
    phase: 'idle',
  })
  const outputRef = useRef<((data: string) => void) | undefined>(onOutput)
  const waitingOutputRef = useRef('')
  const bufferRef = useRef<TerminalOutputBuffer | null>(null)
  const streamingRef = useRef(false)
  const attachmentRef = useRef<TerminalAttachment | null>(null)
  const requestRef = useRef<Promise<TerminalAttachment | null> | null>(null)
  const streamEpochRef = useRef(0)
  const generationRef = useRef(0)
  const lastResizeRef = useRef<{ cols: number; rows: number } | null>(null)

  useEffect(() => {
    outputRef.current = onOutput
    if (onOutput !== undefined && waitingOutputRef.current !== '') {
      const waiting = waitingOutputRef.current
      waitingOutputRef.current = ''
      onOutput(waiting)
    }
  }, [onOutput])

  useEffect(() => {
    const buffer = new TerminalOutputBuffer((data: string): void => {
      const output = outputRef.current
      if (output === undefined) waitingOutputRef.current += data
      else output(data)
    })
    bufferRef.current = buffer
    return (): void => {
      buffer.dispose()
      bufferRef.current = null
    }
  }, [])

  useEffect(() => {
    if (id === null) return
    return session.subscribe((message) => {
      if (message.t === 'terminal:data' && message.id === id && streamingRef.current) {
        bufferRef.current?.append(message.data)
        return
      }
      if (message.t === 'terminal:exit' && message.id === id) {
        const current = attachmentRef.current
        if (current === null) return
        const next: TerminalAttachment = {
          ...current,
          exitCode: message.exitCode,
          status: 'exited',
        }
        attachmentRef.current = next
        setState({ attachment: next, error: null, phase: 'attached' })
      }
    })
  }, [id, session])

  const attach = useCallback(
    (force = false): Promise<TerminalAttachment | null> => {
      if (id === null) return Promise.resolve(null)
      if (requestRef.current !== null) return requestRef.current
      if (!force && streamingRef.current && attachmentRef.current !== null) {
        return Promise.resolve(attachmentRef.current)
      }

      streamingRef.current = true
      bufferRef.current?.clear()
      waitingOutputRef.current = ''
      setState((current) => ({ ...current, error: null, phase: 'attaching' }))
      const reqId = randomUUID()
      const epoch = streamEpochRef.current
      const pending = session
        .request(
          { id, reqId, t: 'terminal:attach' },
          (message) =>
            message.t === 'terminal:attached' && message.reqId === reqId ? message : null,
          { timeoutMs: 10_000 },
        )
        .then((message): TerminalAttachment => {
          generationRef.current += 1
          const attachment: TerminalAttachment = {
            exitCode: message.exitCode,
            found: message.found,
            generation: generationRef.current,
            scrollback: message.scrollback,
            status: message.status,
          }
          if (epoch !== streamEpochRef.current) return attachment
          attachmentRef.current = message.found ? attachment : null
          streamingRef.current = message.found
          setState({
            attachment,
            error: null,
            phase: message.found ? 'attached' : 'missing',
          })
          return attachment
        })
        .catch((cause: unknown) => {
          if (epoch !== streamEpochRef.current) throw cause
          streamingRef.current = false
          attachmentRef.current = null
          const error = streamError('terminal:attach', cause)
          setState({ attachment: null, error, phase: 'error' })
          throw error
        })
      requestRef.current = pending
      pending.then(
        (): void => {
          if (requestRef.current === pending) requestRef.current = null
        },
        (): void => {
          if (requestRef.current === pending) requestRef.current = null
        },
      )
      return pending
    },
    [id, session],
  )

  useEffect(() => {
    if (id === null) return
    return session.onReconnect(() => {
      if (!streamingRef.current) return
      attach(true).catch(() => {})
    })
  }, [attach, id, session])

  const detach = useCallback((): void => {
    if (id === null) return
    streamEpochRef.current += 1
    streamingRef.current = false
    attachmentRef.current = null
    requestRef.current = null
    lastResizeRef.current = null
    bufferRef.current?.clear()
    waitingOutputRef.current = ''
    session.send({ id, t: 'terminal:detach' })
    setState({ attachment: null, error: null, phase: 'idle' })
  }, [id, session])

  const write = useCallback(
    (data: string): void => {
      if (id === null || !streamingRef.current || data === '') return
      for (let offset = 0; offset < data.length; offset += WRITE_CHUNK_SIZE) {
        session.send({
          data: data.slice(offset, offset + WRITE_CHUNK_SIZE),
          id,
          t: 'terminal:write',
        })
      }
    },
    [id, session],
  )

  const resize = useCallback(
    (cols: number, rows: number): void => {
      if (id === null || !streamingRef.current || cols <= 0 || rows <= 0) return
      const previous = lastResizeRef.current
      if (previous?.cols === cols && previous.rows === rows) return
      lastResizeRef.current = { cols, rows }
      session.send({ cols, id, rows, t: 'terminal:resize' })
    },
    [id, session],
  )

  const kill = useCallback((): void => {
    if (id === null) return
    streamEpochRef.current += 1
    streamingRef.current = false
    attachmentRef.current = null
    bufferRef.current?.clear()
    waitingOutputRef.current = ''
    session.send({ id, t: 'terminal:kill' })
  }, [id, session])

  const create = useCallback(
    (options: CreateOptions): Promise<string> => {
      const reqId = randomUUID()
      return session
        .request(
          { ...options, reqId, t: 'terminal:create' },
          (message) =>
            message.t === 'terminal:created' && message.reqId === reqId ? message : null,
          { timeoutMs: 10_000 },
        )
        .then((message) => message.id)
    },
    [session],
  )

  return useMemo(
    () => ({
      attach,
      attachment: state.attachment,
      create,
      detach,
      error: state.error,
      kill,
      phase: state.phase,
      resize,
      write,
    }),
    [attach, create, detach, kill, resize, state, write],
  )
}
