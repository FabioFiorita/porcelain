import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  connectionErrorMessage,
  useAccessStore,
} from '@/features/access/index';
import { submitForm } from '@/shared/lib/submit-form';
import {
  renameProjectValidator,
  useRenameProject,
} from '../commands/rename-project';
import { renameProjectDialog } from '../overlays';
import { projectPath, type Project } from '../rules/inventory';

export function RenameProjectDialog() {
  const connection = useAccessStore((state) => state.connection);
  const rename = useRenameProject(connection, () =>
    renameProjectDialog.close(),
  );
  return (
    <DialogPrimitive.Root
      handle={renameProjectDialog}
      onOpenChangeComplete={rename.onCloseChange}
    >
      {({ payload }) =>
        payload && (
          <RenameProjectContent
            key={payload.id}
            project={payload}
            rename={rename}
          />
        )
      }
    </DialogPrimitive.Root>
  );
}

function RenameProjectContent({
  project,
  rename,
}: {
  project: Project;
  rename: ReturnType<typeof useRenameProject>;
}) {
  const form = useForm({
    defaultValues: { name: project.name },
    validators: { onChange: renameProjectValidator },
    onSubmit: ({ value }) =>
      rename.submit({ projectId: project.id, name: value.name }),
  });
  return (
    <DialogContent>
      <form onSubmit={(event) => submitForm(event, () => form.handleSubmit())}>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            The name is only a label in this sidebar. Nothing on disk changes,
            and two projects may share one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label htmlFor="project-name">Name</Label>
          <form.Field name="name">
            {(field) => (
              <Input
                id="project-name"
                name={field.name}
                value={field.state.value}
                autoFocus
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {projectPath(project)}
          </p>
        </div>
        {rename.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {connectionErrorMessage(rename.error)}
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={rename.isPending}
            onClick={() => renameProjectDialog.close()}
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.canSubmit}>
            {(canSubmit) => (
              <Button type="submit" disabled={!canSubmit || rename.isPending}>
                {rename.isPending && <Spinner />}
                {rename.isPending ? 'Renaming…' : 'Rename'}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
