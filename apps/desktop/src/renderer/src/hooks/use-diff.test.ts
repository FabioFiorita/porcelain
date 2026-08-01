import { useRepoStore } from '@renderer/stores/repo'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommitDiff, useDiffFile, useDiffFilePrefetch } from './use-diff'

const gitDiffFileQuery = vi.hoisted(() => vi.fn())
const gitRangeDiffFileQuery = vi.hoisted(() => vi.fn())
const gitCommitDiffQuery = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    gitDiffFile: { useQuery: gitDiffFileQuery },
    gitRangeDiffFile: { useQuery: gitRangeDiffFileQuery },
    gitCommitDiff: { useQuery: gitCommitDiffQuery },
    useUtils,
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  useRepoStore.setState({ repo: null })
  gitDiffFileQuery.mockReturnValue({ data: undefined, error: null })
  gitRangeDiffFileQuery.mockReturnValue({ data: undefined, error: null })
  gitCommitDiffQuery.mockReturnValue({ data: undefined, error: null })
  useUtils.mockReturnValue({
    gitDiffFile: { prefetch: vi.fn() },
    gitRangeDiffFile: { prefetch: vi.fn() },
  })
})

describe('useDiffFile', () => {
  it('disables both queries with no repo selected, no base', () => {
    const { result } = renderHook(() => useDiffFile('src/a.ts'))
    expect(gitDiffFileQuery).toHaveBeenCalledWith(
      { repoPath: '', filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: false }),
    )
    expect(gitRangeDiffFileQuery).toHaveBeenCalledWith(
      { repoPath: '', base: '', filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current.hunks).toBeUndefined()
    expect(result.current.status).toBeUndefined()
    expect(result.current.image).toBeUndefined()
    expect(result.current.binary).toBe(false)
  })

  it('with no base, enables the working-tree query only and reads it', () => {
    useRepoStore.setState({ repo: aRepo })
    const hunks = [{ header: '@@ -1 +1 @@', lines: [] }]
    gitDiffFileQuery.mockReturnValue({ data: { hunks, status: 'modified' }, error: null })

    const { result } = renderHook(() => useDiffFile('src/a.ts'))

    expect(gitDiffFileQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: true }),
    )
    expect(gitRangeDiffFileQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current.hunks).toBe(hunks)
    expect(result.current.status).toBe('modified')
  })

  it('with a base, enables the range query only and reads it', () => {
    useRepoStore.setState({ repo: aRepo })
    const hunks = [{ header: '@@ -1 +1 @@', lines: [] }]
    gitRangeDiffFileQuery.mockReturnValue({ data: { hunks, status: 'added' }, error: null })

    const { result } = renderHook(() => useDiffFile('src/a.ts', 'main'))

    expect(gitDiffFileQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    )
    expect(gitRangeDiffFileQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, base: 'main', filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current.hunks).toBe(hunks)
    expect(result.current.status).toBe('added')
  })

  it('collapses a missing `binary` flag to false', () => {
    useRepoStore.setState({ repo: aRepo })
    gitDiffFileQuery.mockReturnValue({ data: { hunks: [] }, error: null })
    const { result } = renderHook(() => useDiffFile('src/a.ts'))
    expect(result.current.binary).toBe(false)
  })

  it('reports `binary: true` only when the query says so exactly', () => {
    useRepoStore.setState({ repo: aRepo })
    gitDiffFileQuery.mockReturnValue({ data: { hunks: [], binary: true }, error: null })
    const { result } = renderHook(() => useDiffFile('src/a.ts'))
    expect(result.current.binary).toBe(true)
  })

  it('passes through the active query error', () => {
    useRepoStore.setState({ repo: aRepo })
    const error = { message: 'no such path' }
    gitDiffFileQuery.mockReturnValue({ data: undefined, error })
    const { result } = renderHook(() => useDiffFile('src/a.ts'))
    expect(result.current.error).toBe(error)
  })
})

describe('useDiffFilePrefetch', () => {
  it('does nothing with no repo selected', async () => {
    const prefetch = vi.fn()
    useUtils.mockReturnValue({
      gitDiffFile: { prefetch },
      gitRangeDiffFile: { prefetch: vi.fn() },
    })
    const { result } = renderHook(() => useDiffFilePrefetch())
    await result.current('src/a.ts')
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('prefetches the working-tree diff when no base is given', async () => {
    useRepoStore.setState({ repo: aRepo })
    const prefetch = vi.fn().mockResolvedValue(undefined)
    useUtils.mockReturnValue({
      gitDiffFile: { prefetch },
      gitRangeDiffFile: { prefetch: vi.fn() },
    })
    const { result } = renderHook(() => useDiffFilePrefetch())

    await result.current('src/a.ts')

    expect(prefetch).toHaveBeenCalledWith(
      { repoPath: aRepo.path, filePath: 'src/a.ts' },
      { staleTime: 2000 },
    )
  })

  it('prefetches the range diff when a base is given', async () => {
    useRepoStore.setState({ repo: aRepo })
    const prefetch = vi.fn().mockResolvedValue(undefined)
    useUtils.mockReturnValue({
      gitDiffFile: { prefetch: vi.fn() },
      gitRangeDiffFile: { prefetch },
    })
    const { result } = renderHook(() => useDiffFilePrefetch())

    await result.current('src/a.ts', 'main')

    expect(prefetch).toHaveBeenCalledWith(
      { repoPath: aRepo.path, base: 'main', filePath: 'src/a.ts' },
      { staleTime: 2000 },
    )
  })
})

describe('useCommitDiff', () => {
  it('disables the query with no repo selected', () => {
    const { result } = renderHook(() => useCommitDiff('abc123', 'src/a.ts'))
    expect(gitCommitDiffQuery).toHaveBeenCalledWith(
      { repoPath: '', hash: 'abc123', filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current.hunks).toBeUndefined()
  })

  it('passes through hunks and error for a real repo', () => {
    useRepoStore.setState({ repo: aRepo })
    const hunks = [{ header: '@@ -1 +1 @@', lines: [] }]
    const error = null
    gitCommitDiffQuery.mockReturnValue({ data: hunks, error })
    const { result } = renderHook(() => useCommitDiff('abc123', 'src/a.ts'))
    expect(gitCommitDiffQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, hash: 'abc123', filePath: 'src/a.ts' },
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current.hunks).toBe(hunks)
    expect(result.current.error).toBeNull()
  })
})
