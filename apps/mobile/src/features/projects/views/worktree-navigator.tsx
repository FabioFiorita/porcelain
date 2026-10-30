import { useEnvironments, useEnvironmentStorageStatus } from '../../access';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import {
  readWorktreeNavigator,
  refreshWorktreeNavigator,
} from '@porcelain/client/projects';
import {
  emptyNavigatorFilter,
  navigatorEntrySelected,
  navigatorEntryLabel,
  type NavigatorEntry,
  type NavigatorFilterSection,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { headerIcon } from '../../../shared/icons/header-icon';
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
      {nativeHeader ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon={headerIcon('workspace')}
            accessibilityLabel="Filter worktrees"
            title="Filter worktrees"
          >
            {filters
              .filter((section) => section.key === 'reviews')
              .map((section) => (
                <Stack.Toolbar.Menu key={section.key} inline>
                  <Stack.Toolbar.MenuAction disabled>
                    {section.key === 'environments'
                      ? 'Computers'
                      : section.label}
                  </Stack.Toolbar.MenuAction>
                  {section.items.map((option) => (
                    <Stack.Toolbar.MenuAction
                      key={option.id}
                      isOn={option.checked}
                      onPress={() =>
                        setFilter({ ...filter, [section.key]: option.next })
                      }
                    >
                      {option.label}
                    </Stack.Toolbar.MenuAction>
                  ))}
                </Stack.Toolbar.Menu>
              ))}
            <Stack.Toolbar.MenuAction
              isOn={filter.older}
              onPress={() => setFilter({ ...filter, older: !filter.older })}
            >
              Show older reviews
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              onPress={() => setFilter(emptyNavigatorFilter)}
            >
              Clear filters
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
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
          {!nativeHeader ? (
            <NavigatorFilter
              sections={filters.filter((section) => section.key === 'reviews')}
              filter={filter}
              onChange={setFilter}
            />
          ) : null}
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
        {projects.map((project) => (
          <Box key={project.key} gap={1}>
            <Box className="flex-row items-center" gap={1}>
              <Box className="min-w-0 flex-1">
                <ButtonSurface
                  variant="ghost"
                  size={nativeHeader ? 'navigatorPhoneGroup' : 'navigatorGroup'}
                  expanded={project.expanded}
                  align="start"
                  accessibilityLabel={`${project.project.name}, ${project.environmentName}, ${project.expanded ? 'expanded' : 'collapsed'}`}
                  onPress={() => setExpanded(project.key, !project.expanded)}
                >
                  <Icon
                    name={project.expanded ? 'down' : 'chevron'}
                    size="small"
                    tone="muted"
                  />
                  <Text
                    variant="navigatorCaption"
                    weight="medium"
                    numberOfLines={1}
                    className="min-w-0 flex-1"
                  >
                    {project.project.name}
                  </Text>
                </ButtonSurface>
              </Box>
              <Box className="min-w-0 max-w-1/2 shrink">
                <Badge
                  label={project.environmentName}
                  labelNumberOfLines={1}
                  variant="outline"
                  accessibilityLabel={`Computer: ${project.environmentName}`}
                  onPress={() =>
                    Alert.alert('Computer', project.environmentName)
                  }
                />
              </Box>
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
                  return (
                    <Box key={entry.key} gap={1}>
                      <Item
                        title={row.title}
                        titleNumberOfLines={1}
                        description={row.subtitle}
                        descriptionNumberOfLines={1}
                        size="xs"
                        leading={
                          <Icon
                            name={entry.kind === 'review' ? 'review' : 'folder'}
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
                            <Button
                              label={`PR #${number}`}
                              size="sm"
                              variant="link"
                              disabled={picker.disabled}
                              accessibilityLabel={`Open pull request #${number}, ${entry.projectName}, ${entry.environmentName}`}
                              onPress={() =>
                                openPullRequest({
                                  kind: 'pull-request',
                                  environmentId: entry.environmentId,
                                  reviewId: review.reviewId,
                                  number,
                                  projectId: entry.projectId,
                                })
                              }
                            />
                          ) : undefined
                        }
                        selected={selected}
                        disabled={
                          picker.disabled ||
                          (entry.kind === 'worktree' &&
                            !entry.available &&
                            !review)
                        }
                        accessibilityLabel={`${navigatorEntryLabel(entry)}${selected ? ', current' : ''}`}
                        onPress={() => open(entry)}
                      >
                        <Text variant="caption" tone="muted">
                          {row.detail}
                        </Text>
                      </Item>
                    </Box>
                  );
                })
              : null}
          </Box>
        ))}
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
