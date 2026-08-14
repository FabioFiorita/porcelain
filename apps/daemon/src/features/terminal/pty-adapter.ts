import { spawn as nodePtySpawn } from 'node-pty'
import type { PtyPort, PtyProcess, TerminalEnvironmentPort } from './terminal-ports'

/**
 * The slice of a spawned pty this adapter actually uses.
 *
 * Declared here rather than imported as node-pty's `IPty`, which carries pid/cols/rows/process
 * and four more members this file never touches. Depending on the whole interface forced every
 * unit test to fake all of it or reach for a double-cast; the real `spawn` still satisfies this.
 * Listener registration returns `unknown` because node-pty hands back a disposable and a fake
 * has no reason to.
 */
type SpawnedPty = {
  write: (data: string) => void
  resize: (columns: number, rows: number) => void
  kill: () => void
  onData: (listener: (data: string) => void) => unknown
  onExit: (listener: (event: { exitCode: number }) => void) => unknown
}

type PtySpawn = (
  file: string,
  args: string[],
  options: Parameters<typeof nodePtySpawn>[2],
) => SpawnedPty

export function createPtyAdapter(options: {
  environment: TerminalEnvironmentPort
  spawn?: PtySpawn
}): PtyPort {
  const spawn = options.spawn ?? nodePtySpawn
  return Object.freeze({
    spawn(input): PtyProcess {
      const pty: SpawnedPty = spawn(options.environment.shell, ['-l'], {
        name: 'xterm-256color',
        cols: input.cols,
        rows: input.rows,
        cwd: input.cwd,
        env: { ...options.environment.environment },
      })
      return {
        write: (data) => pty.write(data),
        resize: (cols, rows) => pty.resize(cols, rows),
        kill: () => pty.kill(),
        onData: (listener) => {
          pty.onData(listener)
        },
        onExit: (listener) => {
          pty.onExit(({ exitCode }) => listener(exitCode))
        },
      }
    },
  })
}
