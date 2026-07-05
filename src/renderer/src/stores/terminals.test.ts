import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type TerminalSession, useTerminalsStore } from './terminals'

// The store writes renames through the vanilla tRPC client (daemon owns the
// roster). Unmocked, each rename fires a REAL fetch at jsdom's localhost:3000
// origin whose rejection can escape test teardown as a vitest unhandled error
// (it did, intermittently, under load — a flaky gate). No store test may touch
// the network. (lib/daemon needs no mock here: only `rename` is exercised, and
// its WS session is lazy — add a mock if a test ever drives create/close/reset.)
vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: { renameTerminal: { mutate: vi.fn().mockResolvedValue(undefined) } },
}))

const session = (id: string, name: string): TerminalSession => ({ id, name, status: 'running' })

const seed = (...sessions: TerminalSession[]): void => useTerminalsStore.setState({ sessions })

const sessions = () => useTerminalsStore.getState().sessions

describe('useTerminalsStore.rename', () => {
  beforeEach(() => seed())

  it('renames a session by id', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'))
    useTerminalsStore.getState().rename('t1', 'dev server')
    expect(sessions().map((s) => s.name)).toEqual(['dev server', 'bash'])
  })

  it('trims the new name', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('t1', '  build  ')
    expect(sessions()[0]?.name).toBe('build')
  })

  it('ignores an empty (or whitespace-only) name', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('t1', '   ')
    expect(sessions()[0]?.name).toBe('zsh')
  })

  it('is a no-op for an unknown id', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('nope', 'other')
    expect(sessions()).toEqual([session('t1', 'zsh')])
  })
})
