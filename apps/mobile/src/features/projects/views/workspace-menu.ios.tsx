import { Stack } from 'expo-router';
import { Button, Host, Label, Menu, Text, Toggle } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  frame,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { workspaceIcon } from '../../../shared/icons/workspace-icon';
import type { WorkspaceMenuProps } from './workspace-menu-props';

export function WorkspaceMenu(props: WorkspaceMenuProps) {
  if (props.presentation === 'tablet') return <ProjectMenu {...props} />;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View hidesSharedBackground>
        <Host style={{ width: 44, height: 44 }}>
          <ProjectMenu {...props} />
        </Host>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}

function ProjectMenu(props: WorkspaceMenuProps) {
  return (
    <Menu
      label={
        props.presentation === 'phone' ? (
          <Label
            title={props.label}
            systemImage={workspaceIcon}
            modifiers={[
              labelStyle('iconOnly'),
              font({ size: 20 }),
              frame({ width: 28, height: 28 }),
            ]}
          />
        ) : (
          props.label
        )
      }
      systemImage={workspaceIcon}
      modifiers={[
        accessibilityLabel(props.label),
        ...(props.presentation === 'phone'
          ? [
              buttonStyle('glass'),
              buttonBorderShape('circle'),
              controlSize('regular'),
            ]
          : []),
      ]}
    >
      {props.projects.map(
        ({ environmentId, environmentName, project, unavailable }) => (
          <Menu
            key={JSON.stringify([environmentId, project.id])}
            label={
              <>
                <Text>{project.name}</Text>
                <Text>{environmentName}</Text>
              </>
            }
            modifiers={[
              disabled(props.disabled || unavailable || !project.available),
            ]}
          >
            {project.worktrees.map((worktree) => (
              <Toggle
                key={worktree.id}
                label={worktreeLabel(worktree.branch)}
                isOn={
                  props.environmentId === environmentId &&
                  props.projectId === project.id &&
                  props.worktreeId === worktree.id
                }
                onIsOnChange={() =>
                  props.onWorktree(environmentId, project.id, worktree.id)
                }
                modifiers={[disabled(!worktree.available)]}
              />
            ))}
            {project.worktrees.length === 0 ? (
              <Text>No worktrees available</Text>
            ) : null}
          </Menu>
        ),
      )}
      {props.messages.map((message) => (
        <Text key={message}>{message}</Text>
      ))}
      {props.canReadInventory ? (
        <Button onPress={props.onReadInventory} label="Read projects again" />
      ) : null}
      {props.error ? <Text>{props.error}</Text> : null}
      {props.error ? (
        <Button onPress={props.onRead} label="Read saved workspace again" />
      ) : null}
    </Menu>
  );
}
