import {
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesProjectKey,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import {
  type DirEntry,
  type FileView,
  filesProcedures,
  isFilesProjectRelativePath,
} from '@porcelain/contracts/files'
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { relativePath } from './file-paths'
import { useFilesDirectoryInterest, useFilesViewerInterest } from './files-interests'
import { filesQueryKey } from './files-query-key'
import { useFilesStore } from './files-store'
import { callFilesQuery } from './use-files-reads'

/** A project-relative directory entry — what every row, route and comment in this tab speaks. */
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
  repoPath: string | null,
): string | null {
  if (!isPaired(environment) || repoPath === null) return null
  return filesProjectKey(repoPath)
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
  const queryClient = useQueryClient()
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const showHidden = useFilesStore((state) => state.showHidden)
  const projectPath = liveProjectPath(environment, repoPath)
  const treePath = relative === '' ? '.' : relative
  const valid = projectPath !== null && (treePath === '.' || isFilesProjectRelativePath(treePath))
  const enabled = active && valid && isPaired(environment)
  const environmentId = environment?.id ?? 'none'
  const identity =
    projectPath !== null && valid
      ? filesTreeQuery(projectPath, treePath, showHidden)
      : DISABLED_TREE

  useFilesDirectoryInterest(relative, enabled)
  const query = useQuery({
    enabled,
    placeholderData: () => {
      if (!enabled || projectPath === null) return undefined
      const cached = queryClient.getQueryData<DirEntry[]>(
        filesQueryKey(environmentId, filesTreeQuery(projectPath, treePath, !showHidden)),
      )
      return showHidden ? cached : cached?.filter((entry) => !entry.hidden)
    },
    queryFn: async (): Promise<DirEntry[]> => {
      if (!enabled || projectPath === null || !isPaired(environment)) return disabledQuery('tree')
      return callFilesQuery(environment, readDirProcedure, {
        path: treePath,
        projectPath,
        showHidden,
      })
    },
    queryKey: filesQueryKey(environmentId, identity),
  })
  const state = readState(query, enabled)
  const entries = useMemo(
    () => toEntries(repoPath ?? '/', valid ? query.data : undefined),
    [repoPath, valid, query.data],
  )

  return {
    entries,
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
  const repoPath = useHubRepoPath()
  const projectPath = liveProjectPath(environment, repoPath)
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
  const entries = useMemo(() => toEntries(repoPath ?? '/', state.data), [repoPath, state.data])

  return {
    entries,
    error: state.error,
    isLoading: state.isLoading,
  }
}

export function useFileContents(relative: string, active: boolean): FileContents {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const projectPath = liveProjectPath(environment, repoPath)
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
  const repoPath = useHubRepoPath()
  const projectPath = liveProjectPath(environment, repoPath)
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
