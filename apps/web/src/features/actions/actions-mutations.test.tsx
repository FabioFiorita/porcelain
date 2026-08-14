import { actionsMutations } from '@porcelain/client-runtime/actions'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionMutations, useTrustAction } from './actions-mutations'
import { actionsListKeyForProject } from './actions-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REPO = actionsContractFixtures.actions.input
const OTHER = '/synthetic/other'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
})

describe('useActionMutations', () => {
  it('calls each CRUD procedure and invalidates only that project list key on success', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      addAction: () => ({ ok: true, value: actionsContractFixtures.addAction.output }),
      updateAction: () => ({ ok: true, value: undefined }),
      moveAction: () => ({ ok: true, value: undefined }),
      deleteAction: () => ({ ok: true, value: undefined }),
    })

    const { result } = renderHook(
      () => ({
        mutations: useActionMutations(),
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = {
      host: result.current.daemon.host,
      version: result.current.daemon.version,
    }
    const projectKey = actionsListKeyForProject(daemon, REPO)
    const otherKey = actionsListKeyForProject(daemon, OTHER)
    result.current.queryClient.setQueryData(projectKey, [{ id: 'a' }])
    result.current.queryClient.setQueryData(otherKey, [{ id: 'b' }])

    await act(async () => {
      await result.current.mutations.add({
        title: 'Run checks',
        command: 'make check',
        where: 'local',
      })
    })
    expect(mock.requests().filter((r) => r.procedure === 'addAction')).toContainEqual({
      procedure: 'addAction',
      kind: 'mutation',
      input: actionsContractFixtures.addAction.input,
    })

    await act(async () => {
      await result.current.mutations.update('action-build', {
        title: 'Build everything',
        command: 'make build-all',
        where: 'primary',
      })
    })
    expect(mock.requests().filter((r) => r.procedure === 'updateAction')).toContainEqual({
      procedure: 'updateAction',
      kind: 'mutation',
      input: actionsContractFixtures.updateAction.input,
    })

    await act(async () => {
      await result.current.mutations.move('action-serve', 'up')
    })
    expect(mock.requests().filter((r) => r.procedure === 'moveAction')).toContainEqual({
      procedure: 'moveAction',
      kind: 'mutation',
      input: actionsContractFixtures.moveAction.input,
    })

    await act(async () => {
      await result.current.mutations.remove('action-serve')
    })
    expect(mock.requests().filter((r) => r.procedure === 'deleteAction')).toContainEqual({
      procedure: 'deleteAction',
      kind: 'mutation',
      input: actionsContractFixtures.deleteAction.input,
    })

    expect(result.current.queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
    // Dual identities collapse: one list key, not a trust-only row.
    expect(
      actionsMutations.add
        .affectedQueries({ repoPath: REPO, title: 'Build', command: 'make build' })
        .map((i) => i.name),
    ).toEqual(['list', 'trust'])
  })

  it('rejects without toasting on mutation failure', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      addAction: () => ({
        ok: false,
        error: {
          code: 'actions.unavailable',
          category: 'unavailable',
          message: 'daemon down',
          retryable: true,
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    })

    const { result } = renderHook(() => useActionMutations(), { wrapper })
    await expect(
      act(async () => {
        await result.current.add({ title: 'X', command: 'y' })
      }),
    ).rejects.toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('useTrustAction', () => {
  it('trusts by id and invalidates the project list key only', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      trustActions: () => ({ ok: true, value: undefined }),
    })

    const { result } = renderHook(
      () => ({
        trust: useTrustAction(),
        queryClient: useQueryClient(),
        daemon: useDaemonIdentity(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.daemon.host).toBe('workstation'))

    const daemon = {
      host: result.current.daemon.host,
      version: result.current.daemon.version,
    }
    const projectKey = actionsListKeyForProject(daemon, REPO)
    const otherKey = actionsListKeyForProject(daemon, OTHER)
    result.current.queryClient.setQueryData(projectKey, [])
    result.current.queryClient.setQueryData(otherKey, [])

    await act(async () => {
      await result.current.trust('action-serve')
    })

    expect(mock.requests().filter((r) => r.procedure === 'trustActions')).toContainEqual({
      procedure: 'trustActions',
      kind: 'mutation',
      input: { repoPath: REPO, ids: ['action-serve'] },
    })
    expect(result.current.queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })
})
