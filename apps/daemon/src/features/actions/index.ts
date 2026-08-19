/**
 * Actions domain public surface for daemon composition.
 */

export {
  type ActionAuthor,
  type ActionsOperations,
  createActionsOperations,
} from './actions-operations'
export type { ActionsProjects, ActionsSource } from './actions-ports'
export { createActionsRouter } from './actions-router'
export { commandFingerprint, createJsonActionTrustStore } from './json-action-trust-store'
export { createJsonActionsStore } from './json-actions-store'
export {
  createWorktreeScripts,
  DISPOSE_TIMEOUT_MS,
  trustedScriptsOfKind,
  type WorktreeScripts,
} from './worktree-scripts'
