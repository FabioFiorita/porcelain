import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useRemoveProject } from '../commands/remove-project';
import { removeProjectDialog } from '../overlays';
import { projectPath } from '@porcelain/client/projects/rules';
import { type Project } from '@porcelain/client/projects/rules';
import { type Connection } from '@/shared/workspace/connection';

export function RemoveProjectDialog({
  connection,
}: {
  connection: Connection;
}) {
  const remove = useRemoveProject(connection, () =>
    removeProjectDialog.close(),
  );
  return (
    <AlertDialogPrimitive.Root
      handle={removeProjectDialog}
      onOpenChangeComplete={remove.onCloseChange}
    >
      {({ payload }) =>
        payload && <RemoveProjectContent project={payload} remove={remove} />
      }
    </AlertDialogPrimitive.Root>
  );
}

function RemoveProjectContent({
  project,
  remove,
}: {
  project: Project;
  remove: ReturnType<typeof useRemoveProject>;
}) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Remove {project.name} from Porcelain?
        </AlertDialogTitle>
        <AlertDialogDescription>
          This removes the project and all its worktrees from the sidebar, and
          deletes their published reviews and proof, reviewed marks, comments,
          file preferences and Git action history in Porcelain. Repository files
          and Git history stay on disk.
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
          onClick={() => remove.confirm(project.id)}
        >
          {remove.isPending && <Spinner />}
          {remove.isPending ? 'Removing…' : 'Remove from Porcelain'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
