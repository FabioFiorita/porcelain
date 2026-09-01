import {
  createHubWorktree,
  hubInventoryQuery,
  listCanvasesQuery,
  openProject,
  type ProjectPath,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  promoteCanvas,
  readCanvasQuery,
  recentProjectsQuery,
  removeHubProject,
  removeHubWorktree,
  removeRecentProject,
} from '@porcelain/client-runtime/projects'
import type {
  BrowseDirsOutput,
  CanvasRecord,
  CreateHubWorktreeInput,
  HubInventory,
  HubWorktree,
  PromoteCanvasInput,
  PromoteCanvasOutput,
  ReadCanvasOutput,
  RemoveHubWorktreeInput,
} from '@porcelain/contracts/projects'
import { settleBackground } from '@shared/background'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import {
  daemonScopeForEnvironment,
  environmentClientFor,
  environmentSessionFor,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { z } from 'zod'

import {
  refreshCurrentShellHubInventory,
  SHELL_HUB_INVENTORIES_QUERY_KEY,
  type HubInventoryView,
} from './hub-inventories'
import {
  browseProjectDirectoriesOnDaemon,
  createHubWorktreeOnDaemon,
  listCanvasesOnDaemon,
  mintCanvasAccessTokenOnDaemon,
  openProjectOnDaemon,
  promoteCanvasOnDaemon,
  readCanvasOnDaemon,
  recentProjectsOnDaemon,
  removeHubProjectOnDaemon,
  removeHubWorktreeOnDaemon,
  removeRecentProjectOnDaemon,
} from './project-transport'

export type ProjectsDaemonScope = DaemonScope

export type { HubInventoriesState, HubInventoryView } from './hub-inventories'
export { useHubInventories, useHubInventoriesState, useHubInventory } from './hub-inventories'

const projectsQueryKeySchema = z.tuple([projectsQuerySchema, daemonScopeSchema])

export function projectsQueryKey(
  daemon: ProjectsDaemonScope,
  query: ProjectsQuery,
): readonly [ProjectsQuery, ProjectsDaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

export function isProjectsQueryKey(queryKey: readonly unknown[]): boolean {
  return projectsQueryKeySchema.safeParse(queryKey).success
}

function errorView(error: unknown): { message: string } | null {
  if (error === null || error === undefined) return null
  if (error instanceof Error && error.message.length > 0) return { message: error.message }
  return { message: String(error) }
}

async function invalidateProjectQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  daemon: ProjectsDaemonScope,
  queries: readonly ProjectsQuery[],
  environmentId: string | null = null,
): Promise<void> {
  const scope = daemonScopeForEnvironment(environmentId, daemon)
  const invalidations = queries.map((query) =>
    queryClient.invalidateQueries({
      exact: true,
      queryKey: projectsQueryKey(scope, query),
    }),
  )
  // Browser secondary inventories use a connection-id key because the daemon-announced
  // Environment id is learned only after the connection has answered. Invalidate that
  // concrete cache row as well as the canonical daemon-scoped key above.
  if (isBrowser && environmentId !== null && queries.some((query) => query.name === 'inventory')) {
    const owner = environmentSessionFor(environmentId)
    if (owner !== null) {
      invalidations.push(
        queryClient.invalidateQueries({
          exact: true,
          queryKey: ['browser', 'hubInventory', owner.id],
        }),
      )
    }
  }
  // Electron's Hub tree reads through a separate shell-router query (hub-inventories.ts) that
  // the per-Environment key above never reaches — without this, adding/removing a Project or
  // Worktree leaves the left sidebar showing stale state until staleTime (30s) or a window-focus
  // refetch catches up.
  if (!isBrowser && queries.some((query) => query.name === 'inventory')) {
    if (environmentId === null) invalidations.push(refreshCurrentShellHubInventory(queryClient))
    else {
      invalidations.push(
        queryClient.invalidateQueries({ exact: true, queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY }),
      )
    }
  }
  await Promise.all(invalidations)
}

export function useRecentProjects(enabled = true): readonly ProjectSummary[] {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const identity = recentProjectsQuery(false)
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<readonly ProjectSummary[]> =>
      recentProjectsOnDaemon(client, identity.includeWorktrees),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return query.data ?? []
}

export function useOpenProject(): {
  open: (
    path: ProjectPath,
    options?: { resetPresentation?: boolean; environmentId?: string | null },
  ) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const defaultClient = trpc.useUtils().client
  const queryClient = useQueryClient()
  const selectProject = useProjectSelectionStore((state) => state.selectProject)
  const resetProjectPresentation = useProjectSelectionStore(
    (state) => state.resetProjectPresentation,
  )
  const mutation = useMutation({
    mutationFn: async (variables: {
      path: ProjectPath
      environmentId: string | null
    }): Promise<ProjectSummary> => {
      const owner =
        variables.environmentId === null
          ? { client: defaultClient }
          : environmentSessionFor(variables.environmentId)
      if (owner === null) throw new Error('The target Environment is offline.')
      return openProjectOnDaemon(owner.client, variables.path)
    },
    onSuccess: (project, variables) => {
      selectProject(project)
      settleBackground(
        invalidateProjectQueries(
          queryClient,
          daemon,
          openProject.affectedQueries(variables.path),
          variables.environmentId,
        ),
        'invalidation',
      )
    },
  })

  return {
    isPending: mutation.isPending,
    open: async (path: ProjectPath, options): Promise<void> => {
      const selected = useProjectSelectionStore.getState().project
      if (options?.resetPresentation && selected?.path !== path) {
        resetProjectPresentation()
      }
      await mutation.mutateAsync({ path, environmentId: options?.environmentId ?? null })
    },
  }
}

export function useRemoveRecentProject(): {
  remove: (path: string) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const selectProject = useProjectSelectionStore((state) => state.selectProject)
  const mutation = useMutation({
    mutationFn: async (path: string): Promise<void> => {
      await removeRecentProjectOnDaemon(client, path)
    },
    onSuccess: async (_result, path) => {
      await invalidateProjectQueries(
        queryClient,
        daemon,
        removeRecentProject.affectedQueries(path),
        null,
      )
      if (useProjectSelectionStore.getState().project?.path === path) selectProject(null)
    },
  })

  return { isPending: mutation.isPending, remove: mutation.mutateAsync }
}

export function useRemoveHubProject(): {
  remove: (projectId: string, environmentId?: string | null) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (variables: {
      projectId: string
      environmentId?: string | null
    }): Promise<void> => {
      const owner =
        variables.environmentId === undefined || variables.environmentId === null
          ? { client }
          : environmentSessionFor(variables.environmentId)
      if (owner === null) throw new Error('The target Environment is offline.')
      await removeHubProjectOnDaemon(owner.client, variables.projectId)
    },
    onSuccess: async (_result, variables) => {
      await invalidateProjectQueries(
        queryClient,
        daemon,
        removeHubProject.affectedQueries(variables.projectId),
        variables.environmentId ?? null,
      )
    },
  })

  return {
    isPending: mutation.isPending,
    remove: (projectId, environmentId) => mutation.mutateAsync({ projectId, environmentId }),
  }
}

/**
 * Remove a Worktree. Unlike removing a Project — which only forgets it — this runs
 * `git worktree remove` on the daemon and takes the checkout off the disk, so the caller
 * must confirm with the human first.
 */
export function useRemoveHubWorktree(): {
  remove: (input: RemoveHubWorktreeInput & { environmentId?: string | null }) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  type Snapshot = { queryKey: readonly unknown[]; data: HubInventory | readonly HubInventoryView[] }
  const mutation = useMutation({
    mutationFn: async (
      variables: RemoveHubWorktreeInput & { environmentId?: string | null },
    ): Promise<void> => {
      const owner =
        variables.environmentId === undefined || variables.environmentId === null
          ? { client }
          : environmentSessionFor(variables.environmentId)
      if (owner === null) throw new Error('The target Environment is offline.')
      await removeHubWorktreeOnDaemon(owner.client, {
        projectId: variables.projectId,
        worktreeId: variables.worktreeId,
        force: variables.force,
      })
    },
    onMutate: async (variables): Promise<readonly Snapshot[]> => {
      const removeFromInventory = (inventory: HubInventory): HubInventory => ({
        ...inventory,
        projects: inventory.projects.map((project) =>
          project.id === variables.projectId
            ? {
                ...project,
                worktrees: project.worktrees.filter(
                  (worktree) => worktree.id !== variables.worktreeId,
                ),
              }
            : project,
        ),
      })

      if (!isBrowser) {
        await queryClient.cancelQueries({ exact: true, queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY })
        const data = queryClient.getQueryData<readonly HubInventoryView[]>(
          SHELL_HUB_INVENTORIES_QUERY_KEY,
        )
        if (data === undefined) return []
        queryClient.setQueryData<readonly HubInventoryView[]>(
          SHELL_HUB_INVENTORIES_QUERY_KEY,
          data.map((source) => {
            const target =
              variables.environmentId === undefined || variables.environmentId === null
                ? source.current
                : source.inventory.environment.id === variables.environmentId
            return target ? { ...source, inventory: removeFromInventory(source.inventory) } : source
          }),
        )
        return [{ queryKey: SHELL_HUB_INVENTORIES_QUERY_KEY, data }]
      }

      const queryKey = (() => {
        if (variables.environmentId === undefined || variables.environmentId === null) {
          return projectsQueryKey(daemon, hubInventoryQuery())
        }
        const owner = environmentSessionFor(variables.environmentId)
        return owner === null ? null : (['browser', 'hubInventory', owner.id] as const)
      })()
      if (queryKey === null) return []
      await queryClient.cancelQueries({ exact: true, queryKey })
      const data = queryClient.getQueryData<HubInventory>(queryKey)
      if (data === undefined) return []
      queryClient.setQueryData(queryKey, removeFromInventory(data))
      return [{ queryKey, data }]
    },
    onError: (_error, _variables, snapshots) => {
      for (const snapshot of snapshots ?? []) {
        queryClient.setQueryData(snapshot.queryKey, snapshot.data)
      }
    },
    onSettled: async (_result, _error, variables) => {
      await invalidateProjectQueries(
        queryClient,
        daemon,
        removeHubWorktree.affectedQueries(variables),
        variables.environmentId ?? null,
      )
    },
  })

  return { isPending: mutation.isPending, remove: mutation.mutateAsync }
}

/**
 * Browse one Environment's filesystem. `environmentId` is the daemon-announced id;
 * `undefined` (and `null`) mean this window's own daemon, which is what every caller
 * that only ever browses locally passes.
 *
 * The result is keyed by Environment, so switching machines in the picker cannot show
 * the previous one's directories under the new one's name.
 */
export function useProjectDirectories(
  path: string | null,
  enabled: boolean,
  environmentId?: string | null,
): {
  result: BrowseDirsOutput | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const daemon = useDaemonIdentity()
  const sessionRevision = useEnvironmentSessionsRevision()
  const primary = trpc.useUtils().client
  const owner = useMemo(
    // The revision is the dependency, not a value: a session appears (or moves) after the
    // shell answers, and the browse has to re-resolve when it does.
    () => environmentClientFor(environmentId ?? null, primary, sessionRevision),
    [environmentId, primary, sessionRevision],
  )
  const identity = projectDirectoriesQuery(path)
  const query = useQuery({
    enabled: enabled && owner !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BrowseDirsOutput> => {
      if (owner === null) throw new Error('That Environment is offline.')
      return browseProjectDirectoriesOnDaemon(owner.client, path)
    },
    queryKey: projectsQueryKey(daemonScopeForEnvironment(environmentId, daemon), identity),
  })
  return { error: errorView(query.error), isFetching: query.isFetching, result: query.data }
}

export function useSelectedProject(): ProjectSummary | null {
  return useProjectSelectionStore((state) => state.project)
}

export function useCreateHubWorktree(): {
  create: (
    input: CreateHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<HubWorktree>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (
      input: CreateHubWorktreeInput & { environmentId?: string | null },
    ): Promise<HubWorktree> => {
      const owner =
        input.environmentId === undefined || input.environmentId === null
          ? { client }
          : environmentSessionFor(input.environmentId)
      if (owner === null) throw new Error('The target Environment is offline.')
      return createHubWorktreeOnDaemon(owner.client, {
        branch: input.branch,
        baseRef: input.baseRef,
        existing: input.existing,
        projectId: input.projectId,
      })
    },
    // A create can land before its response or reconciliation fails. Always ask the inventory
    // authority what exists instead of leaving a successful filesystem mutation invisible.
    onSettled: async (_result, _error, input) => {
      await invalidateProjectQueries(
        queryClient,
        daemon,
        createHubWorktree.affectedQueries(input),
        input.environmentId ?? null,
      )
    },
  })
  return { create: mutation.mutateAsync, isPending: mutation.isPending }
}

export function useCanvasList(
  projectId: string | null,
  worktreePath: string | null = null,
  environmentId: string | null = null,
  worktreeId: string | null = null,
): { canvases: readonly CanvasRecord[]; isLoading: boolean; loadError: string | null } {
  const daemon = useDaemonIdentity()
  const defaultClient = trpc.useUtils().client
  const owner =
    environmentId === null ? { client: defaultClient } : environmentSessionFor(environmentId)
  const identity = listCanvasesQuery(projectId ?? '', worktreePath, worktreeId)
  const query = useQuery({
    enabled: projectId !== null && owner !== null,
    queryFn: async (): Promise<readonly CanvasRecord[]> => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return listCanvasesOnDaemon(
        owner.client,
        projectId ?? '',
        worktreePath ?? undefined,
        worktreeId ?? undefined,
      )
    },
    queryKey: [...projectsQueryKey(daemon, identity), environmentId],
  })
  const enabled = projectId !== null
  return {
    canvases: query.data ?? [],
    isLoading: enabled && owner !== null && query.isLoading,
    loadError:
      enabled && owner === null
        ? 'The target Environment is offline.'
        : query.isError
          ? (errorView(query.error)?.message ?? 'Could not read this Canvas list.')
          : null,
  }
}

export function useCanvas(
  projectId: string | null,
  canvasId: string | null,
  worktreePath: string | null = null,
  environmentId: string | null = null,
): { canvas: ReadCanvasOutput | undefined; isLoading: boolean; loadError: string | null } {
  const daemon = useDaemonIdentity()
  const defaultClient = trpc.useUtils().client
  const owner =
    environmentId === null ? { client: defaultClient } : environmentSessionFor(environmentId)
  const enabled = projectId !== null && canvasId !== null
  const identity = readCanvasQuery(projectId ?? '', canvasId ?? '', worktreePath)
  const query = useQuery({
    enabled: enabled && owner !== null,
    queryFn: async (): Promise<ReadCanvasOutput> => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return readCanvasOnDaemon(owner.client, {
        projectId: projectId ?? '',
        canvasId: canvasId ?? '',
        worktreePath: worktreePath ?? undefined,
      })
    },
    queryKey: [...projectsQueryKey(daemon, identity), environmentId],
  })
  return {
    canvas: query.data,
    isLoading: enabled && owner !== null && query.isLoading,
    loadError:
      enabled && owner === null
        ? 'The target Environment is offline.'
        : query.isError
          ? (errorView(query.error)?.message ?? 'Could not open this Canvas.')
          : null,
  }
}

export function useMintCanvasAccessToken(): {
  mint: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
    environmentId?: string | null
  }) => Promise<string>
} {
  const defaultClient = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (input: {
      projectId: string
      canvasId: string
      worktreePath?: string
      environmentId?: string | null
    }) => {
      const owner =
        input.environmentId === undefined || input.environmentId === null
          ? { client: defaultClient }
          : environmentSessionFor(input.environmentId)
      if (owner === null) {
        throw new Error('The target Environment is offline.')
      }
      return mintCanvasAccessTokenOnDaemon(owner.client, {
        projectId: input.projectId,
        canvasId: input.canvasId,
        worktreePath: input.worktreePath,
      })
    },
  })
  return { mint: mutation.mutateAsync }
}

export function usePromoteCanvas(): {
  promote: (
    input: PromoteCanvasInput & { environmentId?: string | null },
  ) => Promise<PromoteCanvasOutput>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (
      input: PromoteCanvasInput & { environmentId?: string | null },
    ): Promise<PromoteCanvasOutput> => {
      const owner =
        input.environmentId === undefined || input.environmentId === null
          ? { client }
          : environmentSessionFor(input.environmentId)
      if (owner === null) throw new Error('The target Environment is offline.')
      return promoteCanvasOnDaemon(owner.client, {
        projectId: input.projectId,
        canvasId: input.canvasId,
        path: input.path,
        worktreeId: input.worktreeId,
      })
    },
    onSuccess: async (_result, input) => {
      for (const query of promoteCanvas.affectedQueries(input)) {
        await queryClient.invalidateQueries({
          exact: true,
          queryKey: [...projectsQueryKey(daemon, query), input.environmentId ?? null],
        })
      }
    },
  })
  return { isPending: mutation.isPending, promote: mutation.mutateAsync }
}
