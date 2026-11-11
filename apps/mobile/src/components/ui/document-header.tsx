import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { documentHeading } from '../../shared/rules/document-heading';
import { topBarItems, type TopBarAction } from './top-bar-items';
import { HeaderTitle } from './header-title';
import { Screen } from './screen';

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
  barItems,
}: {
  path: string;
  details?: readonly (string | undefined)[];
  actions?: readonly TopBarAction[];
  place?: 'screen' | 'pane';
  barItems?: number | undefined;
}) {
  return (
    <PageHeader
      {...documentHeading(path, details)}
      actions={actions}
      place={place}
      barItems={barItems}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions = [],
  place = 'screen',
  barItems,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: readonly TopBarAction[];
  place?: 'screen' | 'pane';
  barItems?: number | undefined;
}) {
  const items = topBarItems(actions);
  return (
    <>
      {place === 'screen' ? (
        <Stack.Screen options={{ headerTransparent: false, title }} />
      ) : null}
      <Stack.Title asChild>
        <HeaderTitle
          title={title}
          subtitle={subtitle}
          trailingItems={barItems ?? items.length}
        />
      </Stack.Title>
      {place === 'screen' && items.length > 0 ? (
        <Stack.Toolbar placement="right">{items}</Stack.Toolbar>
      ) : null}
    </>
  );
}
