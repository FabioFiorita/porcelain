import { Stack } from 'expo-router';
import { headerIcon } from '../../../shared/icons/header-icon';
import type { WorkspaceMenuProps } from './workspace-menu-props';

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon={headerIcon('workspace')}
        accessibilityLabel={props.label}
      >
        {props.choices.map(({ key, environmentName, project, worktrees }) => (
          <Stack.Toolbar.Menu key={key} inline>
            {worktrees.map((choice) => (
              <Stack.Toolbar.MenuAction
                key={choice.key}
                disabled={props.disabled || choice.disabled}
                isOn={choice.selected}
                discoverabilityLabel={choice.accessibilityLabel}
                onPress={() =>
                  props.onWorktree(
                    choice.workspace.environmentId,
                    choice.workspace.projectId,
                    choice.workspace.worktreeId,
                  )
                }
              >
                {`${choice.label} · ${project.name} · ${environmentName}${choice.worktree.available ? '' : ' (unavailable)'}`}
              </Stack.Toolbar.MenuAction>
            ))}
            {worktrees.length === 0 ? (
              <Stack.Toolbar.MenuAction disabled>
                {`${project.name} · ${environmentName}: No worktrees available`}
              </Stack.Toolbar.MenuAction>
            ) : null}
          </Stack.Toolbar.Menu>
        ))}
        {props.messages.map((message) => (
          <Stack.Toolbar.MenuAction key={message} disabled>
            {message}
          </Stack.Toolbar.MenuAction>
        ))}
        {props.canReadInventory ? (
          <Stack.Toolbar.MenuAction onPress={props.onReadInventory}>
            Read projects again
          </Stack.Toolbar.MenuAction>
        ) : null}
        {props.error ? (
          <Stack.Toolbar.MenuAction disabled>
            {props.error}
          </Stack.Toolbar.MenuAction>
        ) : null}
        {props.error ? (
          <Stack.Toolbar.MenuAction onPress={props.onRead}>
            Read again
          </Stack.Toolbar.MenuAction>
        ) : null}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
