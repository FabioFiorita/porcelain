import type { GitAction } from './git-action.ts';
import type { GitActionStatus } from './status.ts';
import { gitActionBlocker } from './status.ts';

export function networkActionBlocker(
  action: GitAction,
  status: GitActionStatus,
  pullBlock: string | undefined,
) {
  return action === 'pull' && pullBlock
    ? pullBlock
    : gitActionBlocker(action, status);
}
