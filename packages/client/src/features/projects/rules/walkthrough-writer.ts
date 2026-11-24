import * as Schema from 'effect/Schema';
import {
  writerSchema,
  unsupportedWalkthroughEffortMessage,
  type WalkthroughWriterSettings,
} from '@porcelain/contracts/walkthroughs';

export const selectedWalkthroughWriter = (key: string, effort: string) => {
  const [provider, model] = key.split(':');
  return Schema.decodeUnknownSync(writerSchema)({ provider, model, effort });
};

export type { WalkthroughWriterSettings as WriterSettings } from '@porcelain/contracts/walkthroughs';
export { unsupportedWalkthroughEffortMessage };

export function walkthroughWriterStatus(settings: WalkthroughWriterSettings) {
  const { writer, availability } = settings;
  const model = settings.models.find(
    (entry) =>
      entry.provider === writer.provider && entry.model === writer.model,
  );
  const provider = writer.provider === 'claude' ? 'Claude' : 'Codex';
  const label = `${provider} / ${model?.label ?? writer.model} · ${writer.effort}`;
  let block: string | undefined;
  if (availability === 'unsupported-effort')
    block = unsupportedWalkthroughEffortMessage(
      model?.label ?? writer.model,
      writer.effort,
    );
  else if (availability === 'missing-model') block = `${label} is unavailable.`;
  return { availability, label, block };
}

export function walkthroughWriterNotice(
  check: {
    failed: boolean;
    status: ReturnType<typeof walkthroughWriterStatus> | undefined;
  },
  existingMessage?: string,
) {
  const message = check.failed
    ? 'Could not check writers on the connected computer.'
    : check.status?.block;
  return message && !existingMessage?.includes(message) ? message : undefined;
}

export function canSaveWalkthroughWriter(input: {
  writer: string;
  effort: string;
  current: { provider: string; model: string; effort: string } | undefined;
  project: boolean;
  models: readonly {
    provider: string;
    model: string;
    efforts: readonly string[];
  }[];
}) {
  if (input.writer === 'default') return true;
  const selected = input.models.find(
    (model) => `${model.provider}:${model.model}` === input.writer,
  );
  if (selected) return selected.efforts.includes(input.effort);
  return (
    input.project &&
    input.current !== undefined &&
    input.writer === `${input.current.provider}:${input.current.model}` &&
    input.effort === input.current.effort
  );
}
