import { createAlertDialogController } from '@/components/ui/alert-dialog';
import { createDialogController } from '@/components/ui/dialog';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import type { ArchivePullRequestRequest } from '@porcelain/contracts/projects';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

type Project = ReadInventoryResponse['projects'][number];
export type ProjectTarget = { project: Project; remote: string | null };

export const openProjectDialog = createDialogController<{
  remote: string | null;
  project?: Project;
  path?: string;
}>();
export const walkthroughSettingsDialog =
  createDialogController<ProjectTarget>();
export const renameProjectDialog = createDialogController<ProjectTarget>();
export const removeProjectDialog = createAlertDialogController<ProjectTarget>();

export const archivePullRequestDialog = createAlertDialogController<{
  context: ConnectionContext;
  projectId: string;
  number: number;
  options: ArchivePullRequestRequest['options'];
  requestId: string;
  beforeLeave: () => void;
}>();

export const deleteWorktreeDialog = createAlertDialogController<{
  context: ConnectionContext;
  entry: NavigatorEntry;
  worktreeId: string;
  requestId: string;
}>();

export const switchWorktreeBranchDialog = createDialogController<{
  context: ConnectionContext;
  entry: NavigatorEntry;
  worktreeId: string;
  requestId: string;
}>();
