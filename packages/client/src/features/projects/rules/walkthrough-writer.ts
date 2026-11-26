import * as Schema from 'effect/Schema';
import {
  latestWalkthroughWriter,
  writerSchema,
  unsupportedWalkthroughEffortMessage,
  walkthroughWriterAvailability,
  type WalkthroughWriterSettings,
} from '@porcelain/contracts/walkthroughs';

type WriterChoice = WalkthroughWriterSettings['writer'];
type WriterModel = WalkthroughWriterSettings['models'][number];

export const selectedWalkthroughWriter = (key: string, effort: string) => {
  const [provider, model, family] = key.split(':');
  return Schema.decodeUnknownSync(writerSchema)({
    provider,
    model,
    effort,
    ...(family === undefined ? {} : { latest: family }),
  });
};

export function walkthroughWriterKey(writer: {
  readonly provider: string;
  readonly model: string;
  readonly latest?: string | undefined;
}) {
  return writer.latest === undefined
    ? `${writer.provider}:${writer.model}`
    : `${writer.provider}:${writer.model}:${writer.latest}`;
}

export function resolvedWalkthroughWriterKey(
  writer: WriterChoice,
  models: readonly WriterModel[],
) {
  return walkthroughWriterKey(latestWalkthroughWriter(writer, models));
}

export function walkthroughWriterKeyModel(key: string) {
  return key.split(':').slice(0, 2).join(':');
}

const providerLabel = (provider: WriterChoice['provider']) =>
  provider === 'claude' ? 'Claude' : 'Codex';

export function walkthroughWriterLabel(
  writer: Pick<WriterChoice, 'provider' | 'model' | 'effort'>,
  models: readonly WriterModel[],
) {
  const model = models.find(
    (entry) =>
      entry.provider === writer.provider && entry.model === writer.model,
  );
  return `${providerLabel(writer.provider)} / ${model?.label ?? writer.model} · ${writer.effort}`;
}

export function walkthroughWriterMenu(models: readonly WriterModel[]) {
  return (['claude', 'codex'] as const).flatMap((provider) => {
    const listed = models.filter((model) => model.provider === provider);
    if (listed.length === 0) return [];
    const families = [
      ...new Set(listed.flatMap((model) => model.family ?? [])),
    ];
    return [
      {
        provider,
        label: providerLabel(provider),
        latest: families.map((family) => {
          const newest = listed.find((model) => model.family === family)!;
          return {
            key: `${provider}:${newest.model}:${family}`,
            label: `Latest ${family}`,
            model: newest.label,
          };
        }),
        exact: listed.map((model) => ({
          key: `${provider}:${model.model}`,
          label: model.label,
        })),
      },
    ];
  });
}

export function chooseWalkthroughWriter(
  key: string,
  current: WriterChoice,
  models: readonly WriterModel[],
): WriterChoice {
  const [provider, slug] = key.split(':');
  const model = models.find(
    (entry) => entry.provider === provider && entry.model === slug,
  );
  const effort =
    model && !model.efforts.includes(current.effort)
      ? model.defaultEffort
      : current.effort;
  return latestWalkthroughWriter(
    selectedWalkthroughWriter(key, effort),
    models,
  );
}

export function isProjectDefaultWriter(
  saved: WriterChoice | undefined,
  writer: WriterChoice,
  models: readonly WriterModel[],
) {
  return (
    saved !== undefined &&
    resolvedWalkthroughWriterKey(saved, models) ===
      walkthroughWriterKey(writer) &&
    saved.effort === writer.effort
  );
}

export function walkthroughEfforts(
  writer: Pick<WriterChoice, 'provider' | 'model'>,
  models: readonly WriterModel[],
): readonly string[] {
  return (
    models.find(
      (model) =>
        model.provider === writer.provider && model.model === writer.model,
    )?.efforts ?? []
  );
}

export function withWalkthroughEffort(writer: WriterChoice, effort: string) {
  return selectedWalkthroughWriter(walkthroughWriterKey(writer), effort);
}

export function walkthroughWriterChoiceStatus(
  writer: WriterChoice,
  models: readonly WriterModel[],
) {
  return walkthroughWriterStatus({
    writer,
    models,
    availability: walkthroughWriterAvailability(writer, models).kind,
  });
}

export type { WalkthroughWriterSettings as WriterSettings } from '@porcelain/contracts/walkthroughs';
export { unsupportedWalkthroughEffortMessage };

export function walkthroughWriterStatus(settings: WalkthroughWriterSettings) {
  const { writer, availability } = settings;
  const model = settings.models.find(
    (entry) =>
      entry.provider === writer.provider && entry.model === writer.model,
  );
  const label = walkthroughWriterLabel(writer, settings.models);
  let block: string | undefined;
  if (availability === 'unsupported-effort')
    block = unsupportedWalkthroughEffortMessage(
      model?.label ?? writer.model,
      writer.effort,
    );
  else if (availability === 'missing-model') block = `${label} is unavailable.`;
  return { availability, label, block };
}

type WriterCheck = {
  failed: boolean;
  noWriters: boolean;
  status: ReturnType<typeof walkthroughWriterStatus> | undefined;
};

export function canRecheckWalkthroughWriters(
  check: WriterCheck,
  signedOut = false,
) {
  return (
    check.failed ||
    check.noWriters ||
    check.status?.availability === 'missing-model' ||
    signedOut
  );
}

export function walkthroughWriterNotice(
  check: WriterCheck,
  existingMessage?: string,
) {
  let message = check.status?.block;
  if (check.failed)
    message = 'Could not check writers on the connected computer.';
  else if (check.noWriters)
    message = 'Sign in to Claude Code or Codex on the connected computer.';
  return message && !existingMessage?.includes(message) ? message : undefined;
}

export function canSaveWalkthroughWriter(input: {
  writer: string;
  effort: string;
  current:
    | {
        provider: string;
        model: string;
        effort: string;
        latest?: string | undefined;
      }
    | undefined;
  project: boolean;
  models: readonly {
    provider: string;
    model: string;
    efforts: readonly string[];
  }[];
}) {
  if (input.writer === 'default') return true;
  const selected = input.models.find(
    (model) =>
      `${model.provider}:${model.model}` ===
      walkthroughWriterKeyModel(input.writer),
  );
  if (selected) return selected.efforts.includes(input.effort);
  return (
    input.project &&
    input.current !== undefined &&
    input.writer === walkthroughWriterKey(input.current) &&
    input.effort === input.current.effort
  );
}
