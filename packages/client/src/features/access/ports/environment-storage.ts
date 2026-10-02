import type { Remote } from '../rules/remotes.ts';

export type EnvironmentStorage = {
  read: () => Promise<Remote[]>;
  write: (remotes: readonly Remote[]) => Promise<void>;
};
