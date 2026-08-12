import {
  type FilesForeignDependency,
  type FilesQueryEffect,
  filesMutations,
  filesProjectKey,
} from '@porcelain/client-runtime/files'
import {
  applySearchForeignDependencies,
  type SearchForeignDependency,
} from '@renderer/features/search'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
} from './files-path'
import { invalidateFilesEffects } from './files-query-filter'

/**
 * Files mutation adapter (FIL-005).
 *
 * Non-optimistic: success-only invalidation via FIL-004 effect tables. Transport
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

/** Map FIL-004 foreign tokens onto Web Git and typed Search effects. */
export function applyFilesForeignDependencies(
  utils: ReturnType<typeof trpc.useUtils>,
  queryClient: QueryClient,
  daemon: DaemonScope,
  projectPath: string | null,
  deps: readonly FilesForeignDependency[],
): Promise<void> {
  const tasks: Promise<unknown>[] = []
  const searchDependencies: SearchForeignDependency[] = []
  for (const dep of deps) {
    if (dep.domain === 'git' && dep.name === 'working-tree') {
      tasks.push(utils.gitFlow.invalidate())
      tasks.push(utils.gitDiffFile.invalidate())
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
  utils: ReturnType<typeof trpc.useUtils>,
  daemon: DaemonScope,
  effects: ReturnType<typeof filesMutations.createFile.affectedEffects>,
  foreign: readonly FilesForeignDependency[],
): Promise<void> {
  await invalidateFilesEffects(queryClient, daemon, effects)
  await applyFilesForeignDependencies(
    utils,
    queryClient,
    daemon,
    projectPathFromEffects(effects),
    foreign,
  )
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
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const client = utils.client

  return {
    createFile: async (absolutePath: string): Promise<void> => {
      if (!project) return
      const rel = projectRelativeFromAbsolute(project.path, absolutePath)
      if (rel === null) return
      const input = { projectPath: filesProjectKey(project.path), path: rel }
      await client.createFile.mutate(input)
      await applyMutationSuccess(
        queryClient,
        utils,
        daemonScope,
        filesMutations.createFile.affectedEffects(input),
        filesMutations.createFile.foreignDependencies(input),
      )
    },
    createFolder: async (absolutePath: string): Promise<void> => {
      if (!project) return
      const rel = projectRelativeFromAbsolute(project.path, absolutePath)
      if (rel === null) return
      const input = { projectPath: filesProjectKey(project.path), path: rel }
      await client.createFolder.mutate(input)
      await applyMutationSuccess(
        queryClient,
        utils,
        daemonScope,
        filesMutations.createFolder.affectedEffects(input),
        filesMutations.createFolder.foreignDependencies(input),
      )
    },
    rename: async (fromAbsolute: string, toAbsolute: string): Promise<void> => {
      if (!project) return
      const fromRel = projectRelativeFromAbsolute(project.path, fromAbsolute)
      const toRel = projectRelativeFromAbsolute(project.path, toAbsolute)
      if (fromRel === null || toRel === null) return
      const input = {
        projectPath: filesProjectKey(project.path),
        from: fromRel,
        to: toRel,
      }
      await client.renamePath.mutate(input)
      await applyMutationSuccess(
        queryClient,
        utils,
        daemonScope,
        filesMutations.rename.affectedEffects(input),
        filesMutations.rename.foreignDependencies(input),
      )
    },
    duplicate: async (absolutePath: string): Promise<string | null> => {
      if (!project) return null
      const rel = projectRelativeFromAbsolute(project.path, absolutePath)
      if (rel === null) return null
      const input = { projectPath: filesProjectKey(project.path), path: rel }
      const output = await client.duplicatePath.mutate(input)
      await applyMutationSuccess(
        queryClient,
        utils,
        daemonScope,
        filesMutations.duplicate.affectedEffectsForResult(input, output),
        filesMutations.duplicate.foreignDependencies(input),
      )
      return projectAbsoluteFromRelative(project.path, output)
    },
    trash: async (absolutePath: string): Promise<boolean> => {
      if (!project) return false
      const rel = projectRelativeFromAbsolute(project.path, absolutePath)
      if (rel === null) return false
      const input = { projectPath: filesProjectKey(project.path), path: rel }
      try {
        await client.trashPath.mutate(input)
      } catch (error) {
        onMutationError('Delete')({ message: mutationErrorMessage(error) })
        return false
      }
      await applyMutationSuccess(
        queryClient,
        utils,
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
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()

  const mutation = useMutation({
    mutationFn: async (vars: {
      projectPath: string
      path: string
      content: string
    }): Promise<void> => {
      await utils.client.writeTextFile.mutate(vars)
    },
    onSuccess: async (_data, variables): Promise<void> => {
      const input = {
        projectPath: variables.projectPath,
        path: variables.path,
        content: variables.content,
      }
      await applyMutationSuccess(
        queryClient,
        utils,
        daemonScope,
        filesMutations.writeText.affectedEffects(input),
        filesMutations.writeText.foreignDependencies(input),
      )
    },
  })

  return {
    save: (content: string, onSaved?: () => void): void => {
      if (!project) return
      const rel = projectRelativeFromAbsolute(project.path, absolutePath)
      if (rel === null) return
      mutation.mutate(
        {
          projectPath: normalizeProjectRoot(project.path),
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
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const client = utils.client

  const runBatch = async (
    absolutePaths: readonly string[],
    kind: 'hide' | 'unhide' | 'pin' | 'unpin',
  ): Promise<void> => {
    if (!project) return
    for (const absolutePath of absolutePaths) {
      const input = { repoPath: project.path, path: absolutePath }
      switch (kind) {
        case 'hide':
          await client.hidePath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            utils,
            daemonScope,
            filesMutations.hide.affectedEffects(input),
            filesMutations.hide.foreignDependencies(input),
          )
          break
        case 'unhide':
          await client.unhidePath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            utils,
            daemonScope,
            filesMutations.unhide.affectedEffects(input),
            filesMutations.unhide.foreignDependencies(input),
          )
          break
        case 'pin':
          await client.pinPath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            utils,
            daemonScope,
            filesMutations.pin.affectedEffects(input),
            filesMutations.pin.foreignDependencies(input),
          )
          break
        case 'unpin':
          await client.unpinPath.mutate(input)
          await applyMutationSuccess(
            queryClient,
            utils,
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
