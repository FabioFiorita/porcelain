import { useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  connectionErrorMessage,
  type EnvironmentIcon,
} from '@porcelain/client/access/rules';
import { useEnvironments, useEnvironmentStorageStatus } from '../../access';
import { ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
  worktreeStatusNotices,
} from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  navigatorChecksLabel,
  type NavigatorEntry,
  type NavigatorFilterSection,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { IconButton } from '../../../components/ui/icon-button';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon, type IconName } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { NavigatorScopePicker } from './navigator-filter';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenComputers } from './open-computers';
import { worktreeRow } from '../rules/worktree-row';
import { useWorktreeNavigator } from '../store';
import { useOpenPullRequest } from './open-pull-request';
import { PickerNotices } from './picker-notices';
import { useCopyPath } from '../commands/clipboard';
import { ProjectActions } from './project-actions';

const environmentGlyphs: Record<EnvironmentIcon, IconName> = {
  desktop: 'environments',
  laptop: 'laptop',
  server: 'server',
  cloud: 'cloud',
};

function worktreeIcon(entry: NavigatorEntry): IconName {
  return entry.main ? 'home' : 'branch';
}

export function WorktreeNavigator({
  onOpenWorktree,
}: {
  onOpenWorktree: (entry: NavigatorEntry) => void;
}) {
  const { picker, checkout, initializing, reading } = useWorkspacePickerModel();
  const remotes = useAtomRef(remoteConnectionState);
  const connections = remotes.map((entry) => entry.connection);
  const { loading, messages, projects, filters } = useAtomValue(
    readWorktreeNavigator(connections),
  );
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  const retryResult = useAtomValue(refreshWorktreeNavigator(connections));
  const notices = useAtomValue(worktreeStatusNotices);
  const setNotices = useAtomSet(worktreeStatusNotices);
  const [details, setDetails] = useState(false);
  const clipboard = useCopyPath();
  const router = useRouter();
  const { setQuery, filter, setFilter, setExpanded } = useWorktreeNavigator();
  const openPullRequest = useOpenPullRequest();
  const openComputers = useOpenComputers();
  const paired = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const selection = checkout;
  const openActions = (entry: NavigatorEntry) => {
    if (entry.worktreeId)
      router.navigate({
        pathname: '/worktree-actions',
        params: {
          environmentId: entry.environmentId,
          worktreeId: entry.worktreeId,
          kind: 'menu',
        },
      });
  };
  const open = (entry: NavigatorEntry) => {
    if (entry.kind === 'worktree' && entry.available && entry.worktreeId) {
      picker.onWorktree(
        entry.environmentId,
        entry.projectId,
        entry.worktreeId,
        () => onOpenWorktree(entry),
      );
    }
  };
  if (storage.status === 'ready' && paired.length === 0)
    return (
      <Box className="flex-1" testID="worktree-navigator">
        <Box paddingX={4} paddingY={3} gap={2}>
          <Text variant="headline">No computers paired</Text>
          <Text variant="caption" tone="muted">
            Pair a computer to see its worktrees here.
          </Text>
          <Box className="items-start">
            <Button
              label="Add computer"
              variant="tonal"
              onPress={openComputers}
            />
          </Box>
        </Box>
      </Box>
    );
  return (
    <Box className="flex-1" testID="worktree-navigator" collapsable={false}>
      <Stack.SearchBar
        placeholder="Search worktrees"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Worktrees by project"
        contentContainerClassName="gap-2.5 px-4 pb-6"
      >
        <Box className="flex-row items-center" gap={2}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="items-center gap-2"
            keyboardShouldPersistTaps="handled"
          >
            {filters.map((section) => (
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
        </Box>
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
                <Box className="min-w-0 flex-1" gap={0.5}>
                  <Text
                    variant="secondary"
                    weight="semibold"
                    numberOfLines={1}
                    accessibilityLabel={`${project.project.name}, ${project.environmentName}`}
                  >
                    {project.project.name}
                  </Text>
                  {connections.length > 1 && (
                    <Box
                      className="min-w-0 flex-row items-center"
                      gap={1}
                      accessible
                      accessibilityLabel={`Computer: ${project.environmentName}`}
                    >
                      <Icon
                        name={environmentGlyphs[project.environmentIcon]}
                        tone="muted"
                        size="caption"
                      />
                      <Text
                        variant="caption"
                        tone="muted"
                        numberOfLines={1}
                        className="min-w-0 flex-1"
                      >
                        {project.environmentName}
                      </Text>
                    </Box>
                  )}
                </Box>
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
                ? project.entries
                    .filter((entry) => entry.kind === 'worktree')
                    .map((entry) => {
                      const selected = navigatorEntrySelected(entry, selection);
                      const row = worktreeRow(entry);
                      const review =
                        entry.pullRequest.state === 'available'
                          ? entry.pullRequest
                          : undefined;
                      const number = review?.number;
                      const checks = review?.checks;
                      const failed =
                        checks?.state === 'available' &&
                        checks.result === 'failed';
                      const pending =
                        entry.pullRequest.state === 'loading' ||
                        (entry.kind === 'worktree' &&
                          entry.changes.state === 'loading');
                      return (
                        <Box key={entry.key} gap={1}>
                          <Item
                            title={row.title}
                            {...(entry.detached ? { detail: 'Detached' } : {})}
                            titleNumberOfLines={1}
                            size="compact"
                            leading={
                              <Icon name={worktreeIcon(entry)} tone="muted" />
                            }
                            trailing={
                              failed || pending ? (
                                <Box className="flex-row items-center" gap={2}>
                                  {failed ? (
                                    <Icon name="warning" tone="destructive" />
                                  ) : null}
                                  {pending ? (
                                    <ActivityIndicator
                                      accessible={false}
                                      size="small"
                                      colorClassName="accent-muted-foreground"
                                    />
                                  ) : null}
                                </Box>
                              ) : undefined
                            }
                            action={
                              review && number !== undefined ? (
                                <ButtonSurface
                                  variant="plain"
                                  size="sm"
                                  className="self-end"
                                  disabled={picker.disabled}
                                  accessibilityLabel={`Open pull request #${number}, ${entry.projectName}, ${entry.environmentName}, ${navigatorChecksLabel(checks)}`}
                                  onPress={() =>
                                    openPullRequest({
                                      environmentId: entry.environmentId,
                                      number,
                                      projectId: entry.projectId,
                                    })
                                  }
                                >
                                  <Text
                                    accessible={false}
                                    variant="caption"
                                    tone="muted"
                                  >
                                    #{number}
                                  </Text>
                                </ButtonSurface>
                              ) : undefined
                            }
                            selected={selected}
                            selectionTone="neutral"
                            disabled={picker.disabled || !entry.available}
                            accessibilityLabel={[
                              row.accessibilityLabel,
                              number ? navigatorChecksLabel(checks) : undefined,
                              selected ? 'current' : undefined,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                            onPress={() => open(entry)}
                            {...(entry.kind === 'worktree' &&
                            entry.worktreeId &&
                            connection
                              ? {
                                  onLongPress: () => openActions(entry),
                                }
                              : {})}
                          >
                            {row.branch ? (
                              <Text
                                variant="mono"
                                tone="muted"
                                numberOfLines={1}
                              >
                                {row.branch}
                              </Text>
                            ) : null}
                            {row.changes ? (
                              <Text variant="caption" tone="muted">
                                {row.changes}
                              </Text>
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
        <PickerNotices
          messages={[...new Set([...picker.messages, ...messages])]}
          error={picker.error}
          onRead={picker.onRead}
          reading={reading}
        />
        {picker.canReadInventory || messages.length > 0 ? (
          <Button
            label="Read projects again"
            variant="tonal"
            pending={reading || loading}
            onPress={() => retry(undefined)}
          />
        ) : null}
      </ScrollView>
      {notices
        .filter(
          (issue) =>
            !issue.dismissed &&
            connections.some(
              (connection) => connection.environmentId === issue.environmentId,
            ),
        )
        .slice(0, 1)
        .map((issue) => (
          <Box
            key={issue.environmentId}
            className="absolute inset-x-4 bottom-4"
          >
            <Card padding={4} gap={2}>
              <Box className="flex-row items-center" gap={2}>
                <Box className="flex-1">
                  <Text
                    variant="caption"
                    weight="medium"
                    accessibilityLiveRegion="polite"
                  >
                    Couldn’t check changes on {issue.environmentName}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {issue.failures.length}{' '}
                    {issue.failures.length === 1 ? 'worktree' : 'worktrees'}
                  </Text>
                </Box>
                <IconButton
                  icon="close"
                  size="sm"
                  accessibilityLabel="Dismiss changes notice"
                  onPress={() =>
                    setNotices((current) =>
                      current.map((notice) =>
                        notice.environmentId === issue.environmentId
                          ? { ...notice, dismissed: true }
                          : notice,
                      ),
                    )
                  }
                />
              </Box>
              <Box className="flex-row" gap={2}>
                <Button
                  label="Retry"
                  variant="tonal"
                  pending={retryResult.waiting}
                  onPress={() => retry({ environmentId: issue.environmentId })}
                />
                <Button
                  label={details ? 'Hide details' : 'Details'}
                  variant="plain"
                  onPress={() => setDetails((current) => !current)}
                />
              </Box>
              {details && (
                <ScrollView className="max-h-48">
                  {issue.failures.map(({ entry, detail }) => (
                    <Box key={entry.key} gap={1}>
                      <Text variant="caption">{entry.name}</Text>
                      {detail && (
                        <Text variant="caption" tone="muted">
                          {detail}
                        </Text>
                      )}
                    </Box>
                  ))}
                </ScrollView>
              )}
            </Card>
          </Box>
        ))}
      {AsyncResult.isFailure(clipboard.result) && (
        <ErrorState
          message={connectionErrorMessage(Cause.squash(clipboard.result.cause))}
        />
      )}
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
