import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { documentHeading } from '../../shared/rules/document-heading';
import { useTopBarItems, type TopBarAction } from './top-bar-items';
import { HeaderTitle } from './header-title';
import { Screen } from './screen';
import { Box } from './box';
import { Text } from './text';

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
  const items = useTopBarItems(actions);
  if (place === 'pane')
    return (
      <Box paddingX={4} paddingY={2} divider="bottom">
        <Text variant="headline" numberOfLines={1} ellipsizeMode="middle">
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            ellipsizeMode="head"
          >
            {subtitle}
          </Text>
        ) : null}
      </Box>
    );
  return (
    <>
      <Stack.Screen options={{ headerTransparent: false, title }} />
      <Stack.Title asChild>
        <HeaderTitle
          title={title}
          subtitle={subtitle}
          trailingItems={barItems ?? items.length}
        />
      </Stack.Title>
      {items.length > 0 ? (
        <Stack.Toolbar placement="right">{items}</Stack.Toolbar>
      ) : null}
    </>
  );
}
