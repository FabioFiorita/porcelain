import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { useWorkspacePickerModel } from './workspace-picker-model';

function worktreeDescription(worktree: { available: boolean; main: boolean }) {
  if (!worktree.available) return 'Unavailable';
  return worktree.main ? 'Main worktree' : '';
}

export function WorktreeNavigator({ onSelect }: { onSelect?: () => void }) {
  const { picker, groups, initializing, reading } =
    useWorkspacePickerModel(onSelect);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      accessibilityLabel="Projects and worktrees"
      testID="worktree-navigator"
    >
      <Box gap={4} paddingX={4} paddingY={3}>
        {initializing ? <Loading label="Reading workspace…" /> : null}
        {groups.map((group) => (
          <Box key={group.key} gap={3}>
            <Box className="flex-row items-center" gap={2}>
              <Icon name="environments" tone="muted" size="small" />
              <Text variant="caption" tone="muted" weight="semibold">
                {group.name}
              </Text>
            </Box>
            {group.choices.map(({ key, project, worktrees }) => (
              <Box key={key} gap={1}>
                <Item
                  title={project.name}
                  size="xs"
                  leading={
                    <Icon
                      name={project.available ? 'folder' : 'warning'}
                      tone="muted"
                      size="small"
                    />
                  }
                  trailing={
                    <Icon
                      name={collapsed.has(key) ? 'chevron' : 'down'}
                      tone="muted"
                      size="small"
                    />
                  }
                  accessibilityLabel={`${collapsed.has(key) ? 'Expand' : 'Collapse'} ${project.name} on ${group.name}`}
                  onPress={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                />
                {!collapsed.has(key) ? (
                  <Box className="ml-3" gap={1}>
                    {worktrees.map((choice) => {
                      const { label, selected, worktree } = choice;
                      return (
                        <Item
                          key={choice.key}
                          title={label}
                          description={worktreeDescription(worktree)}
                          size="xs"
                          selected={selected}
                          disabled={picker.disabled || choice.disabled}
                          accessibilityLabel={choice.accessibilityLabel}
                          trailing={
                            selected ? (
                              <Icon name="check" size="small" />
                            ) : undefined
                          }
                          onPress={() =>
                            picker.onWorktree(
                              choice.workspace.environmentId,
                              choice.workspace.projectId,
                              choice.workspace.worktreeId,
                            )
                          }
                        />
                      );
                    })}
                    {worktrees.length === 0 ? (
                      <Text variant="caption" tone="muted">
                        No worktrees available
                      </Text>
                    ) : null}
                  </Box>
                ) : null}
              </Box>
            ))}
          </Box>
        ))}
        {!initializing
          ? picker.messages.map((message) => (
              <Text key={message} variant="caption" tone="muted">
                {message}
              </Text>
            ))
          : null}
        {!initializing && groups.length === 0 && !picker.error ? (
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
      </Box>
    </ScrollView>
  );
}
