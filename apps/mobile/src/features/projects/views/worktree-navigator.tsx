import { useState, type ComponentRef } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  connectionErrorMessage,
  type EnvironmentIcon,
} from '@porcelain/client/access/rules';
import {
  DemoControls,
  useEnvironments,
  useEnvironmentStorageStatus,
} from '../../access';
import { ScrollView, type TextInput } from 'react-native';
import { Input } from '../../../components/ui/input';
import { useScrollReveal } from '../../../components/ui/scroll-reveal';
import { useRouter } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import {
  readWorktreeNavigatorWithSnapshots,
  refreshWorktreeNavigator,
} from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  type NavigatorEntry,
  type NavigatorFilterSection,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import {
  mobileWorktreeLayout,
  startMobileNavigation,
} from '../../../shared/application/mobile-timing';
import { useListCursor } from '../../../shared/application/key-commands';
import { IconButton } from '../../../components/ui/icon-button';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon, type IconName } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { NavigatorScopePicker } from './navigator-filter';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenComputers } from './open-computers';
import { worktreeChecksLabel, worktreeRow } from '../rules/worktree-row';
import { useWorktreeNavigator } from '../store';
import { useOpenPullRequest } from './open-pull-request';
import { PickerNotices } from './picker-notices';
import { useCopyPath } from '../commands/clipboard';
import { ProjectActions } from './project-actions';
import { savedWorktrees } from '../queries/worktree-snapshot';

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
  const { loading, loadingWithoutSavedRows, projects, allProjects, filters } =
    useAtomValue(
      readWorktreeNavigatorWithSnapshots({
        connections,
        snapshots: savedWorktrees(remotes),
      }),
    );
  const retry = useAtomSet(refreshWorktreeNavigator(connections));
  const clipboard = useCopyPath();
  const router = useRouter();
  const { query, setQuery, filter, setFilter, setExpanded } =
    useWorktreeNavigator();
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
      startMobileNavigation('changes');
      picker.onWorktree(
        entry.environmentId,
        entry.projectId,
        entry.worktreeId,
        () => onOpenWorktree(entry),
      );
    }
  };
  const [searchInput] = useState(() => ({
    current: null as ComponentRef<typeof TextInput> | null,
  }));
  const visibleEntries = projects.flatMap((project) =>
    project.expanded && !project.saved
      ? project.entries.filter((entry) => entry.kind === 'worktree')
      : [],
  );
  const firstSaved = projects.find(
    (project) => project.saved && project.entries.length,
  )?.entries[0]?.key;
  const reveal = useScrollReveal();
  const cursor = useListCursor({
    rows: visibleEntries,
    selected: visibleEntries.find((entry) =>
      navigatorEntrySelected(entry, selection),
    )?.key,
    onOpen: (key) => {
      const entry = visibleEntries.find((candidate) => candidate.key === key);
      if (entry && !picker.disabled) open(entry);
    },
    onSearch: () => searchInput.current?.focus(),
  });
  if (storage.status === 'ready' && paired.length === 0)
    return (
      <ScrollView
        className="flex-1"
        testID="worktree-navigator"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box paddingX={4} paddingY={3} gap={2}>
          <Text variant="secondary" tone="muted">
            No computers paired
          </Text>
          <Box className="items-start">
            <Button
              label="Add computer"
              variant="tonal"
              onPress={openComputers}
            />
          </Box>
          <DemoControls />
        </Box>
      </ScrollView>
    );
  return (
    <Box className="flex-1" testID="worktree-navigator" collapsable={false}>
      <ScrollView
        {...reveal.scroller}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Worktrees by project"
        contentContainerClassName="gap-2.5 px-4 pb-6"
      >
        <Input
          ref={searchInput}
          accessibilityLabel="Search worktrees"
          placeholder="Search worktrees"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
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
        {loadingWithoutSavedRows ||
        (initializing && allProjects.length === 0) ? (
          <Spinner />
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
                {project.saved ? (
                  <IconButton
                    icon="more"
                    disabled
                    onPress={() => undefined}
                    accessibilityLabel={`Project actions: ${project.project.name} · ${project.environmentName}`}
                  />
                ) : (
                  <ProjectActions
                    connection={project.connection}
                    project={project.project}
                    environmentName={project.environmentName}
                    onCopy={clipboard.copy}
                  />
                )}
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
                      const row = worktreeRow(entry, project.saved);
                      const review =
                        entry.pullRequest.state === 'available'
                          ? entry.pullRequest
                          : undefined;
                      const number = review?.number;
                      const checks = review?.checks;
                      const failed =
                        checks?.state === 'available' &&
                        checks.result === 'failed';
                      const first = project.saved
                        ? firstSaved
                        : visibleEntries[0]?.key;
                      const timing =
                        entry.key === first
                          ? mobileWorktreeLayout(project.saved === true)
                          : undefined;
                      return (
                        <Box
                          key={
                            timing ? `${entry.key}/${timing.name}` : entry.key
                          }
                          gap={1}
                          collapsable={false}
                          onLayout={timing?.onLayout}
                          {...(cursor.highlighted === entry.key
                            ? { ref: reveal.row }
                            : {})}
                        >
                          <Item
                            title={row.title}
                            {...(entry.detached ? { detail: 'Detached' } : {})}
                            titleNumberOfLines={1}
                            size="compact"
                            leading={
                              <Icon name={worktreeIcon(entry)} tone="muted" />
                            }
                            trailing={
                              failed ? (
                                <Icon name="warning" tone="destructive" />
                              ) : undefined
                            }
                            action={
                              review && number !== undefined ? (
                                <ButtonSurface
                                  variant="plain"
                                  size="sm"
                                  className="self-end"
                                  disabled={picker.disabled}
                                  accessibilityLabel={[
                                    `Open pull request #${number}`,
                                    entry.projectName,
                                    entry.environmentName,
                                    worktreeChecksLabel(checks),
                                  ]
                                    .filter(Boolean)
                                    .join(', ')}
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
                            highlighted={cursor.highlighted === entry.key}
                            selectionTone="neutral"
                            disabled={picker.disabled || !entry.available}
                            accessibilityLabel={[
                              row.accessibilityLabel,
                              number ? worktreeChecksLabel(checks) : undefined,
                              selected ? 'current' : undefined,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                            onPress={() => {
                              cursor.claim();
                              open(entry);
                            }}
                            {...(!project.saved &&
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
        picker.messages.length === 0 &&
        projects.length === 0 ? (
          <Empty title="No matching worktrees" />
        ) : null}
        <PickerNotices
          messages={picker.messages}
          error={picker.error}
          onRead={picker.onRead}
          reading={reading}
        />
        {picker.canReadInventory ? (
          <Button
            label="Read projects again"
            variant="tonal"
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
