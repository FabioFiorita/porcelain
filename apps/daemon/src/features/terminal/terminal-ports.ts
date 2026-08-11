import type {
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

export type TerminalFailure =
  | { readonly code: 'terminal.not-found' }
  | { readonly code: 'terminal.exited' }
  | { readonly code: 'terminal.capacity' }
  | { readonly code: 'terminal.invalid-size' }
  | { readonly code: 'terminal.paste-unavailable' }

export type TerminalResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: TerminalFailure }

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

export type TerminalOperations = Readonly<{
  create(input: TerminalCreateInput, sink: TerminalStreamSink): TerminalResult<string>
  attach(id: string, sink: TerminalStreamSink): TerminalResult<TerminalAttachValue>
  detach(id: string, sink: TerminalStreamSink): TerminalResult<void>
  write(id: string, data: string): TerminalResult<void>
  resize(id: string, cols: number, rows: number): TerminalResult<void>
  kill(id: string): TerminalResult<void>
  pasteImage(input: {
    id: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess>>
  pasteFile(input: {
    id: string
    filename: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess>>
  list(): TerminalInfo[]
  rename(id: string, name: string): void
  detachSink(sink: TerminalStreamSink): void
  sweep(now?: number): void
}>
