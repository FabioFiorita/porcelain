import type { RuntimeConnection } from '@porcelain/client/transport';
import type { Project } from '@porcelain/client/projects/rules';
import {
  UpdatesButton,
  UpdatesSheet,
  useEnvironments,
  useEnvironmentStorageStatus,
  useUpdatesIndicator,
} from '../../access';
import { ArchiveReview } from './archive-review';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import {
  emptyReviewListFilter,
  reviewListSections,
  reviewListIsSelected,
  type ReviewListSelection,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { headerIcon } from '../../../shared/icons/header-icon';
import { usePreferences } from '../../preferences/index';
import { ButtonSurface } from '../../../components/ui/button-surface';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';
import { NavigatorItem } from '../../../components/ui/navigator-item';
import { ReviewStatus } from '../../../components/ui/review-status';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { HeaderTitle } from '../../../components/ui/header-title';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenComputers } from './open-computers';
import { worktreeRow } from '../rules/worktree-row';
import { retainedReviewRoute } from '../rules/retained-review-route';
import { useWorktreeNavigator } from '../store';

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
  const { entries, loading, messages, projects } = useAtomValue(
    readReviewList(connections),
  );
  const retry = useAtomSet(refreshReviewList(connections));
  const { query, setQuery, filter, setFilter } = useWorktreeNavigator();
  const [updates, setUpdates] = useState(false);
  const updateIndicator = useUpdatesIndicator();
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const [group] = useSegments();
  const { preferences, setPreferences } = usePreferences();
  const openComputers = useOpenComputers();
  const paired = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const selectedProject = picker.choices.find((choice) =>
    choice.worktrees.some((row) => row.selected),
  );
  const selectedWorktree = selectedProject?.worktrees.find(
    (row) => row.selected,
  );
  const selectedCheckout: ReviewListSelection | undefined =
    selectedProject && selectedWorktree
      ? {
          kind: 'worktree',
          environmentId: selectedProject.environmentId,
          worktreeId: selectedWorktree.worktree.id,
        }
      : undefined;
  const selection: ReviewListSelection | undefined = openReview
    ? { kind: 'review', ...openReview }
    : selectedCheckout;
  const { rows, filters, groups } = reviewListSections(
    entries,
    query,
    filter,
    selection,
  );
  const open = (entry: ReviewListEntry) => {
    if (entry.worktreeId && !entry.closed) {
      picker.onWorktree(entry.environmentId, entry.projectId, entry.worktreeId);
    } else if (entry.reviewId) {
      const remote = remotes.find(
        (candidate) => candidate.remote.environmentId === entry.environmentId,
      );
      if (!remote) return;
      router.push({
        pathname: retainedReviewRoute(nativeHeader ? group : undefined),
        params: {
          reviewId: entry.reviewId,
          environment: entry.environmentId,
          host: new URL(remote.remote.address).host,
        },
      });
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
        <Stack.Title asChild>
          <Box className="flex-row items-center" gap={3}>
            <HeaderTitle>Worktrees</HeaderTitle>
            {updateIndicator.visible ? (
              <UpdatesButton
                running={updateIndicator.running}
                onPress={() => setUpdates(true)}
              />
            ) : null}
          </Box>
        </Stack.Title>
      ) : null}
      {nativeHeader ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon={headerIcon('workspace')}
            accessibilityLabel="Filter worktrees"
            title="Filter worktrees"
          >
            {filters.map((section) => (
              <Stack.Toolbar.Menu key={section.key} inline>
                <Stack.Toolbar.MenuAction disabled>
                  {section.key === 'environments' ? 'Computers' : section.label}
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
              onPress={() => setFilter(emptyReviewListFilter)}
            >
              Clear filters
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      {nativeHeader ? (
        <UpdatesSheet
          presented={updates}
          onClose={() => setUpdates(false)}
          onManageComputers={openComputers}
        />
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
            <>
              <IconButton
                icon="filter"
                accessibilityLabel="Filter worktrees"
                onPress={() => setShowFilters(!showFilters)}
              />
            </>
          ) : null}
        </Box>
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
        accessibilityLabel="Worktrees by review status"
        contentContainerClassName={
          nativeHeader ? 'gap-2.5 px-4 pb-6' : 'gap-2 px-2 pb-6'
        }
      >
        {showFilters ? (
          <Box gap={2}>
            {filters.map((section) => (
              <Box key={section.key} gap={2}>
                <Text variant="subheading">
                  {section.key === 'environments' ? 'Computers' : section.label}
                </Text>
                {section.items.map((option) => (
                  <Item
                    key={option.id}
                    title={option.label}
                    trailing={
                      option.checked ? <Icon name="check" /> : undefined
                    }
                    onPress={() =>
                      setFilter({ ...filter, [section.key]: option.next })
                    }
                  />
                ))}
              </Box>
            ))}
            <Button
              label="Clear filters"
              variant="ghost"
              onPress={() => setFilter(emptyReviewListFilter)}
            />
          </Box>
        ) : null}
        {initializing || loading ? (
          <Loading label="Reading worktrees…" />
        ) : null}
        {groups.map(({ group, rows: grouped }) => {
          if (grouped.length === 0 && group !== 'Closed') return null;
          const expanded =
            preferences.reviewListGroupOpen[group] ?? group !== 'Closed';
          return (
            <Box key={group}>
              <ButtonSurface
                variant="ghost"
                size={nativeHeader ? 'navigatorPhoneGroup' : 'navigatorGroup'}
                expanded={expanded}
                className="justify-start"
                accessibilityLabel={`${group} · ${grouped.length}, ${expanded ? 'expanded' : 'collapsed'}`}
                onPress={() =>
                  setPreferences({
                    reviewListGroupOpen: {
                      ...preferences.reviewListGroupOpen,
                      [group]: !expanded,
                    },
                  })
                }
              >
                <Icon
                  name={expanded ? 'down' : 'chevron'}
                  size={nativeHeader ? 'caption' : 'small'}
                  tone="muted"
                />
                <Text
                  variant="navigatorCaption"
                  tone="muted"
                  weight="medium"
                  className="flex-1"
                >
                  {group}
                </Text>
                <Text variant="navigatorCount" tone="muted" weight="medium">
                  {grouped.length}
                </Text>
              </ButtonSurface>
              {expanded &&
              group === 'Closed' &&
              grouped.length === 0 &&
              !loading ? (
                <Box paddingX={2} paddingY={3}>
                  <Text variant="ui" tone="muted">
                    No closed reviews
                  </Text>
                </Box>
              ) : null}
              {expanded ? (
                <Box gap={0.5}>
                  {grouped.map((entry) => {
                    const selected = reviewListIsSelected(entry, selection);
                    const row = worktreeRow(entry, selected);
                    const worktreeId = entry.worktreeId;
                    return (
                      <Box key={entry.key} gap={1}>
                        <NavigatorItem
                          title={row.title}
                          subtitle={
                            row.kind === 'review'
                              ? `${row.project} · ${row.branch}`
                              : row.location
                          }
                          detail={
                            row.kind === 'review' ? row.progress : row.project
                          }
                          progress={row.kind === 'review'}
                          leading={
                            <ReviewStatus
                              status={row.status}
                              phone={nativeHeader}
                            />
                          }
                          phone={nativeHeader}
                          selected={selected}
                          disabled={
                            picker.disabled || (!entry.closed && entry.disabled)
                          }
                          accessibilityLabel={row.accessibilityLabel}
                          action={
                            entry.closed && worktreeId ? (
                              <IconButton
                                icon="openFolder"
                                accessibilityLabel={`Open worktree: ${entry.branch}`}
                                disabled={picker.disabled || entry.disabled}
                                onPress={() =>
                                  picker.onWorktree(
                                    entry.environmentId,
                                    entry.projectId,
                                    worktreeId,
                                  )
                                }
                              />
                            ) : undefined
                          }
                          onPress={() => open(entry)}
                        />
                        {entry.archivable ? (
                          <Box
                            className="min-w-0 items-start"
                            gap={1}
                            paddingX={2}
                          >
                            <ArchiveAction entry={entry} projects={projects} />
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                </Box>
              ) : null}
            </Box>
          );
        })}
        {!initializing &&
        !loading &&
        messages.length === 0 &&
        rows.length === 0 ? (
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

function ArchiveAction({
  entry,
  projects,
}: {
  entry: ReviewListEntry;
  projects: readonly { connection: RuntimeConnection; project: Project }[];
}) {
  const source = projects.find(
    (row) =>
      row.connection.environmentId === entry.environmentId &&
      row.project.id === entry.projectId,
  );
  const main = source?.project.worktrees.find(
    (row) => row.main && row.available,
  );
  return entry.archivable && entry.reviewId && source && main ? (
    <ArchiveReview
      connection={source.connection}
      reviewId={entry.reviewId}
      projectId={entry.projectId}
      mainWorktreeId={main.id}
    />
  ) : null;
}
