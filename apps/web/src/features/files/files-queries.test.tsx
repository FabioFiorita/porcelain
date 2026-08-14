import {
  fileContentQuery,
  filesPinsQuery,
  filesScopeQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { filesContractFixtures, fileViewFixtures } from '@porcelain/contracts/files'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { HubRepoProvider } from '@renderer/stores/hub-repo'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  useFileContent,
  useFilePreview,
  useFilesScope,
  useFilesTree,
  usePinnedFiles,
  usePrefetchFileContent,
} from './files-queries'
import { filesQueryKey } from './files-query-key'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
})

describe('useFilesTree', () => {
  it('queries readDir with absolute wire path for root and nested dirs', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      readDir: (input) => {
        expect(input).toEqual({
          repoPath: REPO,
          path: REPO,
          showHidden: false,
        })
        return { ok: true, value: filesContractFixtures.readDir.output }
      },
    })

    const { result } = renderHook(() => useFilesTree(REPO), { wrapper })
    await waitFor(() => expect(result.current).toEqual(filesContractFixtures.readDir.output))
    expect(mock.requests().some((r) => r.procedure === 'readDir')).toBe(true)
  })

  it('is disabled without a repo and never calls the daemon', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      readDir: () => ({ ok: true, value: [] }),
    })
    const { result } = renderHook(() => useFilesTree(REPO), { wrapper })
    expect(result.current).toBeUndefined()
    await new Promise((r) => setTimeout(r, 20))
    expect(mock.requests().filter((r) => r.procedure === 'readDir')).toHaveLength(0)
  })

  it('uses distinct keys for showHidden variants', () => {
    const daemon = { host: 'beelink', version: '0.52.1' }
    const hiddenOff = filesQueryKey(daemon, filesTreeQuery(REPO, 'src', false))
    const hiddenOn = filesQueryKey(daemon, filesTreeQuery(REPO, 'src', true))
    expect(hiddenOff[0]).not.toEqual(hiddenOn[0])
  })
})

describe('usePinnedFiles / useFilesScope', () => {
  it('loads pins and scope for the active project', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      pinnedEntries: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: filesContractFixtures.pinnedEntries.output }
      },
      repoScope: (input) => {
        expect(input).toBe(REPO)
        return {
          ok: true,
          value: { hiddenPaths: ['src/generated'], pinnedPaths: ['README.md'] },
        }
      },
    })
    const pins = renderHook(() => usePinnedFiles(), { wrapper })
    const scope = renderHook(() => useFilesScope(), { wrapper })
    await waitFor(() =>
      expect(pins.result.current).toEqual(filesContractFixtures.pinnedEntries.output),
    )
    await waitFor(() =>
      expect(scope.result.current).toEqual({
        hiddenPaths: ['src/generated'],
        pinnedPaths: ['README.md'],
      }),
    )
    expect(filesQueryKey({ host: null, version: null }, filesPinsQuery(REPO))[0].name).toBe('pins')
    expect(filesQueryKey({ host: null, version: null }, filesScopeQuery(REPO))[0].name).toBe(
      'scope',
    )
    expect(OTHER).not.toBe(REPO)
  })
})

describe('useFileContent / useFilePreview / prefetch', () => {
  it('sends projectPath + relative path for content and preview', async () => {
    const fileAbs = `${REPO}/README.md`
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      readFile: (input) => {
        expect(input).toEqual({ projectPath: REPO, path: 'README.md' })
        return { ok: true, value: fileViewFixtures.text }
      },
      previewHtml: (input) => {
        expect(input).toEqual({ projectPath: REPO, path: 'docs/index.html' })
        return { ok: true, value: filesContractFixtures.previewHtml.output }
      },
    })

    const content = renderHook(() => useFileContent(fileAbs), { wrapper })
    await waitFor(() => expect(content.result.current.view).toEqual(fileViewFixtures.text))
    expect(content.result.current.error).toBeNull()

    const preview = renderHook(() => useFilePreview(`${REPO}/docs/index.html`, true), { wrapper })
    await waitFor(() =>
      expect(preview.result.current.html).toBe(filesContractFixtures.previewHtml.output),
    )

    expect(mock.requests().some((r) => r.procedure === 'readFile')).toBe(true)
    expect(mock.requests().some((r) => r.procedure === 'previewHtml')).toBe(true)
  })

  it('reads the tab Worktree after a different Worktree is selected', async () => {
    useProjectSelectionStore.setState({ project: { path: OTHER, name: 'other' } })
    const { mock, wrapper: inner } = createValidatingTrpcHarness({
      ...baseHandlers,
      readFile: (input) => {
        expect(input).toEqual({ projectPath: REPO, path: 'README.md' })
        return { ok: true, value: fileViewFixtures.text }
      },
    })
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <HubRepoProvider repoPath={REPO}>{inner({ children })}</HubRepoProvider>
    )
    const { result } = renderHook(() => useFileContent(`${REPO}/README.md`), { wrapper })
    await waitFor(() => expect(result.current.view).toEqual(fileViewFixtures.text))
    expect(mock.requests().some((r) => r.procedure === 'readFile')).toBe(true)
  })

  it('disables content when path is outside the project', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      readFile: () => ({ ok: true, value: fileViewFixtures.text }),
    })
    const { result } = renderHook(() => useFileContent('/outside/secret.txt'), { wrapper })
    expect(result.current.view).toBeUndefined()
    await new Promise((r) => setTimeout(r, 20))
    expect(mock.requests().filter((r) => r.procedure === 'readFile')).toHaveLength(0)
  })

  it('prefetch populates the same filesQueryKey as useFileContent', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      readFile: () => ({ ok: true, value: fileViewFixtures.text }),
    })
    const { result } = renderHook(() => usePrefetchFileContent(), { wrapper })
    await result.current(`${REPO}/README.md`)
    const identity = fileContentQuery(REPO, 'README.md')
    expect(identity.name).toBe('content')
    // Prefetch and content share the identity constructor (same key space).
    expect(filesQueryKey({ host: null, version: null }, identity)[0]).toEqual(identity)
  })
})
