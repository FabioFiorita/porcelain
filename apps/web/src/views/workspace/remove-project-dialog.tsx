import type { RefObject } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Project } from '../../domain/inventory';
import { projectPath } from '../../domain/inventory';
import { connectionErrorMessage } from '../../query/connection';
import { useRemoveProject } from '../../query/inventory';

export function RemoveProjectDialog({
  project,
  onClose,
  finalFocus,
}: {
  project: Project;
  onClose: () => void;
  finalFocus: RefObject<HTMLButtonElement | null>;
}) {
  const remove = useRemoveProject();
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose();
      }}
    >
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {project.name} from Porcelain?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes the project and all its worktrees from the sidebar, and
            deletes their saved reviews, comments, artifacts, preferences, and
            operation history in Porcelain. Repository files and Git history
            stay on disk.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {projectPath(project)}
        </p>
        {remove.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionErrorMessage(remove.error)}
            </AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              void remove
                .submit(project.id)
                .then(onClose)
                .catch(() => {});
            }}
          >
            {remove.isPending && <Spinner />}
            {remove.isPending ? 'Removing…' : 'Remove from Porcelain'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
