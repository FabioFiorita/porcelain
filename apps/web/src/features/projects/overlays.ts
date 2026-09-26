import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

type Project = ReadInventoryResponse['projects'][number];

export const openProjectDialog = Dialog.createHandle();
export const renameProjectDialog = Dialog.createHandle<Project>();
export const removeProjectDialog = AlertDialog.createHandle<Project>();
