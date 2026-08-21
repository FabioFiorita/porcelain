import type { ActionRunTarget } from '@porcelain/contracts/actions'
import { useHubTarget } from '@/features/projects/hub-target'

/**
 * The explicit Environment + Project + Worktree an Action runs against (#24).
 *
 * The join itself is the shared Hub binding (`features/projects/hub-target.ts`) — Actions
 * only names the result in its own vocabulary.
 */
export function useActionsTarget(): ActionRunTarget | null {
  return useHubTarget()
}
