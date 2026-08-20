import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { ActionView, PrepareActionRunInput } from '@porcelain/contracts/actions'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import type { spawnLocalTerminal as spawnLocalTerminalModule } from '@renderer/lib/terminal-actions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn(async () => 'term-1')
const revealTerminal = vi.fn()

const spawnLocalTerminal = vi.fn<typeof spawnLocalTerminalModule>(async () => {})

vi.mock('@renderer/stores/terminals', () => ({
  useTerminalsStore: {
    getState: () => ({ create }),
  },
}))

vi.mock('@renderer/lib/terminal-actions', () => ({
  // Typed forwarder: `(...args: unknown[])` cannot spread into a typed parameter list, and
  // an untyped mock would not notice the real signature changing under it.
  spawnLocalTerminal: (...args: Parameters<typeof spawnLocalTerminalModule>) =>
    spawnLocalTerminal(...args),
  revealTerminal: (id: string) => revealTerminal(id),
}))

import { useActionRun } from './action-run'
import { useActionRunStore } from './action-run-store'

const WORKTREE_PATH = '/synthetic/projects/alpha/main'

const selectionTarget: HubTarget = {
  environmentId: 'env-local',
  projectId: 'proj-alpha',
  worktreeId: 'wt-main',
  path: WORKTREE_PATH,
}

const explicitTarget: HubTarget = {
  environmentId: 'env-mac',
  projectId: 'proj-alpha',
  worktreeId: 'wt-review',
  path: '/synthetic/projects/alpha/review',
}

const trustedPrimary: ActionView = {
  id: 'a1',
  title: 'Build',
  command: 'make build',
  order: 1,
  createdAt: 1,
  trusted: true,
}

const trustedLocal: ActionView = {
  ...trustedPrimary,
  id: 'a2',
  title: 'Serve',
  command: 'make serve',
  where: 'local',
}

const untrusted: ActionView = {
  ...trustedPrimary,
  id: 'a3',
  trusted: false,
}

/** Answer `prepareActionRun` the way the daemon does, recording what it was asked. */
function harness(): {
  wrapper: ReturnType<typeof createValidatingTrpcHarness>['wrapper']
  inputs: PrepareActionRunInput[]
} {
  const inputs: PrepareActionRunInput[] = []
  const { wrapper } = createValidatingTrpcHarness({
    prepareActionRun: (input) => {
      const parsed = input as PrepareActionRunInput
      inputs.push(parsed)
      const action = [trustedPrimary, trustedLocal, untrusted].find((a) => a.id === parsed.actionId)
      return {
        ok: true,
        value: {
          id: parsed.actionId,
          title: action?.title ?? 'Unknown',
          command: action?.command ?? 'noop',
          where: action?.where ?? 'primary',
          cwd: parsed.target.path,
        },
      }
    },
  })
  return { wrapper, inputs }
}

beforeEach(() => {
  setPrimaryEnvironmentId('env-local')
  create.mockReset()
  create.mockResolvedValue('term-1')
  revealTerminal.mockReset()
  spawnLocalTerminal.mockReset()
  spawnLocalTerminal.mockResolvedValue(undefined)
  useHubSelectionStore.setState({ selection: { kind: 'worktree', ...selectionTarget } })
  // The roster popover is open whenever a run starts from it.
  useActionRunStore.getState().setMenuOpen(true)
})

describe('useActionRun', () => {
  it('returns needs-trust without asking the daemon to authorize anything', async () => {
    const { wrapper, inputs } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(untrusted)).resolves.toBe('needs-trust')
    expect(inputs).toEqual([])
    expect(create).not.toHaveBeenCalled()
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
    expect(revealTerminal).not.toHaveBeenCalled()
  })

  it('returns needs-target and authorizes nothing when no Worktree is selected', async () => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    const { wrapper, inputs } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedPrimary)).resolves.toBe('needs-target')

    useHubSelectionStore.setState({
      selection: { kind: 'project', environmentId: 'env-local', projectId: 'proj-alpha' },
    })
    await expect(result.current(trustedPrimary)).resolves.toBe('needs-target')
    await expect(result.current(trustedPrimary, { target: null })).resolves.toBe('needs-target')

    expect(inputs).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it('authorizes against the current Hub Worktree and creates a terminal in the daemon cwd', async () => {
    const { wrapper, inputs } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedPrimary)).resolves.toBe('ran')

    expect(inputs).toEqual([{ actionId: 'a1', target: selectionTarget }])
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      cwd: WORKTREE_PATH,
      name: 'Build',
      initialInput: 'make build',
    })
    // The shell an Action starts is put in front of the human — the Terminals surface is
    // the only place it can be seen at all — and the roster popover gets out of its way.
    expect(revealTerminal).toHaveBeenCalledTimes(1)
    expect(revealTerminal).toHaveBeenCalledWith('term-1')
    expect(useActionRunStore.getState().menuOpen).toBe(false)
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
  })

  it('refuses an explicit target whose Environment is offline', async () => {
    const { wrapper, inputs } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedPrimary, { target: explicitTarget })).rejects.toThrow(
      'offline',
    )
    expect(inputs).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it('returns needs-local-path for a local action with no folder mapping on this device', async () => {
    const { wrapper } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedLocal)).resolves.toBe('needs-local-path')
    await expect(result.current(trustedLocal, { localPath: null })).resolves.toBe(
      'needs-local-path',
    )
    await expect(result.current(trustedLocal, { localPath: '' })).resolves.toBe('needs-local-path')
    expect(create).not.toHaveBeenCalled()
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
  })

  it('local success spawns on this device in the mapped path, not the daemon cwd', async () => {
    const localPath = '/synthetic/local-checkout'
    const { wrapper, inputs } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedLocal, { localPath })).resolves.toBe('ran')

    expect(inputs).toEqual([{ actionId: 'a2', target: selectionTarget }])
    expect(spawnLocalTerminal).toHaveBeenCalledTimes(1)
    expect(spawnLocalTerminal).toHaveBeenCalledWith(localPath, {
      name: 'Serve',
      initialInput: 'make serve',
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects when Terminal create fails', async () => {
    create.mockRejectedValueOnce(new Error('pty failed'))
    const { wrapper } = harness()
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedPrimary)).rejects.toThrow('pty failed')
  })

  it('rejects when the daemon refuses the target', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      prepareActionRun: () => ({
        ok: false,
        error: {
          code: 'actions.target-invalid',
          category: 'conflict',
          message: 'unknown worktree',
          retryable: false,
          requestId: '00000000-0000-4000-8000-000000000099',
          details: { actionId: trustedPrimary.id },
        },
      }),
    })
    const { result } = renderHook(() => useActionRun(), { wrapper })
    await expect(result.current(trustedPrimary)).rejects.toThrow('unknown worktree')
    expect(create).not.toHaveBeenCalled()
  })
})
