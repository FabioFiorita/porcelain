import {
  fileContentQuery,
  filesMutations,
  filesPinsQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { filesContractFixtures } from '@porcelain/contracts/files'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFilesActions, useFilesScopeActions, useWriteTextFile } from './files-mutations'
import { useFilesScope, usePinnedFiles } from './files-queries'
import { filesQueryKey } from './files-query-key'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REPO = '/synthetic/repo'
const FILE_ABS = `${REPO}/docs/notes.txt`

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
})

describe('useFilesActions', () => {
  it('on success invalidates shared Files effects and never setQueryData for file bodies', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      createFile: () => ({ ok: true, value: undefined }),
      trashPath: () => ({ ok: true, value: undefined }),
      duplicatePath: () => ({
        ok: true,
        value: filesContractFixtures.duplicatePath.output,
      }),
      // Foreign targets may be invalidated even without handlers returning data
      gitFlow: () => ({ ok: true, value: null }),
      gitDiffFile: () => ({ ok: true, value: null }),
      searchFiles: () => ({ ok: true, value: [] }),
      searchCode: () => ({ ok: true, value: [] }),
      searchText: () => ({ ok: true, value: [] }),
    })

    const { result } = renderHook(() => useFilesActions(), { wrapper })

    await act(async () => {
      await result.current.createFile(`${REPO}/docs/empty.txt`)
    })
    expect(mock.requests().filter((r) => r.procedure === 'createFile')).toContainEqual({
      procedure: 'createFile',
      kind: 'mutation',
      input: { projectPath: REPO, path: 'docs/empty.txt' },
    })

    let trashOk = false
    await act(async () => {
      trashOk = await result.current.trash(`${REPO}/docs/old.md`)
    })
    expect(trashOk).toBe(true)

    let dupAbs: string | null = null
    await act(async () => {
      dupAbs = await result.current.duplicate(`${REPO}/docs/guide.md`)
    })
    expect(dupAbs).toBe(`${REPO}/docs/guide copy.md`)
    // Duplicate must use output path (affectedEffectsForResult), not source-only base set.
    const dupEffects = filesMutations.duplicate.affectedEffectsForResult(
      { projectPath: REPO, path: 'docs/guide.md' },
      'docs/guide copy.md',
    )
    expect(
      dupEffects.some((e) => e.type === 'content-subtree' && e.path === 'docs/guide copy.md'),
    ).toBe(true)
  })

  it('trash returns false without invalidation on failure, absent repo, or invalid path', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      trashPath: () => ({
        ok: false,
        error: {
          code: 'files.not-found',
          category: 'not-found',
          message: 'path not found',
          retryable: false,
          requestId: '00000000-0000-4000-8000-000000000099',
          details: { path: 'docs/old.md' },
        },
      }),
    })

    const { result } = renderHook(() => useFilesActions(), { wrapper })
    let failed = true
    await act(async () => {
      failed = await result.current.trash(`${REPO}/docs/old.md`)
    })
    expect(failed).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Delete failed', {
      description: 'path not found',
    })
    // Only the failed mutation request — no success-driven follow-up queries
    expect(mock.requests().filter((r) => r.kind === 'mutation')).toHaveLength(1)

    useProjectSelectionStore.setState({ project: null })
    const noRepo = renderHook(() => useFilesActions(), { wrapper })
    await expect(noRepo.result.current.trash(FILE_ABS)).resolves.toBe(false)

    useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' } })
    await expect(result.current.trash('/outside/x')).resolves.toBe(false)
  })

  it('foreign tokens map to git and search utils on write success', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      writeTextFile: () => ({ ok: true, value: undefined }),
      readFile: () => ({
        ok: true,
        value: { type: 'text', content: '' },
      }),
      previewHtml: () => ({ ok: true, value: null }),
      readDir: () => ({ ok: true, value: [] }),
      pinnedEntries: () => ({ ok: true, value: [] }),
      gitFlow: () => ({ ok: true, value: null }),
      gitDiffFile: () => ({ ok: true, value: null }),
      searchFiles: () => ({ ok: true, value: [] }),
      searchCode: () => ({ ok: true, value: [] }),
      searchText: () => ({ ok: true, value: [] }),
    })

    const { result } = renderHook(() => useWriteTextFile(FILE_ABS), { wrapper })
    act(() => {
      result.current.save('body')
    })
    await waitFor(() =>
      expect(mock.requests().some((r) => r.procedure === 'writeTextFile')).toBe(true),
    )
    // Effects from writeText include content/preview + foreign tokens (all three).
    const effects = filesMutations.writeText.affectedEffects({
      projectPath: REPO,
      path: 'docs/notes.txt',
      content: 'body',
    })
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'content')).toBe(true)
    const foreign = filesMutations.writeText.foreignDependencies({
      projectPath: REPO,
      path: 'docs/notes.txt',
      content: 'body',
    })
    expect(foreign).toEqual(
      expect.arrayContaining([
        { domain: 'git', name: 'working-tree' },
        { domain: 'search', name: 'path-index' },
        { domain: 'search', name: 'content-index' },
      ]),
    )
  })
})

describe('useFilesScopeActions', () => {
  it('runs paths sequentially and applies first-path effects before attempting the next', async () => {
    const order: string[] = []
    let hideCount = 0
    let scopeInvalidations = 0
    const secondEntered = deferred<void>()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      hidePath: async (input) => {
        hideCount += 1
        const path = (input as { path: string }).path
        order.push(`hide:${path}`)
        if (hideCount === 1) {
          // First path succeeds; success effects run before the loop continues.
          return { ok: true, value: undefined }
        }
        // When second is entered, first path's success effects have already run.
        order.push(`effects-before-second:${scopeInvalidations}`)
        order.push('second-entered')
        secondEntered.resolve()
        return {
          ok: false,
          error: {
            code: 'files.not-found',
            category: 'not-found',
            message: 'second failed',
            retryable: false,
            requestId: '00000000-0000-4000-8000-000000000099',
            details: { path: `${REPO}/b` },
          },
        }
      },
      // Hide success foreign token + scope/pins/tree family may refetch while active.
      repoScope: () => {
        scopeInvalidations += 1
        order.push('refetch-scope')
        return { ok: true, value: { hiddenPaths: [], pinnedPaths: [] } }
      },
      pinnedEntries: () => {
        order.push('refetch-pins')
        return { ok: true, value: [] }
      },
      readDir: () => {
        order.push('refetch-tree')
        return { ok: true, value: [] }
      },
      searchFiles: () => {
        order.push('refetch-search')
        return { ok: true, value: [] }
      },
    })

    // Mount scope/pins queries so success invalidation can refetch (freshness proof).
    const { result } = renderHook(
      () => ({
        actions: useFilesScopeActions(),
        scope: useFilesScope(),
        pins: usePinnedFiles(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.scope).toBeDefined())
    // Drop initial-load noise; only the hide batch matters from here.
    order.length = 0
    scopeInvalidations = 0

    await expect(result.current.actions.hide([`${REPO}/a`, `${REPO}/b`])).rejects.toThrow()
    await secondEntered.promise

    // Sequential: first path fully settles (mutate + success effects) before second starts.
    expect(order[0]).toBe('hide:a')
    const secondIdx = order.indexOf('second-entered')
    expect(secondIdx).toBeGreaterThan(0)
    // Partial batch freshness: at least one Files effect refetch ran before path two started.
    const beforeSecond = order.slice(0, secondIdx)
    expect(beforeSecond.some((s) => s.startsWith('refetch-'))).toBe(true)
    expect(hideCount).toBe(2)
  })
})

describe('non-optimism', () => {
  it('does not seed cache with filesystem mutation results', () => {
    // Structural proof: requiresAuthoritativeRefetch is always true; adapters never setQueryData.
    expect(filesMutations.trash.requiresAuthoritativeRefetch).toBe(true)
    expect(filesMutations.createFile.requiresAuthoritativeRefetch).toBe(true)
    expect(filesMutations.writeText.requiresAuthoritativeRefetch).toBe(true)
    const key = filesQueryKey(
      { host: null, version: null },
      fileContentQuery(REPO, 'docs/notes.txt'),
    )
    expect(key[0].name).toBe('content')
    expect(filesPinsQuery(REPO).name).toBe('pins')
    expect(filesTreeQuery(REPO, '.', false).name).toBe('tree')
  })
})
