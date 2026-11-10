import { useAtom, useAtomRef } from '@effect/atom-react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { HeaderTitle } from '../../../components/ui/header-title';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Screen } from '../../../components/ui/screen';
import { SegmentedControl } from '../../../components/ui/segmented-control';
import { Text } from '../../../components/ui/text';
import { remoteConnectionState } from '../../../shared/application/store';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { workspaceKey } from '../commands/workspace-connection';
import {
  worktreeSectionNamed,
  worktreeSections,
  type WorktreeSection,
} from '../rules/worktree-section';
import { worktreeSection, type WorktreeDetails } from '../store';
import { useOpenPullRequest } from './open-pull-request';
import { PickerNotices } from './picker-notices';
import { WorkspaceGate } from './workspace-gate';
import { useWorkspacePickerModel } from './workspace-picker-model';

export type WorktreeSectionContent = ComponentType<{
  section: WorktreeSection;
  mode: ListDetailMode;
}>;

type WorktreeParams = Partial<Omit<WorktreeDetails, 'opening'>> & {
  opening?: string | undefined;
};

export function WorktreeScreen({
  content,
}: {
  content: WorktreeSectionContent;
}) {
  const params = useLocalSearchParams<WorktreeParams>();
  const title = params.title ?? 'Worktree';
  return (
    <>
      <Stack.Screen options={{ title }} />
      <Stack.Title asChild>
        <HeaderTitle
          title={title}
          subtitle={worktreePlace(params)}
          trailingItems={1}
        />
      </Stack.Title>
      <WorktreeDetail details={params} mode="stack" content={content} />
    </>
  );
}

export function WorktreeDetail({
  details,
  mode,
  content,
}: {
  details: WorktreeParams;
  mode: ListDetailMode;
  content: WorktreeSectionContent;
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
          <WorktreeSections
            key={workspace.key}
            workspace={workspace.key}
            details={details}
            mode={mode}
            content={content}
          />
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
}: {
  workspace: string;
  details: WorktreeParams;
  mode: ListDetailMode;
  content: WorktreeSectionContent;
}) {
  const [opening] = useState(() => worktreeSectionNamed(details.opening));
  const [chosen, choose] = useAtom(worktreeSection(workspace));
  const section = chosen ?? opening;
  const openPullRequest = useOpenPullRequest();
  const number = Number(details.number);
  const pullRequest =
    details.reviewId &&
    details.environment &&
    details.projectId &&
    Number.isInteger(number) &&
    number > 0
      ? {
          environmentId: details.environment,
          projectId: details.projectId,
          reviewId: details.reviewId,
          number,
        }
      : undefined;
  const beside = mode === 'beside';
  return (
    <Screen layout="fixed" testID="worktree-screen">
      <Box
        className={beside ? 'flex-row flex-wrap items-center' : ''}
        paddingX={4}
        paddingY={2}
        gap={4}
      >
        {beside ? (
          <Box className="min-w-40 flex-1">
            <Text
              variant="headline"
              accessibilityRole="header"
              numberOfLines={1}
            >
              {details.title ?? 'Worktree'}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {worktreePlace(details)}
            </Text>
          </Box>
        ) : null}
        <Box className={beside ? 'w-80 max-w-full' : ''}>
          <SegmentedControl
            options={worktreeSections}
            selected={section}
            onSelect={choose}
          />
        </Box>
      </Box>
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
        <Content section={section} mode={mode} />
      </Box>
    </Screen>
  );
}

function worktreePlace(details: WorktreeParams) {
  return [details.project, details.computer].filter(Boolean).join(' · ');
}
