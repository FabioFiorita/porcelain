import {
  createHubWorktree,
  hubInventoryQuery,
  openProject,
  type ProjectPath,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  recentProjectsQuery,
  removeRecentProject,
  visibleHubInventories,
} from '@porcelain/client-runtime/projects'
import type { BrowseDirsOutput, HubInventory, HubWorktree } from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  browseProjectDirectoriesOnDaemon,
  createHubWorktreeOnDaemon,
  hubInventoryOnDaemon,
  openProjectOnDaemon,
  recentProjectsOnDaemon,
  removeRecentProjectOnDaemon,
} from './project-transport'

export type ProjectsDaemonScope = DaemonScope

const projectsQueryKeySchema = z.tuple([projectsQuerySchema, daemonScopeSchema])

/** The only Web Query key shape for Project server data. */
export function projectsQueryKey(
  daemon: ProjectsDaemonScope,
  query: ProjectsQuery,
): readonly [ProjectsQuery, ProjectsDaemonScope] {
  return [query, { host: daemon.host, version: daemon.version }] as const
}

/** True when a cache key carries a strict Project identity and a daemon scope. */
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
): Promise<void> {
  for (const query of queries) {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: projectsQueryKey(daemon, query),
    })
  }
}

/** Recent Projects for the welcome surface and Project switcher. */
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

/** Open a Project and apply its authoritative summary to the existing Web selection boundary. */
export function useOpenProject(): {
  open: (path: ProjectPath, options?: { resetPresentation?: boolean }) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const selectProject = useProjectSelectionStore((state) => state.selectProject)
  const resetProjectPresentation = useProjectSelectionStore(
    (state) => state.resetProjectPresentation,
  )
  const mutation = useMutation({
    mutationFn: async (path: ProjectPath): Promise<ProjectSummary> =>
      openProjectOnDaemon(client, path),
    onSuccess: async (project, path) => {
      selectProject(project)
      await invalidateProjectQueries(queryClient, daemon, openProject.affectedQueries(path))
    },
  })

  return {
    isPending: mutation.isPending,
    open: async (path: ProjectPath, options): Promise<void> => {
      const selected = useProjectSelectionStore.getState().project
      if (options?.resetPresentation && selected?.path !== path) {
        resetProjectPresentation()
      }
      await mutation.mutateAsync(path)
    },
  }
}

/** Remove a recent Project and clear selection only when it is the selected Project. */
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
      await invalidateProjectQueries(queryClient, daemon, removeRecentProject.affectedQueries(path))
      if (useProjectSelectionStore.getState().project?.path === path) selectProject(null)
    },
  })

  return { isPending: mutation.isPending, remove: mutation.mutateAsync }
}

/** Browse daemon directories with the same nullable-root and keep-previous-data behavior. */
export function useProjectDirectories(
  path: string | null,
  enabled: boolean,
): {
  result: BrowseDirsOutput | undefined
  error: { message: string } | null
  isFetching: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const identity = projectDirectoriesQuery(path)
  const query = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BrowseDirsOutput> => browseProjectDirectoriesOnDaemon(client, path),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return { error: errorView(query.error), isFetching: query.isFetching, result: query.data }
}

/** Selected Project presentation state; the recent list remains Query data. */
export function useSelectedProject(): ProjectSummary | null {
  return useProjectSelectionStore((state) => state.project)
}

/**
 * Live Hub inventory for the bound Environment. A failed or pending read is
 * treated as offline: the Hub omits the Environment rather than showing stale children.
 */
export function useHubInventory(): HubInventory | null {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const identity = hubInventoryQuery()
  const query = useQuery({
    queryFn: async (): Promise<HubInventory> => hubInventoryOnDaemon(client),
    queryKey: projectsQueryKey(daemon, identity),
  })
  if (query.isError || query.data === undefined) return null
  return visibleHubInventories([{ online: true, inventory: query.data }])[0] ?? null
}

/** Create a Worktree on a Hub Project and refresh inventory. */
export function useCreateHubWorktree(): {
  create: (input: { projectId: string; branch: string }) => Promise<HubWorktree>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: { projectId: string; branch: string }): Promise<HubWorktree> =>
      createHubWorktreeOnDaemon(client, input),
    onSuccess: async (_result, input) => {
      await invalidateProjectQueries(queryClient, daemon, createHubWorktree.affectedQueries(input))
    },
  })
  return { create: mutation.mutateAsync, isPending: mutation.isPending }
}
