import { useAtom, useAtomRef, useAtomSet } from '@effect/atom-react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  useLayoutMove,
  useListDetailLayout,
} from '../../../components/ui/list-detail';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { HeaderTitle } from '../../../components/ui/header-title';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import { remoteConnectionState } from '../../../shared/application/store';
import { useScreenKeyCommands } from '../../../shared/application/key-commands';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { workspaceKey, type Workspace } from '../commands/workspace-connection';
import {
  openingWorktreeSection,
  shownWorktreeSection,
  worktreeSections,
  type WorktreeGuide,
  type WorktreeSection,
} from '../rules/worktree-section';
import {
  useWorktreeSwitcher,
  type WorktreeSwitcher,
} from './worktree-switcher';
import {
  worktreeListHidden,
  worktreeSection,
  type WorktreeDetails,
} from '../store';
import { useOpenPullRequest } from './open-pull-request';
import { PickerNotices } from './picker-notices';
import { WorkspaceGate } from './workspace-gate';
import { DemoNotice } from '../../access';
import { useWorkspacePickerModel } from './workspace-picker-model';

export type WorktreeSectionContent = ComponentType<{
  section: WorktreeSection | undefined;
  mode: ListDetailMode;
  switcher: WorktreeSwitcher;
}>;

export type WorktreeGuideReader = ComponentType<{
  workspace: Workspace;
  children: (guide: WorktreeGuide) => ReactNode;
}>;

type WorktreeParams = Partial<WorktreeDetails>;

export function WorktreeScreen({
  content,
  guide,
}: {
  content: WorktreeSectionContent;
  guide: WorktreeGuideReader;
}) {
  const params = useLocalSearchParams<WorktreeParams>();
  const title = params.title ?? 'Worktree';
  const router = useRouter();
  const hideWorktrees = useAtomSet(worktreeListHidden);
  const layout = useListDetailLayout();
  useLayoutMove({
    place: 'pushed',
    mode: layout.measured,
    onMove: () => {
      hideWorktrees(true);
      router.dismissTo('/worktrees');
    },
  });
  return (
    <View className="flex-1" collapsable={false} onLayout={layout.onLayout}>
      <Stack.Screen options={{ title }} />
      <WorktreeTitle title={title} subtitle={worktreePlace(params)} />
      <WorktreeDetail
        details={params}
        mode="stack"
        content={content}
        guide={guide}
      />
    </View>
  );
}

export function WorktreeDetail({
  details,
  mode,
  content,
  guide: Guide,
  onDestination,
}: {
  details: WorktreeParams;
  mode: ListDetailMode;
  content: WorktreeSectionContent;
  guide: WorktreeGuideReader;
  onDestination?: (() => void) | undefined;
}) {
  const { picker, reading } = useWorkspacePickerModel();
  const remotes = useAtomRef(remoteConnectionState);
  const remote = remotes.find(
    (entry) => entry.remote.environmentId === details.environment,
  )?.remote;
  const target =
    details.environment && details.projectId && details.worktreeId
      ? {
          environmentId: details.environment,
          projectId: details.projectId,
          worktreeId: details.worktreeId,
        }
      : undefined;
  return (
    <WorkspaceGate
      title="Worktree"
      frame="pane"
      expectedWorkspace={
        remote && target ? workspaceKey(remote, target) : undefined
      }
      changed={
        <Box className="flex-1" padding={4} gap={3}>
          <Empty
            title="Another worktree is selected"
            description={`Select ${details.title ?? 'this worktree'} again to read it here.`}
            action={
              target
                ? {
                    label: 'Select this worktree',
                    onPress: () =>
                      picker.onWorktree(
                        target.environmentId,
                        target.projectId,
                        target.worktreeId,
                        () => undefined,
                      ),
                  }
                : undefined
            }
          />
          <PickerNotices
            messages={[]}
            error={picker.error}
            onRead={picker.onRead}
            reading={reading}
          />
        </Box>
      }
    >
      {(workspace) =>
        target && !remote ? (
          <Box className="flex-1" padding={4}>
            <Empty
              title="Computer no longer paired"
              description={`Pair ${details.computer ?? 'this computer'} again in Settings to read ${details.title ?? 'this worktree'}.`}
            />
          </Box>
        ) : (
          <Guide key={workspace.key} workspace={workspace}>
            {(guide) => (
              <Box className="flex-1">
                <DemoNotice environmentId={details.environment} />
                <WorktreeSections
                  workspace={workspace.key}
                  details={details}
                  mode={mode}
                  content={content}
                  guide={guide}
                  onDestination={onDestination}
                />
              </Box>
            )}
          </Guide>
        )
      }
    </WorkspaceGate>
  );
}

function WorktreeSections({
  workspace,
  details,
  mode,
  content: Content,
  guide,
  onDestination,
}: {
  workspace: string;
  details: WorktreeParams;
  mode: ListDetailMode;
  content: WorktreeSectionContent;
  guide: WorktreeGuide;
  onDestination?: (() => void) | undefined;
}) {
  const [opening, setOpening] = useState<WorktreeSection>();
  const [chosen, setChosen] = useAtom(worktreeSection(workspace));
  const choose = (next: WorktreeSection) => {
    setChosen(next);
    onDestination?.();
  };
  const answered = openingWorktreeSection(guide);
  if (opening === undefined && answered !== undefined) setOpening(answered);
  const section =
    opening === undefined ? chosen : shownWorktreeSection({ chosen, opening });
  const switcher = useWorktreeSwitcher(section, choose, mode);
  const openPullRequest = useOpenPullRequest();
  const number = Number(details.number);
  const pullRequest =
    details.environment &&
    details.projectId &&
    Number.isInteger(number) &&
    number > 0
      ? {
          environmentId: details.environment,
          projectId: details.projectId,
          number,
        }
      : undefined;
  useScreenKeyCommands(
    'worktree-sections',
    worktreeSections.map((entry) => ({
      binding: entry.id,
      run: () => choose(entry.id),
    })),
  );
  return (
    <Screen layout="fixed" testID="worktree-screen">
      {mode === 'beside' ? (
        <Box paddingX={4} paddingY={2} surface="background" divider="bottom">
          <Text variant="headline" accessibilityRole="header" numberOfLines={1}>
            {details.title ?? 'Worktree'}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {worktreePlace(details)}
          </Text>
        </Box>
      ) : null}
      {section === 'changes' && pullRequest ? (
        <Box divider="bottom">
          <Item
            testID="worktree-pull-request"
            title={`Pull request #${pullRequest.number}`}
            leading={<Icon name="review" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            onPress={() => openPullRequest(pullRequest)}
          />
        </Box>
      ) : null}
      <Box className="flex-1" collapsable={false}>
        <Content section={section} mode={mode} switcher={switcher} />
      </Box>
    </Screen>
  );
}

const phoneBarButtons = 2;

function WorktreeTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Stack.Title asChild>
      <HeaderTitle
        title={title}
        subtitle={subtitle}
        trailingItems={phoneBarButtons}
      />
    </Stack.Title>
  );
}

function worktreePlace(details: WorktreeParams) {
  return [details.project, details.computer].filter(Boolean).join(' · ');
}
