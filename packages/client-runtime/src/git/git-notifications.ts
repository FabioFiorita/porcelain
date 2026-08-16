import type { GitChange } from '@porcelain/contracts/git'
import {
  gitCommitConventionsQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitProjectKey,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from './git-queries'
import {
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
  ]
}
