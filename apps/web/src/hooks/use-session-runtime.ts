import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { invalidateAllBoardCards } from '@renderer/features/board'
import { invalidateAllFilesQueries } from '@renderer/features/files'
import { invalidateAllReviewComments } from '@renderer/features/review/comments'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import { isBrowser } from '@renderer/lib/platform'
import type { SessionConnectionStatus } from '@renderer/lib/session-browser-adapter'
import { shellTrpcClient, trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { unreadTabFor, useUnreadStore } from '@renderer/stores/unread'
import { settleBackground } from '@shared/background'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Web's binding between the shared session runtime and React Query: it turns a domain change
 * notification into a refetch of the queries that own the data and reports the connection
 * state a human can act on.
 *
 * Owns no socket. The window's primary `DaemonSession` (or an injected test session) owns the
 * single runtime + adapter; this hook only registers invalidation handlers and project
 * selection on that runtime so terminal traffic and change signals share one connection.
 *
 * Files notifications and watch interests are owned by the Files feature adapters (FIL-005);
 * Board and Review comments are feature-owned the same way. Files change arms here are no-ops.
 *
 * The contract of this module is that a notification is a *freshness signal*, never data
 * (decision 009). Nothing here writes a payload into the cache; every category maps to
 * `invalidate()` on the authoritative queries, which is also why processing the same
 * notification twice is harmless. Recovery is the same instruction with a wider scope: when the
 * runtime says it can no longer prove freshness, the affected scope is invalidated wholesale
 * rather than reconstructed from what might have been missed.
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
  /** Files cache — wired to the feature key predicate (FIL-005). */
  readonly files: QueryInvalidation
  readonly actions: QueryInvalidation
}

/**
 * The queries a Review change makes stale for non-comments Review surfaces: feature-view,
 * layers, and evidence. Comments are owned by the RVC-003 feature adapter (subscription +
 * recovery predicate), so they are not bulk-invalidated here.
 * The per-asset body is dropped too — an agent retrying a capture reuses `before.png`, so the
 * name is not a proxy for immutable bytes.
 */
function invalidateReview(utils: SessionQueryUtils): Promise<unknown> {
  return Promise.all([
    utils.featureView.invalidate(),
    utils.featureReading.invalidate(),
    utils.exploreFeature.invalidate(),
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
type GlobalSessionChange = Exclude<SessionChange, { kind: 'git.working-tree-changed' }>

export function invalidateForChange(
  change: GlobalSessionChange,
  utils: SessionQueryUtils,
): Promise<unknown> {
  switch (change.kind) {
    case 'files.scope-changed':
    case 'files.tree-changed':
    case 'files.content-changed':
      // Files owns notification → identity mapping (FIL-005 feature adapter).
      // Session runtime must not invalidate Files, Git, or Search here.
      return Promise.resolve()
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
  if (requirement.scope.kind === 'session') {
    return Promise.all([
      utils.invalidate(),
      utils.reviewComments.invalidate(),
      utils.boardCards.invalidate(),
      utils.files.invalidate(),
    ])
  }
  return Promise.all([
    utils.files.invalidate(),
    utils.gitDiffFile.invalidate(),
    invalidateReview(utils),
    // Comments freshness is feature-owned (RVC-003); recovery still hits the predicate slot.
    utils.reviewComments.invalidate(),
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
 * Bind React Query invalidation to a daemon session's runtime.
 *
 * Defaults to `primary` so the whole window shares one socket with terminal traffic.
 * Tests may inject a purpose-built `DaemonSession` (with a fake opener) instead.
 *
 * Files watch interests are owned by `useFilesInterestBridge` (FIL-005), not here.
 */
export function useSessionRuntime({
  session = primary,
}: {
  readonly session?: DaemonSession
} = {}): SessionRuntimeState {
  const trpcUtils = trpc.useUtils()
  const queryClient = useQueryClient()
  const repoPath = useProjectSelectionStore((s) => s.project?.path)
  const [status, setStatus] = useState<SessionConnectionStatus>(() => session.status())
  const [updateRequired, setUpdateRequired] = useState<SessionMismatchFrame | undefined>(() =>
    session.updateRequiredFrame(),
  )

  // Structural SessionQueryUtils: Board, comments, and Files recovery use feature key predicates
  // so they invalidate domain caches, not tRPC procedure-name keys.
  const utils: SessionQueryUtils = useMemo(
    () => ({
      invalidate: () => trpcUtils.invalidate(),
      gitFlow: { invalidate: () => trpcUtils.gitFlow.invalidate() },
      gitDiffFile: { invalidate: () => trpcUtils.gitDiffFile.invalidate() },
      gitRangeFlow: { invalidate: () => trpcUtils.gitRangeFlow.invalidate() },
      gitCommitFlow: { invalidate: () => trpcUtils.gitCommitFlow.invalidate() },
      repoLayers: { invalidate: () => trpcUtils.repoLayers.invalidate() },
      featureView: { invalidate: () => trpcUtils.featureView.invalidate() },
      featureReading: { invalidate: () => trpcUtils.featureReading.invalidate() },
      exploreFeature: { invalidate: () => trpcUtils.exploreFeature.invalidate() },
      reviewComments: { invalidate: () => invalidateAllReviewComments(queryClient) },
      loopEvidence: { invalidate: () => trpcUtils.loopEvidence.invalidate() },
      loopEvidenceHtml: { invalidate: () => trpcUtils.loopEvidenceHtml.invalidate() },
      reviewEvidenceDocs: { invalidate: () => trpcUtils.reviewEvidenceDocs.invalidate() },
      reviewEvidenceAssets: { invalidate: () => trpcUtils.reviewEvidenceAssets.invalidate() },
      reviewEvidenceAsset: { invalidate: () => trpcUtils.reviewEvidenceAsset.invalidate() },
      boardCards: { invalidate: () => invalidateAllBoardCards(queryClient) },
      files: { invalidate: () => invalidateAllFilesQueries(queryClient) },
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
      // Invalidation failure surfaces on the query that failed to refetch — the UI
      // already renders that error, so a push refresh owes nothing but not floating.
      if (change.kind !== 'git.working-tree-changed') {
        settleBackground(invalidateForChange(change, latest.current.utils), 'invalidation')
      }
    })
    const offFreshness = session.onFreshnessRequired((requirement: FreshnessRequirement): void => {
      settleBackground(invalidateForRecovery(requirement, latest.current.utils), 'invalidation')
    })
    // Socket died: a remote-bound window may need the shell to re-resolve the local child's
    // route (port moved). Browser clients have no shell bridge. Best-effort — failures stay silent.
    const offClose = session.onDaemonClose(() => {
      if (!isBrowser) {
        settleBackground(shellTrpcClient.refreshRemoteEnvironment.query(), 'lifecycle')
      }
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
  // can reach the wire. Files interest bridge owns the watches themselves.
  useEffect(() => {
    if (repoPath !== undefined) session.runtime.selectProject(repoPath)
  }, [session, repoPath])

  return { status, updateRequired }
}
