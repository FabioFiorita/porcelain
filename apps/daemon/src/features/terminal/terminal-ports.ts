import type {
  DevServer,
  DevServersInput,
  StartDevServerInput,
  TerminalInfo,
  TerminalServerFrame,
  TerminalStatus,
} from '@porcelain/contracts/terminal'

export type PtyProcess = Readonly<{
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
  onData(listener: (data: string) => void): void
  onExit(listener: (exitCode: number) => void): void
}>

export type PtyPort = Readonly<{
  spawn(input: { cwd: string; cols: number; rows: number }): PtyProcess
}>

export type TerminalEnvironmentPort = Readonly<{
  shell: string
  environment: Readonly<Record<string, string>>
}>

export type TerminalPastePort = Readonly<{
  save(input: {
    id: string
    filename: string
    dataBase64: string
    maxBytes: number
  }): Promise<
    | { ok: true; value: { path: string } }
    | { ok: false; error: { code: 'terminal.paste-unavailable' } }
  >
  sweep(now: number): Promise<void>
}>

export type TerminalClock = Readonly<{
  now(): number
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  clearTimeout(timeout: ReturnType<typeof setTimeout>): void
  setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval>
}>

export type TerminalIds = Readonly<{
  create(): string
  epoch(): string
}>

export type TerminalStreamSink = Readonly<{
  isAlive(): boolean
  send(frame: TerminalServerFrame): void
}>

/** What a PTY frame can fail with. The stream's error frame carries exactly these. */
export type TerminalStreamFailure =
  | { readonly code: 'terminal.not-found' }
  | { readonly code: 'terminal.exited' }
  | { readonly code: 'terminal.capacity' }
  | { readonly code: 'terminal.invalid-size' }
  | { readonly code: 'terminal.paste-unavailable' }

/**
 * What a development-server command can fail with: its own record failures plus whatever
 * spawning the underlying session can fail with, since `start` forwards that verbatim.
 */
export type DevServerFailure =
  | TerminalStreamFailure
  | { readonly code: 'terminal.dev-server-not-found' }
  | { readonly code: 'terminal.dev-server-target' }
  | { readonly code: 'terminal.dev-server-running' }

export type TerminalFailure = DevServerFailure

export type TerminalResult<Value, Failure = TerminalFailure> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: Failure }

export type TerminalCreateInput = Readonly<{
  name: string
  cwd: string
  initialInput?: string
  cols?: number
  rows?: number
}>

export type TerminalAttachValue = Readonly<{
  id: string
  scrollback: string
  status: TerminalStatus
  exitCode?: number
  epoch: string
  sequence: number
}>

export type TerminalPasteSuccess = Readonly<{
  result: 'ok'
  path?: string
}>

/**
 * How a daemon-side owner watches the session it spawned. A development-server record uses
 * it to learn when its command actually reached the shell, what the process printed (URL
 * detection), and that it ended — without pretending to be a client sink.
 */
export type TerminalSessionObserver = Readonly<{
  onCommandSent(): void
  onData(data: string): void
  onExit(exitCode: number): void
}>

/**
 * The narrow slice of session machinery a development server needs: spawn something nothing
 * may reap, and end it on request. Deliberately not the whole TerminalOperations surface —
 * a server record has no business writing to, resizing, or renaming its own PTY.
 */
export type DevServerHost = Readonly<{
  createRetained(
    input: TerminalCreateInput,
    observer: TerminalSessionObserver,
  ): TerminalResult<string, TerminalStreamFailure>
  kill(id: string): TerminalResult<void, TerminalStreamFailure>
}>

export type DevServerOperations = Readonly<{
  list(input: DevServersInput): DevServer[]
  start(input: StartDevServerInput): TerminalResult<DevServer, DevServerFailure>
  stop(id: string): TerminalResult<DevServer, DevServerFailure>
  dismiss(id: string): TerminalResult<void, DevServerFailure>
}>

export type TerminalOperations = Readonly<{
  create(
    input: TerminalCreateInput,
    sink: TerminalStreamSink,
  ): TerminalResult<string, TerminalStreamFailure>
  createRetained(
    input: TerminalCreateInput,
    observer: TerminalSessionObserver,
  ): TerminalResult<string, TerminalStreamFailure>
  devServers: DevServerOperations
  attach(
    id: string,
    sink: TerminalStreamSink,
  ): TerminalResult<TerminalAttachValue, TerminalStreamFailure>
  detach(id: string, sink: TerminalStreamSink): TerminalResult<void, TerminalStreamFailure>
  write(id: string, data: string): TerminalResult<void, TerminalStreamFailure>
  resize(id: string, cols: number, rows: number): TerminalResult<void, TerminalStreamFailure>
  kill(id: string): TerminalResult<void, TerminalStreamFailure>
  pasteImage(input: {
    id: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess, TerminalStreamFailure>>
  pasteFile(input: {
    id: string
    filename: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess, TerminalStreamFailure>>
  list(): TerminalInfo[]
  rename(id: string, name: string): void
  detachSink(sink: TerminalStreamSink): void
  sweep(now?: number): void
}>
