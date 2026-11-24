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
