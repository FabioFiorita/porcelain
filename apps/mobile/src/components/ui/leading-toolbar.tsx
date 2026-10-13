import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { headerIcon } from '../../shared/icons/header-icon';

export type LeadingToolbarProps = {
  sidebar: { readonly visible: boolean; readonly toggle: () => void } | null;
  children?: ReactNode;
};

export function LeadingToolbar({ children, sidebar }: LeadingToolbarProps) {
  if (!sidebar && !children) return null;
  return (
    <Stack.Toolbar placement="left">
      {sidebar ? (
        <Stack.Toolbar.Button
          icon={headerIcon('sidebar')}
          accessibilityLabel={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
          onPress={sidebar.toggle}
        />
      ) : null}
      {children}
    </Stack.Toolbar>
  );
}
