import type { ReactNode } from 'react';

export type EnvironmentMenuProps = {
  children: ReactNode;
  onForget: () => void;
  isPending: boolean;
};
