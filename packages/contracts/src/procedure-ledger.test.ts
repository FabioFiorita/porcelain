import { describe, expect, it } from 'vitest'
import { boardProcedures } from './board'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { unmigratedProcedureLedger, unmigratedProcedureNames } from './procedure-ledger'
import { initialProcedureOwnershipBaseline } from './procedure-ledger-baseline'
import { PROCEDURE_NAMES } from './procedures/names'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'

describe('unmigrated procedure ledger', () => {
  it('contains each unmigrated procedure exactly once', () => {
    expect(unmigratedProcedureNames).toHaveLength(14)
    expect(new Set(unmigratedProcedureNames).size).toBe(14)
    expect([...unmigratedProcedureNames].sort()).toEqual(
      PROCEDURE_NAMES.filter(
        (name) =>
          !(name in remoteProcedures) &&
          !(name in projectsProcedures) &&
          !(name in filesProcedures) &&
          !(name in searchProcedures) &&
          !(name in gitProcedures) &&
          !(name in reviewProcedures) &&
          !(name in boardProcedures),
      ).sort(),
    )
  })

  it('keeps the exact temporary initial ownership baseline', () => {
    expect(initialProcedureOwnershipBaseline).toHaveLength(113)
    expect(new Set(initialProcedureOwnershipBaseline.map(({ name }) => name)).size).toBe(113)
    expect(initialProcedureOwnershipBaseline.map(({ name }) => name).sort()).toEqual(
      [...PROCEDURE_NAMES].sort(),
    )

    const baselineByName = new Map(
      initialProcedureOwnershipBaseline.map((entry) => [entry.name, entry]),
    )
    for (const [domain, entries] of Object.entries(unmigratedProcedureLedger)) {
      for (const entry of entries) {
        expect(baselineByName.get(entry.name)).toEqual({ ...entry, domain })
      }
    }
  })

  it('contains exactly the ten canonical domains', () => {
    expect(Object.keys(unmigratedProcedureLedger).sort()).toEqual([
      'actions',
      'board',
      'files',
      'git',
      'project-data',
      'projects',
      'remote',
      'review',
      'search',
      'terminal',
    ])
  })

  it('removes exactly the completed Remote procedures', () => {
    expect(unmigratedProcedureLedger.remote).toEqual([])
    for (const name of Object.keys(remoteProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Projects procedures', () => {
    expect(unmigratedProcedureLedger.projects).toEqual([])
    expect(Object.keys(projectsProcedures).sort()).toEqual([
      'browseDirs',
      'openRepoPath',
      'recentRepos',
      'removeRecentRepo',
    ])
    for (const name of Object.keys(projectsProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Files procedures', () => {
    expect(unmigratedProcedureLedger.files).toEqual([])
    expect(Object.keys(filesProcedures).sort()).toEqual([
      'createFile',
      'createFolder',
      'duplicatePath',
      'hidePath',
      'pinPath',
      'pinnedEntries',
      'previewHtml',
      'readDir',
      'readFile',
      'renamePath',
      'repoScope',
      'trashPath',
      'unhidePath',
      'unpinPath',
      'writeTextFile',
    ])
    for (const name of Object.keys(filesProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Search procedures', () => {
    expect(unmigratedProcedureLedger.search).toEqual([])
    expect(Object.keys(searchProcedures).sort()).toEqual([
      'searchCode',
      'searchFiles',
      'searchText',
    ])
    for (const name of Object.keys(searchProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Git procedures', () => {
    expect(unmigratedProcedureLedger.git).toEqual([])
    expect(Object.keys(gitProcedures).sort()).toEqual([
      'commitModels',
      'diffReading',
      'gitAddWorktree',
      'gitBranches',
      'gitCheckout',
      'gitCommit',
      'gitCommitConventions',
      'gitCommitDiff',
      'gitCommitFlow',
      'gitCommitMessage',
      'gitCreateBranch',
      'gitDiffFile',
      'gitDiscardFile',
      'gitFileLog',
      'gitFlow',
      'gitGenerateCommitGroups',
      'gitGenerateCommitMessage',
      'gitHead',
      'gitLog',
      'gitPush',
      'gitQuickCommand',
      'gitRangeDiffFile',
      'gitRangeFlow',
      'gitStageAll',
      'gitStageFile',
      'gitStatus',
      'gitSuggestions',
      'gitUnstageAll',
      'gitUnstageFile',
      'gitWorktrees',
    ])
    for (const name of Object.keys(gitProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Review procedures', () => {
    expect(unmigratedProcedureLedger.review).toEqual([])
    expect(Object.keys(reviewProcedures).sort()).toEqual([
      'addReviewComment',
      'archivedReviews',
      'clearFeatureReview',
      'clearLoopEvidence',
      'clearResolvedReviewComments',
      'deleteArchivedReview',
      'deleteReviewComment',
      'editReviewComment',
      'exploreFeature',
      'featureReading',
      'featureView',
      'loopEvidence',
      'loopEvidenceHtml',
      'markReviewed',
      'publishReview',
      'repoLayers',
      'resolveReviewComment',
      'restoreArchivedReview',
      'reviewComments',
      'reviewEvidenceAsset',
      'reviewEvidenceAssets',
      'reviewEvidenceDocs',
      'reviewIntent',
      'reviewPublishCost',
      'reviewedPaths',
      'setRepoLayers',
      'setReviewed',
      'unmarkReviewed',
      'worktreeInbox',
    ])
    for (const name of Object.keys(reviewProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('removes exactly the completed Board procedures', () => {
    expect(unmigratedProcedureLedger.board).toEqual([])
    expect(Object.keys(boardProcedures).sort()).toEqual([
      'addBoardCard',
      'boardCards',
      'clearBoardCards',
      'deleteBoardCard',
      'moveBoardCard',
      'updateBoardCard',
    ])
    for (const name of Object.keys(boardProcedures)) {
      expect(unmigratedProcedureNames).not.toContain(name)
    }
  })

  it('declares only query and mutation kinds with the expected current balance', () => {
    const entries = Object.values(unmigratedProcedureLedger).flat()
    expect(entries.every(({ kind }) => kind === 'query' || kind === 'mutation')).toBe(true)
    expect(entries.filter(({ kind }) => kind === 'query')).toHaveLength(5)
    expect(entries.filter(({ kind }) => kind === 'mutation')).toHaveLength(9)
  })
})
