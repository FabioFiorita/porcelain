import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { headerIcon } from '../../shared/icons/header-icon';
import type { HeaderIconName } from '../../shared/icons/icon';
import { documentHeading } from '../../shared/rules/document-heading';
import { HeaderTitle } from './header-title';
import { Screen } from './screen';

type DocumentChoice = {
  label: string;
  selected?: boolean | undefined;
  onPress: () => void;
};

export type DocumentAction =
  | {
      kind: 'button';
      id: string;
      label: string;
      icon: HeaderIconName;
      onPress: () => void;
      disabled?: boolean | undefined;
    }
  | {
      kind: 'choice';
      id: string;
      label: string;
      icon: HeaderIconName;
      choices: readonly DocumentChoice[];
    };

const visibleActions = 3;

export function DocumentScreen({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <Screen layout="fixed">
      <Stack.Screen options={{ title: documentHeading(path).title }} />
      {children}
    </Screen>
  );
}

export function DocumentHeader({
  path,
  details = [],
  actions = [],
  place = 'screen',
}: {
  path: string;
  details?: readonly (string | undefined)[];
  actions?: readonly DocumentAction[];
  place?: 'screen' | 'pane';
}) {
  return <PageHeader {...documentHeading(path, details)} actions={actions} />;
}

export function PageHeader({
  title,
  subtitle,
  actions = [],
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: readonly DocumentAction[];
}) {
  const overflowing = actions.length > visibleActions;
  const visible = overflowing ? actions.slice(0, 2) : actions;
  const overflow = overflowing ? actions.slice(2) : [];
  return (
    <>
      {place === 'screen' ? (
        <Stack.Screen options={{ headerTransparent: false, title }} />
      ) : null}
      <Stack.Title asChild>
        <HeaderTitle
          title={title}
          subtitle={subtitle}
          trailingItems={visible.length + (overflowing ? 1 : 0)}
        />
      </Stack.Title>
      {actions.length > 0 ? (
        <Stack.Toolbar placement="right">
          {visible.map(barItem)}
          {overflowing ? (
            <Stack.Toolbar.Menu
              key="more"
              icon={headerIcon('more')}
              accessibilityLabel="More actions"
              title="More actions"
            >
              {overflow.map(menuItem)}
            </Stack.Toolbar.Menu>
          ) : null}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

function barItem(action: DocumentAction) {
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

function menuItem(action: DocumentAction) {
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

function choiceItem(choice: DocumentChoice) {
  return (
    <Stack.Toolbar.MenuAction
      key={choice.label}
      {...(choice.selected === undefined ? {} : { isOn: choice.selected })}
      onPress={choice.onPress}
    >
      {choice.label}
    </Stack.Toolbar.MenuAction>
  );
}
