import type { GitChange } from '@porcelain/contracts/git'
import {
  type GitWorkspaceQuery,
  gitCommitConventionsQuery,
  gitDiffQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitProjectKey,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
} from './git-queries'

/** Map the typed Git change fact to the current-worktree data it can make stale. */
export function gitNotificationEffects(notification: GitChange): readonly GitWorkspaceQuery[] {
  switch (notification.kind) {
    case 'git.working-tree-changed': {
      const projectPath = gitProjectKey(notification.projectPath)
      return [
        gitHeadQuery(projectPath),
        gitFlowQuery(projectPath),
        gitRangeFlowQuery(projectPath),
        gitStatusQuery(projectPath),
        gitDiffQuery(projectPath),
        gitLogQuery(projectPath),
        gitCommitConventionsQuery(projectPath),
        gitSuggestionsQuery(projectPath),
        reviewReadingQuery(projectPath),
        reviewViewQuery(projectPath),
        reviewedPathsQuery(projectPath),
      ]
    }
    default: {
      const _exhaustive: never = notification
      return _exhaustive
    }
  }
}
