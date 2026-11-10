import { useAtom, useAtomValue } from '@effect/atom-react';
import { Stack, useRouter } from 'expo-router';
import { WorktreeSectionView } from './worktree-section-view';
import { Empty } from '../components/ui/empty';
import { ListDetail, useListDetailLayout } from '../components/ui/list-detail';
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
import { headerIcon } from '../shared/icons/header-icon';

export function WorktreesHome() {
  const selected = useSelectedWorktree();
  const workspace = useSelectedWorkspaceKey();
  const section = useAtomValue(worktreeSection(workspace ?? ''));
  const openedFile = useOpenedFile(workspace);
  const [hidden, setHidden] = useAtom(worktreeListHidden);
  const router = useRouter();
  const layout = useListDetailLayout((mode) => {
    if (mode !== 'stack' || !selected) return;
    router.push({ pathname: '/worktree', params: selected });
    if (workspace && section === 'files' && openedFile)
      router.push({
        pathname: '/file',
        params: { path: openedFile, workspace },
      });
  });
  const beside = layout.mode === 'beside' && selected !== undefined;
  return (
    <>
      <Stack.Screen options={{ headerLargeTitleEnabled: !beside }} />
      <SettingsToolbar>
        {beside ? (
          <Stack.Toolbar.Button
            icon={headerIcon(hidden ? 'showList' : 'hideList')}
            accessibilityLabel={hidden ? 'Show worktrees' : 'Hide worktrees'}
            onPress={() => setHidden(!hidden)}
          />
        ) : null}
      </SettingsToolbar>
      <ListDetail
        layout={layout}
        listHidden={beside && hidden}
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
    </>
  );
}
