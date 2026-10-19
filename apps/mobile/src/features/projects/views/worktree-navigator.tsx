import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  searchWorkspaces,
  type WorkspaceChoice,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Input } from '../../../components/ui/input';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { worktreeDescription } from '../rules/workspace-browser';
import { useWorkspacePickerModel } from './workspace-picker-model';
import type { WorkspacePickerProps } from './workspace-picker-props';

export function WorktreeNavigator({ onSelect }: { onSelect?: () => void }) {
  const { picker, initializing, reading } = useWorkspacePickerModel(onSelect);
  const [query, setQuery] = useState('');
  const [projectKey, setProjectKey] = useState<string | null>();
  const selectedProjectKey = picker.choices.find((choice) =>
    choice.worktrees.some((row) => row.selected),
  )?.key;
  const searching = query.trim().length > 0;
  const choices = searchWorkspaces(picker.choices, query);
  const project = !searching
    ? choices.find(
        (choice) =>
          choice.key ===
          (projectKey === undefined ? selectedProjectKey : projectKey),
      )
    : undefined;
  return (
    <Box className="flex-1" surface="background" testID="worktree-navigator">
      <Box paddingX={4} paddingY={3} gap={2}>
        <Input
          accessibilityLabel="Search projects and worktrees"
          placeholder="Search projects or worktrees"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          value={query}
          onChangeText={setQuery}
        />
        {searching ? (
          <Button
            label="Clear search"
            variant="ghost"
            onPress={() => setQuery('')}
          />
        ) : null}
        {!searching && project ? (
          <Button
            label="All projects"
            variant="ghost"
            className="self-start"
            onPress={() => setProjectKey(null)}
          />
        ) : null}
      </Box>
      <ScrollView
        key={searching ? 'search' : (project?.key ?? 'projects')}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        accessibilityLabel="Projects and worktrees"
        contentContainerClassName="gap-4 px-4 pb-6"
      >
        {initializing ? <Loading label="Reading workspace…" /> : null}
        {searching ? (
          <>
            <Text variant="caption" tone="muted">
              Results across all computers
            </Text>
            {choices.map((choice) => (
              <Box key={choice.key} gap={2}>
                <ProjectHeading choice={choice} />
                <WorktreeRows choice={choice} picker={picker} />
              </Box>
            ))}
            {!initializing && choices.length === 0 ? (
              <Empty
                title="No matching workspaces"
                description="Try a project, branch, computer or folder name."
              />
            ) : null}
          </>
        ) : null}
        {!searching && project ? (
          <Box gap={3}>
            <ProjectHeading choice={project} />
            <Text variant="caption" tone="muted">
              Choose a worktree
            </Text>
            <WorktreeRows choice={project} picker={picker} />
          </Box>
        ) : null}
        {!searching && !project ? (
          <Box gap={2}>
            <Text variant="heading">Projects</Text>
            <Text variant="caption" tone="muted">
              Choose a project to see its worktrees.
            </Text>
            {choices.map((choice) => {
              const selected = choice.worktrees.find((row) => row.selected);
              return (
                <Item
                  key={choice.key}
                  title={choice.project.name}
                  description={`${choice.environmentName} · ${choice.worktrees.length} ${choice.worktrees.length === 1 ? 'worktree' : 'worktrees'}`}
                  leading={
                    <Icon
                      name={choice.project.available ? 'folder' : 'warning'}
                      size="large"
                      tone="muted"
                    />
                  }
                  trailing={<Icon name="chevron" tone="muted" />}
                  selected={selected !== undefined}
                  accessibilityLabel={`Open ${choice.project.name} on ${choice.environmentName}`}
                  onPress={() => setProjectKey(choice.key)}
                >
                  {selected ? (
                    <Text variant="caption" tone="primary">
                      Current · {selected.label}
                    </Text>
                  ) : null}
                </Item>
              );
            })}
          </Box>
        ) : null}
        {!initializing
          ? picker.messages.map((message) => (
              <Text key={message} variant="caption" tone="muted">
                {message}
              </Text>
            ))
          : null}
        {!initializing &&
        picker.messages.includes('No environments paired') &&
        !picker.error ? (
          <Text variant="caption" tone="muted">
            Pair an environment in Settings to see its projects and worktrees.
          </Text>
        ) : null}
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
        {!initializing && picker.canReadInventory ? (
          <Button
            label="Read projects again"
            variant="outline"
            pending={reading}
            onPress={picker.onReadInventory}
          />
        ) : null}
      </ScrollView>
    </Box>
  );
}

function ProjectHeading({ choice }: { choice: WorkspaceChoice }) {
  return (
    <Box gap={1}>
      <Text variant="heading">{choice.project.name}</Text>
      <Box className="flex-row items-center" gap={2}>
        <Icon name="environments" tone="muted" size="small" />
        <Text variant="caption" tone="muted">
          {choice.environmentName}
        </Text>
      </Box>
    </Box>
  );
}

function WorktreeRows({
  choice,
  picker,
}: {
  choice: WorkspaceChoice;
  picker: WorkspacePickerProps;
}) {
  return (
    <Box gap={2}>
      {choice.worktrees.map((row) => (
        <Item
          key={row.key}
          title={row.label}
          description={worktreeDescription(choice, row)}
          variant="outline"
          selected={row.selected}
          disabled={picker.disabled || row.disabled}
          accessibilityLabel={`${row.accessibilityLabel}${row.selected ? ', current' : ''}, ${row.worktree.path}`}
          leading={
            <Icon
              name={row.worktree.main ? 'folder' : 'code'}
              tone={row.selected ? 'primary' : 'muted'}
            />
          }
          trailing={
            row.selected ? <Icon name="check" tone="primary" /> : undefined
          }
          onPress={() =>
            picker.onWorktree(
              row.workspace.environmentId,
              row.workspace.projectId,
              row.workspace.worktreeId,
            )
          }
        />
      ))}
      {choice.worktrees.length === 0 ? (
        <Text variant="caption" tone="muted">
          No worktrees available
        </Text>
      ) : null}
    </Box>
  );
}
