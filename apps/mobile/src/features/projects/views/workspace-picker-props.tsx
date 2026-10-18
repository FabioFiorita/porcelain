import type { WorkspaceChoice } from '@porcelain/client/projects/rules';

export type WorkspacePickerProps = {
  label: string;
  choices: readonly WorkspaceChoice[];
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
