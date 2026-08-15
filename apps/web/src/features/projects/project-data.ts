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
  ReadCanvasOutput,
} from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  browseProjectDirectoriesOnDaemon,
  createHubWorktreeOnDaemon,
  hubInventoryOnDaemon,
  listCanvasesOnDaemon,
  mintCanvasAccessTokenOnDaemon,
  openProjectOnDaemon,
  readCanvasOnDaemon,
  recentProjectsOnDaemon,
  removeHubProjectOnDaemon,
  removeHubWorktreeOnDaemon,
  removeRecentProjectOnDaemon,
} from './project-transport'

export type ProjectsDaemonScope = DaemonScope

/** One live inventory plus the shell identity needed to route its actions safely. */
export type HubInventoryView = Readonly<{
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}>

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

/** Remove a Hub Project from the daemon inventory without deleting its repository. */
export function useRemoveHubProject(): {
  remove: (projectId: string) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (projectId: string): Promise<void> =>
      removeHubProjectOnDaemon(client, projectId),
    onSuccess: async (_result, projectId) => {
      await invalidateProjectQueries(
        queryClient,
        daemon,
        removeHubProject.affectedQueries(projectId),
      )
    },
  })

  return { isPending: mutation.isPending, remove: mutation.mutateAsync }
}

/** Remove one linked Worktree from Git and refresh the Hub inventory. */
export function useRemoveHubWorktree(): {
  remove: (input: { projectId: string; worktreeId: string }) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: { projectId: string; worktreeId: string }): Promise<void> =>
      removeHubWorktreeOnDaemon(client, input),
    onSuccess: async (_result, input) => {
      await invalidateProjectQueries(queryClient, daemon, removeHubWorktree.affectedQueries(input))
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

/** Live Hub inventories: shell aggregation in Electron, one daemon in the browser client. */
export function useHubInventories(): readonly HubInventoryView[] {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const identity = hubInventoryQuery()
  const browserQuery = useQuery({
    enabled: isBrowser,
    queryFn: async (): Promise<HubInventory> => hubInventoryOnDaemon(client),
    queryKey: projectsQueryKey(daemon, identity),
  })
  const shellQuery = useQuery({
    enabled: !isBrowser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryKey: ['shell', 'hubInventories'],
    queryFn: async (): Promise<readonly HubInventoryView[]> =>
      shellTrpcClient.hubInventories.query(),
  })
  if (!isBrowser) return shellQuery.data ?? []
  if (browserQuery.isError || browserQuery.data === undefined) return []
  return [{ environmentId: null, current: true, inventory: browserQuery.data }]
}

/** The inventory for this window's bound Environment, retained for narrow callers. */
export function useHubInventory(): HubInventory | null {
  return useHubInventories().find((source) => source.current)?.inventory ?? null
}

/** Create a Worktree on a Hub Project and refresh inventory. */
export function useCreateHubWorktree(): {
  create: (input: CreateHubWorktreeInput) => Promise<HubWorktree>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: CreateHubWorktreeInput): Promise<HubWorktree> =>
      createHubWorktreeOnDaemon(client, input),
    onSuccess: async (_result, input) => {
      await invalidateProjectQueries(queryClient, daemon, createHubWorktree.affectedQueries(input))
    },
  })
  return { create: mutation.mutateAsync, isPending: mutation.isPending }
}

/** Canvases for one Project, newest-updated first — the right sidebar's list. */
export function useCanvasList(projectId: string | null): readonly CanvasRecord[] {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const identity = listCanvasesQuery(projectId ?? '')
  const query = useQuery({
    enabled: projectId !== null,
    queryFn: async (): Promise<readonly CanvasRecord[]> =>
      listCanvasesOnDaemon(client, projectId ?? ''),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return query.data ?? []
}

/**
 * One Canvas — HTML content already server-inlined, Markdown raw. Read-only:
 * Canvases are agent-owned in v1 (see canvas-view.tsx for how each kind renders).
 */
export function useCanvas(
  projectId: string | null,
  canvasId: string | null,
): { canvas: ReadCanvasOutput | undefined; isLoading: boolean } {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const enabled = projectId !== null && canvasId !== null
  const identity = readCanvasQuery(projectId ?? '', canvasId ?? '')
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<ReadCanvasOutput> =>
      readCanvasOnDaemon(client, { projectId: projectId ?? '', canvasId: canvasId ?? '' }),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return { canvas: query.data, isLoading: enabled && query.isLoading }
}

/**
 * Mints the short-lived token an HTML Canvas's sandboxed iframe navigates
 * with (GET /canvas/<token> — see canvas-http.ts). Not cached: every mount
 * gets its own fresh grant, and the daemon sweeps expired ones lazily.
 */
export function useMintCanvasAccessToken(): {
  mint: (input: { projectId: string; canvasId: string }) => Promise<string>
} {
  const client = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (input: { projectId: string; canvasId: string }) =>
      mintCanvasAccessTokenOnDaemon(client, input),
  })
  return { mint: mutation.mutateAsync }
}
