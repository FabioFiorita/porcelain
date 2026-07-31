import { useRepoStore } from '@renderer/stores/repo'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCommitFlow,
  useCommitMessage,
  useFetchCommitMessage,
  useFileLog,
  useGitLog,
} from './use-history'

const gitLogQuery = vi.hoisted(() => vi.fn())
const gitFileLogQuery = vi.hoisted(() => vi.fn())
const gitCommitMessageQuery = vi.hoisted(() => vi.fn())
const gitCommitFlowQuery = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    gitLog: { useQuery: gitLogQuery },
    gitFileLog: { useQuery: gitFileLogQuery },
    gitCommitMessage: { useQuery: gitCommitMessageQuery },
    gitCommitFlow: { useQuery: gitCommitFlowQuery },
    useUtils,
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  useRepoStore.setState({ repo: null })
  gitLogQuery.mockReturnValue({ data: undefined })
  gitFileLogQuery.mockReturnValue({ data: undefined })
  gitCommitMessageQuery.mockReturnValue({ data: undefined })
  gitCommitFlowQuery.mockReturnValue({ data: undefined })
})

describe('useGitLog', () => {
  it('disables the query with no repo selected', () => {
    const { result } = renderHook(() => useGitLog())
    expect(gitLogQuery).toHaveBeenCalledWith(
      { repoPath: '', limit: 200 },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current).toBeUndefined()
  })

  it('stays disabled when explicitly disabled, even with a repo open', () => {
    useRepoStore.setState({ repo: aRepo })
    renderHook(() => useGitLog(200, false))
    expect(gitLogQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, limit: 200 },
      expect.objectContaining({ enabled: false }),
    )
  })

  it('enables and forwards a custom limit with a repo open', () => {
    useRepoStore.setState({ repo: aRepo })
    const commits = [{ hash: 'a', author: 'x', date: 'today', subject: 'msg' }]
    gitLogQuery.mockReturnValue({ data: commits })
    const { result } = renderHook(() => useGitLog(50))
    expect(gitLogQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, limit: 50 },
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current).toBe(commits)
  })
})

describe('useFileLog', () => {
  it('disables the query when no file is open in the viewer', () => {
    useRepoStore.setState({ repo: aRepo })
    const { result } = renderHook(() => useFileLog(null))
    expect(gitFileLogQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, filePath: '', limit: 50 },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current).toBeUndefined()
  })

  it('enables the query and forwards the file path once one is open', () => {
    useRepoStore.setState({ repo: aRepo })
    const commits = [{ hash: 'a', author: 'x', date: 'today', subject: 'msg' }]
    gitFileLogQuery.mockReturnValue({ data: commits })
    const { result } = renderHook(() => useFileLog('src/a.ts', 10))
    expect(gitFileLogQuery).toHaveBeenCalledWith(
      { repoPath: aRepo.path, filePath: 'src/a.ts', limit: 10 },
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current).toBe(commits)
  })
})

describe('useCommitMessage', () => {
  it('disables the query with no repo selected', () => {
    const { result } = renderHook(() => useCommitMessage('abc123'))
    expect(gitCommitMessageQuery).toHaveBeenCalledWith(
      { repoPath: '', hash: 'abc123' },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current).toBeUndefined()
  })

  it('passes through the commit message', () => {
    useRepoStore.setState({ repo: aRepo })
    gitCommitMessageQuery.mockReturnValue({ data: 'fix: thing' })
    const { result } = renderHook(() => useCommitMessage('abc123'))
    expect(result.current).toBe('fix: thing')
  })
})

describe('useFetchCommitMessage', () => {
  it('resolves to an empty string with no repo selected', async () => {
    const fetch = vi.fn()
    useUtils.mockReturnValue({ gitCommitMessage: { fetch } })
    const { result } = renderHook(() => useFetchCommitMessage())

    await expect(result.current('abc123')).resolves.toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the full commit message with a repo open', async () => {
    useRepoStore.setState({ repo: aRepo })
    const fetch = vi.fn().mockResolvedValue('fix: thing\n\nbody')
    useUtils.mockReturnValue({ gitCommitMessage: { fetch } })
    const { result } = renderHook(() => useFetchCommitMessage())

    await expect(result.current('abc123')).resolves.toBe('fix: thing\n\nbody')
    expect(fetch).toHaveBeenCalledWith({ repoPath: aRepo.path, hash: 'abc123' })
  })
})

describe('useCommitFlow', () => {
  it('disables the query with no repo selected', () => {
    const { result } = renderHook(() => useCommitFlow('abc123'))
    expect(gitCommitFlowQuery).toHaveBeenCalledWith(
      { repoPath: '', hash: 'abc123' },
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current.groups).toBeUndefined()
  })

  it('wraps the query data in a groups object', () => {
    useRepoStore.setState({ repo: aRepo })
    const groups = [{ layer: 'ui', files: [] }]
    gitCommitFlowQuery.mockReturnValue({ data: groups })
    const { result } = renderHook(() => useCommitFlow('abc123'))
    expect(result.current.groups).toBe(groups)
  })
})
