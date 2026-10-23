import type { RuntimeConnection } from '@porcelain/client/transport';
import type { Project } from '@porcelain/client/projects/rules';
import { UpdatesButton, UpdatesSheet, useUpdatesIndicator } from '../../access';
import { ArchiveReview } from './archive-review';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import {
  emptyReviewListFilter,
  reviewListGroups,
  reviewListView,
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
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { HeaderTitle } from '../../../components/ui/header-title';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { worktreeRow } from '../rules/worktree-row';

export function WorktreeNavigator({
  onSelect,
  nativeHeader = false,
}: {
  onSelect?: () => void;
  nativeHeader?: boolean;
}) {
  const { picker, initializing, reading } = useWorkspacePickerModel(onSelect);
  const remotes = useAtomRef(remoteConnectionState);
  const connections = remotes.map((entry) => entry.connection);
  const { entries, loading, messages, projects } = useAtomValue(
    readReviewList(connections),
  );
  const retry = useAtomSet(refreshReviewList(connections));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(emptyReviewListFilter);
  const [updates, setUpdates] = useState(false);
  const updateIndicator = useUpdatesIndicator();
  const [closed, setClosed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const { preferences, setPreferences } = usePreferences();
  const { rows, filters, multipleProjects } = reviewListView(
    entries,
    query,
    filter,
    closed,
  );
  const open = (entry: ReviewListEntry) => {
    if (entry.worktreeId && !closed) {
      picker.onWorktree(entry.environmentId, entry.projectId, entry.worktreeId);
    } else if (entry.reviewId) {
      const remote = remotes.find(
        (candidate) => candidate.remote.environmentId === entry.environmentId,
      );
      if (!remote) return;
      router.push({
        pathname: '/(review)/reviews/[reviewId]',
        params: {
          reviewId: entry.reviewId,
          environment: entry.environmentId,
          host: new URL(remote.remote.address).host,
        },
      });
    }
  };
  return (
    <Box className="flex-1" surface="background" testID="worktree-navigator">
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
          <Stack.Toolbar.Button
            icon={headerIcon(closed ? 'close' : 'closed')}
            accessibilityLabel="Closed reviews"
            onPress={() => setClosed(!closed)}
          />
        </Stack.Toolbar>
      ) : null}
      <UpdatesSheet
        presented={updates}
        onClose={() => setUpdates(false)}
        onManageComputers={() => router.push('/computers')}
      />
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
              {updateIndicator.visible ? (
                <UpdatesButton
                  running={updateIndicator.running}
                  onPress={() => setUpdates(true)}
                />
              ) : null}
              <IconButton
                icon="filter"
                accessibilityLabel="Filter worktrees"
                onPress={() => setShowFilters(!showFilters)}
              />
              <IconButton
                icon={closed ? 'close' : 'closed'}
                accessibilityLabel="Closed reviews"
                onPress={() => setClosed(!closed)}
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
        contentContainerClassName="gap-2 px-4 pb-6"
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
        {(closed ? (['Closed'] as const) : reviewListGroups).map((group) => {
          const grouped =
            group === 'Closed'
              ? rows
              : rows.filter((entry) => entry.group === group);
          if (grouped.length === 0) return null;
          const expanded = preferences.reviewListGroupOpen[group] ?? true;
          return (
            <Box key={group}>
              <ButtonSurface
                variant="ghost"
                size="sm"
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
                <Icon name={expanded ? 'down' : 'chevron'} tone="muted" />
                <Text variant="subheading" tone="muted">
                  {group} · {grouped.length}
                </Text>
              </ButtonSurface>
              {expanded &&
                grouped.map((entry) => {
                  const selected = picker.choices.some(
                    (choice) =>
                      choice.environmentId === entry.environmentId &&
                      choice.project.id === entry.projectId &&
                      choice.worktrees.some(
                        (row) =>
                          row.selected && row.worktree.id === entry.worktreeId,
                      ),
                  );
                  const row = worktreeRow(entry, multipleProjects, selected);
                  const { context } = row;
                  return (
                    <Item
                      key={entry.key}
                      title={entry.title}
                      titleNumberOfLines={1}
                      leading={
                        <Box className="self-start mt-0.5">
                          <Icon name={row.icon} tone={row.tone} size="small" />
                        </Box>
                      }
                      titleTrailing={
                        entry.reviewId ? (
                          <Text variant="caption" tone="muted">
                            {entry.reviewed}/{entry.total}
                          </Text>
                        ) : undefined
                      }
                      size="xs"
                      selected={selected}
                      disabled={picker.disabled || (!closed && entry.disabled)}
                      accessibilityLabel={row.accessibilityLabel}
                      action={
                        entry.archivable ? (
                          <ArchiveAction entry={entry} projects={projects} />
                        ) : undefined
                      }
                      onPress={() => open(entry)}
                    >
                      <Box className="min-w-0 flex-row items-center" gap={1}>
                        {context.project ? (
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                            className={
                              context.branch
                                ? 'min-w-0 max-w-1/2 shrink'
                                : 'min-w-0 flex-1'
                            }
                          >
                            {context.project}
                          </Text>
                        ) : null}
                        {context.branch ? (
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                            className="min-w-0 flex-1"
                          >
                            {context.branch}
                          </Text>
                        ) : null}
                      </Box>
                    </Item>
                  );
                })}
            </Box>
          );
        })}
        {!initializing &&
        !loading &&
        messages.length === 0 &&
        rows.length === 0 ? (
          <Empty
            title={closed ? 'No closed reviews' : 'No matching worktrees'}
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
