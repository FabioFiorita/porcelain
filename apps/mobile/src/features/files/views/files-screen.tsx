import { WorktreeEmpty } from '../../../shared/worktree-empty';
import { useSelectedWorktree } from '../../projects';

export function FilesScreen() {
  const selected = useSelectedWorktree();
  return <WorktreeEmpty key={selected?.key} title="Files" />;
}
