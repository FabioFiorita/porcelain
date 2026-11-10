import { FilesScreen } from '../features/files';
import { HistoryScreen } from '../features/history';
import type { WorktreeSectionContent } from '../features/projects';
import { WalkthroughSection } from '../features/walkthroughs';
import { WorktreeChangesPane } from './workspace-review-pane';

export const WorktreeSectionView: WorktreeSectionContent = ({
  section,
  mode,
}) => {
  switch (section) {
    case 'walkthrough':
      return <WalkthroughSection />;
    case 'changes':
      return <WorktreeChangesPane />;
    case 'files':
      return <FilesScreen mode={mode} />;
    case 'history':
      return <HistoryScreen />;
  }
};
