import { gitContractFixtures } from '@porcelain/contracts/git'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type Tab, tabId, useTabsStore } from '@renderer/stores/tabs'
import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCommit,
  useCommitGeneration,
  useDiscardFile,
  useFileStaging,
  useQuickCommand,
  useStageAll,
} from './git-mutations'

const REPO = '/synthetic/repo'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

const CONFLICT = {
  ok: false as const,
  error: {
    category: 'conflict' as const,
    code: 'git.working-tree-conflict' as const,
    message: 'dirty working tree',
    requestId: '00000000-0000-4000-8000-000000000099',
    retryable: false as const,
  },
}

const DIFF_TAB: Tab = {
  id: tabId('diff', 'src/old.ts'),
  kind: 'diff',
  path: 'src/old.ts',
  title: 'old.ts',
}

function diffTabIsOpen(): boolean {
  return useTabsStore.getState().panes.some((pane) => pane.tabs.some((t) => t.id === DIFF_TAB.id))
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: { name: 'repo', path: REPO }, showHidden: false })
  usePreferencesStore.setState({ pullMode: 'rebase' })
  useTabsStore.setState({ activePaneIndex: 0, panes: [{ activeTabId: null, tabs: [] }] })
})

describe('staging', () => {
  it('sends the contract input and refreshes only the working-tree identities', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitStageFile: () => ({ ok: true, value: undefined }),
      gitUnstageFile: () => ({ ok: true, value: undefined }),
    })
    const { result } = renderHook(() => useFileStaging(), { wrapper })

    await act(async () => {
      await result.current.stageFile('src/example.ts')
    })

    expect(mock.requests()).toContainEqual({
      procedure: 'gitStageFile',
      kind: 'mutation',
      input: { path: 'src/example.ts', repoPath: REPO },
    })
    // Exactly the five working-tree effects, never a broad flush.
    expect(invalidate).toHaveBeenCalledTimes(5)
    for (const call of invalidate.mock.calls) {
      expect(call[0]).toHaveProperty('predicate')
    }
    invalidate.mockRestore()
  })

  it('rejects staging failures to the caller instead of toasting them', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitStageAll: () => CONFLICT,
    })
    const { result } = renderHook(() => useStageAll(), { wrapper })

    await expect(result.current.stageAll()).rejects.toThrow('dirty working tree')
  })

  it('does nothing at all without a selected project', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitStageAll: () => ({ ok: true, value: undefined }),
    })
    const { result } = renderHook(() => useStageAll(), { wrapper })

    await act(async () => {
      await result.current.stageAll()
    })
    expect(mock.requests().filter((r) => r.procedure === 'gitStageAll')).toHaveLength(0)
  })
})

describe('useDiscardFile', () => {
  it('refreshes Git and the typed Files tree/pins effects, then closes the file diff tab', async () => {
    useTabsStore.getState().openTab(DIFF_TAB)
    expect(diffTabIsOpen()).toBe(true)

    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiscardFile: () => ({ ok: true, value: undefined }),
    })
    const { result } = renderHook(() => useDiscardFile(), { wrapper })

    await act(async () => {
      await result.current('src/old.ts')
    })

    expect(mock.requests()).toContainEqual({
      procedure: 'gitDiscardFile',
      kind: 'mutation',
      input: { path: 'src/old.ts', repoPath: REPO },
    })
    expect(diffTabIsOpen()).toBe(false)
  })

  it('rejects to the confirm dialog and leaves the tab open on refusal', async () => {
    useTabsStore.getState().openTab(DIFF_TAB)
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiscardFile: () => CONFLICT,
    })
    const { result } = renderHook(() => useDiscardFile(), { wrapper })

    await expect(result.current('src/old.ts')).rejects.toThrow('dirty working tree')
    expect(diffTabIsOpen()).toBe(true)
  })
})

describe('useCommit', () => {
  it('reports its failure through `error` and invalidates nothing', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCommit: () => CONFLICT,
    })
    const { result } = renderHook(() => useCommit(), { wrapper })

    act(() => {
      result.current.commit('feat: synthetic commit')
    })

    await waitFor(() => expect(result.current.error?.message).toContain('dirty working tree'))
    expect(invalidate).not.toHaveBeenCalled()
    invalidate.mockRestore()
  })

  it('does not invalidate while the write is still pending', async () => {
    const write = deferred<{ ok: true; value: undefined }>()
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCommit: () => write.promise,
    })
    const { result } = renderHook(() => useCommit(), { wrapper })

    act(() => {
      result.current.commit('feat: synthetic commit')
    })
    await waitFor(() => expect(result.current.isCommitting).toBe(true))
    expect(invalidate).not.toHaveBeenCalled()

    await act(async () => {
      write.resolve({ ok: true, value: undefined })
      await waitFor(() => expect(result.current.isCommitting).toBe(false))
    })
    expect(invalidate).toHaveBeenCalled()
    invalidate.mockRestore()
  })

  it('sends the contract input and runs the committed callback on success', async () => {
    const onCommitted = vi.fn()
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCommit: () => ({ ok: true, value: undefined }),
    })
    const { result } = renderHook(() => useCommit(onCommitted), { wrapper })

    await act(async () => {
      result.current.commit('feat: synthetic commit')
      await waitFor(() => expect(onCommitted).toHaveBeenCalled())
    })
    expect(mock.requests()).toContainEqual({
      procedure: 'gitCommit',
      kind: 'mutation',
      input: { message: 'feat: synthetic commit', repoPath: REPO },
    })
  })
})

describe('useQuickCommand', () => {
  it('sends the stored pull mode and applies pull consequences', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitQuickCommand: () => ({ ok: true, value: gitContractFixtures.gitQuickCommand.output }),
    })
    const { result } = renderHook(() => useQuickCommand(), { wrapper })

    await act(async () => {
      await expect(result.current('pull')).resolves.toBe(gitContractFixtures.gitQuickCommand.output)
    })

    expect(mock.requests()).toContainEqual({
      procedure: 'gitQuickCommand',
      kind: 'mutation',
      input: { command: 'pull', pullMode: 'rebase', repoPath: REPO },
    })
    expect(invalidate.mock.calls.length).toBeGreaterThan(0)
    invalidate.mockRestore()
  })

  it('applies no cache effect for a read-only status command', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitQuickCommand: () => ({ ok: true, value: 'nothing to commit' }),
    })
    const { result } = renderHook(() => useQuickCommand(), { wrapper })

    await act(async () => {
      await result.current('status')
    })

    expect(invalidate).not.toHaveBeenCalled()
    invalidate.mockRestore()
  })
})

describe('useCommitGeneration', () => {
  it('unwraps the generated message and groups', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitGenerateCommitMessage: () => ({
        ok: true,
        value: gitContractFixtures.gitGenerateCommitMessage.output,
      }),
      gitGenerateCommitGroups: () => ({
        ok: true,
        value: gitContractFixtures.gitGenerateCommitGroups.output,
      }),
    })
    const { result } = renderHook(() => useCommitGeneration(), { wrapper })

    await act(async () => {
      await expect(result.current.generateMessage()).resolves.toBe('feat: synthetic commit')
      await expect(result.current.generateGroups()).resolves.toEqual(
        gitContractFixtures.gitGenerateCommitGroups.output.groups,
      )
    })
  })

  it('rejects generation failures to the composer', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitGenerateCommitMessage: () => CONFLICT,
    })
    const { result } = renderHook(() => useCommitGeneration(), { wrapper })

    await expect(result.current.generateMessage()).rejects.toThrow('dirty working tree')
  })
})
