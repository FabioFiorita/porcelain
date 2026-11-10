import { FilesScreen } from '../features/files';
import { HistoryScreen } from '../features/history';
import type { WorktreeSectionContent } from '../features/projects';
import { WorkspaceReviewPane } from './workspace-review-pane';

export const WorktreeSectionView: WorktreeSectionContent = ({
  section,
  mode,
}) => {
  switch (section) {
    case 'changes':
      return <WorkspaceReviewPane />;
    case 'files':
      return <FilesScreen mode={mode} />;
    case 'history':
      return <HistoryScreen />;
  }
};
