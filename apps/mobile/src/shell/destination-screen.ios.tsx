import type { ReactNode } from 'react';
import { DeviceType, deviceType } from 'expo-device';
import { WorkspacePicker } from '../features/projects';

export function DestinationScreen({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspacePicker
        presentation={deviceType === DeviceType.TABLET ? 'tablet' : 'phone'}
      />
      {children}
    </>
  );
}
