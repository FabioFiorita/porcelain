import { SettingsScreen } from '../features/access';
import type { ReactNode } from 'react';
import { DestinationLayout } from './destination-layout';
import type { SettingsPresentationProps } from './settings-presentation-props';

export function SettingsNavigator({ children }: { children: ReactNode }) {
  return (
    <DestinationLayout name="settings" title="Settings">
      {children}
    </DestinationLayout>
  );
}

export function SettingsPresentation(props: SettingsPresentationProps) {
  return <SettingsScreen {...props} />;
}
