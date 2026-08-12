import {
  openProject,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  recentProjectsQuery,
  removeRecentProject,
} from '@porcelain/client-runtime/projects'
import { type BrowseDirsOutput, projectsProcedures } from '@porcelain/contracts/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

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

function recentInput(includeWorktrees: boolean): { includeWorktrees: true } | undefined {
  return includeWorktrees ? { includeWorktrees: true } : undefined
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
      projectsProcedures.recentRepos.output.parse(
        await client.recentRepos.query(recentInput(identity.includeWorktrees)),
      ),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return query.data ?? []
}

/** Open a Project and apply its authoritative summary to the existing Web selection boundary. */
export function useOpenProject(): {
  open: (path: string, options?: { resetPresentation?: boolean }) => Promise<void>
  isPending: boolean
} {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const selectProject = useRepoStore((state) => state.selectProject)
  const resetProjectPresentation = useRepoStore((state) => state.resetProjectPresentation)
  const mutation = useMutation({
    mutationFn: async (path: string): Promise<ProjectSummary> =>
      projectsProcedures.openRepoPath.output.parse(await client.openRepoPath.mutate(path)),
    onSuccess: async (project, path) => {
      selectProject(project)
      await invalidateProjectQueries(queryClient, daemon, openProject.affectedQueries(path))
    },
  })

  return {
    isPending: mutation.isPending,
    open: async (path, options): Promise<void> => {
      const selected = useRepoStore.getState().repo
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
  const selectProject = useRepoStore((state) => state.selectProject)
  const mutation = useMutation({
    mutationFn: async (path: string): Promise<void> => {
      const result = await client.removeRecentRepo.mutate(path)
      projectsProcedures.removeRecentRepo.output.parse(result)
    },
    onSuccess: async (_result, path) => {
      await invalidateProjectQueries(queryClient, daemon, removeRecentProject.affectedQueries(path))
      if (useRepoStore.getState().repo?.path === path) selectProject(null)
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
    queryFn: async (): Promise<BrowseDirsOutput> =>
      projectsProcedures.browseDirs.output.parse(await client.browseDirs.query(path)),
    queryKey: projectsQueryKey(daemon, identity),
  })
  return { error: errorView(query.error), isFetching: query.isFetching, result: query.data }
}

/** Selected Project presentation state; the recent list remains Query data. */
export function useSelectedProject(): ProjectSummary | null {
  return useRepoStore((state) => state.repo)
}
