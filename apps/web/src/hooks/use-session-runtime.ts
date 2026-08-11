import {
  createSessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import {
  createSessionBrowserAdapter,
  type SessionConnectionStatus,
  type SessionEndpoint,
  type SessionRetrySchedule,
  type SessionSocketOpener,
} from '@renderer/lib/session-browser-adapter'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { type Pane, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Web's binding between the shared session runtime and React Query: it turns a domain change
 * notification into a refetch of the queries that own the data, restates the Viewer's file and
 * directory interests to the runtime, and reports the connection state a human can act on.
 *
 * The contract of this module is that a notification is a *freshness signal*, never data
 * (decision 009). Nothing here writes a payload into the cache; every category maps to
 * `invalidate()` on the authoritative queries, which is also why processing the same
 * notification twice is harmless. Recovery is the same instruction with a wider scope: when the
 * runtime says it can no longer prove freshness, the affected scope is invalidated wholesale
 * rather than reconstructed from what might have been missed.
 *
 * The category → query mapping is deliberately the one `use-app-events.ts` performs today, so
 * the cutover changes the transport and not what the screen refreshes. Where the target contract
 * merges several legacy events into one category, this maps to the union of what those events
 * invalidated — the daemon already published them together
 * (`packages/contracts/src/review/review.notifications.ts`), so no consumer could act on the
 * distinction anyway.
 *
 * UNACTIVATED. No production module imports this hook; `use-app-events.ts` and `use-files.ts`
 * remain the mounted path until `RT-005` switches the daemon and deletes them.
 */

/** One query's invalidator, structurally satisfied by a tRPC utils proxy. */
type QueryInvalidation = {
  readonly invalidate: () => Promise<void>
}

/**
 * Exactly the authoritative queries a session signal can make stale. A structural type rather
 * than the full `trpc.useUtils()` proxy so the mapping is testable against a recording double
 * without faking a router.
 */
export type SessionQueryUtils = {
  /** Every daemon-derived query this client holds. Used only for session-wide recovery. */
  readonly invalidate: () => Promise<void>
  readonly readDir: QueryInvalidation
  readonly readFile: QueryInvalidation
  readonly previewHtml: QueryInvalidation
  readonly pinnedEntries: QueryInvalidation
  readonly repoScope: QueryInvalidation
  readonly searchFiles: QueryInvalidation
  readonly gitFlow: QueryInvalidation
  readonly gitDiffFile: QueryInvalidation
  readonly gitRangeFlow: QueryInvalidation
  readonly gitCommitFlow: QueryInvalidation
  readonly repoLayers: QueryInvalidation
  readonly featureView: QueryInvalidation
  readonly featureReading: QueryInvalidation
  readonly exploreFeature: QueryInvalidation
  readonly reviewComments: QueryInvalidation
  readonly loopEvidence: QueryInvalidation
  readonly loopEvidenceHtml: QueryInvalidation
  readonly reviewEvidenceDocs: QueryInvalidation
  readonly reviewEvidenceAssets: QueryInvalidation
  readonly reviewEvidenceAsset: QueryInvalidation
  readonly boardCards: QueryInvalidation
  readonly actions: QueryInvalidation
}

/**
 * The queries a Review change makes stale: the union of today's `feature-view`, `comments`,
 * `layers`, and `evidence` mappings, which the target contract collapses into one category.
 * The per-asset body is dropped too — an agent retrying a capture reuses `before.png`, so the
 * name is not a proxy for immutable bytes.
 */
function invalidateReview(utils: SessionQueryUtils): Promise<unknown> {
  return Promise.all([
    utils.featureView.invalidate(),
    utils.featureReading.invalidate(),
    utils.exploreFeature.invalidate(),
    utils.reviewComments.invalidate(),
    utils.repoLayers.invalidate(),
    utils.gitFlow.invalidate(),
    utils.gitRangeFlow.invalidate(),
    utils.gitCommitFlow.invalidate(),
    utils.loopEvidence.invalidate(),
    utils.loopEvidenceHtml.invalidate(),
    utils.reviewEvidenceDocs.invalidate(),
    utils.reviewEvidenceAssets.invalidate(),
    utils.reviewEvidenceAsset.invalidate(),
  ])
}

/**
 * Map one change notification to the authoritative queries it makes stale.
 *
 * The `Promise<unknown>` return with NO `default` case is deliberate, and copied from
 * `use-app-events.ts`: a category added to the contract falls through to an implicit
 * `return undefined`, which fails the annotated type at `pnpm typecheck` — so a new domain
 * signal cannot silently ship un-refreshed.
 */
export function invalidateForChange(
  change: SessionChange,
  utils: SessionQueryUtils,
): Promise<unknown> {
  switch (change.kind) {
    case 'files.scope-changed':
      // hidden/pinned scope moved — the tree, the pins, and every listing that filters
      // hidden paths (flow + search)
      return Promise.all([
        utils.readDir.invalidate(),
        utils.pinnedEntries.invalidate(),
        utils.repoScope.invalidate(),
        utils.gitFlow.invalidate(),
        utils.searchFiles.invalidate(),
      ])
    case 'files.tree-changed':
      // entries appeared or disappeared under a watched directory — the lazy tree rows, the
      // pinned list, and the working-tree grouping
      return Promise.all([
        utils.readDir.invalidate(),
        utils.pinnedEntries.invalidate(),
        utils.gitFlow.invalidate(),
      ])
    case 'files.content-changed':
      // a watched file body changed outside the app — re-read the open documents and diffs.
      // exploreFeature too: the explore tab has no manual reload, so a re-trace when the seed
      // file's imports change is the live path.
      return Promise.all([
        utils.readFile.invalidate(),
        utils.previewHtml.invalidate(),
        utils.gitDiffFile.invalidate(),
        utils.exploreFeature.invalidate(),
      ])
    case 'git.working-tree-changed':
      // the Git half of today's coarse working-tree event: the flow and the per-file diffs.
      // Today those recover through gitFlow's 3s poll; the target signal makes that explicit.
      return Promise.all([utils.gitFlow.invalidate(), utils.gitDiffFile.invalidate()])
    case 'review.changed':
      return invalidateReview(utils)
    case 'board.changed':
      return utils.boardCards.invalidate()
    case 'actions.changed':
      return utils.actions.invalidate()
  }
}

/**
 * Recover from a freshness requirement the runtime raised.
 *
 * A `session` scope (reconnect, or a replaced daemon) invalidates everything daemon-derived:
 * a new daemon process has empty caches and no session state, so nothing this client holds is
 * proven. A `project` scope (a sequence gap on one project's stream) invalidates every
 * project-derived query instead of the whole client — narrower, and still wholesale, because a
 * gap says only that *something* was missed.
 */
export function invalidateForRecovery(
  requirement: FreshnessRequirement,
  utils: SessionQueryUtils,
): Promise<unknown> {
  if (requirement.scope.kind === 'session') return utils.invalidate()
  return Promise.all([
    utils.readDir.invalidate(),
    utils.readFile.invalidate(),
    utils.previewHtml.invalidate(),
    utils.pinnedEntries.invalidate(),
    utils.repoScope.invalidate(),
    utils.searchFiles.invalidate(),
    utils.gitDiffFile.invalidate(),
    invalidateReview(utils),
    utils.boardCards.invalidate(),
    utils.actions.invalidate(),
  ])
}

export type SessionRuntimeState = {
  /** What to tell the human about this connection. */
  readonly status: SessionConnectionStatus
  /** The daemon's refusal, when this build's protocol is no longer accepted. */
  readonly updateRequired: SessionMismatchFrame | undefined
}

/**
 * A refresh nobody awaits. Invalidation failure surfaces on the query that failed to refetch —
 * the UI already renders that error — so the only thing owed here is not leaving an unhandled
 * rejection behind a push notification.
 */
function applyRefresh(refresh: Promise<unknown>): void {
  refresh.catch(() => undefined)
}

/** The Viewer's open files, deduplicated and ordered so an unchanged set compares equal. */
function openFilePaths(panes: readonly Pane[]): string[] {
  const paths = new Set<string>()
  for (const pane of panes) {
    for (const tab of pane.tabs) {
      if (tab.kind === 'file') paths.add(tab.path)
    }
  }
  return [...paths].sort()
}

export function useSessionRuntime({
  endpoint,
  openSocket,
  schedule,
  onTerminalFrame,
}: {
  readonly endpoint: () => SessionEndpoint
  readonly openSocket?: SessionSocketOpener
  readonly schedule?: SessionRetrySchedule
  /** Terminal is a stateful stream, not a query: its frames go to the terminal registry as-is. */
  readonly onTerminalFrame?: (frame: TerminalServerFrame) => void
}): SessionRuntimeState {
  const utils = trpc.useUtils()
  const repoPath = useRepoStore((s) => s.repo?.path)
  const panes = useTabsStore((s) => s.panes)
  const treeDirs = useTreeDirsStore((s) => s.dirs)
  const [status, setStatus] = useState<SessionConnectionStatus>('idle')
  const [updateRequired, setUpdateRequired] = useState<SessionMismatchFrame | undefined>(undefined)

  // The observer closes over values that change on every render; a ref keeps the runtime and its
  // socket alive across those renders instead of tearing the session down to adopt a new
  // callback identity. A caller that re-points its daemon changes what `endpoint()` answers, not
  // which session exists.
  const latest = useRef({ utils, onTerminalFrame, endpoint })
  latest.current = { utils, onTerminalFrame, endpoint }
  // Transport injection is a mount-time concern (production passes neither); only the first
  // value is ever read, so a fresh callback identity cannot restart the session.
  const transport = useRef({ openSocket, schedule })

  const runtime = useMemo(
    () =>
      createSessionClientRuntime({
        observer: {
          onChange: (change: SessionChange): void => {
            applyRefresh(invalidateForChange(change, latest.current.utils))
          },
          onFreshnessRequired: (requirement: FreshnessRequirement): void => {
            applyRefresh(invalidateForRecovery(requirement, latest.current.utils))
          },
          onTerminalFrame: (frame: TerminalServerFrame): void => {
            latest.current.onTerminalFrame?.(frame)
          },
          onUpdateRequired: (frame: SessionMismatchFrame): void => {
            setUpdateRequired(frame)
          },
        },
      }),
    [],
  )

  const adapter = useMemo(
    () =>
      createSessionBrowserAdapter({
        runtime,
        endpoint: () => latest.current.endpoint(),
        openSocket: transport.current.openSocket,
        schedule: transport.current.schedule,
        onStatusChange: setStatus,
      }),
    [runtime],
  )

  useEffect(() => {
    adapter.start()
    return () => adapter.stop()
  }, [adapter])

  // The daemon refused this protocol: retire the transport rather than reconnect into the same
  // final answer. The runtime has already stopped speaking on its own.
  useEffect(() => {
    if (updateRequired !== undefined) adapter.updateRequired()
  }, [adapter, updateRequired])

  // Interests are project-scoped by contract, so the project is declared before any registration
  // can reach the wire.
  useEffect(() => {
    if (repoPath !== undefined) runtime.selectProject(repoPath)
  }, [runtime, repoPath])

  // Compared by value, not identity: a Viewer that reordered its tabs without opening or closing
  // one must not resend the whole desired set to the daemon. NUL separates the two lists because
  // a path can contain anything else.
  const interestKey = `${openFilePaths(panes).join('\n')}\u0000${[...treeDirs].sort().join('\n')}`
  const interest = useMemo(() => {
    const [files = '', dirs = ''] = interestKey.split('\u0000')
    return {
      files: files === '' ? [] : files.split('\n'),
      dirs: dirs === '' ? [] : dirs.split('\n'),
    }
  }, [interestKey])

  useEffect(() => {
    const registration = runtime.registerWatchInterest(interest)
    return () => registration.release()
  }, [runtime, interest])

  return { status, updateRequired }
}
