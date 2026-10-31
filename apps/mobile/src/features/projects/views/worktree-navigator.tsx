import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useEnvironments, useEnvironmentStorageStatus } from '../../access';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
} from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  navigatorEntryLabel,
  navigatorChecksLabel,
  type NavigatorEntry,
  type NavigatorFilterSection,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { IconButton } from '../../../components/ui/icon-button';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Input } from '../../../components/ui/input';
import { Item } from '../../../components/ui/item';
import { Badge } from '../../../components/ui/badge';
import { NavigatorFilter, NavigatorScopePicker } from './navigator-filter';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenComputers } from './open-computers';
import { worktreeRow } from '../rules/worktree-row';
import { retainedReviewRoute } from '../rules/retained-review-route';
import { requestDocumentLeave, useWorktreeNavigator } from '../store';
import { useOpenPullRequest } from './open-pull-request';
import { useCopyPath } from '../commands/clipboard';
import { ProjectActions } from './project-actions';
import {
  WorktreeActionSheet,
  type WorktreeActionRequest,
} from './worktree-action-sheet';

const pullCheckTones = {
  passed: 'add',
  running: 'muted',
  failed: 'del',
  none: 'muted',
} as const;

export function WorktreeNavigator({
  onSelect,
  nativeHeader = false,
  openReview,
}: {
  onSelect?: () => void;
  nativeHeader?: boolean;
  openReview?: { reviewId: string; environmentId: string } | undefined;
}) {
  const { picker, initializing, reading } = useWorkspacePickerModel(onSelect);
  const remotes = useAtomRef(remoteConnectionState);
  const connections = remotes.map((entry) => entry.connection);
  const { loading, messages, projects, filters } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  const clipboard = useCopyPath();
  const [action, setAction] = useState<WorktreeActionRequest>();
  const { query, setQuery, filter, setFilter, setExpanded } =
    useWorktreeNavigator();
  const router = useRouter();
  const [group] = useSegments();
  const openPullRequest = useOpenPullRequest();
  const openComputers = useOpenComputers();
  const paired = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const selectedProject = picker.choices.find((choice) =>
    choice.worktrees.some((row) => row.selected),
  );
  const selectedWorktree = selectedProject?.worktrees.find(
    (row) => row.selected,
  );
  const selectedCheckout:
    | Parameters<typeof navigatorEntrySelected>[1]
    | undefined =
    selectedProject && selectedWorktree
      ? {
          kind: 'worktree',
          environmentId: selectedProject.environmentId,
          worktreeId: selectedWorktree.worktree.id,
        }
      : undefined;
  const selection: Parameters<typeof navigatorEntrySelected>[1] | undefined =
    openReview ? { kind: 'review', ...openReview } : selectedCheckout;
  const openAction = (
    kind: WorktreeActionRequest['kind'],
    entry: NavigatorEntry,
    connection: WorktreeActionRequest['connection'] | undefined,
  ) => {
    const worktreeId = entry.worktreeId;
    if (!worktreeId || !connection) return;
    setAction({ kind, entry, connection, worktreeId, requestId: randomUUID() });
  };
  const open = (entry: NavigatorEntry) => {
    if (entry.kind === 'worktree' && entry.available && entry.worktreeId) {
      picker.onWorktree(entry.environmentId, entry.projectId, entry.worktreeId);
    } else if (entry.review.state === 'available') {
      const remote = remotes.find(
        (candidate) => candidate.remote.environmentId === entry.environmentId,
      );
      if (!remote) return;
      requestDocumentLeave(() =>
        router.push({
          pathname: retainedReviewRoute(nativeHeader ? group : undefined),
          params: {
            reviewId:
              entry.review.state === 'available' ? entry.review.reviewId : '',
            environment: entry.environmentId,
            host: new URL(remote.remote.address).host,
          },
        }),
      );
    }
  };
  if (storage.status === 'ready' && paired.length === 0)
    return (
      <Box className="flex-1" testID="worktree-navigator">
        <Box paddingX={4} paddingY={3} gap={2}>
          <Text variant="subheading">No computers paired</Text>
          <Text variant="caption" tone="muted">
            Pair a computer to see its worktrees and reviews here.
          </Text>
          <Box className="items-start">
            <Button
              label="Add computer"
              variant="outline"
              onPress={openComputers}
            />
          </Box>
        </Box>
      </Box>
    );
  return (
    <Box className="flex-1" testID="worktree-navigator">
      <Box paddingX={4} paddingY={3} gap={2}>
        <Box className="flex-row items-center" gap={1}>
          <Box className="min-w-0 flex-1">
            <Input
              leading={<Icon name="search" tone="muted" />}
              accessibilityLabel="Search reviews and worktrees"
              placeholder="Search"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              value={query}
              onChangeText={setQuery}
            />
          </Box>
          <NavigatorFilter
            sections={filters.filter((section) => section.key === 'reviews')}
            filter={filter}
            onChange={setFilter}
          />
        </Box>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerClassName="items-center gap-2"
          keyboardShouldPersistTaps="handled"
        >
          {filters
            .filter((section) => section.key !== 'reviews')
            .map((section) => (
              <NavigatorScopePicker
                key={section.key}
                section={section}
                label={scopeLabel(section)}
                onChange={(next) =>
                  setFilter({ ...filter, [section.key]: next })
                }
              />
            ))}
        </ScrollView>
        {query ? (
          <Button
            label="Clear search"
            variant="ghost"
            onPress={() => setQuery('')}
          />
        ) : null}
      </Box>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Worktrees by project"
        contentContainerClassName={
          nativeHeader ? 'gap-2.5 px-4 pb-6' : 'gap-2 px-2 pb-6'
        }
      >
        {initializing || loading ? (
          <Loading label="Reading worktrees…" />
        ) : null}
        {projects.map((project) => {
          const connection = remotes.find(
            (remote) =>
              remote.remote.environmentId === project.connection.environmentId,
          )?.connection;
          return (
            <Box key={project.key} gap={2}>
              <Box className="flex-row items-center" gap={1}>
                <Text
                  variant="navigatorCaption"
                  weight="medium"
                  numberOfLines={1}
                  className="min-w-0 flex-1"
                  accessibilityLabel={`${project.project.name}, ${project.environmentName}`}
                >
                  {project.project.name}
                </Text>
                {connections.length > 1 && (
                  <Box className="min-w-0 max-w-20 shrink">
                    <Badge
                      label={project.environmentName}
                      labelNumberOfLines={1}
                      variant="secondary"
                      accessibilityLabel={`Computer: ${project.environmentName}`}
                    />
                  </Box>
                )}
                <ProjectActions
                  connection={project.connection}
                  project={project.project}
                  environmentName={project.environmentName}
                  onCopy={clipboard.copy}
                />
                <IconButton
                  icon={project.expanded ? 'down' : 'chevron'}
                  size="sm"
                  expanded={project.expanded}
                  accessibilityLabel={`${project.expanded ? 'Collapse' : 'Expand'} ${project.project.name} · ${project.environmentName}`}
                  onPress={() => setExpanded(project.key, !project.expanded)}
                />
              </Box>
              {project.expanded
                ? project.entries.map((entry) => {
                    const selected = navigatorEntrySelected(entry, selection);
                    const row = worktreeRow(entry);
                    const review =
                      entry.review.state === 'available'
                        ? entry.review
                        : undefined;
                    const number = review?.pullRequestNumber;
                    const checks = review?.checks;
                    const checkResult =
                      checks?.state === 'available' ? checks.result : 'none';
                    return (
                      <Box key={entry.key} gap={1}>
                        <Item
                          title={row.title}
                          {...(entry.detached ? { detail: 'Detached' } : {})}
                          titleNumberOfLines={1}
                          titleTrailing={
                            number !== undefined ? (
                              <Box className="h-11" accessible={false} />
                            ) : undefined
                          }
                          size="xs"
                          leading={
                            <Icon
                              name={
                                entry.kind === 'review' ? 'review' : 'folder'
                              }
                              tone="muted"
                            />
                          }
                          trailing={
                            entry.review.state === 'loading' ||
                            (entry.kind === 'worktree' &&
                              entry.changes.state === 'loading') ? (
                              <ActivityIndicator
                                accessible={false}
                                size="small"
                                colorClassName="accent-muted-foreground"
                              />
                            ) : undefined
                          }
                          action={
                            review && number !== undefined ? (
                              <ButtonSurface
                                variant="ghost"
                                size="sm"
                                className="self-start"
                                disabled={picker.disabled}
                                accessibilityLabel={`Open pull request #${number}, ${entry.projectName}, ${entry.environmentName}, ${navigatorChecksLabel(checks)}`}
                                onPress={() =>
                                  openPullRequest({
                                    kind: 'pull-request',
                                    environmentId: entry.environmentId,
                                    reviewId: review.reviewId,
                                    number,
                                    projectId: entry.projectId,
                                  })
                                }
                              >
                                <Text
                                  accessible={false}
                                  variant="caption"
                                  tone={pullCheckTones[checkResult]}
                                >
                                  PR #{number}
                                  {checkResult === 'running'
                                    ? ' · Running'
                                    : ''}
                                </Text>
                              </ButtonSurface>
                            ) : undefined
                          }
                          selected={selected}
                          disabled={
                            picker.disabled ||
                            (entry.kind === 'worktree' &&
                              !entry.available &&
                              !review)
                          }
                          accessibilityLabel={`${navigatorEntryLabel(entry)}${row.diff ? `, Local uncommitted changes: ${row.changes}` : ''}${selected ? ', current' : ''}`}
                          onPress={() => open(entry)}
                          {...(entry.kind === 'worktree' &&
                          entry.worktreeId &&
                          connection
                            ? {
                                onLongPress: () =>
                                  openAction('menu', entry, connection),
                              }
                            : {})}
                        >
                          {row.review || row.changes ? (
                            <Box
                              className="flex-row items-center justify-between"
                              gap={2}
                            >
                              {row.review ? (
                                <Text
                                  variant="caption"
                                  tone="muted"
                                  numberOfLines={1}
                                  className="min-w-0 flex-1"
                                >
                                  {row.review}
                                </Text>
                              ) : null}
                              {row.changes &&
                                (row.diff ? (
                                  <Box
                                    className="ml-auto flex-row items-center"
                                    gap={1}
                                  >
                                    <Text variant="caption" tone="add">
                                      +{row.diff.additions}
                                    </Text>
                                    <Text variant="caption" tone="del">
                                      −{row.diff.deletions}
                                    </Text>
                                    {row.diff.binaryFiles > 0 && (
                                      <Text variant="caption" tone="muted">
                                        {row.diff.binaryFiles} binary
                                      </Text>
                                    )}
                                  </Box>
                                ) : (
                                  <Text
                                    variant="caption"
                                    tone="muted"
                                    className="ml-auto"
                                  >
                                    {row.changes}
                                  </Text>
                                ))}
                            </Box>
                          ) : null}
                        </Item>
                      </Box>
                    );
                  })
                : null}
            </Box>
          );
        })}
        {!initializing &&
        !loading &&
        messages.length === 0 &&
        projects.length === 0 ? (
          <Empty
            title="No matching worktrees"
            description="Try another search or clear the filters."
          />
        ) : null}
        {[...new Set([...picker.messages, ...messages])].map((message) => (
          <Text key={message} variant="caption" tone="muted">
            {message}
          </Text>
        ))}
        {picker.error ? (
          <ErrorState
            message={picker.error}
            retry={{
              label: 'Read again',
              onPress: picker.onRead,
              pending: reading,
            }}
          />
        ) : null}
        {picker.canReadInventory || messages.length > 0 ? (
          <Button
            label="Read projects again"
            variant="outline"
            pending={reading || loading}
            onPress={() => retry(undefined)}
          />
        ) : null}
      </ScrollView>
      {AsyncResult.isFailure(clipboard.result) && (
        <ErrorState
          message={connectionErrorMessage(Cause.squash(clipboard.result.cause))}
        />
      )}
      <WorktreeActionSheet
        request={action}
        onClose={() => setAction(undefined)}
        onAction={(kind) =>
          setAction((current) =>
            current ? { ...current, kind, requestId: randomUUID() } : undefined,
          )
        }
      />
    </Box>
  );
}

function scopeLabel(section: NavigatorFilterSection) {
  const labels =
    section.key === 'environments'
      ? {
          none: 'No environments',
          all: 'All environments',
          one: 'environment',
          many: 'environments',
        }
      : {
          none: 'No projects',
          all: 'All projects',
          one: 'project',
          many: 'projects',
        };
  const checked = section.items.filter((option) => option.checked).length;
  if (checked === 0) return labels.none;
  if (checked === section.items.length) return labels.all;
  return `${checked} ${checked === 1 ? labels.one : labels.many}`;
}
