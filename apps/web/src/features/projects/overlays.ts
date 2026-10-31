import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import type { ArchiveReviewRequest } from '@porcelain/contracts/reviews';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

type Project = ReadInventoryResponse['projects'][number];
export type ProjectTarget = { project: Project; remote: string | null };

export const openProjectDialog = Dialog.createHandle<{
  remote: string | null;
}>();
export const renameProjectDialog = Dialog.createHandle<ProjectTarget>();
export const removeProjectDialog = AlertDialog.createHandle<ProjectTarget>();

export const archiveReviewDialog = AlertDialog.createHandle<{
  connection: Connection;
  reviewId: string;
  options: ArchiveReviewRequest['options'];
  requestId: string;
  beforeLeave: () => void;
}>();

export const deleteWorktreeDialog = AlertDialog.createHandle<{
  connection: Connection;
  entry: NavigatorEntry;
  worktreeId: string;
  requestId: string;
}>();

export const switchWorktreeBranchDialog = Dialog.createHandle<{
  connection: Connection;
  entry: NavigatorEntry;
  worktreeId: string;
  requestId: string;
}>();
