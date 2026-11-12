import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { headerIcon } from '../../shared/icons/header-icon';
import type { HeaderIconName } from '../../shared/icons/icon';
import type { ScreenKeyBinding } from '../../shared/rules/key-commands';

type TopBarChoice = {
  label: string;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  onPress: () => void;
};

export type TopBarAction =
  | {
      kind: 'button';
      id: string;
      label: string;
      icon: HeaderIconName;
      onPress: () => void;
      disabled?: boolean | undefined;
      shortcut?: ScreenKeyBinding | undefined;
    }
  | {
      kind: 'choice';
      id: string;
      label: string;
      icon: HeaderIconName;
      choices: readonly TopBarChoice[];
    };

const visibleActions = 3;

export function topBarItems(actions: readonly TopBarAction[]): ReactNode[] {
  const overflowing = actions.length > visibleActions;
  const visible = overflowing ? actions.slice(0, 2) : actions;
  const overflow = overflowing ? actions.slice(2) : [];
  return [
    ...visible.map(barItem),
    ...(overflowing
      ? [
          <Stack.Toolbar.Menu
            key="more"
            icon={headerIcon('more')}
            accessibilityLabel="More actions"
            title="More actions"
          >
            {overflow.map(menuItem)}
          </Stack.Toolbar.Menu>,
        ]
      : []),
  ];
}

function barItem(action: TopBarAction) {
  if (action.kind === 'choice')
    return (
      <Stack.Toolbar.Menu
        key={action.id}
        icon={headerIcon(action.icon)}
        accessibilityLabel={action.label}
        title={action.label}
      >
        {action.choices.map(choiceItem)}
      </Stack.Toolbar.Menu>
    );
  return (
    <Stack.Toolbar.Button
      key={action.id}
      icon={headerIcon(action.icon)}
      accessibilityLabel={action.label}
      disabled={action.disabled ?? false}
      onPress={action.onPress}
    />
  );
}

function menuItem(action: TopBarAction) {
  if (action.kind === 'choice')
    return (
      <Stack.Toolbar.Menu
        key={action.id}
        icon={headerIcon(action.icon)}
        title={action.label}
      >
        {action.choices.map(choiceItem)}
      </Stack.Toolbar.Menu>
    );
  return (
    <Stack.Toolbar.MenuAction
      key={action.id}
      icon={headerIcon(action.icon)}
      disabled={action.disabled ?? false}
      onPress={action.onPress}
    >
      {action.label}
    </Stack.Toolbar.MenuAction>
  );
}

export function topBarMenuEntries(actions: readonly TopBarAction[]) {
  return actions.flatMap((action) =>
    action.kind === 'choice'
      ? action.choices.map(choiceItem)
      : [menuItem(action)],
  );
}

function choiceItem(choice: TopBarChoice) {
  return (
    <Stack.Toolbar.MenuAction
      key={choice.label}
      {...(choice.selected === undefined ? {} : { isOn: choice.selected })}
      disabled={choice.disabled ?? false}
      onPress={choice.onPress}
    >
      {choice.label}
    </Stack.Toolbar.MenuAction>
  );
}
