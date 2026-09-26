import { useForm } from '@tanstack/react-form';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '@/shared/lib/submit-form';
import { openProjectDialog } from '../overlays';

export function OpenProjectPathForm({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: (path: string) => void;
}) {
  const form = useForm({
    defaultValues: { path: '' },
    onSubmit: ({ value }) => onOpen(value.path),
  });
  return (
    <Collapsible className="group/path">
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        <ChevronDownIcon className="transition-transform group-data-closed/path:-rotate-90" />
        Enter a path
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form
          onSubmit={(event) => submitForm(event, () => form.handleSubmit())}
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
                    disabled={disabled}
                    autoComplete="off"
                    spellCheck={false}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldDescription>
                    Use an absolute path on the machine running the server.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => openProjectDialog.close()}
              >
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
                    disabled={submitting || disabled || !path.trim()}
                  >
                    {disabled ? (
                      <Spinner />
                    ) : (
                      <PlusIcon data-icon="inline-start" />
                    )}
                    {disabled ? 'Opening…' : 'Open project'}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </FieldGroup>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
