import { useAtomValue } from '@effect/atom-react';
import { useForm } from '@tanstack/react-form';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import type { WriterSettings } from '@porcelain/client/projects/rules';
import {
  readWalkthroughWriterSettings,
  saveDefaultWalkthroughWriter,
  saveWalkthroughSettings,
} from '@porcelain/client/projects';
import {
  selectedWalkthroughWriter,
  canSaveWalkthroughWriter,
  type Project,
} from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { useCommand } from '@/shared/lib/use-command';
import { useWalkthroughWriterSave } from '../commands/walkthrough-writer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cause } from 'effect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { submitForm } from '@/shared/lib/submit-form';

export function WalkthroughWriterForm({
  connection,
  project,
  unavailable,
  onSaved,
}: {
  connection: Connection;
  project?: Project;
  unavailable?: string | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const result = useAtomValue(readWalkthroughWriterSettings(connection));
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  if (AsyncResult.isFailure(result))
    return (
      <p role="alert">
        Could not read walkthrough models. Check this computer’s connection and
        reopen settings.
      </p>
    );
  if (!settings) return <Spinner />;
  return (
    <WriterForm
      connection={connection}
      project={project}
      unavailable={unavailable}
      onSaved={onSaved}
      settings={settings}
    />
  );
}
function WriterForm({
  connection,
  project,
  unavailable,
  onSaved,
  settings,
}: {
  connection: Connection;
  project: Project | undefined;
  unavailable: string | undefined;
  onSaved: (() => void) | undefined;
  settings: WriterSettings;
}) {
  const [projectResult, saveProject] = useCommand(
    saveWalkthroughSettings(connection),
  );
  const [defaultResult, saveDefault] = useCommand(
    saveDefaultWalkthroughWriter(connection),
  );
  const current = project
    ? project.walkthroughSettings?.writer
    : settings.writer;
  const defaultLabel = `${settings.writer.provider === 'claude' ? 'Claude' : 'Codex'} / ${settings.models.find((model) => model.provider === settings.writer.provider && model.model === settings.writer.model)?.label ?? settings.writer.model} · ${settings.writer.effort}`;
  const result: AsyncResult.AsyncResult<unknown, unknown> = project
    ? projectResult
    : defaultResult;
  const submit = useWalkthroughWriterSave(saveProject, saveDefault, onSaved);
  const form = useForm({
    defaultValues: {
      writer: current ? `${current.provider}:${current.model}` : 'default',
      effort: current?.effort ?? settings.writer.effort,
      mode: project?.walkthroughSettings?.mode ?? 'manual',
    },
    onSubmit: ({ value }) =>
      submit({
        project,
        writer:
          value.writer === 'default'
            ? undefined
            : selectedWalkthroughWriter(value.writer, value.effort),
        mode: value.mode,
      }),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => submitForm(event, () => form.handleSubmit())}
    >
      <form.Field name="writer">
        {(field) => {
          const selected = settings.models.find(
            (model) => `${model.provider}:${model.model}` === field.state.value,
          );
          let label = `${current?.provider} / ${current?.model} (unavailable)`;
          if (selected)
            label = `${selected.provider === 'claude' ? 'Claude' : 'Codex'} / ${selected.label}`;
          if (field.state.value === 'default')
            label = `Use the default · ${defaultLabel}`;
          return (
            <div className="grid gap-2">
              <Label htmlFor="walkthrough-writer">Writer</Label>
              <Select
                value={field.state.value}
                disabled={result.waiting || unavailable !== undefined}
                onValueChange={(value) => {
                  if (value === null) return;
                  field.handleChange(value);
                  const model = settings.models.find(
                    (model) => `${model.provider}:${model.model}` === value,
                  );
                  form.setFieldValue(
                    'effort',
                    model?.defaultEffort ?? settings.writer.effort,
                  );
                }}
              >
                <SelectTrigger
                  id="walkthrough-writer"
                  aria-label="Walkthrough writer"
                  className="w-full"
                >
                  <SelectValue>{label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {project && (
                    <SelectItem value="default">
                      Use the default · {defaultLabel}
                    </SelectItem>
                  )}
                  {!selected && field.state.value !== 'default' && (
                    <SelectItem value={field.state.value} disabled>
                      {label}
                    </SelectItem>
                  )}
                  {settings.models.map((model) => (
                    <SelectItem
                      key={`${model.provider}:${model.model}`}
                      value={`${model.provider}:${model.model}`}
                    >
                      {model.provider === 'claude' ? 'Claude' : 'Codex'} /{' '}
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.value !== 'default' && !selected && (
                <p role="status" className="text-ui text-muted-foreground">
                  This model is unavailable. Install its CLI and sign in, or
                  select an available model. Runs will fail clearly while it is
                  unavailable.
                </p>
              )}
            </div>
          );
        }}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.writer}>
        {(writer) => {
          const model = settings.models.find(
            (model) => `${model.provider}:${model.model}` === writer,
          );
          return (
            <form.Field name="effort">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="walkthrough-effort">Effort</Label>
                  <Select
                    value={
                      writer === 'default'
                        ? settings.writer.effort
                        : field.state.value
                    }
                    disabled={writer === 'default' || !model || result.waiting}
                    onValueChange={(value) => {
                      if (value !== null) field.handleChange(value);
                    }}
                  >
                    <SelectTrigger
                      id="walkthrough-effort"
                      aria-label="Walkthrough effort"
                      className="w-full"
                    >
                      <SelectValue>
                        {writer === 'default'
                          ? settings.writer.effort
                          : field.state.value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {model?.efforts.map((effort) => (
                        <SelectItem key={effort} value={effort}>
                          {effort}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          );
        }}
      </form.Subscribe>
      {project && (
        <form.Field name="mode">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="walkthrough-mode">Write walkthroughs</Label>
              <Select
                value={field.state.value}
                disabled={result.waiting}
                onValueChange={(value) => {
                  if (value === 'manual' || value === 'automatic')
                    field.handleChange(value);
                }}
              >
                <SelectTrigger
                  id="walkthrough-mode"
                  aria-label="Walkthrough mode"
                  className="w-full"
                >
                  <SelectValue>
                    {field.state.value === 'manual' ? 'Manual' : 'Automatic'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">
                    Automatic when a pull request opens
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
      )}
      {unavailable && (
        <Alert variant="destructive">
          <AlertDescription>{unavailable}</AlertDescription>
        </Alert>
      )}
      {AsyncResult.isFailure(result) && (
        <Alert variant="destructive">
          <AlertDescription>
            {String(Cause.squash(result.cause))}
          </AlertDescription>
        </Alert>
      )}
      {AsyncResult.isSuccess(result) && !result.waiting && (
        <p role="status" className="text-ui text-muted-foreground">
          Saved on this computer.
        </p>
      )}
      <form.Subscribe
        selector={(state) => ({
          writer: state.values.writer,
          effort: state.values.effort,
        })}
      >
        {({ writer, effort }) => (
          <Button
            type="submit"
            disabled={
              result.waiting ||
              unavailable !== undefined ||
              !canSaveWalkthroughWriter({
                writer,
                effort,
                current,
                project: project !== undefined,
                models: settings.models,
              })
            }
          >
            {result.waiting && <Spinner />}Save
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
