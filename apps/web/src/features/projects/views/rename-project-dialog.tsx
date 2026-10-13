import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { useForm } from '@tanstack/react-form';
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
import { Field, FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '@/shared/lib/submit-form';
import {
  renameProjectValidator,
  useRenameProject,
} from '../commands/manage-project';
import { renameProjectDialog } from '../overlays';
import { projectPath } from '@porcelain/client/projects/rules';
import { type Project } from '@porcelain/client/projects/rules';
import { type Connection } from '@/shared/workspace/connection';
import { ProjectCommandProblem, ProjectOwner } from './project-owner';

export function RenameProjectDialog({
  connection,
}: {
  connection: Connection;
}) {
  return (
    <DialogPrimitive.Root handle={renameProjectDialog}>
      {({ payload }) =>
        payload && (
          <ProjectOwner remote={payload.remote} connection={connection}>
            {(owner) => (
              <DialogContent>
                <RenameProjectContent
                  key={payload.project.id}
                  project={payload.project}
                  {...owner}
                />
              </DialogContent>
            )}
          </ProjectOwner>
        )
      }
    </DialogPrimitive.Root>
  );
}

function RenameProjectContent({
  project,
  connection,
  unavailable,
}: {
  project: Project;
  connection: Connection;
  unavailable: string | undefined;
}) {
  const rename = useRenameProject(connection, () =>
    renameProjectDialog.close(),
  );
  const { result } = rename;
  const form = useForm({
    defaultValues: { name: project.name },
    validators: { onChange: renameProjectValidator },
    onSubmit: ({ value }) =>
      rename.submit({ projectId: project.id, name: value.name }),
  });
  return (
    <form onSubmit={(event) => submitForm(event, () => form.handleSubmit())}>
      <DialogHeader>
        <DialogTitle>Rename project</DialogTitle>
        <DialogDescription>
          The name is only a label in this sidebar. Nothing on disk changes, and
          two projects may share one.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 py-4">
        <form.Field name="name">
          {(field) => (
            <Field
              data-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
              }
            >
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                name={field.name}
                value={field.state.value}
                autoFocus
                aria-invalid={
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
                aria-describedby={
                  field.state.meta.isTouched && !field.state.meta.isValid
                    ? 'project-name-error'
                    : undefined
                }
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <FieldError
                  id="project-name-error"
                  errors={field.state.meta.errors}
                />
              )}
            </Field>
          )}
        </form.Field>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {projectPath(project)}
        </p>
      </div>
      <ProjectCommandProblem unavailable={unavailable} result={result} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={result.waiting}
          onClick={() => renameProjectDialog.close()}
        >
          Cancel
        </Button>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              disabled={
                !canSubmit || result.waiting || unavailable !== undefined
              }
            >
              {result.waiting && <Spinner />}
              {result.waiting ? 'Renaming…' : 'Rename'}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
