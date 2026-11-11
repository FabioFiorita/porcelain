import { Loading } from '../components/ui/loading';
import type { ListDetailMode } from '../shared/rules/list-detail';
import type { WorktreeSection } from '../features/projects';
import { TopBar } from './top-bar';
import { FilesScreen } from '../features/files';
import { HistoryScreen } from '../features/history';
import type { WorktreeSectionContent } from '../features/projects';
import { WalkthroughSection } from '../features/walkthroughs';
import { WorktreeChangesPane } from './workspace-review-pane';

export const WorktreeSectionView: WorktreeSectionContent = ({
  section,
  mode,
  switcher,
}) => (
  <>
    <TopBar leading={switcher} />
    <SectionBody section={section} mode={mode} />
  </>
);

function SectionBody({
  section,
  mode,
}: {
  section: WorktreeSection | undefined;
  mode: ListDetailMode;
}) {
  switch (section) {
    case undefined:
      return <Loading label="Reading worktree…" />;
    case 'walkthrough':
      return <WalkthroughSection />;
    case 'changes':
      return <WorktreeChangesPane />;
    case 'files':
      return <FilesScreen mode={mode} />;
    case 'history':
      return <HistoryScreen />;
  }
}
