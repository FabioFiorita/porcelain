import { WorktreeScreen } from '../../../features/projects';
import { WalkthroughGuide } from '../../../features/walkthroughs';
import { WorktreeSectionView } from '../../../shell/worktree-section-view';

export default function WorktreeRoute() {
  return (
    <WorktreeScreen content={WorktreeSectionView} guide={WalkthroughGuide} />
  );
}
