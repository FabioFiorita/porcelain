import { Stack } from 'expo-router';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { workspaceIcon } from '../../../shared/icons/workspace-icon';
import type { WorkspaceMenuProps } from './workspace-menu-props';

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon={workspaceIcon}
        accessibilityLabel={props.label}
        title={props.label}
      >
        {props.choices.map(
          ({ key, environmentId, environmentName, project, unavailable }) => (
            <Stack.Toolbar.Menu
              key={key}
              title={`${project.name} · ${environmentName}`}
              disabled={props.disabled || unavailable || !project.available}
            >
              {project.worktrees.map((worktree) => (
                <Stack.Toolbar.MenuAction
                  key={worktree.id}
                  disabled={!project.available || !worktree.available}
                  isOn={
                    props.environmentId === environmentId &&
                    props.projectId === project.id &&
                    props.worktreeId === worktree.id
                  }
                  onPress={() =>
                    props.onWorktree(environmentId, project.id, worktree.id)
                  }
                >
                  {worktreeLabel(worktree.branch)}
                </Stack.Toolbar.MenuAction>
              ))}
              {project.worktrees.length === 0 ? (
                <Stack.Toolbar.MenuAction disabled>
                  No worktrees available
                </Stack.Toolbar.MenuAction>
              ) : null}
            </Stack.Toolbar.Menu>
          ),
        )}
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
            Read saved workspace again
          </Stack.Toolbar.MenuAction>
        ) : null}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
