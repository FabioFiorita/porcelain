import { type IPty, spawn as nodePtySpawn } from 'node-pty'
import type { PtyPort, PtyProcess, TerminalEnvironmentPort } from './terminal-ports'

type PtySpawn = typeof nodePtySpawn

export function createPtyAdapter(options: {
  environment: TerminalEnvironmentPort
  spawn?: PtySpawn
}): PtyPort {
  const spawn = options.spawn ?? nodePtySpawn
  return Object.freeze({
    spawn(input): PtyProcess {
      const pty: IPty = spawn(options.environment.shell, ['-l'], {
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
