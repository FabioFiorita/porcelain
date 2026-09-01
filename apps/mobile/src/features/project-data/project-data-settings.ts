import {
  projectDataDispositionsQuery,
  projectDataProjectKey,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import type { ChannelDispositionValue } from '@porcelain/contracts/project-data'
import { projectDataProcedures } from '@porcelain/contracts/project-data'
import { runUserAction } from '@porcelain/shared/background'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { useProjectDataWrites } from './project-data-mutations'
import { projectDataQueryKey } from './project-data-query-key'
import { callProjectDataProcedure } from './use-project-data-transport'

/**
 * Settings-facing Project Data hooks.
 *
 * Failure text, 15s flow preview, and grouping-after-write order are preserved
 * from the Settings seam. Layer-editor draft state stays in Settings.
 */

const dispositionsProcedure = namedContractProcedure(
  'companionDispositions',
  projectDataProcedures.companionDispositions,
)
const visibilityProcedure = namedContractProcedure(
  'companionGitVisibility',
  projectDataProcedures.companionGitVisibility,
)

function failureText(label: string, cause: unknown): string {
  return `${label}: ${cause instanceof Error ? cause.message : String(cause)}`
}

function useWriteFailure(): {
  failure: string | null
  run: (label: string, work: () => Promise<unknown>) => void
  runAsync: (label: string, work: () => Promise<unknown>) => Promise<boolean>
} {
  const [failure, setFailure] = useState<string | null>(null)

  return {
    failure,
    run: (label, work): void => {
      setFailure(null)
      runUserAction(
        () => work(),
        (cause: unknown) => {
          setFailure(failureText(label, cause))
        },
      )
    },
    runAsync: async (label, work): Promise<boolean> => {
      setFailure(null)
      try {
        await work()
        return true
      } catch (cause: unknown) {
        setFailure(failureText(label, cause))
        return false
      }
    },
  }
}

export type CompanionData = {
  channels: readonly ChannelDispositionValue[]
  hidden: boolean
  isLoading: boolean
  error: Error | null
  failure: string | null
  isPending: boolean
  untracked: readonly string[]
  setDisposition: (key: string, disposition: 'shared' | 'local') => void
  setVisibility: (hidden: boolean) => void
}

/** Settings › Data — the repo companion dispositions, and what git can see of them. */
export function useCompanionData(repoPath: string): CompanionData {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const enabled = isPaired(environment)
  const key = projectDataProjectKey(repoPath)
  const writes = useProjectDataWrites()
  const { failure, run } = useWriteFailure()
  const [untracked, setUntracked] = useState<readonly string[]>([])
  const [isPending, setIsPending] = useState(false)

  const dispositions = useQuery({
    enabled,
    queryKey: projectDataQueryKey(environmentId, projectDataDispositionsQuery(key)),
    queryFn: (): Promise<ChannelDispositionValue[]> =>
      callProjectDataProcedure(environment, dispositionsProcedure, key),
  })
  const visibility = useQuery({
    enabled,
    queryKey: projectDataQueryKey(environmentId, projectDataVisibilityQuery(key)),
    queryFn: (): Promise<{ hidden: boolean }> =>
      callProjectDataProcedure(environment, visibilityProcedure, key),
  })

  return {
    channels: dispositions.data ?? [],
    error: dispositions.error,
    failure,
    hidden: visibility.data?.hidden === true,
    isLoading: dispositions.isLoading,
    isPending,
    setDisposition: (channelKey, disposition): void => {
      run('Could not change what git carries', async () => {
        setIsPending(true)
        try {
          const result = await writes.setDisposition(repoPath, channelKey, disposition)
          setUntracked(result.untracked)
        } finally {
          setIsPending(false)
        }
      })
    },
    setVisibility: (hidden): void => {
      run('Could not change git visibility', async () => {
        setIsPending(true)
        try {
          await writes.setVisibility(repoPath, hidden)
        } finally {
          setIsPending(false)
        }
      })
    },
    untracked,
  }
}
