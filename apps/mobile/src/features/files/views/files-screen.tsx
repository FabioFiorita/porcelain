import { WorktreeEmpty } from '../../../shared/worktree-empty';
import { useSelectedWorktree } from '../../projects';
import { FilesWorkspace } from './files-workspace';

export function FilesScreen() {
  const selected = useSelectedWorktree();
  return selected ? (
    <FilesWorkspace key={selected.key} context={selected} />
  ) : (
    <WorktreeEmpty title="Files" />
  );
}
