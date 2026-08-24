import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  followTerminal,
  nextTerminalNumber,
  revealTerminal,
  spawnTerminal,
} from './terminal-actions'

describe('nextTerminalNumber', () => {
  it('starts at 1 with an empty roster', () => {
    expect(nextTerminalNumber([], 0)).toBe(1)
  })

  it('goes one past the highest existing "Terminal N"', () => {
    expect(nextTerminalNumber(['Terminal 1', 'Terminal 2'], 0)).toBe(3)
  })

  it('does not reuse a closed terminal’s number while a higher one lives', () => {
    // Terminal 1 was closed; naive row-counting would mint a duplicate "Terminal 2".
    expect(nextTerminalNumber(['Terminal 2'], 0)).toBe(3)
  })

  it('counts renamed (non-numbered) sessions via the roster size', () => {
    expect(nextTerminalNumber(['dev server'], 0)).toBe(2)
  })

  it('never dips below the monotonic floor when the roster is transiently clobbered', () => {
    // A stale terminalSessions snapshot can hydrate the roster to [] right before a
    // spawn (stores/terminals.ts); the floor keeps issued numbers from repeating.
    expect(nextTerminalNumber([], 2)).toBe(3)
  })
})

describe('reveal', () => {
  beforeEach(() => {
    useTerminalsStore.setState({ sessions: [], panelOpen: false, panelSessionId: null })
  })

  it('opens the bottom panel on the session for a shell the human asked for', () => {
    useTerminalsStore.setState({
      sessions: [
        {
          id: 't-1',
          name: 'Terminal 1',
          cwd: '/repo',
          createdAt: 0,
          status: 'running',
          origin: 'primary',
        },
      ],
    })
    revealTerminal('t-1')

    const state = useTerminalsStore.getState()
    expect(state.panelOpen).toBe(true)
    expect(state.panelSessionId).toBe('t-1')
  })

  it('keeps the Viewer where it is for a shell the daemon started on its own', () => {
    useTerminalsStore.setState({
      panelOpen: false,
      sessions: [
        {
          id: 't-2',
          name: 'setup',
          cwd: '/repo',
          createdAt: 0,
          status: 'running',
          origin: 'primary',
        },
      ],
    })
    followTerminal('t-2')

    // A Worktree setup script must not slide the panel over what is being read; the
    // tab points at this session for whenever the panel is next opened.
    const state = useTerminalsStore.getState()
    expect(state.panelOpen).toBe(false)
    expect(state.panelSessionId).toBe('t-2')
  })
})

describe('spawnTerminal', () => {
  const create = vi.fn(async (opts: { cwd: string; name: string }) => {
    useTerminalsStore.setState((state) => ({
      sessions: [
        ...state.sessions,
        {
          id: 'spawned',
          name: opts.name,
          cwd: opts.cwd,
          createdAt: 0,
          status: 'running' as const,
          origin: 'primary' as const,
        },
      ],
      panelOpen: true,
      panelSessionId: 'spawned',
    }))
    return 'spawned'
  })
  const originalCreate = useTerminalsStore.getState().create

  beforeEach(() => {
    create.mockClear()
    useTerminalsStore.setState({
      sessions: [],
      panelOpen: false,
      panelSessionId: null,
      create,
    })
    useHubSelectionStore.getState().selectHome()
    useProjectSelectionStore.setState({ project: null })
    setPrimaryEnvironmentId('env-local')
  })

  afterEach(() => {
    useTerminalsStore.setState({ create: originalCreate })
  })

  it('spawns in the selected Worktree, not a stale project path', async () => {
    useProjectSelectionStore.setState({
      project: { path: '/stale/primary', name: 'primary' },
    })
    useHubSelectionStore.getState().selectWorktree({
      environmentId: 'env-local',
      projectId: 'proj',
      worktreeId: 'wt-feature',
      path: '/repo/worktrees/feature',
      name: 'feature',
    })

    await spawnTerminal()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo/worktrees/feature' }))
    expect(useTerminalsStore.getState().panelOpen).toBe(true)
    expect(useTerminalsStore.getState().panelSessionId).toBe('spawned')
  })

  it('falls back to the open project when no Worktree is selected', async () => {
    useProjectSelectionStore.setState({
      project: { path: '/repo/main', name: 'main' },
    })

    await spawnTerminal()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo/main' }))
  })

  it('is a no-op without a Worktree or open project', async () => {
    await spawnTerminal()
    expect(create).not.toHaveBeenCalled()
  })
})
