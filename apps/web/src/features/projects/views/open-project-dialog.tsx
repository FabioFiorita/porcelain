import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon, FolderGit2Icon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '@/shared/lib/submit-form';
import { connectionErrorMessage } from '@/features/access/index';
import { useRegisterProject } from '../queries/inventory';
import { ProjectDiscovery } from './project-discovery';
import { ProjectFolderPicker } from './project-folder-picker';

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
    onSubmit: async ({ value }) => openProject(value.path.trim()),
  });

  async function openProject(path: string) {
    if (register.isPending) return;
    const project = await register.submit(path);
    const worktree = project.worktrees.find((entry) => entry.available);
    form.reset();
    register.reset();
    onOpenChange(false);
    if (worktree) void navigate({ search: { worktree: worktree.id } });
  }

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
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0 flex-row items-center text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <FolderGit2Icon aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>Open project</DialogTitle>
            <DialogDescription>
              Find a repository on the Porcelain server.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90svh-8rem)]">
          <div className="flex flex-col gap-3 p-1">
            {open && (
              <>
                <ProjectDiscovery
                  disabled={register.isPending}
                  onOpen={(path) => {
                    void openProject(path).catch(() => {});
                  }}
                />
                <ProjectFolderPicker
                  disabled={register.isPending}
                  onOpen={(path) => {
                    void openProject(path).catch(() => {});
                  }}
                />
              </>
            )}
            {register.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {connectionErrorMessage(register.error)}
                </AlertDescription>
              </Alert>
            )}
            <Collapsible className="group/path">
              <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                <ChevronDownIcon className="transition-transform group-data-closed/path:-rotate-90" />
                Enter a path
              </CollapsibleTrigger>
              <CollapsibleContent>
                <form
                  onSubmit={(event) =>
                    submitForm(event, () => form.handleSubmit())
                  }
                >
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
                            placeholder="/path/to/repository"
                            disabled={register.isPending}
                            autoComplete="off"
                            spellCheck={false}
                            required
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                          />
                          <FieldDescription>
                            Use an absolute path on the machine running the
                            server.
                          </FieldDescription>
                        </Field>
                      )}
                    </form.Field>

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
                            disabled={
                              submitting || register.isPending || !path.trim()
                            }
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
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
