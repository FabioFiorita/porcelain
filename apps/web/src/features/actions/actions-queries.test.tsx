import { actionsQuery } from '@porcelain/client-runtime/actions'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useActions } from './actions-queries'
import { actionsListKeyForProject } from './actions-query-key'

const PROJECT_ID = 'proj-alpha'
const OTHER_PROJECT_ID = 'proj-beta'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

function selectWorktreeOf(projectId: string): void {
  useHubSelectionStore.setState({
    selection: {
      kind: 'worktree',
      environmentId: 'env-local',
      projectId,
      worktreeId: 'wt-main',
      path: '/synthetic/projects/alpha',
    },
  })
}

describe('useActions', () => {
  beforeEach(() => {
    selectWorktreeOf(PROJECT_ID)
  })

  it('loads the selected Project id list via the list identity key', async () => {
    const rows = actionsContractFixtures.actions.output
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      actions: () => ({ ok: true, value: [...rows] }),
    })

    const { result } = renderHook(() => useActions(), { wrapper })
    await waitFor(() => expect(result.current).toEqual(rows))

    // The daemon identity resolves after mount, so the key (and the fetch) may repeat;
    // what matters is that every ask names the selected Project id and nothing else.
    const asks = mock.requests().filter((r) => r.procedure === 'actions')
    expect(asks.length).toBeGreaterThan(0)
    expect(asks.map((r) => r.input)).toEqual(asks.map(() => ({ projectId: PROJECT_ID })))

    const key = actionsListKeyForProject({ host: 'beelink', version: '0.52.1' }, PROJECT_ID)
    expect(key[0]).toEqual(actionsQuery(PROJECT_ID))
    expect(key[0].projectId).toBe(PROJECT_ID)
  })

  it('reads an explicitly passed Project id instead of the selection', async () => {
    const rows = actionsContractFixtures.actions.output
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      actions: () => ({ ok: true, value: [...rows] }),
    })

    const { result } = renderHook(() => useActions(true, OTHER_PROJECT_ID), { wrapper })
    await waitFor(() => expect(result.current).toEqual(rows))

    const asks = mock.requests().filter((r) => r.procedure === 'actions')
    expect(asks.length).toBeGreaterThan(0)
    expect(asks.map((r) => r.input)).toEqual(asks.map(() => ({ projectId: OTHER_PROJECT_ID })))
  })

  it('returns [] and asks the daemon nothing when disabled or no Project is selected', async () => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      actions: () => ({ ok: true, value: [...actionsContractFixtures.actions.output] }),
    })
    const idle = renderHook(() => useActions(), { wrapper })
    expect(idle.result.current).toEqual([])
    idle.unmount()

    selectWorktreeOf(PROJECT_ID)
    const disabled = renderHook(() => useActions(false), { wrapper })
    expect(disabled.result.current).toEqual([])
    disabled.unmount()

    expect(mock.requests().filter((r) => r.procedure === 'actions')).toEqual([])
  })
})
