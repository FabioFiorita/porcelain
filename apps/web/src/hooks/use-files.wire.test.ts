import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DISABLED_FILES_QUERY_INPUT,
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
  useCreateFile,
  useCreateFolder,
  useDuplicatePath,
  usePreviewHtml,
  useReadFile,
  useReadFilePrefetch,
  useRenamePath,
  useTrashPath,
  useWriteTextFile,
} from './use-files'

const readFileQuery = vi.hoisted(() => vi.fn())
const previewHtmlQuery = vi.hoisted(() => vi.fn())
const writeTextFileMutation = vi.hoisted(() => vi.fn())
const createFileMutation = vi.hoisted(() => vi.fn())
const createFolderMutation = vi.hoisted(() => vi.fn())
const renamePathMutation = vi.hoisted(() => vi.fn())
const duplicatePathMutation = vi.hoisted(() => vi.fn())
const trashPathMutation = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())
const useRepoStoreMock = vi.hoisted(() => vi.fn())
const prefetch = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    readFile: { useQuery: readFileQuery },
    previewHtml: { useQuery: previewHtmlQuery },
    writeTextFile: { useMutation: writeTextFileMutation },
    createFile: { useMutation: createFileMutation },
    createFolder: { useMutation: createFolderMutation },
    renamePath: { useMutation: renamePathMutation },
    duplicatePath: { useMutation: duplicatePathMutation },
    trashPath: { useMutation: trashPathMutation },
    useUtils,
  },
  shellTrpc: {},
}))

vi.mock('@renderer/stores/repo', () => ({
  useRepoStore: (
    selector: (s: { repo: { path: string } | null; showHidden: boolean }) => unknown,
  ) => useRepoStoreMock(selector),
}))

vi.mock('@renderer/stores/selection', () => ({
  useSelectionStore: () => ({ selected: new Set(), clear: vi.fn() }),
}))

vi.mock('@renderer/stores/tabs', () => ({
  tabId: () => 'file:x',
  useTabsStore: {
    getState: () => ({ closeTabEverywhere: vi.fn() }),
  },
}))

vi.mock('@renderer/hooks/mutation-error', () => ({
  onMutationError: () => undefined,
}))

const REPO = '/synthetic/repo'
const FILE_ABS = '/synthetic/repo/docs/notes.txt'

function withRepo(path: string | null) {
  useRepoStoreMock.mockImplementation(
    (selector: (s: { repo: { path: string } | null; showHidden: boolean }) => unknown) =>
      selector({ repo: path === null ? null : { path }, showHidden: false }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  withRepo(REPO)
  readFileQuery.mockReturnValue({ data: undefined, error: null })
  previewHtmlQuery.mockReturnValue({ data: undefined, error: null })
  writeTextFileMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  createFileMutation.mockReturnValue({ mutateAsync: vi.fn(), error: null })
  createFolderMutation.mockReturnValue({ mutateAsync: vi.fn(), error: null })
  renamePathMutation.mockReturnValue({ mutateAsync: vi.fn(), error: null })
  duplicatePathMutation.mockReturnValue({ mutateAsync: vi.fn(), error: null })
  trashPathMutation.mockReturnValue({ mutateAsync: vi.fn() })
  useUtils.mockReturnValue({
    readFile: { prefetch, invalidate: vi.fn() },
    previewHtml: { invalidate: vi.fn() },
    readDir: { invalidate: vi.fn() },
    pinnedEntries: { invalidate: vi.fn() },
    gitFlow: { invalidate: vi.fn() },
    gitDiffFile: { invalidate: vi.fn() },
    repoScope: { invalidate: vi.fn() },
  })
})

describe('project path helpers', () => {
  it('normalizes trailing slashes including root variants', () => {
    expect(normalizeProjectRoot('/repo/')).toBe('/repo')
    expect(normalizeProjectRoot('/')).toBe('/')
    expect(normalizeProjectRoot('//')).toBe('/')
    expect(normalizeProjectRoot('///')).toBe('/')
  })

  it('converts absolute paths under the project to relative wire paths', () => {
    expect(projectRelativeFromAbsolute(REPO, FILE_ABS)).toBe('docs/notes.txt')
    expect(projectRelativeFromAbsolute('/repo/', '/repo/a.ts')).toBe('a.ts')
    expect(projectRelativeFromAbsolute(REPO, REPO)).toBeNull()
    expect(projectRelativeFromAbsolute(REPO, '/other/a.ts')).toBeNull()
    expect(projectRelativeFromAbsolute(REPO, '/synthetic/repo/foo/../bar')).toBeNull()
  })

  it('builds UI absolute paths without double slash when root is /', () => {
    expect(projectAbsoluteFromRelative('/', 'etc/passwd')).toBe('/etc/passwd')
    expect(projectAbsoluteFromRelative(REPO, 'docs/guide copy.md')).toBe(
      '/synthetic/repo/docs/guide copy.md',
    )
  })
})

describe('web files wire cutover', () => {
  it('always invokes readFile with DISABLED sentinel + enabled false when no repo', () => {
    withRepo(null)
    renderHook(() => useReadFile(FILE_ABS))
    expect(readFileQuery).toHaveBeenCalledWith(DISABLED_FILES_QUERY_INPUT, {
      enabled: false,
    })
  })

  it('always invokes readFile with DISABLED sentinel when absolute path is outside the project', () => {
    renderHook(() => useReadFile('/outside/secret.txt'))
    expect(readFileQuery).toHaveBeenCalledWith(DISABLED_FILES_QUERY_INPUT, {
      enabled: false,
    })
  })

  it('sends projectPath + relative path for readFile when conversion is valid', () => {
    renderHook(() => useReadFile(FILE_ABS))
    expect(readFileQuery).toHaveBeenCalledWith(
      { projectPath: REPO, path: 'docs/notes.txt' },
      { enabled: true },
    )
  })

  it('sends projectPath + relative path for previewHtml when enabled', () => {
    renderHook(() => usePreviewHtml(`${REPO}/docs/index.html`, true))
    expect(previewHtmlQuery).toHaveBeenCalledWith(
      { projectPath: REPO, path: 'docs/index.html' },
      { enabled: true },
    )
  })

  it('prefetch is a true no-op without repo or with invalid conversion', async () => {
    withRepo(null)
    const { result: noRepo } = renderHook(() => useReadFilePrefetch())
    await noRepo.current(FILE_ABS)
    expect(prefetch).not.toHaveBeenCalled()

    withRepo(REPO)
    const { result } = renderHook(() => useReadFilePrefetch())
    await result.current('/outside/x')
    expect(prefetch).not.toHaveBeenCalled()

    await result.current(FILE_ABS)
    expect(prefetch).toHaveBeenCalledWith({ projectPath: REPO, path: 'docs/notes.txt' })
  })

  it('writeTextFile mutates object input and no-ops without valid conversion', () => {
    const mutate = vi.fn()
    writeTextFileMutation.mockReturnValue({ mutate, isPending: false, error: null })
    const { result } = renderHook(() => useWriteTextFile(FILE_ABS))
    result.current.save('body')
    expect(mutate).toHaveBeenCalledWith(
      { projectPath: REPO, path: 'docs/notes.txt', content: 'body' },
      expect.any(Object),
    )

    mutate.mockClear()
    const { result: outside } = renderHook(() => useWriteTextFile('/outside/x'))
    outside.current.save('body')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('create/rename/trash/duplicate send projectPath objects; invalid conversions no-op', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined)
    const folderMutate = vi.fn().mockResolvedValue(undefined)
    const renameMutate = vi.fn().mockResolvedValue(undefined)
    const trashMutate = vi.fn().mockResolvedValue(undefined)
    const dupMutate = vi.fn().mockResolvedValue('docs/notes copy.txt')
    createFileMutation.mockReturnValue({ mutateAsync: createMutate, error: null })
    createFolderMutation.mockReturnValue({ mutateAsync: folderMutate, error: null })
    renamePathMutation.mockReturnValue({ mutateAsync: renameMutate, error: null })
    trashPathMutation.mockReturnValue({ mutateAsync: trashMutate })
    duplicatePathMutation.mockReturnValue({ mutateAsync: dupMutate, error: null })

    const { result: create } = renderHook(() => useCreateFile())
    await create.current.create(`${REPO}/docs/empty.txt`)
    expect(createMutate).toHaveBeenCalledWith({ projectPath: REPO, path: 'docs/empty.txt' })

    const { result: folder } = renderHook(() => useCreateFolder())
    await folder.current.create(`${REPO}/docs/generated`)
    expect(folderMutate).toHaveBeenCalledWith({ projectPath: REPO, path: 'docs/generated' })

    const { result: rename } = renderHook(() => useRenamePath())
    await rename.current.rename(`${REPO}/docs/draft.md`, `${REPO}/docs/final.md`)
    expect(renameMutate).toHaveBeenCalledWith({
      projectPath: REPO,
      from: 'docs/draft.md',
      to: 'docs/final.md',
    })

    const { result: trash } = renderHook(() => useTrashPath())
    await trash.current(`${REPO}/docs/old.md`)
    expect(trashMutate).toHaveBeenCalledWith({ projectPath: REPO, path: 'docs/old.md' })

    const { result: dup } = renderHook(() => useDuplicatePath())
    await expect(dup.current(FILE_ABS)).resolves.toBe(`${REPO}/docs/notes copy.txt`)
    expect(dupMutate).toHaveBeenCalledWith({ projectPath: REPO, path: 'docs/notes.txt' })

    createMutate.mockClear()
    dupMutate.mockClear()
    withRepo(null)
    const { result: noRepoCreate } = renderHook(() => useCreateFile())
    await noRepoCreate.current.create(FILE_ABS)
    expect(createMutate).not.toHaveBeenCalled()
    const { result: noRepoDup } = renderHook(() => useDuplicatePath())
    await expect(noRepoDup.current(FILE_ABS)).resolves.toBeNull()
    expect(dupMutate).not.toHaveBeenCalled()
  })

  it('duplicate absolute rebuild for root project never yields //name', async () => {
    withRepo('/')
    const dupMutate = vi.fn().mockResolvedValue('etc/hosts')
    duplicatePathMutation.mockReturnValue({ mutateAsync: dupMutate, error: null })
    const { result } = renderHook(() => useDuplicatePath())
    await expect(result.current('/etc/passwd')).resolves.toBe('/etc/hosts')
  })
})
