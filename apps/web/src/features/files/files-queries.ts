import {
  fileContentQuery,
  filePreviewQuery,
  filesExactEffect,
  filesPinsQuery,
  filesProjectKey,
  filesScopeQuery,
  filesTreeFamilyEffect,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import type { DirEntry, FileView, RepoScope } from '@porcelain/contracts/files'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
  treePathFromAbsolute,
} from './files-path'
import { invalidateFilesEffects } from './files-query-filter'
import { filesQueryKey } from './files-query-key'

/** Private sentinel identities for disabled React Query keys (never public, never sent). */
const DISABLED_TREE = filesTreeQuery('/', '.', false)
const DISABLED_PINS = filesPinsQuery('/')
const DISABLED_SCOPE = filesScopeQuery('/')
const DISABLED_CONTENT = fileContentQuery('/', '__disabled__')
const DISABLED_PREVIEW = filePreviewQuery('/', '__disabled__')

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

function invariantDisabledQueryFn(label: string): never {
  throw new Error(`files: disabled ${label} queryFn must not run`)
}

/** Directory listing for one absolute UI path (lazy tree rows). */
export function useFilesTree(absolutePath: string, enabled = true): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const utils = trpc.useUtils()

  const identityPath = repo !== null ? treePathFromAbsolute(repo.path, absolutePath) : null
  const projectKey = repo !== null ? filesProjectKey(repo.path) : null
  const canRun = repo !== null && identityPath !== null && enabled

  const identity =
    canRun && projectKey !== null
      ? filesTreeQuery(projectKey, identityPath, showHidden)
      : DISABLED_TREE

  const { data } = useQuery({
    queryKey: filesQueryKey(daemonScope, identity),
    queryFn: async (): Promise<DirEntry[]> => {
      if (!canRun || projectKey === null || identityPath === null) {
        return invariantDisabledQueryFn('tree')
      }
      const wireAbs =
        identityPath === '.' ? projectKey : projectAbsoluteFromRelative(projectKey, identityPath)
      return utils.client.readDir.query({
        repoPath: projectKey,
        path: wireAbs,
        showHidden,
      })
    },
    enabled: canRun,
  })

  return data
}

/** Pinned entries for the active project. */
export function usePinnedFiles(): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const utils = trpc.useUtils()
  const projectKey = repo !== null ? filesProjectKey(repo.path) : null
  const identity = projectKey !== null ? filesPinsQuery(projectKey) : DISABLED_PINS

  const { data } = useQuery({
    queryKey: filesQueryKey(daemonScope, identity),
    queryFn: async (): Promise<DirEntry[]> => {
      if (projectKey === null) return invariantDisabledQueryFn('pins')
      return utils.client.pinnedEntries.query(projectKey)
    },
    enabled: repo !== null,
  })

  return data
}

/** Monorepo hide/pin lists; empty arrays when the repo has never configured scope. */
export function useFilesScope(): RepoScope | undefined {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const utils = trpc.useUtils()
  const projectKey = repo !== null ? filesProjectKey(repo.path) : null
  const identity = projectKey !== null ? filesScopeQuery(projectKey) : DISABLED_SCOPE

  const { data } = useQuery({
    queryKey: filesQueryKey(daemonScope, identity),
    queryFn: async (): Promise<RepoScope> => {
      if (projectKey === null) return invariantDisabledQueryFn('scope')
      return utils.client.repoScope.query(projectKey)
    },
    enabled: repo !== null,
  })

  return data
}

/** File body for one absolute UI path. */
export function useFileContent(
  absolutePath: string,
  enabled = true,
): {
  view: FileView | undefined
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const utils = trpc.useUtils()
  const rel = repo ? projectRelativeFromAbsolute(repo.path, absolutePath) : null
  const projectKey = repo !== null ? filesProjectKey(repo.path) : null
  const canRun =
    enabled && repo !== null && rel !== null && absolutePath !== '' && projectKey !== null
  const identity =
    canRun && projectKey !== null && rel !== null
      ? fileContentQuery(projectKey, rel)
      : DISABLED_CONTENT

  const { data: view, error } = useQuery({
    queryKey: filesQueryKey(daemonScope, identity),
    queryFn: async (): Promise<FileView> => {
      if (!canRun || projectKey === null || rel === null) {
        return invariantDisabledQueryFn('content')
      }
      return utils.client.readFile.query({ projectPath: projectKey, path: rel })
    },
    enabled: canRun,
  })

  return { view, error }
}

/**
 * Sandboxed HTML preview for a path. Only enabled while HTML preview mode is active.
 */
export function useFilePreview(
  absolutePath: string,
  enabled: boolean,
): { html: string | null | undefined; error: { message: string } | null } {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const utils = trpc.useUtils()
  const rel = repo ? projectRelativeFromAbsolute(repo.path, absolutePath) : null
  const projectKey = repo !== null ? filesProjectKey(repo.path) : null
  const canRun =
    enabled && repo !== null && rel !== null && absolutePath !== '' && projectKey !== null
  const identity =
    canRun && projectKey !== null && rel !== null
      ? filePreviewQuery(projectKey, rel)
      : DISABLED_PREVIEW

  const { data: html, error } = useQuery({
    queryKey: filesQueryKey(daemonScope, identity),
    queryFn: async (): Promise<string | null> => {
      if (!canRun || projectKey === null || rel === null) {
        return invariantDisabledQueryFn('preview')
      }
      return utils.client.previewHtml.query({ projectPath: projectKey, path: rel })
    },
    enabled: canRun,
  })

  return { html, error }
}

/** Prefetch a file's contents (tree hover) into the same key as useFileContent. */
export function usePrefetchFileContent(): (path: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()

  return (path: string): Promise<void> => {
    if (!repo) return Promise.resolve()
    const rel = projectRelativeFromAbsolute(repo.path, path)
    if (rel === null) return Promise.resolve()
    const projectKey = filesProjectKey(repo.path)
    const identity = fileContentQuery(projectKey, rel)
    return queryClient.prefetchQuery({
      queryKey: filesQueryKey(daemonScope, identity),
      queryFn: () => utils.client.readFile.query({ projectPath: projectKey, path: rel }),
    })
  }
}

/** Drop stale tree + pinned rows after a file vanished from disk (external delete). */
export function useRefreshFilesTree(): () => void {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version
  const queryClient = useQueryClient()

  return useCallback(() => {
    if (!repo) return
    const projectKey = filesProjectKey(repo.path)
    const daemonScope: DaemonScope = { host, version }
    void invalidateFilesEffects(queryClient, daemonScope, [
      filesTreeFamilyEffect(projectKey),
      filesExactEffect(filesPinsQuery(projectKey)),
    ])
  }, [repo, host, version, queryClient])
}

// Re-export path helpers used when building wire absolute paths from identity paths.
export { normalizeProjectRoot, projectAbsoluteFromRelative }
