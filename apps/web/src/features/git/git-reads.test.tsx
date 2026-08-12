import {
  gitCommitDiffQuery,
  gitCommitMessageQuery,
  gitDiffFileQuery,
  gitFileLogQuery,
  gitLogQuery,
  gitRangeDiffFileQuery,
} from '@porcelain/client-runtime/git'
import { gitContractFixtures } from '@porcelain/contracts/git'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { gitQueryKey } from './git-query-key'
import {
  useCommitDiff,
  useCommitFlow,
  useCommitMessage,
  useCommitModels,
  useDiffFile,
  useDiffFilePrefetch,
  useDiffReading,
  useFetchCommitMessage,
  useFileLog,
  useGitFlow,
  useGitLog,
  useGitSuggestions,
} from './git-reads'

const REPO = '/synthetic/repo'
const DAEMON = {
  host: remoteContractFixtures.daemonInfo.output.host,
  version: remoteContractFixtures.daemonInfo.output.version,
}

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

/** Requests for one procedure, so a disabled query can be proved to never reach the wire. */
function callsTo(
  mock: ReturnType<typeof createValidatingTrpcHarness>['mock'],
  procedure: string,
): number {
  return mock.requests().filter((request) => request.procedure === procedure).length
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: { name: 'repo', path: REPO } })
})

describe('useGitFlow / useGitSuggestions', () => {
  it('reads the flow for the selected project', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitFlow: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: gitContractFixtures.gitFlow.output }
      },
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
    })
    const { result } = renderHook(() => useGitFlow(), { wrapper })

    await waitFor(() => expect(result.current.groups).toEqual(gitContractFixtures.gitFlow.output))
    expect(callsTo(mock, 'gitFlow')).toBeGreaterThan(0)
  })

  it('is disabled with no project and never reaches the daemon', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitFlow: () => ({ ok: true, value: [] }),
      gitSuggestions: () => ({ ok: true, value: [] }),
    })
    const { result } = renderHook(
      () => ({ flow: useGitFlow(), suggestions: useGitSuggestions() }),
      { wrapper },
    )

    expect(result.current.flow.groups).toBeUndefined()
    expect(result.current.suggestions).toEqual([])
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(callsTo(mock, 'gitFlow')).toBe(0)
    expect(callsTo(mock, 'gitSuggestions')).toBe(0)
  })

  it('refresh() refetches the flow AND invalidates every mounted working diff', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitFlow: () => ({ ok: true, value: gitContractFixtures.gitFlow.output }),
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
    })
    const { result } = renderHook(
      () => ({ diff: useDiffFile('src/example.ts'), flow: useGitFlow() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.flow.groups).toBeDefined())
    await waitFor(() => expect(result.current.diff.hunks).toBeDefined())
    const before = { diff: callsTo(mock, 'gitDiffFile'), flow: callsTo(mock, 'gitFlow') }

    await result.current.flow.refresh()

    await waitFor(() => expect(callsTo(mock, 'gitFlow')).toBeGreaterThan(before.flow))
    await waitFor(() => expect(callsTo(mock, 'gitDiffFile')).toBeGreaterThan(before.diff))
  })
})

describe('useDiffFile', () => {
  it('reads the working diff when no base is given and keeps commit reads out of it', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiffFile: (input) => {
        expect(input).toEqual({ filePath: 'src/example.ts', repoPath: REPO })
        return { ok: true, value: gitContractFixtures.gitDiffFile.output }
      },
      gitRangeDiffFile: () => ({ ok: true, value: gitContractFixtures.gitRangeDiffFile.output }),
    })
    const { result } = renderHook(() => useDiffFile('src/example.ts'), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('modified'))
    expect(result.current.binary).toBe(false)
    expect(callsTo(mock, 'gitRangeDiffFile')).toBe(0)
  })

  it('reads the range diff when a base is given, on its own identity', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
      gitRangeDiffFile: (input) => {
        expect(input).toEqual({
          base: 'origin/main',
          filePath: 'src/example.ts',
          repoPath: REPO,
        })
        return { ok: true, value: gitContractFixtures.gitRangeDiffFile.output }
      },
    })
    const { result } = renderHook(() => useDiffFile('src/example.ts', 'origin/main'), { wrapper })

    await waitFor(() => expect(result.current.hunks).toBeDefined())
    expect(callsTo(mock, 'gitDiffFile')).toBe(0)
    expect(gitQueryKey(DAEMON, gitDiffFileQuery(REPO, 'src/example.ts'))[0]).not.toEqual(
      gitQueryKey(DAEMON, gitRangeDiffFileQuery(REPO, 'origin/main', 'src/example.ts'))[0],
    )
  })

  it('collapses a missing binary flag to false', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiffFile: () => ({ ok: true, value: { hunks: [], status: 'modified' } }),
    })
    const { result } = renderHook(() => useDiffFile('src/example.ts'), { wrapper })
    await waitFor(() => expect(result.current.hunks).toEqual([]))
    expect(result.current.binary).toBe(false)
  })

  it('surfaces the active query error to the caller', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiffFile: () => ({
        ok: false,
        error: {
          category: 'not-found',
          code: 'git.not-a-repository',
          message: 'no such path',
          requestId: '00000000-0000-4000-8000-000000000042',
          retryable: false,
        },
      }),
    })
    const { result } = renderHook(() => useDiffFile('src/example.ts'), { wrapper })
    await waitFor(() => expect(result.current.error?.message).toContain('no such path'))
  })
})

describe('useDiffFilePrefetch', () => {
  it('does nothing without a project and prefetches the identity that matches the read', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
      gitRangeDiffFile: () => ({ ok: true, value: gitContractFixtures.gitRangeDiffFile.output }),
    })
    const { result, rerender } = renderHook(() => useDiffFilePrefetch(), { wrapper })

    await result.current('src/example.ts')
    expect(callsTo(mock, 'gitDiffFile')).toBe(0)

    useProjectSelectionStore.setState({ project: { name: 'repo', path: REPO } })
    rerender()
    await result.current('src/example.ts')
    await result.current('src/example.ts', 'origin/main')

    expect(callsTo(mock, 'gitDiffFile')).toBe(1)
    expect(callsTo(mock, 'gitRangeDiffFile')).toBe(1)
  })
})

describe('history reads', () => {
  it('forwards limits and disables the file log until a file is open', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitLog: (input) => {
        expect(input).toEqual({ limit: 50, repoPath: REPO })
        return { ok: true, value: gitContractFixtures.gitLog.output }
      },
      gitFileLog: () => ({ ok: true, value: gitContractFixtures.gitFileLog.output }),
    })
    const { result } = renderHook(() => ({ commits: useGitLog(50), file: useFileLog(null) }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.commits).toEqual(gitContractFixtures.gitLog.output))
    expect(result.current.file).toBeUndefined()
    expect(callsTo(mock, 'gitFileLog')).toBe(0)
    // The default limits are part of the identity, so two limits are two caches.
    expect(gitLogQuery(REPO, 200)).not.toEqual(gitLogQuery(REPO, 50))
    expect(gitFileLogQuery(REPO, 'src/example.ts', 50)).not.toEqual(
      gitFileLogQuery(REPO, 'src/example.ts', 10),
    )
  })

  it('stays disabled when the caller disables it, even with a project open', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitLog: () => ({ ok: true, value: gitContractFixtures.gitLog.output }),
    })
    const { result } = renderHook(() => useGitLog(200, false), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current).toBeUndefined()
    expect(callsTo(mock, 'gitLog')).toBe(0)
  })

  it('reads a commit message, flow, and diff on immutable per-hash identities', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCommitMessage: () => ({ ok: true, value: gitContractFixtures.gitCommitMessage.output }),
      gitCommitFlow: () => ({ ok: true, value: gitContractFixtures.gitCommitFlow.output }),
      gitCommitDiff: () => ({ ok: true, value: gitContractFixtures.gitCommitDiff.output }),
    })
    const { result } = renderHook(
      () => ({
        diff: useCommitDiff('abc123', 'src/example.ts'),
        flow: useCommitFlow('abc123'),
        message: useCommitMessage('abc123'),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.message).toContain('feat: synthetic commit'))
    expect(result.current.flow.groups).toEqual(gitContractFixtures.gitCommitFlow.output)
    expect(result.current.diff.hunks).toEqual(gitContractFixtures.gitCommitDiff.output)
    expect(gitCommitMessageQuery(REPO, 'abc123')).not.toEqual(gitCommitMessageQuery(REPO, 'def456'))
    expect(gitCommitDiffQuery(REPO, 'abc123', 'a.ts')).not.toEqual(
      gitCommitDiffQuery(REPO, 'abc123', 'b.ts'),
    )
  })

  it('useFetchCommitMessage resolves empty without a project and fetches with one', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCommitMessage: () => ({ ok: true, value: gitContractFixtures.gitCommitMessage.output }),
    })
    const { result, rerender } = renderHook(() => useFetchCommitMessage(), { wrapper })

    await expect(result.current('abc123')).resolves.toBe('')
    expect(callsTo(mock, 'gitCommitMessage')).toBe(0)

    useProjectSelectionStore.setState({ project: { name: 'repo', path: REPO } })
    rerender()
    await expect(result.current('abc123')).resolves.toBe(
      gitContractFixtures.gitCommitMessage.output,
    )
  })
})

describe('useDiffReading', () => {
  it('keys each scope separately and forwards the discriminated scope to the daemon', async () => {
    const seen: unknown[] = []
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      diffReading: (input) => {
        seen.push(input)
        return { ok: true, value: gitContractFixtures.diffReading.output }
      },
    })
    const { result } = renderHook(
      () => ({
        branch: useDiffReading({ type: 'branch' }),
        working: useDiffReading({ type: 'working' }),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.working.reading).toBeDefined())
    await waitFor(() => expect(result.current.branch.reading).toBeDefined())
    expect(seen).toContainEqual({ repoPath: REPO, scope: { type: 'working' } })
    expect(seen).toContainEqual({ repoPath: REPO, scope: { type: 'branch' } })
  })
})

describe('useCommitModels', () => {
  it('reads the daemon-scoped models and selects the first when the preference is unknown', async () => {
    usePreferencesStore.setState({ commitModel: 'not-on-this-daemon' })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      commitModels: () => ({ ok: true, value: gitContractFixtures.commitModels.output }),
    })
    const { result } = renderHook(() => useCommitModels(), { wrapper })

    await waitFor(() =>
      expect(result.current.models).toEqual(gitContractFixtures.commitModels.output),
    )
    await waitFor(() => expect(usePreferencesStore.getState().commitModel).toBe('sonnet'))
    // Daemon-scoped: the read carries no input and no project dimension.
    const modelReads = mock.requests().filter((r) => r.procedure === 'commitModels')
    expect(modelReads).not.toHaveLength(0)
    for (const request of modelReads) expect(request.input).toBeUndefined()
  })

  it('keeps a preference the daemon still offers', async () => {
    usePreferencesStore.setState({ commitModel: 'opencode:synthetic/model' })
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      commitModels: () => ({ ok: true, value: gitContractFixtures.commitModels.output }),
    })
    const { result } = renderHook(() => useCommitModels(), { wrapper })

    await waitFor(() => expect(result.current.models).toHaveLength(2))
    expect(usePreferencesStore.getState().commitModel).toBe('opencode:synthetic/model')
  })
})
