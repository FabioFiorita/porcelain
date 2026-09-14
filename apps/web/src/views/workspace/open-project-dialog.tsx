import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { FolderGit2Icon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '../../lib/submit-form';
import { connectionErrorMessage } from '../../query/connection';
import { useRegisterProject } from '../../query/inventory';

export function OpenProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate({ from: '/' });
  const register = useRegisterProject();
  const form = useForm({
    defaultValues: { path: '' },
    onSubmit: async ({ value, formApi }) => {
      const project = await register.submit(value.path.trim());
      const worktree = project.worktrees.find((entry) => entry.available);
      formApi.reset();
      register.reset();
      onOpenChange(false);
      if (worktree) void navigate({ search: { worktree: worktree.id } });
    },
  });

  const close = () => {
    if (register.isPending) return;
    form.reset();
    register.reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <FolderGit2Icon aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>Open project</DialogTitle>
            <DialogDescription>
              Register a repository that lives on the Porcelain server.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={(event) => submitForm(event, form.handleSubmit)}>
          <FieldGroup>
            <form.Field name="path">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="project-path">
                    Repository path
                  </FieldLabel>
                  <Input
                    id="project-path"
                    name={field.name}
                    type="text"
                    placeholder="/home/fabio/projects/my-repository"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldDescription>
                    Use an absolute Linux path from the machine running the
                    server. Porcelain will inspect it as a Git repository;
                    nothing is created or changed on disk.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

            {register.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {connectionErrorMessage(register.error)}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) =>
                  [state.isSubmitting, state.values.path] as const
                }
              >
                {([submitting, path]) => (
                  <Button
                    type="submit"
                    disabled={submitting || register.isPending || !path.trim()}
                  >
                    {register.isPending ? (
                      <Spinner />
                    ) : (
                      <PlusIcon data-icon="inline-start" />
                    )}
                    {register.isPending ? 'Opening…' : 'Open project'}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
