import {
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesProjectKey,
  filesTreeQuery,
  isFilesProjectRelativePath,
} from '@porcelain/client-runtime/files'
import { type DirEntry, type FileView, filesProcedures } from '@porcelain/contracts/files'
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query'

import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { namedContractProcedure } from '@/lib/daemon/procedure'
import { useActiveRepo } from '@/lib/daemon/repo'

import { absolutePath, relativePath } from './file-paths'
import { useFilesDirectoryInterest, useFilesViewerInterest } from './files-interests'
import { filesQueryKey } from './files-query-key'
import { useFilesStore } from './files-store'
import { callFilesQuery } from './use-files-reads'

/** A repo-relative directory entry — what every row, route and comment in this tab speaks. */
export type FileEntry = Omit<DirEntry, 'path'> & {
  path: string
  absolutePath: string
}

export type FileContents = {
  view: FileView | undefined
  isLoading: boolean
  error: Error | null
}

const DISABLED_TREE = filesTreeQuery('/', '.', false)
const DISABLED_PINS = filesPinsQuery('/')
const DISABLED_CONTENT = fileContentQuery('/', '__disabled__')
const DISABLED_PREVIEW = filePreviewQuery('/', '__disabled__')

const readDirProcedure = namedContractProcedure('readDir', filesProcedures.readDir)
const pinnedEntriesProcedure = namedContractProcedure(
  'pinnedEntries',
  filesProcedures.pinnedEntries,
)
const readFileProcedure = namedContractProcedure('readFile', filesProcedures.readFile)
const previewHtmlProcedure = namedContractProcedure('previewHtml', filesProcedures.previewHtml)

function queryError(query: UseQueryResult<unknown>): Error | null {
  if (!query.isError) return null
  return query.error instanceof Error ? query.error : new Error(String(query.error))
}

function liveProjectPath(
  environment: ReturnType<typeof useActiveEnvironment>,
  repo: ReturnType<typeof useActiveRepo>,
): string | null {
  if (!isPaired(environment) || repo === null) return null
  return filesProjectKey(repo.path)
}

function toEntries(repoPath: string, entries: readonly DirEntry[] | undefined): FileEntry[] {
  if (entries === undefined) return []
  const mapped: FileEntry[] = []
  for (const entry of entries) {
    const path = relativePath(repoPath, entry.path)
    if (path === null) continue
    mapped.push({ ...entry, absolutePath: entry.path, path })
  }
  return mapped
}

function readState<T>(
  query: UseQueryResult<T>,
  enabled: boolean,
): { data: T | undefined; error: Error | null; isLoading: boolean } {
  return {
    data: enabled ? query.data : undefined,
    error: enabled ? queryError(query as UseQueryResult<unknown>) : null,
    isLoading: enabled ? query.isPending : false,
  }
}

function disabledQuery(label: string): never {
  throw new Error(`files: disabled ${label} queryFn must not run`)
}

export function useDirEntries(
  relative: string,
  active: boolean,
): { entries: FileEntry[]; isLoading: boolean; error: Error | null } {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const showHidden = useFilesStore((state) => state.showHidden)
  const projectPath = liveProjectPath(environment, repo)
  const treePath = relative === '' ? '.' : relative
  const valid = projectPath !== null && (treePath === '.' || isFilesProjectRelativePath(treePath))
  const enabled = active && valid && isPaired(environment)
  const environmentId = environment?.id ?? 'none'
  const identity =
    projectPath !== null && enabled
      ? filesTreeQuery(projectPath, treePath, showHidden)
      : DISABLED_TREE

  useFilesDirectoryInterest(relative, enabled)
  const query = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DirEntry[]> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('tree')
      const path = treePath === '.' ? projectPath : absolutePath(projectPath, treePath)
      return callFilesQuery(environment, readDirProcedure, {
        path,
        repoPath: projectPath,
        showHidden,
      })
    },
    queryKey: filesQueryKey(environmentId, identity),
  })
  const state = readState(query, enabled)

  return {
    entries: toEntries(repo?.path ?? '/', state.data),
    error: state.error,
    isLoading: state.isLoading,
  }
}

export function usePinnedEntries(active: boolean): {
  entries: FileEntry[]
  isLoading: boolean
  error: Error | null
} {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const projectPath = liveProjectPath(environment, repo)
  const enabled = active && projectPath !== null && isPaired(environment)
  const environmentId = environment?.id ?? 'none'
  const identity = projectPath !== null && enabled ? filesPinsQuery(projectPath) : DISABLED_PINS
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<DirEntry[]> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('pins')
      return callFilesQuery(environment, pinnedEntriesProcedure, projectPath)
    },
    queryKey: filesQueryKey(environmentId, identity),
  })
  const state = readState(query, enabled)

  return {
    entries: toEntries(repo?.path ?? '/', state.data),
    error: state.error,
    isLoading: state.isLoading,
  }
}

export function useFileContents(relative: string, active: boolean): FileContents {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const projectPath = liveProjectPath(environment, repo)
  const valid = projectPath !== null && relative !== '' && isFilesProjectRelativePath(relative)
  const enabled = active && valid && isPaired(environment)
  const environmentId = environment?.id ?? 'none'
  const identity =
    projectPath !== null && enabled ? fileContentQuery(projectPath, relative) : DISABLED_CONTENT

  useFilesViewerInterest(relative, enabled)
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<FileView> => {
      if (!enabled || projectPath === null || !isPaired(environment)) {
        return disabledQuery('content')
      }
      return callFilesQuery(environment, readFileProcedure, {
        path: relative,
        projectPath,
      })
    },
    queryKey: filesQueryKey(environmentId, identity),
  })
  const state = readState(query, enabled)
  return { error: state.error, isLoading: state.isLoading, view: state.data }
}

export function useHtmlPreview(
  relative: string,
  active: boolean,
): { html: string | null | undefined; isLoading: boolean; error: Error | null } {
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const projectPath = liveProjectPath(environment, repo)
  const valid = projectPath !== null && relative !== '' && isFilesProjectRelativePath(relative)
  const enabled = active && valid && isPaired(environment)
  const environmentId = environment?.id ?? 'none'
  const identity =
    projectPath !== null && enabled ? filePreviewQuery(projectPath, relative) : DISABLED_PREVIEW
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<string | null> => {
      if (!enabled || projectPath === null || !isPaired(environment)) {
        return disabledQuery('preview')
      }
      return callFilesQuery(environment, previewHtmlProcedure, {
        path: relative,
        projectPath,
      })
    },
    queryKey: filesQueryKey(environmentId, identity),
  })
  const state = readState(query, enabled)
  return { error: state.error, html: state.data, isLoading: state.isLoading }
}
