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
  worktreeListHidden,
  worktreeSection,
} from '../features/projects';
import { WalkthroughGuide } from '../features/walkthroughs';
import { headerIcon } from '../shared/icons/header-icon';

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
  const [open, setOpen] = useState(false);
  const [close] = useState(() => () => setOpen(false));
  const [seenPortrait, setSeenPortrait] = useState(portrait);
  if (seenPortrait !== portrait) {
    setSeenPortrait(portrait);
    setOpen(false);
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
            onPress={() => (portrait ? setOpen(!open) : setHidden(!hidden))}
          />
        ) : null}
      </SettingsToolbar>
      <ListDetail
        layout={layout}
        listHidden={beside && hidden}
        overlay={selected ? { open, onDismiss: close } : undefined}
        list={(mode) => <WorktreesScreen mode={mode} onOpen={close} />}
        detail={
          selected ? (
            <WorktreeDetail
              key={`${selected.environment}/${selected.projectId}/${selected.worktreeId}`}
              details={selected}
              mode="beside"
              content={WorktreeSectionView}
              guide={WalkthroughGuide}
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
