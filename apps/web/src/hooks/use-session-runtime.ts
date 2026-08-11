import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { invalidateAllBoardCards } from '@renderer/features/board'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import type { SessionConnectionStatus } from '@renderer/lib/session-browser-adapter'
import { shellTrpcClient, trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { type Pane, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { unreadTabFor, useUnreadStore } from '@renderer/stores/unread'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Web's binding between the shared session runtime and React Query: it turns a domain change
 * notification into a refetch of the queries that own the data, restates the Viewer's file and
 * directory interests to the runtime, and reports the connection state a human can act on.
 *
 * Owns no socket. The window's primary `DaemonSession` (or an injected test session) owns the
 * single runtime + adapter; this hook only registers invalidation handlers, project selection,
 * and watch interests on that runtime so terminal traffic and change signals share one connection.
 *
 * The contract of this module is that a notification is a *freshness signal*, never data
 * (decision 009). Nothing here writes a payload into the cache; every category maps to
 * `invalidate()` on the authoritative queries, which is also why processing the same
 * notification twice is harmless. Recovery is the same instruction with a wider scope: when the
 * runtime says it can no longer prove freshness, the affected scope is invalidated wholesale
 * rather than reconstructed from what might have been missed.
 *
 * The category → query mapping is deliberately the one the legacy `useShellEvents` path
 * performed, so the cutover changes the transport and not what the screen refreshes. Where the
 * target contract merges several legacy events into one category, this maps to the union of
 * what those events invalidated — the daemon already published them together
 * (`packages/contracts/src/review/review.notifications.ts`), so no consumer could act on the
 * distinction anyway.
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
  /** Board cards cache — wired to the feature key predicate, not a procedure-name string. */
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
 * The `Promise<unknown>` return with NO `default` case is deliberate: a category added to the
 * contract falls through to an implicit `return undefined`, which fails the annotated type at
 * `pnpm typecheck` — so a new domain signal cannot silently ship un-refreshed.
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
      // Board owns its notification → cards-identity mapping (BRD-004 feature adapter).
      // Session runtime must not invalidate Board here; the feature subscription does.
      return Promise.resolve()
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

/**
 * Bind React Query invalidation + Viewer interests to a daemon session's runtime.
 *
 * Defaults to `primary` so the whole window shares one socket with terminal traffic.
 * Tests may inject a purpose-built `DaemonSession` (with a fake opener) instead.
 */
export function useSessionRuntime({
  session = primary,
}: {
  readonly session?: DaemonSession
} = {}): SessionRuntimeState {
  const trpcUtils = trpc.useUtils()
  const queryClient = useQueryClient()
  const repoPath = useRepoStore((s) => s.repo?.path)
  const panes = useTabsStore((s) => s.panes)
  const treeDirs = useTreeDirsStore((s) => s.dirs)
  const [status, setStatus] = useState<SessionConnectionStatus>(() => session.status())
  const [updateRequired, setUpdateRequired] = useState<SessionMismatchFrame | undefined>(() =>
    session.updateRequiredFrame(),
  )

  // Structural SessionQueryUtils: Board recovery uses the feature key predicate so it
  // invalidates the BRD-004 cards cache, not a tRPC procedure-name key.
  const utils: SessionQueryUtils = useMemo(
    () => ({
      invalidate: () => trpcUtils.invalidate(),
      readDir: { invalidate: () => trpcUtils.readDir.invalidate() },
      readFile: { invalidate: () => trpcUtils.readFile.invalidate() },
      previewHtml: { invalidate: () => trpcUtils.previewHtml.invalidate() },
      pinnedEntries: { invalidate: () => trpcUtils.pinnedEntries.invalidate() },
      repoScope: { invalidate: () => trpcUtils.repoScope.invalidate() },
      searchFiles: { invalidate: () => trpcUtils.searchFiles.invalidate() },
      gitFlow: { invalidate: () => trpcUtils.gitFlow.invalidate() },
      gitDiffFile: { invalidate: () => trpcUtils.gitDiffFile.invalidate() },
      gitRangeFlow: { invalidate: () => trpcUtils.gitRangeFlow.invalidate() },
      gitCommitFlow: { invalidate: () => trpcUtils.gitCommitFlow.invalidate() },
      repoLayers: { invalidate: () => trpcUtils.repoLayers.invalidate() },
      featureView: { invalidate: () => trpcUtils.featureView.invalidate() },
      featureReading: { invalidate: () => trpcUtils.featureReading.invalidate() },
      exploreFeature: { invalidate: () => trpcUtils.exploreFeature.invalidate() },
      reviewComments: { invalidate: () => trpcUtils.reviewComments.invalidate() },
      loopEvidence: { invalidate: () => trpcUtils.loopEvidence.invalidate() },
      loopEvidenceHtml: { invalidate: () => trpcUtils.loopEvidenceHtml.invalidate() },
      reviewEvidenceDocs: { invalidate: () => trpcUtils.reviewEvidenceDocs.invalidate() },
      reviewEvidenceAssets: { invalidate: () => trpcUtils.reviewEvidenceAssets.invalidate() },
      reviewEvidenceAsset: { invalidate: () => trpcUtils.reviewEvidenceAsset.invalidate() },
      boardCards: { invalidate: () => invalidateAllBoardCards(queryClient) },
      actions: { invalidate: () => trpcUtils.actions.invalidate() },
    }),
    [trpcUtils, queryClient],
  )

  // Utils identity changes every render from tRPC; a ref keeps the long-lived change/
  // freshness subscriptions from tearing down and re-registering on that churn.
  const latest = useRef({ utils })
  latest.current = { utils }

  // Open the single session for this window (idempotent). Terminal APIs also start it, but
  // change signals must flow even when no PTY is open.
  useEffect(() => {
    session.start()
  }, [session])

  useEffect(() => {
    const offStatus = session.onStatusChange(setStatus)
    const offUpdate = session.onUpdateRequired(setUpdateRequired)
    const offChange = session.onChange((change: SessionChange): void => {
      // Light the rail's unread dot for agent-push categories that carry an attention signal
      // (mark no-ops when that tab is already active).
      const tab = unreadTabFor(change)
      if (tab) useUnreadStore.getState().mark(tab)
      applyRefresh(invalidateForChange(change, latest.current.utils))
    })
    const offFreshness = session.onFreshnessRequired((requirement: FreshnessRequirement): void => {
      applyRefresh(invalidateForRecovery(requirement, latest.current.utils))
    })
    // Socket died: a remote-bound window may need the shell to re-resolve the local child's
    // route (port moved). Browser clients have no shell bridge.
    const offClose = session.onDaemonClose(() => {
      if (!isBrowser) void shellTrpcClient.refreshRemoteEnvironment.query()
    })
    return () => {
      offStatus()
      offUpdate()
      offChange()
      offFreshness()
      offClose()
    }
  }, [session])

  // Interests are project-scoped by contract, so the project is declared before any registration
  // can reach the wire.
  useEffect(() => {
    if (repoPath !== undefined) session.runtime.selectProject(repoPath)
  }, [session, repoPath])

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
    const registration = session.runtime.registerWatchInterest(interest)
    return () => registration.release()
  }, [session, interest])

  return { status, updateRequired }
}
