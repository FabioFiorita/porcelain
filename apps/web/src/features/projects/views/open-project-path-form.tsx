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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '@/shared/lib/submit-form';
import { registerProjectValidator } from '../commands/register-project';
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
    validators: { onChange: registerProjectValidator },
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
                <Field
                  data-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                >
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
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    aria-describedby={
                      field.state.meta.isTouched && !field.state.meta.isValid
                        ? 'project-path-error'
                        : undefined
                    }
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <FieldError
                      id="project-path-error"
                      errors={field.state.meta.errors}
                    />
                  )}
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
                selector={(state) => ({
                  submitting: state.isSubmitting,
                  path: state.values.path,
                  canSubmit: state.canSubmit,
                })}
              >
                {({ submitting, path, canSubmit }) => (
                  <Button
                    type="submit"
                    disabled={
                      submitting || disabled || !path.trim() || !canSubmit
                    }
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
