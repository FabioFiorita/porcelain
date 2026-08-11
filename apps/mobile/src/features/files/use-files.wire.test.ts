import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useActiveRepo = vi.hoisted(() => vi.fn())
const useDaemonQuery = vi.hoisted(() => vi.fn())
const useDaemonMutation = vi.hoisted(() => vi.fn())
const useDaemonWatch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/daemon/repo', () => ({ useActiveRepo }))
vi.mock('@/lib/daemon/queries', () => ({
  useDaemonQuery,
  useDaemonMutation,
}))
vi.mock('@/lib/daemon/watch', () => ({ useDaemonWatch }))
vi.mock('./files-store', () => ({
  useFilesStore: (sel: (s: { showHidden: boolean }) => unknown) => sel({ showHidden: false }),
}))

import { useFileContents, useFileWrites, useHtmlPreview } from './use-files'

const REPO = { path: '/synthetic/repo', name: 'repo' }
const DISABLED = { projectPath: '/', path: '__disabled__' }

beforeEach(() => {
  vi.clearAllMocks()
  useActiveRepo.mockReturnValue(REPO)
  useDaemonQuery.mockReturnValue({ data: undefined, error: null, isLoading: false })
  useDaemonWatch.mockReturnValue(undefined)
  useDaemonMutation.mockImplementation(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }))
})

describe('mobile files wire cutover', () => {
  it('queries use projectPath + relative; invalid uses disabled sentinel + enabled false', () => {
    renderHook(() => useFileContents('src/main.ts', true))
    expect(useDaemonQuery).toHaveBeenCalledWith(
      expect.anything(),
      { projectPath: REPO.path, path: 'src/main.ts' },
      { enabled: true },
    )

    useDaemonQuery.mockClear()
    renderHook(() => useFileContents('foo/../bar', true))
    expect(useDaemonQuery).toHaveBeenCalledWith(expect.anything(), DISABLED, { enabled: false })

    useDaemonQuery.mockClear()
    renderHook(() => useFileContents('foo//bar', true))
    expect(useDaemonQuery).toHaveBeenCalledWith(expect.anything(), DISABLED, { enabled: false })

    useDaemonQuery.mockClear()
    useActiveRepo.mockReturnValue(null)
    renderHook(() => useFileContents('src/main.ts', true))
    expect(useDaemonQuery).toHaveBeenCalledWith(expect.anything(), DISABLED, { enabled: false })
  })

  it('preview uses projectPath + relative when valid', () => {
    renderHook(() => useHtmlPreview('docs/index.html', true))
    expect(useDaemonQuery).toHaveBeenCalledWith(
      expect.anything(),
      { projectPath: REPO.path, path: 'docs/index.html' },
      { enabled: true },
    )
  })

  it('writes seven live payloads with projectPath; invalid/no-repo no-ops', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined)
    const folderMutate = vi.fn().mockResolvedValue(undefined)
    const renameMutate = vi.fn().mockResolvedValue(undefined)
    const dupMutate = vi.fn().mockResolvedValue('docs/guide copy.md')
    const trashMutate = vi.fn().mockResolvedValue(undefined)
    let call = 0
    useDaemonMutation.mockImplementation(() => {
      const mutateAsync = [createMutate, folderMutate, renameMutate, dupMutate, trashMutate][call++]
      return { mutateAsync, isPending: false, error: null }
    })

    const { result } = renderHook(() => useFileWrites())
    await result.current.createFile('docs', 'empty.txt')
    expect(createMutate).toHaveBeenCalledWith({
      projectPath: REPO.path,
      path: 'docs/empty.txt',
    })
    await result.current.createFolder('docs', 'generated')
    expect(folderMutate).toHaveBeenCalledWith({
      projectPath: REPO.path,
      path: 'docs/generated',
    })
    await result.current.rename('docs/draft.md', 'final.md')
    expect(renameMutate).toHaveBeenCalledWith({
      projectPath: REPO.path,
      from: 'docs/draft.md',
      to: 'docs/final.md',
    })
    await expect(result.current.duplicate('docs/guide.md')).resolves.toBe('docs/guide copy.md')
    expect(dupMutate).toHaveBeenCalledWith({ projectPath: REPO.path, path: 'docs/guide.md' })
    await result.current.trash('docs/old.md')
    expect(trashMutate).toHaveBeenCalledWith({ projectPath: REPO.path, path: 'docs/old.md' })

    createMutate.mockClear()
    dupMutate.mockClear()
    call = 0
    useDaemonMutation.mockImplementation(() => {
      const mutateAsync = [createMutate, folderMutate, renameMutate, dupMutate, trashMutate][call++]
      return { mutateAsync, isPending: false, error: null }
    })
    // Invalid assembled path (dot-segment via name)
    const { result: bad } = renderHook(() => useFileWrites())
    await bad.current.createFile('docs', '..')
    expect(createMutate).not.toHaveBeenCalled()
    await expect(bad.current.duplicate('foo/../bar')).resolves.toBeNull()
    expect(dupMutate).not.toHaveBeenCalled()

    useActiveRepo.mockReturnValue(null)
    call = 0
    useDaemonMutation.mockImplementation(() => {
      const mutateAsync = [createMutate, folderMutate, renameMutate, dupMutate, trashMutate][call++]
      return { mutateAsync, isPending: false, error: null }
    })
    const { result: noRepo } = renderHook(() => useFileWrites())
    await noRepo.current.createFile('', 'a.txt')
    expect(createMutate).not.toHaveBeenCalled()
    await expect(noRepo.current.duplicate('a.txt')).resolves.toBeNull()
  })
})
