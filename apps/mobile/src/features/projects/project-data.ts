import {
  openProject,
  type ProjectPath,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  recentProjectsQuery,
  removeRecentProject,
} from '@porcelain/client-runtime/projects'
import type { BrowseDirsOutput } from '@porcelain/contracts/projects'
import { runUserAction } from '@porcelain/shared/background'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  activeEnvironment,
  activeProjectPathOf,
  environmentActions,
  isPaired,
  useActiveEnvironment,
} from '@/features/remote'
import { useShellStore } from '@/features/shell/shell-store'
import { daemonSession } from '@/lib/daemon/session'

import {
  browseDirectoriesProcedure,
  openProjectProcedure,
  pairedProjectEnvironment,
  recentProjectsProcedure,
  removeRecentProjectProcedure,
} from './project-procedures'
import { useActiveProject } from './project-transport'
import { callProjectDaemon } from './use-project-transport'

export function projectsQueryKey(
  environmentId: string,
  query: ProjectsQuery,
): readonly ['daemon', string, ProjectsQuery] {
  return ['daemon', environmentId, query] as const
}

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

async function invalidateProjectQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  environmentId: string,
  queries: readonly ProjectsQuery[],
): Promise<void> {
  for (const query of queries) {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: projectsQueryKey(environmentId, query),
    })
  }
}

/** Recent Projects for the mobile Project sheet. */
export function useRecentProjects(active: boolean): {
  projects: readonly ProjectSummary[]
  isLoading: boolean
  loadError: string | null
} {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const enabled = active && isPaired(environment)
  const identity = recentProjectsQuery(false)
  const query = useQuery({
    enabled,
    queryFn: async (): Promise<readonly ProjectSummary[]> => {
      return callProjectDaemon(environment, recentProjectsProcedure, { includeWorktrees: false })
    },
    queryKey: projectsQueryKey(environmentId, identity),
  })

  return {
    isLoading: enabled && query.isPending,
    loadError:
      enabled && query.isError
        ? failureMessage(query.error, 'Could not load recent projects.')
        : null,
    projects: query.data ?? [],
  }
}

/** Open a Project and apply the daemon's authoritative summary to mobile selection/session state. */
export function useOpenProject(): {
  open: (path: ProjectPath) => Promise<void>
  isPending: boolean
} {
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (path: ProjectPath): Promise<ProjectSummary> => {
      return callProjectDaemon(environment, openProjectProcedure, path)
    },
    onSuccess: async (project) => {
      const paired = pairedProjectEnvironment(environment, openProjectProcedure.name)
      await environmentActions.setActiveProjectPath(paired.id, project.path)
      daemonSession.selectProject(project.path)
      await invalidateProjectQueries(
        queryClient,
        paired.id,
        openProject.affectedQueries(project.path),
      )
    },
  })

  return {
    isPending: mutation.isPending,
    open: async (path: ProjectPath): Promise<void> => {
      await mutation.mutateAsync(path)
    },
  }
}

/** Remove a recent Project and clear the active path only when it is selected. */
export function useRemoveRecentProject(): {
  remove: (path: string) => Promise<void>
  isPending: boolean
} {
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (path: string): Promise<void> => {
      await callProjectDaemon(environment, removeRecentProjectProcedure, path)
    },
    onSuccess: async (_result, path) => {
      const paired = pairedProjectEnvironment(environment, removeRecentProjectProcedure.name)
      await invalidateProjectQueries(
        queryClient,
        paired.id,
        removeRecentProject.affectedQueries(path),
      )
      const current = activeEnvironment()
      if (isPaired(current) && activeProjectPathOf(current) === path) {
        await environmentActions.setActiveProjectPath(current.id, null)
      }
    },
  })

  return {
    isPending: mutation.isPending,
    remove: async (path): Promise<void> => {
      await mutation.mutateAsync(path)
    },
  }
}

/** Browse daemon directories with the nullable-root and keep-previous-data semantics. */
export function useProjectDirectories(
  path: string | null,
  active: boolean,
): {
  result: BrowseDirsOutput | undefined
  isFetching: boolean
  isLoading: boolean
  error: string | null
} {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const enabled = active && isPaired(environment)
  const identity = projectDirectoriesQuery(path)
  const query = useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BrowseDirsOutput> => {
      return callProjectDaemon(environment, browseDirectoriesProcedure, path)
    },
    queryKey: projectsQueryKey(environmentId, identity),
  })

  return {
    error:
      enabled && query.isError
        ? failureMessage(query.error, 'Could not browse this folder.')
        : null,
    isFetching: enabled && query.isFetching,
    isLoading: enabled && query.isPending,
    result: query.data,
  }
}

/** Selected Project presentation state derived from the persisted active path. */
export function useSelectedProject(): ProjectSummary | null {
  return useActiveProject()
}

export type ProjectSheet = {
  /** `browse` is the daemon-side directory browser; `projects` is the recents list. */
  mode: 'projects' | 'browse'
  paired: boolean
  activePath: string | null
  projects: readonly ProjectSummary[]
  isLoading: boolean
  loadError: string | null
  browse: {
    result: BrowseDirsOutput | undefined
    isFetching: boolean
    isLoading: boolean
    error: string | null
  }
  busyPath: string | null
  actionError: string | null
  /** Total void: failures land on actionError; busyPath cleared in finally. */
  open: (path: ProjectPath) => void
  setBrowsePath: (path: string | null) => void
  startBrowsing: () => void
  stopBrowsing: () => void
}

/** Project recents plus the daemon-side directory browser used by local and remote daemons. */
export function useProjectSheet(open: boolean): ProjectSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const environment = useActiveEnvironment()
  const project = useSelectedProject()
  const openProjectMutation = useOpenProject()
  const [mode, setMode] = useState<'projects' | 'browse'>('projects')
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const recent = useRecentProjects(open && mode === 'projects')
  const browse = useProjectDirectories(browsePath, open && mode === 'browse')

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setBrowsePath(null)
      setBusyPath(null)
      setMode('projects')
    }
  }, [open])

  return {
    actionError,
    activePath: project?.path ?? null,
    browse,
    busyPath,
    isLoading: recent.isLoading,
    loadError: recent.loadError,
    mode,
    open: (path): void => {
      setBusyPath(path)
      setActionError(null)
      runUserAction(
        async () => {
          await openProjectMutation.open(path)
          closeSheet()
        },
        (error) => {
          setActionError(failureMessage(error, 'Could not open that project.'))
        },
        () => {
          setBusyPath(null)
        },
      )
    },
    paired: isPaired(environment),
    projects: recent.projects,
    setBrowsePath,
    startBrowsing: () => {
      setActionError(null)
      setBrowsePath(null)
      setMode('browse')
    },
    stopBrowsing: () => {
      setActionError(null)
      setMode('projects')
    },
  }
}
