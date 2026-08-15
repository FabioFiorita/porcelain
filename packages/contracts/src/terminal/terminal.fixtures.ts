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

const devServerTarget = {
  projectId: 'project-1',
  worktreeId: 'worktree-1',
  path: '/synthetic/repo',
} as const

const runningDevServer = {
  id: 'dev-server-1',
  target: devServerTarget,
  label: 'web',
  command: 'pnpm dev',
  cwd: '/synthetic/repo',
  status: 'running',
  detectedUrl: 'http://127.0.0.1:5173/',
  terminalId: 'terminal-1',
  createdAt: 10,
  startedAt: 10,
} as const

const exitedDevServer = {
  id: 'dev-server-2',
  target: devServerTarget,
  label: 'api',
  command: 'pnpm api',
  cwd: '/synthetic/repo',
  status: 'exited',
  exitCode: 1,
  terminalId: 'terminal-2',
  createdAt: 20,
  startedAt: 20,
  endedAt: 30,
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
  devServers: {
    input: { target: devServerTarget },
    output: [runningDevServer, exitedDevServer],
  },
  startDevServer: {
    input: { target: devServerTarget, label: 'web', command: 'pnpm dev' },
    output: runningDevServer,
  },
  stopDevServer: {
    input: { id: 'dev-server-1' },
    output: { ...runningDevServer, status: 'stopped', endedAt: 40 },
  },
  dismissDevServer: {
    input: { id: 'dev-server-2' },
    output: undefined,
  },
} as const
