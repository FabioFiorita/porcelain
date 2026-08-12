import type { CommitModelOption } from '@porcelain/contracts'
import { runUserAction } from '@porcelain/shared/background'
import { useState } from 'react'
import {
  useCommitModels as useGitCommitModels,
  useGitFlow,
  useInvalidateGitGrouping,
} from '@/features/git'
import { useConnectionState } from '@/lib/daemon/environments-store'
import {
  type ChannelDisposition,
  companionDispositionsQuery,
  companionGitVisibilityQuery,
  setCompanionDispositionMutation,
  setCompanionGitVisibilityMutation,
} from '@/lib/daemon/procedures/companion'
import {
  type Layer,
  repoLayersQuery,
  setRepoLayersMutation,
} from '@/lib/daemon/procedures/settings'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

/**
 * The Settings tab's daemon seam.
 *
 * The panels used to call `useDaemonQuery` / `useDaemonMutation` inline, which is how they
 * grew the two habits no other feature has: a fire-and-forget `.mutate()` whose failure was
 * invisible, and a read whose error was never rendered. One hook file per feature is what
 * makes those visible — every call the tab makes is in this file, and every write reports.
 *
 * Preferences themselves are not here: `preferences-store` is on-device state, not a daemon read.
 */

/**
 * A flip rewrites `.porcelain/.gitignore` and going Local stages a deletion, so the row and the
 * visibility line are stale afterwards. The Git reads it also invalidates are typed effects the
 * Git feature owns — see `useInvalidateGitGrouping`.
 */
const COMPANION_INVALIDATIONS = ['companionDispositions', 'companionGitVisibility'] as const

/** Layers regroup every flow the reader is looking at, committed ranges and the review included. */
const REVIEW_LAYER_INVALIDATIONS = ['repoLayers', 'featureView', 'featureReading'] as const

/**
 * How often the pattern builder re-reads the changed files it previews against.
 *
 * Slow on purpose: this is a preview beside a text field, not a live view of the tree. It
 * shares `gitFlow`'s cache entry with Changes, and React Query takes the shortest interval
 * among a key's observers — so an open Changes tab refreshes this faster, never slower.
 */
const FLOW_PREVIEW_POLL_MS = 15_000

function failureText(label: string, cause: unknown): string {
  return `${label}: ${cause instanceof Error ? cause.message : String(cause)}`
}

/**
 * A write that reports. Every settings mutation is a daemon round trip that can fail — a repo
 * that moved, a `.gitignore` git refuses — and a settings toggle that silently snaps back is
 * indistinguishable from one that worked.
 */
function useWriteFailure(): {
  failure: string | null
  /**
   * Total void write for sync UI edges: catches into `failure`.
   * Callers that need a success boolean (saved flash) use {@link runAsync}.
   */
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
  channels: readonly ChannelDisposition[]
  /** True while git cannot see `.porcelain/` in this clone at all. */
  hidden: boolean
  isLoading: boolean
  error: Error | null
  /** Failure of the last write, or null. Rendered by the panel that triggered it. */
  failure: string | null
  isPending: boolean
  /**
   * Paths the last Local flip staged for deletion, straight off the mutation's own result —
   * the panel keeps no copy of it, so a second flip cannot leave a stale line on screen.
   */
  untracked: readonly string[]
  setDisposition: (key: string, disposition: 'shared' | 'local') => void
  setVisibility: (hidden: boolean) => void
}

/** Settings › Data — the repo companion dispositions, and what git can see of them. */
export function useCompanionData(repoPath: string): CompanionData {
  const dispositions = useDaemonQuery(companionDispositionsQuery, repoPath)
  const visibility = useDaemonQuery(companionGitVisibilityQuery, repoPath)
  const setDisposition = useDaemonMutation(setCompanionDispositionMutation, {
    invalidates: COMPANION_INVALIDATIONS,
  })
  const setVisibility = useDaemonMutation(setCompanionGitVisibilityMutation, {
    invalidates: COMPANION_INVALIDATIONS,
  })
  const invalidateGrouping = useInvalidateGitGrouping()
  const { failure, run } = useWriteFailure()

  return {
    channels: dispositions.data ?? [],
    error: dispositions.error,
    failure,
    hidden: visibility.data?.hidden === true,
    isLoading: dispositions.isLoading,
    isPending: setDisposition.isPending || setVisibility.isPending,
    setDisposition: (key, disposition): void => {
      run('Could not change what git carries', async () => {
        await setDisposition.mutateAsync({ disposition, key, repoPath })
        await invalidateGrouping(repoPath)
      })
    },
    setVisibility: (hidden): void => {
      run('Could not change git visibility', async () => {
        await setVisibility.mutateAsync({ hidden, repoPath })
        await invalidateGrouping(repoPath)
      })
    },
    untracked: setDisposition.data?.untracked ?? [],
  }
}

export type CommitModels = {
  options: readonly CommitModelOption[]
  isLoading: boolean
  error: Error | null
  /** No daemon to ask — the picker says so rather than printing an empty list. */
  unreachable: boolean
}

/** The commit-message providers installed on the active daemon. */
export function useCommitModels(): CommitModels {
  const connection = useConnectionState()
  const unreachable = connection.kind !== 'ready'
  const models = useGitCommitModels(!unreachable)

  return {
    error: models.error,
    isLoading: models.isLoading && !unreachable,
    options: models.options,
    unreachable,
  }
}

export type ReviewLayers = {
  layers: readonly Layer[] | undefined
  /** True while the repo is still on the Docs + Agents starters. */
  isStarter: boolean
  isLoading: boolean
  error: Error | null
  failure: string | null
  isSaving: boolean
  /** Repo-relative paths the pattern builder previews a pattern against. */
  changedPaths: readonly string[]
  /** `null` clears the override back to the starters. */
  save: (layers: readonly Layer[] | null) => Promise<boolean>
}

/** Settings › Review — the agent-managed path groups for one repository. */
export function useReviewLayers(repoPath: string): ReviewLayers {
  const layers = useDaemonQuery(repoLayersQuery, repoPath)
  const flow = useGitFlow({ pollMs: FLOW_PREVIEW_POLL_MS })
  const saveLayers = useDaemonMutation(setRepoLayersMutation, {
    invalidates: REVIEW_LAYER_INVALIDATIONS,
  })
  const invalidateGrouping = useInvalidateGitGrouping()
  const { failure, runAsync } = useWriteFailure()

  return {
    changedPaths: (flow.groups ?? []).flatMap((group) => group.files.map((file) => file.path)),
    error: layers.error,
    failure,
    isLoading: layers.isLoading,
    isSaving: saveLayers.isPending,
    isStarter: layers.data !== undefined && !layers.data.custom,
    layers: layers.data?.layers,
    save: (next) =>
      runAsync('Could not save layers', async () => {
        await saveLayers.mutateAsync({
          layers: next === null ? null : next.map(({ label, pattern }) => ({ label, pattern })),
          repoPath,
        })
        await invalidateGrouping(repoPath)
      }),
  }
}
