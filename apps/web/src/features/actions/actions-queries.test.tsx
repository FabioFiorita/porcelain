import { actionsQuery } from '@porcelain/client-runtime/actions'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useActions } from './actions-queries'
import { actionsListKeyForProject } from './actions-query-key'

const REPO = actionsContractFixtures.actions.input

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

describe('useActions', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
  })

  it('loads contract-valid list for the active project via list identity key', async () => {
    const rows = actionsContractFixtures.actions.output
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      actions: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: [...rows] }
      },
    })

    const { result } = renderHook(() => useActions(), { wrapper })
    await waitFor(() => expect(result.current).toEqual(rows))

    expect(mock.requests().filter((r) => r.procedure === 'actions')).toContainEqual({
      procedure: 'actions',
      kind: 'query',
      input: REPO,
    })

    const key = actionsListKeyForProject({ host: 'beelink', version: '0.52.1' }, REPO)
    expect(key[0]).toEqual(actionsQuery(REPO))
    expect(key[0].name).toBe('list')
  })

  it('returns [] when disabled or no project is selected', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      actions: () => ({ ok: true, value: [...actionsContractFixtures.actions.output] }),
    })
    const idle = renderHook(() => useActions(), { wrapper })
    expect(idle.result.current).toEqual([])

    useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' } })
    const disabled = renderHook(() => useActions(false), { wrapper })
    expect(disabled.result.current).toEqual([])
  })
})
