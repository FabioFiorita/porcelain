const runningSession = {
  id: 'terminal-1',
  name: 'dev server',
  cwd: '/synthetic/repo',
  status: 'running',
  createdAt: 10,
} as const

const exitedSession = {
  id: 'terminal-2',
  name: 'checks',
  cwd: '/synthetic/repo/apps',
  status: 'exited',
  exitCode: 1,
  createdAt: 20,
} as const

/** Representative Terminal wire values used by boundary tests and client mocks. */
export const terminalContractFixtures = {
  terminalSessions: {
    input: undefined,
    output: [runningSession, exitedSession],
  },
  renameTerminal: {
    input: { id: 'terminal-1', name: 'server' },
    output: undefined,
  },
} as const
