import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
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
import { useRemoveProject } from '../commands/manage-project';
import { removeProjectDialog } from '../overlays';
import { projectPath } from '@porcelain/client/projects/rules';
import { type Project } from '@porcelain/client/projects/rules';
import { type Connection } from '@/shared/workspace/connection';
import { ProjectCommandProblem, ProjectOwner } from './project-owner';

export function RemoveProjectDialog({
  connection,
}: {
  connection: Connection;
}) {
  return (
    <AlertDialogPrimitive.Root handle={removeProjectDialog}>
      {({ payload }) =>
        payload && (
          <ProjectOwner remote={payload.remote} connection={connection}>
            {(owner) => (
              <AlertDialogContent>
                <RemoveProjectContent
                  key={payload.project.id}
                  project={payload.project}
                  {...owner}
                />
              </AlertDialogContent>
            )}
          </ProjectOwner>
        )
      }
    </AlertDialogPrimitive.Root>
  );
}

function RemoveProjectContent({
  project,
  connection,
  unavailable,
}: {
  project: Project;
  connection: Connection;
  unavailable: string | undefined;
}) {
  const remove = useRemoveProject(connection, () =>
    removeProjectDialog.close(),
  );
  const { result } = remove;
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Remove {project.name} from Porcelain?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Removes this project and its reviews and comments from Porcelain;
          files and Git history stay on disk.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p className="break-all font-mono text-xs text-muted-foreground">
        {projectPath(project)}
      </p>
      <ProjectCommandProblem unavailable={unavailable} result={result} />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={result.waiting}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={result.waiting || unavailable !== undefined}
          onClick={() => void remove.submit(project.id)}
        >
          {result.waiting && <Spinner />}
          {result.waiting ? 'Removing…' : 'Remove from Porcelain'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
