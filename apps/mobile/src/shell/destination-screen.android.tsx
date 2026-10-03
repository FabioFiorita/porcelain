import type { ReactNode } from 'react';
import { WorkspacePicker } from '../features/projects';

export function DestinationScreen({ children }: { children: ReactNode }) {
  return (
    <>
      <WorkspacePicker presentation="phone" />
      {children}
    </>
  );
}
