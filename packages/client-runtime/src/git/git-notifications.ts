import {
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
} from '@porcelain/client-runtime/review'
import type { GitChange } from '@porcelain/contracts/git'
import type { ReviewChanged } from '@porcelain/contracts/review'
import {
  gitCommitConventionsQuery,
  gitDiffReadingQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitProjectKey,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from './git-queries'
import {
  dedupeGitQueryEffects,
  type GitQueryEffect,
  gitDiffQuery,
  gitDiffReadingQueryFamily,
  gitFileLogQueryFamily,
  gitLogQueryFamily,
  gitRangeDiffQuery,
} from './git-query-effects'

/** Map a typed Git change fact to all project data that can be stale. */
export function gitNotificationEffects(notification: GitChange): readonly GitQueryEffect[] {
  const projectPath = gitProjectKey(notification.projectPath)
  return [
    gitHeadQuery(projectPath),
    gitFlowQuery(projectPath),
    gitRangeFlowQuery(projectPath),
    gitStatusQuery(projectPath),
    gitDiffQuery(projectPath),
    gitRangeDiffQuery(projectPath),
    gitDiffReadingQueryFamily(projectPath),
    gitLogQueryFamily(projectPath),
    gitFileLogQueryFamily(projectPath),
    gitCommitConventionsQuery(projectPath),
    gitSuggestionsQuery(projectPath),
    reviewReadingQuery(projectPath),
    reviewViewQuery(projectPath),
    reviewedPathsQuery(projectPath),
  ]
}

/** Map changed Review layers to the Git reads whose grouping and stacked diffs they affect. */
export function gitReviewNotificationEffects(
  notification: ReviewChanged,
): readonly GitQueryEffect[] {
  const projectPath = gitProjectKey(notification.projectPath)
  return dedupeGitQueryEffects([
    gitFlowQuery(projectPath),
    gitRangeFlowQuery(projectPath),
    gitDiffQuery(projectPath),
    gitRangeDiffQuery(projectPath),
    gitDiffReadingQuery(projectPath, { type: 'working' }),
    gitDiffReadingQuery(projectPath, { type: 'branch' }),
  ])
}
