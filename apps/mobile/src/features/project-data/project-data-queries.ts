import {
  projectDataNotesQuery,
  projectDataProjectKey,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { projectDataProcedures } from '@porcelain/contracts/project-data'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { saveProjectNotes } from './project-data-mutations'
import { projectDataQueryKey } from './project-data-query-key'
import { callProjectDataProcedure } from './use-project-data-transport'

/**
 * Mobile Project Data reads (PDT-003).
 *
 * Binds typed identities + environment id. Transport is namedContractProcedure
 * plus callDaemon — no local defineQuery descriptors.
 */

const notesProcedure = namedContractProcedure('repoNotes', projectDataProcedures.repoNotes)
const visibilityProcedure = namedContractProcedure(
  'companionGitVisibility',
  projectDataProcedures.companionGitVisibility,
)

const DISABLED_NOTES = {
  domain: 'project-data',
  name: 'notes',
  projectPath: '/',
} as const

const DISABLED_VISIBILITY = {
  domain: 'project-data',
  name: 'visibility',
  projectPath: '/',
} as const

export function useProjectNotes(active: boolean): {
  notes: string | undefined
  save: (notes: string) => Promise<void>
  isSaving: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const enabled = active && project !== null && isPaired(environment)
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const [writeError, setWriteError] = useState<Error | null>(null)

  const query = useQuery({
    enabled,
    queryKey: projectPath
      ? projectDataQueryKey(environmentId, projectDataNotesQuery(projectPath))
      : projectDataQueryKey(environmentId, DISABLED_NOTES),
    queryFn: async (): Promise<string> => {
      if (projectPath === null) return ''
      return callProjectDataProcedure(
        environment,
        notesProcedure,
        projectDataProjectKey(projectPath),
      )
    },
  })

  return {
    error: enabled ? ((query.error as Error | null) ?? writeError) : null,
    isSaving,
    notes: query.data,
    save: async (notes): Promise<void> => {
      if (project === null) return
      setIsSaving(true)
      setWriteError(null)
      try {
        await saveProjectNotes(environment, queryClient, project.path, notes)
      } catch (cause: unknown) {
        const error = cause instanceof Error ? cause : new Error(String(cause))
        setWriteError(error)
        throw error
      } finally {
        setIsSaving(false)
      }
    },
  }
}

export function useCompanionGitVisibility(enabled: boolean): {
  hidden: boolean | undefined
  isPending: boolean
} {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project?.path ?? null
  const canRun = enabled && project !== null && isPaired(environment)

  const query = useQuery({
    enabled: canRun,
    queryKey: projectPath
      ? projectDataQueryKey(environmentId, projectDataVisibilityQuery(projectPath))
      : projectDataQueryKey(environmentId, DISABLED_VISIBILITY),
    queryFn: async (): Promise<{ hidden: boolean }> => {
      if (projectPath === null) return { hidden: false }
      return callProjectDataProcedure(
        environment,
        visibilityProcedure,
        projectDataProjectKey(projectPath),
      )
    },
  })

  return { hidden: query.data?.hidden, isPending: query.isPending }
}
