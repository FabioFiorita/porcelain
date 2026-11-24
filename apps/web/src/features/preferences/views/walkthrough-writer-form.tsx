import { PendingButton } from '@/shared/views/pending-button';
import { useAtom, useAtomValue } from '@effect/atom-react';
import { useForm } from '@tanstack/react-form';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import type { WriterSettings } from '@porcelain/client/projects/rules';
import {
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
  saveDefaultWalkthroughWriter,
  saveWalkthroughSettings,
} from '@porcelain/client/projects';
import {
  selectedWalkthroughWriter,
  canSaveWalkthroughWriter,
  walkthroughWriterStatus,
  unsupportedWalkthroughEffortMessage,
  type Project,
} from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { useCommand } from '@/shared/lib/use-command';
import { useWalkthroughWriterSave } from '../commands/walkthrough-writer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cause } from 'effect';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PendingSpinner } from '@/shared/views/state-notice';
import { NoWalkthroughWriters } from '@/shared/views/no-walkthrough-writers';
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
  const [recheck, run] = useAtom(recheckWalkthroughWriterSettings(connection));
  const refresh = () => run(undefined);
  const checking = result.waiting || recheck.waiting;
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  if (AsyncResult.isFailure(result))
    return (
      <p
        role="alert"
        className="flex items-center gap-2 text-ui text-muted-foreground"
      >
        Could not read walkthrough models.
        <PendingButton
          size="xs"
          variant="outline"
          pending={checking}
          onClick={refresh}
        >
          Try again
        </PendingButton>
      </p>
    );
  if (!settings) return <PendingSpinner label="Reading walkthrough models" />;
  if (settings.models.length === 0 && !project)
    return <NoWalkthroughWriters checking={checking} onCheck={refresh} />;
  return (
    <WriterForm
      connection={connection}
      project={project}
      unavailable={unavailable}
      onSaved={onSaved}
      settings={settings}
      checking={checking}
      onCheck={refresh}
    />
  );
}
function WriterForm({
  connection,
  project,
  unavailable,
  onSaved,
  settings,
  checking,
  onCheck,
}: {
  connection: Connection;
  project: Project | undefined;
  unavailable: string | undefined;
  onSaved: (() => void) | undefined;
  settings: WriterSettings;
  checking: boolean;
  onCheck: () => void;
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
  const defaultStatus = walkthroughWriterStatus(settings);
  const result: AsyncResult.AsyncResult<unknown, unknown> = project
    ? projectResult
    : defaultResult;
  const submit = useWalkthroughWriterSave(saveProject, saveDefault, onSaved);
  const canSave = (writer: string, effort: string) =>
    canSaveWalkthroughWriter({
      writer,
      effort,
      current,
      project: project !== undefined,
      models: settings.models,
    });
  const form = useForm({
    defaultValues: {
      writer: current ? `${current.provider}:${current.model}` : 'default',
      effort: current?.effort ?? settings.writer.effort,
      mode: project?.walkthroughSettings?.mode ?? 'manual',
    },
    onSubmit: ({ value }) => {
      if (!canSave(value.writer, value.effort)) return;
      return submit({
        project,
        writer:
          value.writer === 'default'
            ? undefined
            : selectedWalkthroughWriter(value.writer, value.effort),
        mode: value.mode,
      });
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => submitForm(event, () => form.handleSubmit())}
    >
      {settings.models.length === 0 ? (
        <NoWalkthroughWriters checking={checking} onCheck={onCheck} />
      ) : (
        <>
          <form.Field name="writer">
            {(field) => {
              const selected = settings.models.find(
                (model) =>
                  `${model.provider}:${model.model}` === field.state.value,
              );
              let label = `${current?.provider} / ${current?.model} (unavailable)`;
              if (selected)
                label = `${selected.provider === 'claude' ? 'Claude' : 'Codex'} / ${selected.label}`;
              if (field.state.value === 'default')
                label = `Use the default · ${defaultStatus.label}`;
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
                          Use the default · {defaultStatus.label}
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
                      Install the model’s CLI and sign in, or choose another
                      model.
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
                  {(field) => {
                    const effort =
                      writer === 'default'
                        ? settings.writer.effort
                        : field.state.value;
                    let note: string | undefined;
                    if (writer === 'default') {
                      if (defaultStatus.availability === 'unsupported-effort')
                        note = defaultStatus.block;
                    } else if (model && !canSave(writer, effort)) {
                      note = unsupportedWalkthroughEffortMessage(
                        model.label,
                        effort,
                      );
                    }
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor="walkthrough-effort">Effort</Label>
                        <Select
                          value={effort}
                          disabled={
                            writer === 'default' || !model || result.waiting
                          }
                          onValueChange={(value) => {
                            if (value !== null) field.handleChange(value);
                          }}
                        >
                          <SelectTrigger
                            id="walkthrough-effort"
                            aria-label="Walkthrough effort"
                            aria-describedby={
                              note ? 'walkthrough-effort-note' : undefined
                            }
                            className="w-full"
                          >
                            <SelectValue>{effort}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {model?.efforts.map((effort) => (
                              <SelectItem key={effort} value={effort}>
                                {effort}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {note && (
                          <p
                            id="walkthrough-effort-note"
                            className="text-ui text-muted-foreground"
                          >
                            {note}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </form.Field>
              );
            }}
          </form.Subscribe>
        </>
      )}
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
      <form.Subscribe
        selector={(state) => ({
          writer: state.values.writer,
          effort: state.values.effort,
        })}
      >
        {({ writer, effort }) => (
          <PendingButton
            pending={result.waiting}
            type="submit"
            disabled={
              result.waiting ||
              unavailable !== undefined ||
              !canSave(writer, effort)
            }
          >
            Save
          </PendingButton>
        )}
      </form.Subscribe>
    </form>
  );
}
