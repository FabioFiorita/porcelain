import {
  fileContentQuery,
  filePreviewQuery,
  filesExactEffect,
  filesPinsQuery,
  filesProfileQuery,
  filesProjectKey,
  filesScopeQuery,
  filesTreeFamilyEffect,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import type { DirEntry, FileView, RepoScope, WorktreeProfileView } from '@porcelain/contracts/files'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeForEnvironment, environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { settleBackground } from '@shared/background'
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
const DISABLED_PROFILE = filesProfileQuery('/')
const DISABLED_CONTENT = fileContentQuery('/', '__disabled__')
const DISABLED_PREVIEW = filePreviewQuery('/', '__disabled__')

function invariantDisabledQueryFn(label: string): never {
  throw new Error(`files: disabled ${label} queryFn must not run`)
}

function useFilesOwner(): {
  repoPath: string | null
  owner: ReturnType<typeof environmentClientFor>
  daemon: DaemonScope
} {
  const target = useHubRepoTarget()
  const repoPath = useHubRepoPath()
  const identity = useDaemonIdentity()
  const primary = trpc.useUtils().client
  return {
    daemon: daemonScopeForEnvironment(target?.environmentId, identity),
    owner:
      target === null && repoPath !== null
        ? { client: primary, session: null }
        : environmentClientFor(target?.environmentId ?? null, primary),
    repoPath,
  }
}

/** Directory listing for one absolute UI path (lazy tree rows). */
export function useFilesTree(absolutePath: string, enabled = true): DirEntry[] | undefined {
  const { daemon, owner, repoPath } = useFilesOwner()
  const showHidden = useProjectSelectionStore((s) => s.showHidden)
  const identityPath = repoPath !== null ? treePathFromAbsolute(repoPath, absolutePath) : null
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const canRun = owner !== null && repoPath !== null && identityPath !== null && enabled

  const identity =
    canRun && projectKey !== null
      ? filesTreeQuery(projectKey, identityPath, showHidden)
      : DISABLED_TREE

  const { data } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<DirEntry[]> => {
      if (!canRun || owner === null || projectKey === null || identityPath === null) {
        return invariantDisabledQueryFn('tree')
      }
      const wireAbs =
        identityPath === '.' ? projectKey : projectAbsoluteFromRelative(projectKey, identityPath)
      return owner.client.readDir.query({
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
  const { daemon, owner, repoPath } = useFilesOwner()
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const identity = projectKey !== null ? filesPinsQuery(projectKey) : DISABLED_PINS

  const { data } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<DirEntry[]> => {
      if (owner === null || projectKey === null) return invariantDisabledQueryFn('pins')
      return owner.client.pinnedEntries.query(projectKey)
    },
    enabled: repoPath !== null,
  })

  return data
}

/** Monorepo hide/pin lists; empty arrays when the project has never configured scope. */
export function useFilesScope(): RepoScope | undefined {
  const { daemon, owner, repoPath } = useFilesOwner()
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const identity = projectKey !== null ? filesScopeQuery(projectKey) : DISABLED_SCOPE

  const { data } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<RepoScope> => {
      if (owner === null || projectKey === null) return invariantDisabledQueryFn('scope')
      return owner.client.repoScope.query(projectKey)
    },
    enabled: repoPath !== null,
  })

  return data
}

/**
 * The worktree profile with its two levels kept apart — Settings →
 * Personalization. `useFilesScope` is the merged answer the tree applies; this
 * is the same state broken into "what the project declares" and "what this
 * worktree added", which is the only thing a reader can act on.
 */
export function useWorktreeProfile(): WorktreeProfileView | undefined {
  const { daemon, owner, repoPath } = useFilesOwner()
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const identity = projectKey !== null ? filesProfileQuery(projectKey) : DISABLED_PROFILE

  const { data } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<WorktreeProfileView> => {
      if (owner === null || projectKey === null) return invariantDisabledQueryFn('profile')
      return owner.client.worktreeProfile.query(projectKey)
    },
    enabled: repoPath !== null,
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
  const { daemon, owner, repoPath } = useFilesOwner()
  const rel = repoPath !== null ? projectRelativeFromAbsolute(repoPath, absolutePath) : null
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const canRun =
    enabled &&
    owner !== null &&
    repoPath !== null &&
    rel !== null &&
    absolutePath !== '' &&
    projectKey !== null
  const identity =
    canRun && projectKey !== null && rel !== null
      ? fileContentQuery(projectKey, rel)
      : DISABLED_CONTENT

  const { data: view, error } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<FileView> => {
      if (!canRun || owner === null || projectKey === null || rel === null) {
        return invariantDisabledQueryFn('content')
      }
      return owner.client.readFile.query({ projectPath: projectKey, path: rel })
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
  const { daemon, owner, repoPath } = useFilesOwner()
  const rel = repoPath !== null ? projectRelativeFromAbsolute(repoPath, absolutePath) : null
  const projectKey = repoPath !== null ? filesProjectKey(repoPath) : null
  const canRun =
    enabled &&
    owner !== null &&
    repoPath !== null &&
    rel !== null &&
    absolutePath !== '' &&
    projectKey !== null
  const identity =
    canRun && projectKey !== null && rel !== null
      ? filePreviewQuery(projectKey, rel)
      : DISABLED_PREVIEW

  const { data: html, error } = useQuery({
    queryKey: filesQueryKey(daemon, identity),
    queryFn: async (): Promise<string | null> => {
      if (!canRun || owner === null || projectKey === null || rel === null) {
        return invariantDisabledQueryFn('preview')
      }
      return owner.client.previewHtml.query({ projectPath: projectKey, path: rel })
    },
    enabled: canRun,
  })

  return { html, error }
}

/** Prefetch a file's contents (tree hover) into the same key as useFileContent. */
export function usePrefetchFileContent(): (path: string) => Promise<void> {
  const { daemon, owner, repoPath } = useFilesOwner()
  const queryClient = useQueryClient()

  return (path: string): Promise<void> => {
    if (owner === null || repoPath === null) return Promise.resolve()
    const rel = projectRelativeFromAbsolute(repoPath, path)
    if (rel === null) return Promise.resolve()
    const projectKey = filesProjectKey(repoPath)
    const identity = fileContentQuery(projectKey, rel)
    return queryClient.prefetchQuery({
      queryKey: filesQueryKey(daemon, identity),
      queryFn: () => owner.client.readFile.query({ projectPath: projectKey, path: rel }),
    })
  }
}

/** Drop stale tree + pinned rows after a file vanished from disk (external delete). */
export function useRefreshFilesTree(): () => void {
  const { daemon, owner, repoPath } = useFilesOwner()
  const host = daemon.host
  const version = daemon.version
  const queryClient = useQueryClient()

  return useCallback(() => {
    if (owner === null || repoPath === null) return
    const projectKey = filesProjectKey(repoPath)
    const daemonScope: DaemonScope = { host, version }
    settleBackground(
      invalidateFilesEffects(queryClient, daemonScope, [
        filesTreeFamilyEffect(projectKey),
        filesExactEffect(filesPinsQuery(projectKey)),
      ]),
      'invalidation',
    )
  }, [repoPath, host, version, queryClient, owner])
}

// Re-export path helpers used when building wire absolute paths from identity paths.
export { normalizeProjectRoot, projectAbsoluteFromRelative }
