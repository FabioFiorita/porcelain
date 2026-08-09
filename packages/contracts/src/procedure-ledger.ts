import type { ProcedureKind } from './procedure-contract'
import type { ProcedureName } from './procedures/names'

export type ProcedureDomain =
  | 'remote'
  | 'projects'
  | 'files'
  | 'search'
  | 'git'
  | 'review'
  | 'board'
  | 'actions'
  | 'terminal'
  | 'project-data'

export type UnmigratedProcedure = Readonly<{
  name: ProcedureName
  kind: ProcedureKind
}>

/**
 * Transitional ownership ledger. CON-002 through CON-011 remove only their own entries;
 * CON-012 deletes this file once every domain record is complete.
 */
export const unmigratedProcedureLedger = {
  remote: [],
  projects: [],
  files: [],
  search: [],
  git: [],
  review: [
    { name: 'worktreeInbox', kind: 'query' },
    { name: 'markReviewed', kind: 'mutation' },
    { name: 'unmarkReviewed', kind: 'mutation' },
    { name: 'reviewedPaths', kind: 'query' },
    { name: 'setReviewed', kind: 'mutation' },
    { name: 'featureView', kind: 'query' },
    { name: 'featureReading', kind: 'query' },
    { name: 'clearFeatureReview', kind: 'mutation' },
    { name: 'reviewIntent', kind: 'query' },
    { name: 'reviewEvidenceDocs', kind: 'query' },
    { name: 'reviewEvidenceAssets', kind: 'query' },
    { name: 'reviewEvidenceAsset', kind: 'query' },
    { name: 'reviewPublishCost', kind: 'query' },
    { name: 'publishReview', kind: 'mutation' },
    { name: 'archivedReviews', kind: 'query' },
    { name: 'restoreArchivedReview', kind: 'mutation' },
    { name: 'deleteArchivedReview', kind: 'mutation' },
    { name: 'loopEvidence', kind: 'query' },
    { name: 'loopEvidenceHtml', kind: 'query' },
    { name: 'clearLoopEvidence', kind: 'mutation' },
    { name: 'reviewComments', kind: 'query' },
    { name: 'addReviewComment', kind: 'mutation' },
    { name: 'editReviewComment', kind: 'mutation' },
    { name: 'deleteReviewComment', kind: 'mutation' },
    { name: 'clearResolvedReviewComments', kind: 'mutation' },
    { name: 'resolveReviewComment', kind: 'mutation' },
    { name: 'exploreFeature', kind: 'query' },
    { name: 'repoLayers', kind: 'query' },
    { name: 'setRepoLayers', kind: 'mutation' },
  ],
  board: [
    { name: 'boardCards', kind: 'query' },
    { name: 'addBoardCard', kind: 'mutation' },
    { name: 'updateBoardCard', kind: 'mutation' },
    { name: 'moveBoardCard', kind: 'mutation' },
    { name: 'deleteBoardCard', kind: 'mutation' },
    { name: 'clearBoardCards', kind: 'mutation' },
  ],
  actions: [
    { name: 'actions', kind: 'query' },
    { name: 'trustActions', kind: 'mutation' },
    { name: 'addAction', kind: 'mutation' },
    { name: 'updateAction', kind: 'mutation' },
    { name: 'moveAction', kind: 'mutation' },
    { name: 'deleteAction', kind: 'mutation' },
  ],
  terminal: [
    { name: 'terminalSessions', kind: 'query' },
    { name: 'renameTerminal', kind: 'mutation' },
  ],
  'project-data': [
    { name: 'repoNotes', kind: 'query' },
    { name: 'setRepoNotes', kind: 'mutation' },
    { name: 'companionDispositions', kind: 'query' },
    { name: 'companionGitVisibility', kind: 'query' },
    { name: 'setCompanionGitVisibility', kind: 'mutation' },
    { name: 'setCompanionDisposition', kind: 'mutation' },
  ],
} as const satisfies Readonly<Record<ProcedureDomain, readonly UnmigratedProcedure[]>>

export const unmigratedProcedureNames: readonly ProcedureName[] = Object.freeze(
  Object.values(unmigratedProcedureLedger).flatMap((entries) => entries.map(({ name }) => name)),
)
