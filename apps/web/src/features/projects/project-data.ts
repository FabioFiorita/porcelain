import {
  createHubWorktree,
  listCanvasesQuery,
  openProject,
  overlayQuery,
  type ProjectPath,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  promoteCanvas,
  promoteOverrides,
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
  HubWorktree,
  ListOverlayOutput,
  ProjectOverrides,
  PromoteCanvasInput,
  PromoteCanvasOutput,
  PromoteOverridesInput,
  ReadCanvasOutput,
} from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { environmentSessionFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  browseProjectDirectoriesOnDaemon,
  createHubWorktreeOnDaemon,
  listCanvasesOnDaemon,
  listOverlayOnDaemon,
  mintCanvasAccessTokenOnDaemon,
  openProjectOnDaemon,
  promoteCanvasOnDaemon,
  promoteOverridesOnDaemon,
  readCanvasOnDaemon,
  recentProjectsOnDaemon,
  removeHubProjectOnDaemon,
  removeHubWorktreeOnDaemon,
  removeRecentProjectOnDaemon,
} from './project-transport'

export type ProjectsDaemonScope = DaemonScope

export type { HubInventoryView } from './hub-inventories'
export { useHubInventories, useHubInventory } from './hub-inventories'

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
    onSuccess: async (project, variables) => {
      selectProject(project)
      await invalidateProjectQueries(
        queryClient,
        daemon,
        openProject.affectedQueries(variables.path),
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

/**
 * Canvases for one Project, newest-updated first — the right sidebar's list.
 * `worktreePath` addresses the checkout whose tracked `.porcelain/` overlay is
 * merged over the private records, and is part of the cache identity.
 */
export function useCanvasList(
  projectId: string | null,
  worktreePath: string | null = null,
  environmentId: string | null = null,
): readonly CanvasRecord[] {
  const daemon = useDaemonIdentity()
  const defaultClient = trpc.useUtils().client
  const owner = environmentId === null ? null : environmentSessionFor(environmentId)
  const client = owner?.client ?? defaultClient
  const identity = listCanvasesQuery(projectId ?? '', worktreePath)
  const query = useQuery({
    enabled: projectId !== null,
    queryFn: async (): Promise<readonly CanvasRecord[]> =>
      listCanvasesOnDaemon(client, projectId ?? '', worktreePath ?? undefined),
    queryKey: [...projectsQueryKey(daemon, identity), environmentId],
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
  worktreePath: string | null = null,
  environmentId: string | null = null,
): { canvas: ReadCanvasOutput | undefined; isLoading: boolean } {
  const daemon = useDaemonIdentity()
  const defaultClient = trpc.useUtils().client
  const owner = environmentId === null ? null : environmentSessionFor(environmentId)
  const client = owner?.client ?? defaultClient
  const enabled = projectId !== null && canvasId !== null
  const identity = readCanvasQuery(projectId ?? '', canvasId ?? '', worktreePath)
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<ReadCanvasOutput> =>
      readCanvasOnDaemon(client, {
        projectId: projectId ?? '',
        canvasId: canvasId ?? '',
        worktreePath: worktreePath ?? undefined,
      }),
    queryKey: [...projectsQueryKey(daemon, identity), environmentId],
  })
  return { canvas: query.data, isLoading: enabled && query.isLoading }
}

/**
 * Mints the short-lived token an HTML Canvas's sandboxed iframe navigates
 * with (GET /canvas/<token> — see canvas-http.ts). Not cached: every mount
 * gets its own fresh grant, and the daemon sweeps expired ones lazily.
 */
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
      if (owner === null) throw new Error('The target Environment is offline.')
      return mintCanvasAccessTokenOnDaemon(owner.client, input)
    },
  })
  return { mint: mutation.mutateAsync }
}

/**
 * Promote one Canvas into an explicitly addressed checkout's Git overlay. The
 * caller supplies `path`; there is no "current" checkout to fall back to, and
 * the daemon rejects a path that is not a live Worktree of this Project.
 */
export function usePromoteCanvas(): {
  promote: (input: PromoteCanvasInput) => Promise<PromoteCanvasOutput>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: PromoteCanvasInput): Promise<PromoteCanvasOutput> =>
      promoteCanvasOnDaemon(client, input),
    onSuccess: async (_result, input) => {
      await invalidateProjectQueries(queryClient, daemon, promoteCanvas.affectedQueries(input))
    },
  })
  return { isPending: mutation.isPending, promote: mutation.mutateAsync }
}

/** Track the current project defaults into the addressed checkout's `.porcelain/`. */
export function usePromoteProjectOverrides(): {
  promote: (input: PromoteOverridesInput) => Promise<ProjectOverrides>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: PromoteOverridesInput): Promise<ProjectOverrides> =>
      promoteOverridesOnDaemon(client, input),
    onSuccess: async (_result, input) => {
      await invalidateProjectQueries(queryClient, daemon, promoteOverrides.affectedQueries(input))
    },
  })
  return { isPending: mutation.isPending, promote: mutation.mutateAsync }
}

/**
 * What one checkout's tracked `.porcelain/` overlay currently carries. The path
 * is required: an overlay belongs to a checkout, and there is no daemon-root
 * fallback to read instead.
 */
export function useProjectOverlay(path: string): ListOverlayOutput | undefined {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const query = useQuery({
    queryFn: async (): Promise<ListOverlayOutput> => listOverlayOnDaemon(client, path),
    queryKey: projectsQueryKey(daemon, overlayQuery(path)),
  })
  return query.data
}
