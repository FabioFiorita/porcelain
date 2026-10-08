import type { Project } from '@porcelain/client/projects/rules';

export type WorkspaceMenuProps = {
  presentation: 'phone' | 'tablet';
  label: string;
  environmentId: string | undefined;
  projects: readonly {
    environmentId: string;
    environmentName: string;
    project: Project;
    unavailable: boolean;
  }[];
  projectId: string | undefined;
  worktreeId: string | undefined;
  disabled: boolean;
  messages: readonly string[];
  canReadInventory: boolean;
  error: string | undefined;
  onRead: () => void;
  onReadInventory: () => void;
  onWorktree: (
    environmentId: string,
    projectId: string,
    worktreeId: string,
  ) => void;
};
