import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { headerIcon } from '../../shared/icons/header-icon';

export type LeadingToolbarProps = {
  sidebar: { readonly visible: boolean; readonly toggle: () => void } | null;
  back?: (() => void) | undefined;
  children?: ReactNode;
};

export function LeadingToolbar({
  children,
  sidebar,
  back,
}: LeadingToolbarProps) {
  if (!sidebar && !children && !back) return null;
  return (
    <Stack.Toolbar placement="left">
      {back ? (
        <Stack.Toolbar.Button onPress={back} accessibilityLabel="Back">
          Back
        </Stack.Toolbar.Button>
      ) : null}
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
