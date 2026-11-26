import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Box } from '../components/ui/box';
import { Icon } from '../components/ui/icon';
import { Item } from '../components/ui/item';
import {
  useLayoutMove,
  useListDetailLayout,
} from '../components/ui/list-detail';
import { Screen } from '../components/ui/screen';
import { DemoNotice } from '../features/access';
import { FilesScreen, useOpenedFile } from '../features/files';
import { HistoryScreen } from '../features/history';
import {
  WorkspaceGate,
  WorktreeTitleButton,
  useOpenPullRequest,
  useSelectedWorkspaceKey,
  useSelectedWorktree,
} from '../features/projects';
import { WalkthroughSection } from '../features/walkthroughs';
import type { ListDetailMode } from '../shared/rules/list-detail';
import type { WorktreeTab } from './app-tab-list';
import { TopBar } from './top-bar';
import { WorktreeChangesPane } from './workspace-review-pane';
import { DrawerToolbar } from './drawer-toolbar';

const tabTestIds = {
  walkthrough: 'walkthrough-tab',
  changes: 'changes-tab',
  files: 'files-tab',
  history: 'history-tab',
} as const satisfies Record<WorktreeTab, string>;

export function WorktreeTabRoot({ tab }: { tab: WorktreeTab }) {
  const [collapsing, setCollapsing] = useState(false);
  const layout = useListDetailLayout((mode) =>
    setCollapsing(tab === 'files' && mode === 'stack'),
  );
  const selected = useSelectedWorktree();
  const workspace = useSelectedWorkspaceKey();
  const openedFile = useOpenedFile(workspace);
  const router = useRouter();
  useLayoutMove({
    place: 'root',
    mode: layout.measured,
    collapsing,
    file: tab === 'files' ? openedFile : undefined,
    onMove: (move) => {
      setCollapsing(false);
      if (move.kind === 'push' && workspace && move.file)
        router.push({
          pathname: '/file',
          params: { path: move.file, workspace },
        });
    },
  });
  return (
    <View
      className="flex-1"
      collapsable={false}
      onLayout={layout.onLayout}
      testID={tabTestIds[tab]}
    >
      <DrawerToolbar />
      <WorktreeTitleButton />
      <TopBar />
      <WorkspaceGate frame="pane">
        {() => (
          <Screen layout="fixed">
            <DemoNotice environmentId={selected?.environment} />
            {tab === 'changes' ? <PullRequestRow /> : null}
            <Box className="flex-1" collapsable={false}>
              <TabBody tab={tab} mode={layout.mode} />
            </Box>
          </Screen>
        )}
      </WorkspaceGate>
    </View>
  );
}

function TabBody({ tab, mode }: { tab: WorktreeTab; mode: ListDetailMode }) {
  switch (tab) {
    case 'walkthrough':
      return <WalkthroughSection />;
    case 'changes':
      return <WorktreeChangesPane mode={mode} />;
    case 'files':
      return <FilesScreen mode={mode} nested />;
    case 'history':
      return <HistoryScreen nested mode={mode} />;
  }
}

function PullRequestRow() {
  const selected = useSelectedWorktree();
  const openPullRequest = useOpenPullRequest();
  const number = Number(selected?.number);
  if (!selected || !Number.isInteger(number) || number <= 0) return null;
  return (
    <Box divider="bottom">
      <Item
        testID="worktree-pull-request"
        title={`Pull request #${number}`}
        leading={<Icon name="review" tone="muted" />}
        trailing={<Icon name="chevron" tone="muted" />}
        onPress={() =>
          openPullRequest({
            environmentId: selected.environment,
            projectId: selected.projectId,
            number,
          })
        }
      />
    </Box>
  );
}
