import { Stack } from 'expo-router';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { workspaceIcon } from '../../../shared/icons/workspace-icon';
import type { WorkspaceMenuProps } from './workspace-menu-props';

export function PhoneWorkspaceMenu(props: WorkspaceMenuProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon={workspaceIcon}
        accessibilityLabel={props.label}
        title={props.label}
      >
        <Stack.Toolbar.Menu title="Environment" disabled={props.disabled}>
          {props.environments.map((environment) => (
            <Stack.Toolbar.MenuAction
              key={environment.environmentId}
              isOn={props.environmentId === environment.environmentId}
              onPress={() => props.onEnvironment(environment.environmentId)}
            >
              {environment.name}
            </Stack.Toolbar.MenuAction>
          ))}
          {props.environments.length === 0 ? (
            <Stack.Toolbar.MenuAction disabled>
              No environments paired
            </Stack.Toolbar.MenuAction>
          ) : null}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu title="Project" disabled={props.disabled}>
          {props.projects.map((project) => (
            <Stack.Toolbar.Menu key={project.id} title={project.name}>
              {project.worktrees.map((worktree) => (
                <Stack.Toolbar.MenuAction
                  key={worktree.id}
                  disabled={!project.available || !worktree.available}
                  isOn={
                    props.projectId === project.id &&
                    props.worktreeId === worktree.id
                  }
                  onPress={() => props.onWorktree(project.id, worktree.id)}
                >
                  {worktreeLabel(worktree.branch)}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          ))}
          {props.projectMessage ? (
            <Stack.Toolbar.MenuAction disabled>
              {props.projectMessage}
            </Stack.Toolbar.MenuAction>
          ) : null}
          {props.projectMessage === 'Could not read projects' ? (
            <Stack.Toolbar.MenuAction onPress={props.onReadInventory}>
              Read projects again
            </Stack.Toolbar.MenuAction>
          ) : null}
        </Stack.Toolbar.Menu>
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
