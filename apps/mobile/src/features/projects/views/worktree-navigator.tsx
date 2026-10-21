import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAtomRef, useAtomValue, useAtomSet } from '@effect/atom-react';
import { readReviewList, refreshReviewList } from '@porcelain/client/reviews';
import {
  emptyReviewListFilter,
  reviewListGroups,
  reviewListMeta,
  reviewListView,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import { headerIcon } from '../../../shared/icons/header-icon';
import { Box } from '../../../components/ui/box';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Input } from '../../../components/ui/input';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { useWorkspacePickerModel } from './workspace-picker-model';

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
  const { entries, loading, messages } = useAtomValue(
    readReviewList(connections),
  );
  const retry = useAtomSet(refreshReviewList(connections));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(emptyReviewListFilter);
  const [closed, setClosed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const { rows, filters } = reviewListView(entries, query, filter, closed);
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
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon={headerIcon('workspace')}
            accessibilityLabel="Filter worktrees"
            title="Filter worktrees"
          >
            {filters.map((section) => (
              <Stack.Toolbar.Menu key={section.key} inline>
                <Stack.Toolbar.MenuAction disabled>
                  {section.label}
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
            icon={headerIcon('closed')}
            accessibilityLabel={closed ? 'Back to worktrees' : 'Closed reviews'}
            onPress={() => setClosed(!closed)}
          >
            {closed ? 'Active' : 'Closed'}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <Box
          className="flex-row items-center justify-between"
          paddingX={4}
          paddingY={2}
        >
          <Button
            label="Filter worktrees"
            variant="ghost"
            onPress={() => setShowFilters(!showFilters)}
          />
          <Button
            label={closed ? 'Back to worktrees' : 'Closed'}
            variant="ghost"
            onPress={() => setClosed(!closed)}
          />
        </Box>
      )}
      <Box paddingX={4} paddingY={3} gap={2}>
        <Input
          leading={<Icon name="search" tone="muted" />}
          accessibilityLabel="Search reviews and worktrees"
          placeholder="Search reviews, branches or worktrees"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          value={query}
          onChangeText={setQuery}
        />
        {query ? (
          <Button
            label="Clear search"
            variant="ghost"
            onPress={() => setQuery('')}
          />
        ) : null}
        {closed ? <Text variant="subheading">Closed reviews</Text> : null}
      </Box>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Worktrees by review status"
        contentContainerClassName="gap-4 px-4 pb-6"
      >
        {showFilters ? (
          <Box gap={2}>
            {filters.map((section) => (
              <Box key={section.key} gap={2}>
                <Text variant="subheading">{section.label}</Text>
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
          return (
            <Box key={group} gap={2}>
              <Text variant="subheading" tone="muted">
                {group} · {grouped.length}
              </Text>
              {grouped.map((entry) => {
                const selected = picker.choices.some(
                  (choice) =>
                    choice.environmentId === entry.environmentId &&
                    choice.project.id === entry.projectId &&
                    choice.worktrees.some(
                      (row) =>
                        row.selected && row.worktree.id === entry.worktreeId,
                    ),
                );
                return (
                  <Item
                    key={entry.key}
                    title={entry.title}
                    titleNumberOfLines={entry.group === 'Projects' ? 1 : 2}
                    variant={entry.group === 'Projects' ? 'default' : 'outline'}
                    size="sm"
                    selected={selected}
                    disabled={picker.disabled || (!closed && entry.disabled)}
                    accessibilityLabel={`${entry.title}, ${reviewListMeta(entry, Date.now())}${entry.reviewId ? `, ${entry.reviewed}/${entry.total} decisions reviewed, ${entry.badges.map((badge) => badge.label).join(', ')}` : ''}${selected ? ', current' : ''}${entry.disabled ? ', unavailable' : ''}`}
                    leading={
                      <Box className="w-10 shrink-0 self-start">
                        {entry.reviewId ? (
                          <Badge
                            label={`${entry.reviewed}/${entry.total}`}
                            variant="outline"
                          />
                        ) : null}
                      </Box>
                    }
                    trailing={<Icon name="chevron" tone="muted" />}
                    onPress={() => open(entry)}
                  >
                    {entry.badges.length > 0 ? (
                      <Box className="flex-row flex-wrap" gap={1}>
                        {entry.badges.map((badge) => (
                          <Badge
                            key={badge.label}
                            label={badge.label}
                            variant={badge.variant}
                          />
                        ))}
                      </Box>
                    ) : null}
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {reviewListMeta(entry, Date.now())}
                    </Text>
                    {entry.disabled ? (
                      <Text variant="caption" tone="muted">
                        Unavailable
                      </Text>
                    ) : null}
                  </Item>
                );
              })}
            </Box>
          );
        })}
        {!initializing && !loading && rows.length === 0 ? (
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
            pending={reading}
            onPress={() => retry(undefined)}
          />
        ) : null}
      </ScrollView>
    </Box>
  );
}
