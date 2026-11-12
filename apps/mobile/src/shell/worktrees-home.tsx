import type { SearchBarCommands } from 'react-native-screens';
import { useAtom, useAtomValue } from '@effect/atom-react';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { WorktreeSectionView } from './worktree-section-view';
import { Empty } from '../components/ui/empty';
import {
  ListDetail,
  useLayoutMove,
  useListDetailLayout,
  usePortrait,
} from '../components/ui/list-detail';
import { SettingsToolbar } from '../features/access';
import { useOpenedFile } from '../features/files';
import {
  WorktreeDetail,
  WorktreesScreen,
  useSelectedWorkspaceKey,
  useSelectedWorktree,
  useWorktreeNavigator,
  worktreeListHidden,
  worktreeSection,
} from '../features/projects';
import { WalkthroughGuide } from '../features/walkthroughs';
import { headerIcon } from '../shared/icons/header-icon';
import {
  closedListDrawer,
  listDrawer,
  listDrawerShown,
  type ListDrawerEvent,
} from '../shared/rules/list-detail';

export function WorktreesHome() {
  const selected = useSelectedWorktree();
  const workspace = useSelectedWorkspaceKey();
  const section = useAtomValue(worktreeSection(workspace ?? ''));
  const openedFile = useOpenedFile(workspace);
  const [hidden, setHidden] = useAtom(worktreeListHidden);
  const router = useRouter();
  const [collapsing, setCollapsing] = useState(false);
  const layout = useListDetailLayout((mode) => setCollapsing(mode === 'stack'));
  useLayoutMove({
    place: 'root',
    mode: layout.measured,
    collapsing,
    file: section === 'files' ? openedFile : undefined,
    onMove: (move) => {
      setCollapsing(false);
      if (!selected || move.kind !== 'push') return;
      router.push({ pathname: '/worktree', params: selected });
      if (workspace && move.file)
        router.push({
          pathname: '/file',
          params: { path: move.file, workspace },
        });
    },
  });
  const beside = layout.mode === 'beside' && selected !== undefined;
  const portrait = usePortrait();
  const [drawer, setDrawer] = useState(closedListDrawer);
  const [send] = useState(
    () => (event: ListDrawerEvent) =>
      setDrawer((current) => listDrawer(current, event)),
  );
  const search = useWorktreeNavigator();
  const open = listDrawerShown(drawer, search.query);
  const [searchBarRef] = useState(() => ({
    current: null as SearchBarCommands | null,
  }));
  const close = () => {
    if (!portrait) return;
    searchBarRef.current?.cancelSearch();
    search.setQuery('');
    send('close');
  };
  const [searchFocusChange] = useState(
    () => (focused: boolean) => send(focused ? 'searchFocus' : 'searchBlur'),
  );
  const [seenPortrait, setSeenPortrait] = useState(portrait);
  if (seenPortrait !== portrait) {
    setSeenPortrait(portrait);
    setDrawer(listDrawer(drawer, 'rotate'));
  }
  const listShown = portrait ? open : !hidden;
  return (
    <>
      <Stack.Screen options={{ headerLargeTitleEnabled: !beside }} />
      <SettingsToolbar>
        {beside ? (
          <Stack.Toolbar.Button
            icon={headerIcon(listShown ? 'hideList' : 'showList')}
            accessibilityLabel={listShown ? 'Hide worktrees' : 'Show worktrees'}
            onPress={() => {
              if (!portrait) return setHidden(!hidden);
              return open ? close() : send('show');
            }}
          />
        ) : null}
      </SettingsToolbar>
      <ListDetail
        layout={layout}
        listHidden={beside && hidden}
        overlay={selected ? { open, onDismiss: close } : undefined}
        list={(mode, presentation) => (
          <WorktreesScreen
            mode={mode}
            presentation={presentation}
            onOpen={close}
            onSearchFocusChange={searchFocusChange}
            searchBarRef={searchBarRef}
          />
        )}
        detail={
          selected ? (
            <WorktreeDetail
              key={`${selected.environment}/${selected.projectId}/${selected.worktreeId}`}
              details={selected}
              mode="beside"
              content={WorktreeSectionView}
              guide={WalkthroughGuide}
              onDestination={close}
            />
          ) : (
            <Empty
              title="Select a worktree"
              description="Choose a worktree on the left to see its changes, files and history."
            />
          )
        }
      />
    </>
  );
}
