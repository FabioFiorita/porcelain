import { randomUUID } from 'node:crypto'
import type { SessionChange } from '@porcelain/contracts/session'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { settleBackground } from '@porcelain/shared/background'
import { createDevServerOperations } from './dev-server-operations'
import { createTerminalPasteOperations } from './terminal-paste-operations'
import type {
  PtyPort,
  TerminalAttachValue,
  TerminalClock,
  TerminalCreateInput,
  TerminalIds,
  TerminalOperations,
  TerminalPastePort,
  TerminalResult,
  TerminalSessionObserver,
  TerminalStreamFailure,
  TerminalStreamSink,
} from './terminal-ports'
import { ScrollbackBuffer } from './terminal-scrollback'

export const EXITED_RETENTION_MS = 10 * 60_000
export const DETACHED_IDLE_MS = 12 * 60 * 60_000
export const MAX_SESSIONS = 64
export const QUIET_AFTER_PROMPT_MS = 300
export const QUIET_AFTER_NEWLINE_MS = 2_000
const SCROLLBACK_BYTES = 64 * 1024
const SWEEP_INTERVAL_MS = 60_000

function initialInputQuietDelay(chunk: string): number {
  return chunk.endsWith('\n') ? QUIET_AFTER_NEWLINE_MS : QUIET_AFTER_PROMPT_MS
}

/**
 * The shell submits what we send it, and the daemon adds the submitting `\r` itself. A caller
 * that also ended its command with a newline therefore submitted TWICE: the command ran, and the
 * bare second return drew one more empty prompt above whatever the command painted — the stray
 * `❯` row over tmux. Trailing newlines are stripped here, at the one place that appends the
 * return, so no client literal can reintroduce it. Interior newlines are untouched: a lifecycle
 * script list is several commands on purpose.
 */
export function submittableInitialInput(command: string): string {
  return command.replace(/[\r\n]+$/, '')
}

type Session = {
  id: string
  pty: ReturnType<PtyPort['spawn']>
  name: string
  cwd: string
  createdAt: number
  status: 'running' | 'exited'
  exitCode?: number
  exitedAt?: number
  detachedSince?: number
  scrollback: ScrollbackBuffer
  attached: Set<TerminalStreamSink>
  epoch: string
  sequence: number
  initialTimer?: ReturnType<typeof setTimeout>
  sendInitialInput: (() => void) | null
  /**
   * A retained session is owned by a daemon record (today: a development server), not by
   * whoever is watching it. None of the three lifecycle bounds may reap it — that is the
   * whole point of the record — so its owner is the only thing that can end it.
   */
  retained: boolean
  observer?: TerminalSessionObserver
}

type CreateTerminalOperationsOptions = Readonly<{
  pty: PtyPort
  paste: TerminalPastePort
  clock?: TerminalClock
  ids?: TerminalIds
  /** Session-channel publisher for development-server roster freshness; absent = no clients. */
  publishChange?: (change: SessionChange) => void
}>

function defaultClock(): TerminalClock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeout) => clearTimeout(timeout),
    setInterval: (callback, delay) => setInterval(callback, delay),
  }
}

function defaultIds(): TerminalIds {
  return { create: randomUUID, epoch: randomUUID }
}

function failure(
  code: TerminalStreamFailure['code'],
): TerminalResult<never, TerminalStreamFailure> {
  return { ok: false, error: { code } }
}

export function createTerminalOperations(
  options: CreateTerminalOperationsOptions,
): TerminalOperations {
  const clock = options.clock ?? defaultClock()
  const ids = options.ids ?? defaultIds()
  const { paste: pasteStore, pty } = options
  const epoch = ids.epoch()
  const sessions = new Map<string, Session>()
  let sweepTimer: ReturnType<typeof setInterval> | undefined

  function markDetachedIfEmpty(session: Session, now = clock.now()): void {
    if (session.attached.size === 0) session.detachedSince ??= now
  }

  function clearInitialInput(session: Session): void {
    if (session.initialTimer !== undefined) clock.clearTimeout(session.initialTimer)
    session.initialTimer = undefined
    session.sendInitialInput = null
  }

  function evict(id: string, session: Session): void {
    sessions.delete(id)
    clearInitialInput(session)
    if (session.status === 'running') session.pty.kill()
  }

  function oldestFirst(match: (session: Session) => boolean): Array<[string, Session]> {
    return [...sessions]
      .filter(([, session]) => match(session))
      .sort(([, first], [, second]) => first.createdAt - second.createdAt)
  }

  function sweep(now = clock.now()): void {
    for (const [id, session] of sessions) {
      // A development server you return to next week must still be there, and its final
      // output must still explain why it died. Its record owns that lifetime, not the sweep.
      if (session.retained) continue
      if (session.attached.size > 0) continue
      if (session.status === 'exited') {
        if (session.exitedAt !== undefined && now - session.exitedAt > EXITED_RETENTION_MS) {
          sessions.delete(id)
        }
        continue
      }
      if (session.detachedSince !== undefined && now - session.detachedSince > DETACHED_IDLE_MS) {
        evict(id, session)
      }
    }
    settleBackground(pasteStore.sweep(now), 'watcher')
  }

  function startSweeping(): void {
    if (sweepTimer !== undefined) return
    sweepTimer = clock.setInterval(() => sweep(), SWEEP_INTERVAL_MS)
    sweepTimer.unref()
  }

  function makeRoom(now: number): TerminalResult<void, TerminalStreamFailure> {
    if (sessions.size < MAX_SESSIONS) return { ok: true, value: undefined }
    sweep(now)
    for (const [id] of oldestFirst(
      (session) => !session.retained && session.status === 'exited' && session.attached.size === 0,
    )) {
      if (sessions.size < MAX_SESSIONS) break
      sessions.delete(id)
    }
    const [oldestIdle] = oldestFirst(
      (session) => !session.retained && session.status === 'running' && session.attached.size === 0,
    )
    if (sessions.size >= MAX_SESSIONS && oldestIdle !== undefined) {
      evict(oldestIdle[0], oldestIdle[1])
    }
    return sessions.size < MAX_SESSIONS
      ? { ok: true, value: undefined }
      : failure('terminal.capacity')
  }

  function fanOut(
    session: Session,
    frame: (id: string) => Parameters<TerminalStreamSink['send']>[0],
  ): void {
    for (const sink of session.attached) {
      if (!sink.isAlive()) {
        session.attached.delete(sink)
        continue
      }
      sink.send(frame(session.id))
    }
    markDetachedIfEmpty(session)
  }

  function spawnSession(
    input: TerminalCreateInput,
    owner: { sink?: TerminalStreamSink; retained?: boolean; observer?: TerminalSessionObserver },
  ): TerminalResult<string, TerminalStreamFailure> {
    const cols = input.cols ?? 80
    const rows = input.rows ?? 24
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
      return failure('terminal.invalid-size')
    }
    const room = makeRoom(clock.now())
    if (!room.ok) return room
    startSweeping()
    const id = ids.create()
    const process = pty.spawn({ cwd: input.cwd, cols, rows })
    const session: Session = {
      id,
      pty: process,
      name: input.name,
      cwd: input.cwd,
      createdAt: clock.now(),
      status: 'running',
      scrollback: new ScrollbackBuffer(SCROLLBACK_BYTES),
      attached: new Set(owner.sink === undefined ? [] : [owner.sink]),
      epoch,
      sequence: 0,
      sendInitialInput: null,
      retained: owner.retained === true,
      observer: owner.observer,
    }
    sessions.set(id, session)
    markDetachedIfEmpty(session)

    const initialInput =
      input.initialInput === undefined ? '' : submittableInitialInput(input.initialInput)
    if (initialInput !== '') {
      const command = initialInput
      session.sendInitialInput = () => {
        clearInitialInput(session)
        if (!sessions.has(id)) return
        process.write(`${command}\r`)
        session.observer?.onCommandSent()
      }
      session.initialTimer = clock.setTimeout(
        () => session.sendInitialInput?.(),
        QUIET_AFTER_NEWLINE_MS,
      )
    }

    process.onData((data) => {
      if (session.sendInitialInput !== null) {
        if (session.initialTimer !== undefined) clock.clearTimeout(session.initialTimer)
        session.initialTimer = clock.setTimeout(
          () => session.sendInitialInput?.(),
          initialInputQuietDelay(data),
        )
      }
      session.scrollback.append(data)
      session.sequence += 1
      fanOut(session, (terminalId) => ({
        t: 'terminal:data',
        id: terminalId,
        data,
        epoch: session.epoch,
        sequence: session.sequence,
      }))
      session.observer?.onData(data)
    })
    process.onExit((exitCode) => {
      clearInitialInput(session)
      // Evicted sessions (kill, sweep) are already out of the roster, but attached
      // sinks still need the exit frame so every client sees the session end.
      if (session.status === 'exited') return
      session.status = 'exited'
      session.exitCode = exitCode
      session.exitedAt = clock.now()
      session.sequence += 1
      fanOut(session, () => ({
        t: 'terminal:exit',
        id,
        exitCode,
        epoch: session.epoch,
        sequence: session.sequence,
      }))
      session.observer?.onExit(exitCode)
    })
    return { ok: true, value: id }
  }

  function create(
    input: TerminalCreateInput,
    sink: TerminalStreamSink,
  ): TerminalResult<string, TerminalStreamFailure> {
    return spawnSession(input, { sink })
  }

  /**
   * Spawn a session nobody is watching yet. The caller (a development-server record) owns its
   * lifetime and receives output through `observer`; a human attaches to the same session
   * later through the ordinary Terminal path and sees the scrollback replayed.
   */
  function createRetained(
    input: TerminalCreateInput,
    observer: TerminalSessionObserver,
  ): TerminalResult<string, TerminalStreamFailure> {
    return spawnSession(input, { retained: true, observer })
  }

  function attach(
    id: string,
    sink: TerminalStreamSink,
  ): TerminalResult<TerminalAttachValue, TerminalStreamFailure> {
    const session = sessions.get(id)
    if (session === undefined) return failure('terminal.not-found')
    session.attached.add(sink)
    session.detachedSince = undefined
    return {
      ok: true,
      value: {
        id,
        scrollback: session.scrollback.snapshot(),
        status: session.status,
        exitCode: session.exitCode,
        epoch: session.epoch,
        sequence: session.sequence,
      },
    }
  }

  function detach(
    id: string,
    sink: TerminalStreamSink,
  ): TerminalResult<void, TerminalStreamFailure> {
    const session = sessions.get(id)
    if (session === undefined) return failure('terminal.not-found')
    session.attached.delete(sink)
    markDetachedIfEmpty(session)
    return { ok: true, value: undefined }
  }

  function write(id: string, data: string): TerminalResult<void, TerminalStreamFailure> {
    const session = sessions.get(id)
    if (session === undefined) return failure('terminal.not-found')
    if (session.status === 'exited') return failure('terminal.exited')
    session.pty.write(data)
    return { ok: true, value: undefined }
  }

  function resize(
    id: string,
    cols: number,
    rows: number,
  ): TerminalResult<void, TerminalStreamFailure> {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
      return failure('terminal.invalid-size')
    }
    const session = sessions.get(id)
    if (session === undefined) return failure('terminal.not-found')
    if (session.status === 'exited') return failure('terminal.exited')
    session.pty.resize(cols, rows)
    return { ok: true, value: undefined }
  }

  function kill(id: string): TerminalResult<void, TerminalStreamFailure> {
    const session = sessions.get(id)
    if (session === undefined) return failure('terminal.not-found')
    evict(id, session)
    return { ok: true, value: undefined }
  }

  function list(): TerminalInfo[] {
    return [...sessions.values()].map((session) => ({
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: session.status,
      exitCode: session.exitCode,
      createdAt: session.createdAt,
    }))
  }

  function rename(id: string, name: string): void {
    const trimmed = name.trim()
    if (trimmed === '') return
    const session = sessions.get(id)
    if (session !== undefined) session.name = trimmed
  }

  function detachSink(sink: TerminalStreamSink): void {
    for (const session of sessions.values()) {
      session.attached.delete(sink)
      markDetachedIfEmpty(session)
    }
  }

  const { pasteFile } = createTerminalPasteOperations({
    store: pasteStore,
    session: (id) => {
      const session = sessions.get(id)
      if (session === undefined) return undefined
      return { status: session.status, write: (data) => session.pty.write(data) }
    },
  })

  const devServers = createDevServerOperations({
    host: { createRetained, kill },
    publish: options.publishChange ?? (() => {}),
    clock,
    ids: { create: ids.create },
  })

  return Object.freeze({
    create,
    createRetained,
    devServers,
    attach,
    detach,
    write,
    resize,
    kill,
    pasteFile,
    list,
    rename,
    detachSink,
    sweep,
  })
}
