import { WorktreeEmpty } from '../../../shared/worktree-empty';
import { WorktreeReview } from './worktree-review';
import { useSelectedWorktree } from '../../projects';

export function ReviewScreen() {
  const current = useSelectedWorktree();
  return current ? (
    <WorktreeReview
      key={current.key}
      scope={current.scope}
      connection={current.connection}
    />
  ) : (
    <WorktreeEmpty title="Review" />
  );
}
