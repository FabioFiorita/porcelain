import { Button, Menu, Picker, Text } from '@expo/ui/swift-ui';
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { workspaceIcon } from '../../../shared/icons/workspace-icon';
import type { WorkspaceMenuProps } from './workspace-menu-props';
import { PhoneWorkspaceMenu } from './phone-workspace-menu';

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  if (props.presentation === 'phone') return <PhoneWorkspaceMenu {...props} />;
  return (
    <Menu label={props.label} systemImage={workspaceIcon}>
      <Picker<string>
        label="Environment"
        {...(props.environmentId === undefined
          ? {}
          : { selection: props.environmentId })}
        onSelectionChange={props.onEnvironment}
        modifiers={[pickerStyle('menu'), disabled(props.disabled)]}
      >
        {props.environments.map((environment) => (
          <Text
            key={environment.environmentId}
            modifiers={[tag(environment.environmentId)]}
          >
            {environment.name}
          </Text>
        ))}
      </Picker>
      <Menu label="Project" modifiers={[disabled(props.disabled)]}>
        {props.projects.map((project) => (
          <Picker<string>
            key={project.id}
            label={project.name}
            {...(props.projectId === project.id &&
            props.worktreeId !== undefined
              ? { selection: props.worktreeId }
              : {})}
            onSelectionChange={(worktreeId) =>
              props.onWorktree(project.id, worktreeId)
            }
            modifiers={[pickerStyle('menu'), disabled(!project.available)]}
          >
            {project.worktrees.map((worktree) => (
              <Text
                key={worktree.id}
                modifiers={[tag(worktree.id), disabled(!worktree.available)]}
              >
                {worktreeLabel(worktree.branch)}
              </Text>
            ))}
          </Picker>
        ))}
        {props.projectMessage ? <Text>{props.projectMessage}</Text> : null}
        {props.projectMessage === 'Could not read projects' ? (
          <Button onPress={props.onReadInventory} label="Read projects again" />
        ) : null}
      </Menu>
      {props.error ? <Text>{props.error}</Text> : null}
      {props.error ? (
        <Button onPress={props.onRead} label="Read saved workspace again" />
      ) : null}
    </Menu>
  );
}
