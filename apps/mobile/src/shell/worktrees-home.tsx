import { WorktreeSectionView } from './worktree-section-view';
import { Empty } from '../components/ui/empty';
import { ListDetail } from '../components/ui/list-detail';
import {
  WorktreeDetail,
  WorktreesScreen,
  useSelectedWorktree,
} from '../features/projects';

export function WorktreesHome() {
  const selected = useSelectedWorktree();
  return (
    <ListDetail
      list={(mode) => <WorktreesScreen mode={mode} />}
      detail={
        selected ? (
          <WorktreeDetail
            key={`${selected.environment}/${selected.projectId}/${selected.worktreeId}`}
            details={selected}
            mode="beside"
            content={WorktreeSectionView}
          />
        ) : (
          <Empty
            title="Select a worktree"
            description="Choose a worktree on the left to see its changes, files and history."
          />
        )
      }
    />
  );
}
