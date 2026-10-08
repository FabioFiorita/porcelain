import { Empty } from '../../../components/ui/empty';
import { useSelectedWorktree } from '../../projects';

export function FilesScreen() {
  const selected = useSelectedWorktree();
  return (
    <Empty
      description="Select a worktree to continue."
      key={selected?.key}
      title="Files"
    />
  );
}
