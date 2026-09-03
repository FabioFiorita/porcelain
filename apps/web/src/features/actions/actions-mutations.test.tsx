import { actionsMutations } from '@porcelain/client-runtime/actions'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { duplicateTitle, useActionMutations, useTrustAction } from './actions-mutations'
import { actionsListKeyForProject } from './actions-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const PROJECT_ID = 'proj-alpha'
const OTHER_PROJECT_ID = 'proj-beta'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

beforeEach(() => {
  setPrimaryEnvironmentId('env-local')
  vi.mocked(toast.error).mockReset()
  useHubSelectionStore.setState({
    selection: {
      kind: 'worktree',
      environmentId: 'env-local',
      projectId: PROJECT_ID,
      worktreeId: 'wt-main',
      path: '/synthetic/projects/alpha',
    },
  })
})

describe('useActionMutations', () => {
  it('uses an explicit Project target instead of the currently selected row', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      addAction: () => ({ ok: true, value: actionsContractFixtures.addAction.output }),
    })
    useHubSelectionStore.setState({
      selection: {
        kind: 'worktree',
        environmentId: 'env-local',
        projectId: OTHER_PROJECT_ID,
        worktreeId: 'wt-other',
        path: '/synthetic/projects/beta',
      },
    })

    const { result } = renderHook(
      () => useActionMutations({ projectId: PROJECT_ID, environmentId: null }),
      { wrapper },
    )
    await act(async () => {
      await result.current.add({ title: 'Install', command: 'pnpm install' })
    })

    expect(mock.requests().filter((request) => request.procedure === 'addAction')).toContainEqual({
      procedure: 'addAction',
      kind: 'mutation',
      input: { projectId: PROJECT_ID, title: 'Install', command: 'pnpm install' },
    })
  })

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
    const projectKey = actionsListKeyForProject(daemon, PROJECT_ID)
    const otherKey = actionsListKeyForProject(daemon, OTHER_PROJECT_ID)
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
        .affectedQueries({ projectId: PROJECT_ID, title: 'Build', command: 'make build' })
        .map((i) => i.name),
    ).toEqual(['list', 'trust'])
  })

  it('duplicates by adding a copy last and walking it up under the original', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      addAction: () => ({ ok: true, value: actionsContractFixtures.addAction.output }),
      moveAction: () => ({ ok: true, value: undefined }),
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

    const projectKey = actionsListKeyForProject(
      { host: result.current.daemon.host, version: result.current.daemon.version },
      PROJECT_ID,
    )
    result.current.queryClient.setQueryData(projectKey, [{ id: 'a' }])

    // Original sits first of three rows: two rows below it, so two moves up.
    await act(async () => {
      await result.current.mutations.duplicate(
        { title: 'Serve locally', command: 'make serve', where: 'local' },
        2,
      )
    })

    expect(mock.requests().filter((r) => r.procedure === 'addAction')).toEqual([
      {
        procedure: 'addAction',
        kind: 'mutation',
        input: {
          projectId: PROJECT_ID,
          title: 'Serve locally (copy)',
          command: 'make serve',
          where: 'local',
        },
      },
    ])
    // Same command text: trust is keyed to the text, so the copy arrives as trusted as the original.
    expect(mock.requests().filter((r) => r.procedure === 'moveAction')).toEqual([
      {
        procedure: 'moveAction',
        kind: 'mutation',
        input: { projectId: PROJECT_ID, id: 'action-check', direction: 'up' },
      },
      {
        procedure: 'moveAction',
        kind: 'mutation',
        input: { projectId: PROJECT_ID, id: 'action-check', direction: 'up' },
      },
    ])
    expect(result.current.queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
  })

  it('keeps a duplicated title inside the stored title limit', () => {
    expect(duplicateTitle('Serve sim')).toBe('Serve sim (copy)')
    expect(duplicateTitle('x'.repeat(400))).toHaveLength(240)
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
    const projectKey = actionsListKeyForProject(daemon, PROJECT_ID)
    const otherKey = actionsListKeyForProject(daemon, OTHER_PROJECT_ID)
    result.current.queryClient.setQueryData(projectKey, [])
    result.current.queryClient.setQueryData(otherKey, [])

    await act(async () => {
      await result.current.trust('action-serve')
    })

    expect(mock.requests().filter((r) => r.procedure === 'trustActions')).toContainEqual({
      procedure: 'trustActions',
      kind: 'mutation',
      input: { projectId: PROJECT_ID, ids: ['action-serve'] },
    })
    expect(result.current.queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(result.current.queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })
})
