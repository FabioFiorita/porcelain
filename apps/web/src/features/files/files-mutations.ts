import {
  type FilesForeignDependency,
  type FilesQueryEffect,
  filesMutations,
  filesProjectKey,
} from '@porcelain/client-runtime/files'
import { invalidateGitWorkingTree } from '@renderer/features/git'
import {
  applySearchForeignDependencies,
  type SearchForeignDependency,
} from '@renderer/features/search'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeForEnvironment, environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
} from './files-path'
import { invalidateFilesEffects } from './files-query-filter'

/**
 * Files mutation adapter.
 *
 * Non-optimistic: success-only invalidation via shared Files effects. Transport
 * goes through the vanilla tRPC client so the feature owns cache identities.
 */

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

function mutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return 'Request failed'
}

function projectPathFromEffects(effects: readonly FilesQueryEffect[]): string | null {
  const first = effects[0]
  if (first === undefined) return null
  return first.type === 'exact' ? first.query.projectPath : first.projectPath
}

/** Map shared Files foreign tokens onto Web Git and typed Search effects. */
export function applyFilesForeignDependencies(
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string | null,
  deps: readonly FilesForeignDependency[],
): Promise<void> {
  const tasks: Promise<unknown>[] = []
  const searchDependencies: SearchForeignDependency[] = []
  for (const dep of deps) {
    if (dep.domain === 'git' && dep.name === 'working-tree') {
      if (projectPath !== null)
        tasks.push(invalidateGitWorkingTree(queryClient, daemon, projectPath))
      continue
    }
    if (dep.domain === 'search') {
      searchDependencies.push(dep)
      continue
    }
    const _exhaustive: never = dep
    return Promise.reject(new Error(`unknown foreign dep: ${JSON.stringify(_exhaustive)}`))
  }
  if (projectPath !== null && searchDependencies.length > 0) {
    tasks.push(applySearchForeignDependencies(queryClient, daemon, projectPath, searchDependencies))
  }
  return Promise.all(tasks).then(() => undefined)
}

async function applyMutationSuccess(
  queryClient: ReturnType<typeof useQueryClient>,
  daemon: DaemonScope,
  effects: ReturnType<typeof filesMutations.createFile.affectedEffects>,
  foreign: readonly FilesForeignDependency[],
): Promise<void> {
  await invalidateFilesEffects(queryClient, daemon, effects)
  await applyFilesForeignDependencies(queryClient, daemon, projectPathFromEffects(effects), foreign)
}

/** Create / rename / duplicate / trash filesystem paths (non-optimistic). */
export function useFilesActions(): {
  createFile: (absolutePath: string) => Promise<void>
  createFolder: (absolutePath: string) => Promise<void>
  rename: (fromAbsolute: string, toAbsolute: string) => Promise<void>
  /** Relative daemon output converted to absolute UI path; null if no project / invalid conversion. */
  duplicate: (absolutePath: string) => Promise<string | null>
  /** True only when the daemon mutation and its success effects completed. */
  trash: (absolutePath: string) => Promise<boolean>
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(
    daemonScopeForEnvironment(target?.environmentId, daemon),
  )
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)

  return {
    createFile: async (absolutePath: string): Promise<void> => {
      if (repoPath === null || owner === null) return
      const rel = projectRelativeFromAbsolute(repoPath, absolutePath)
      if (rel === null) return
      const input = { projectPath: filesProjectKey(repoPath), path: rel }
      await owner.client.createFile.mutate(input)
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.createFile.affectedEffects(input),
        filesMutations.createFile.foreignDependencies(input),
      )
    },
    createFolder: async (absolutePath: string): Promise<void> => {
      if (repoPath === null || owner === null) return
      const rel = projectRelativeFromAbsolute(repoPath, absolutePath)
      if (rel === null) return
      const input = { projectPath: filesProjectKey(repoPath), path: rel }
      await owner.client.createFolder.mutate(input)
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.createFolder.affectedEffects(input),
        filesMutations.createFolder.foreignDependencies(input),
      )
    },
    rename: async (fromAbsolute: string, toAbsolute: string): Promise<void> => {
      if (repoPath === null || owner === null) return
      const fromRel = projectRelativeFromAbsolute(repoPath, fromAbsolute)
      const toRel = projectRelativeFromAbsolute(repoPath, toAbsolute)
      if (fromRel === null || toRel === null) return
      const input = {
        projectPath: filesProjectKey(repoPath),
        from: fromRel,
        to: toRel,
      }
      await owner.client.renamePath.mutate(input)
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.rename.affectedEffects(input),
        filesMutations.rename.foreignDependencies(input),
      )
    },
    duplicate: async (absolutePath: string): Promise<string | null> => {
      if (repoPath === null || owner === null) return null
      const rel = projectRelativeFromAbsolute(repoPath, absolutePath)
      if (rel === null) return null
      const input = { projectPath: filesProjectKey(repoPath), path: rel }
      const output = await owner.client.duplicatePath.mutate(input)
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.duplicate.affectedEffectsForResult(input, output),
        filesMutations.duplicate.foreignDependencies(input),
      )
      return projectAbsoluteFromRelative(repoPath, output)
    },
    trash: async (absolutePath: string): Promise<boolean> => {
      if (repoPath === null || owner === null) return false
      const rel = projectRelativeFromAbsolute(repoPath, absolutePath)
      if (rel === null) return false
      const input = { projectPath: filesProjectKey(repoPath), path: rel }
      try {
        await owner.client.trashPath.mutate(input)
      } catch (error) {
        onMutationError('Delete')({ message: mutationErrorMessage(error) })
        return false
      }
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.trash.affectedEffects(input),
        filesMutations.trash.foreignDependencies(input),
      )
      return true
    },
  }
}

/** Save text content for one absolute path (non-optimistic; success-only effects). */
export function useWriteTextFile(absolutePath: string): {
  save: (content: string, onSaved?: () => void) => void
  isSaving: boolean
  error: { message: string } | null
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(
    daemonScopeForEnvironment(target?.environmentId, daemon),
  )
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)

  const mutation = useMutation({
    mutationFn: async (vars: {
      projectPath: string
      path: string
      content: string
    }): Promise<void> => {
      if (owner === null) throw new Error('The target Environment is offline.')
      await owner.client.writeTextFile.mutate(vars)
    },
    onSuccess: async (_data, variables): Promise<void> => {
      const input = {
        projectPath: variables.projectPath,
        path: variables.path,
        content: variables.content,
      }
      await applyMutationSuccess(
        queryClient,
        daemonScope,
        filesMutations.writeText.affectedEffects(input),
        filesMutations.writeText.foreignDependencies(input),
      )
    },
  })

  return {
    save: (content: string, onSaved?: () => void): void => {
      if (repoPath === null || owner === null) return
      const rel = projectRelativeFromAbsolute(repoPath, absolutePath)
      if (rel === null) return
      mutation.mutate(
        {
          projectPath: normalizeProjectRoot(repoPath),
          path: rel,
          content,
        },
        { onSuccess: onSaved },
      )
    },
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * Hide/unhide/pin/unpin path batches. Sequential; each successful path applies its
 * Files effects before the next attempt. Callers clear selection only when the whole
 * batch resolves.
 */
export function useFilesScopeActions(): {
  hide: (absolutePaths: readonly string[]) => Promise<void>
  unhide: (absolutePaths: readonly string[]) => Promise<void>
  pin: (absolutePaths: readonly string[]) => Promise<void>
  unpin: (absolutePaths: readonly string[]) => Promise<void>
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(
    daemonScopeForEnvironment(target?.environmentId, daemon),
  )
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)

  const runBatch = async (
    absolutePaths: readonly string[],
    kind: 'hide' | 'unhide' | 'pin' | 'unpin',
  ): Promise<void> => {
    if (repoPath === null || owner === null) return
    for (const absolutePath of absolutePaths) {
      const input = { repoPath, path: absolutePath }
      switch (kind) {
        case 'hide':
          await owner.client.hidePath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            daemonScope,
            filesMutations.hide.affectedEffects(input),
            filesMutations.hide.foreignDependencies(input),
          )
          break
        case 'unhide':
          await owner.client.unhidePath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            daemonScope,
            filesMutations.unhide.affectedEffects(input),
            filesMutations.unhide.foreignDependencies(input),
          )
          break
        case 'pin':
          await owner.client.pinPath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            daemonScope,
            filesMutations.pin.affectedEffects(input),
            filesMutations.pin.foreignDependencies(input),
          )
          break
        case 'unpin':
          await owner.client.unpinPath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            daemonScope,
            filesMutations.unpin.affectedEffects(input),
            filesMutations.unpin.foreignDependencies(input),
          )
          break
        default: {
          const _exhaustive: never = kind
          return _exhaustive
        }
      }
    }
  }

  return {
    hide: (paths) => runBatch(paths, 'hide'),
    unhide: (paths) => runBatch(paths, 'unhide'),
    pin: (paths) => runBatch(paths, 'pin'),
    unpin: (paths) => runBatch(paths, 'unpin'),
  }
}
