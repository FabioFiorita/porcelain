import { WorktreeScreen } from '../../../features/projects';
import { WorktreeSectionView } from '../../../shell/worktree-section-view';

export default function WorktreeRoute() {
  return <WorktreeScreen content={WorktreeSectionView} />;
}
