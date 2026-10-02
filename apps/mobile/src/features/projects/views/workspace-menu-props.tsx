import type { Project } from '@porcelain/client/projects/rules';

export type WorkspaceMenuProps = {
  presentation: 'phone' | 'tablet';
  label: string;
  environments: { environmentId: string; name: string }[];
  environmentId: string | undefined;
  projects: Project[];
  projectId: string | undefined;
  worktreeId: string | undefined;
  disabled: boolean;
  projectMessage: string | undefined;
  error: string | undefined;
  onRead: () => void;
  onReadInventory: () => void;
  onEnvironment: (environmentId: string) => void;
  onWorktree: (projectId: string, worktreeId: string) => void;
};
