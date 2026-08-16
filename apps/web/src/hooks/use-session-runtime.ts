import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { invalidateAllActionsQueries } from '@renderer/features/actions'
import { invalidateAllFilesQueries } from '@renderer/features/files'
import {
  invalidateAllProjectDataQueries,
  invalidateProjectDataLayers,
} from '@renderer/features/project-data'
import { invalidateAllReviewComments, invalidateAllReviewQueries } from '@renderer/features/review'
import { invalidateAllTasks } from '@renderer/features/tasks'
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
 * Review is feature-owned the same way (RVC-003, REV-007). Files change arms
 * here are no-ops.
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
  readonly repoLayers: QueryInvalidation
  readonly projectData: QueryInvalidation
  /** Review cache — wired to the feature key predicate (REV-007), not a procedure name. */
  readonly review: QueryInvalidation
  readonly reviewComments: QueryInvalidation
  /** Legacy compatibility slot; Board is no longer a shipped surface. */
  readonly boardCards?: QueryInvalidation
  /** Files cache — wired to the feature key predicate (FIL-005). */
  readonly files: QueryInvalidation
  readonly actions: QueryInvalidation
  /** Tasks cache — daemon-wide, so recovery invalidates every Environment's table. */
  readonly tasks: QueryInvalidation
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
    case 'files.tree-changed':
    case 'files.content-changed':
      // Files owns notification → identity mapping (FIL-005 feature adapter).
      // Session runtime must not invalidate Files, Git, or Search here.
      return Promise.resolve()
    case 'git.working-tree-changed':
      // The Git feature bridge owns it (GIT-006): one subscription maps the change to typed
      // Git identities. Handled here only so the switch stays exhaustive over SessionChange.
      return Promise.resolve()
    case 'tasks.changed':
      // Tasks owns its notification → identity mapping (the Web Tasks feature adapter).
      // Handled here only so the switch stays exhaustive over SessionChange.
      return Promise.resolve()
    case 'review.changed':
      // Review owns its notification → identity mapping (REV-007 feature adapter) and comments
      // own theirs (RVC-003). What is left here is the Project Data consequence REV-006 ruling 7
      // assigned to Project Data: the repo's layers are derived from the active review.
      return utils.repoLayers.invalidate()
    case 'board.changed':
      // Retained only so older daemons can finish a session stream during migration.
      return Promise.resolve()
    case 'actions.changed':
      // Actions owns its notification → list-identity mapping (ACT-003 feature adapter).
      // Session runtime must not invalidate Actions here; the feature subscription does.
      return Promise.resolve()
    case 'terminal.dev-servers-changed':
      // Terminal owns its notification → dev-servers-identity mapping (the feature
      // subscription in features/terminal). Handled here only for exhaustiveness.
      return Promise.resolve()
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
      ...(utils.boardCards === undefined ? [] : [utils.boardCards.invalidate()]),
      utils.tasks.invalidate(),
      utils.files.invalidate(),
      utils.projectData.invalidate(),
    ])
  }
  return Promise.all([
    utils.files.invalidate(),
    utils.repoLayers.invalidate(),
    // Review freshness is feature-owned (REV-007); recovery still hits the predicate slot.
    utils.review.invalidate(),
    // Comments freshness is feature-owned (RVC-003); recovery still hits the predicate slot.
    utils.reviewComments.invalidate(),
    ...(utils.boardCards === undefined ? [] : [utils.boardCards.invalidate()]),
    // Tasks are daemon-wide, so a project-scoped gap still leaves them unproven: the gap
    // could have swallowed a `tasks.changed`, which carries no project to narrow by.
    utils.tasks.invalidate(),
    utils.actions.invalidate(),
    utils.projectData.invalidate(),
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

  // Structural SessionQueryUtils: Review, comments, and Files recovery use feature key
  // predicates so they invalidate domain caches, not tRPC procedure-name keys.
  const utils: SessionQueryUtils = useMemo(
    () => ({
      invalidate: () => trpcUtils.invalidate(),
      repoLayers: { invalidate: () => invalidateProjectDataLayers(queryClient) },
      projectData: { invalidate: () => invalidateAllProjectDataQueries(queryClient) },
      review: { invalidate: () => invalidateAllReviewQueries(queryClient) },
      reviewComments: { invalidate: () => invalidateAllReviewComments(queryClient) },
      files: { invalidate: () => invalidateAllFilesQueries(queryClient) },
      actions: { invalidate: () => invalidateAllActionsQueries(queryClient) },
      tasks: { invalidate: () => invalidateAllTasks(queryClient) },
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
      settleBackground(invalidateForChange(change, latest.current.utils), 'invalidation')
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
