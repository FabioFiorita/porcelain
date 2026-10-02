import type { ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { WorkspacePicker } from '../features/projects';

export function DestinationScreen({ children }: { children: ReactNode }) {
  return (
    <>
      {deviceType === DeviceType.TABLET ? null : (
        <WorkspacePicker presentation="phone" />
      )}
      {children}
    </>
  );
}
