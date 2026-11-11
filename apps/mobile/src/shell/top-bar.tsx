import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { topBarItems } from '../components/ui/top-bar-items';
import { usePublishedTopBar } from '../shared/application/top-bar';

export function TopBar({ leading = [] }: { leading?: readonly ReactNode[] }) {
  const items = topBarItems(usePublishedTopBar());
  if (leading.length === 0 && items.length === 0) return null;
  return (
    <Stack.Toolbar placement="right">
      {leading}
      {leading.length > 0 && items.length > 0 ? (
        <Stack.Toolbar.Spacer key="actions-gap" width={8} />
      ) : null}
      {items}
    </Stack.Toolbar>
  );
}
