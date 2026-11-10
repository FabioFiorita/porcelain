import * as Schema from 'effect/Schema';
import { writerSchema } from '@porcelain/contracts/walkthroughs';
export const selectedWalkthroughWriter = (key: string, effort: string) => {
  const [provider, model] = key.split(':');
  return Schema.decodeUnknownSync(writerSchema)({ provider, model, effort });
};

export type { WalkthroughWriterSettings as WriterSettings } from '@porcelain/contracts/walkthroughs';

export function canSaveWalkthroughWriter(input: {
  writer: string;
  effort: string;
  current: { provider: string; model: string; effort: string } | undefined;
  project: boolean;
  models: readonly { provider: string; model: string }[];
}) {
  return (
    (input.project &&
      input.current !== undefined &&
      input.writer === `${input.current.provider}:${input.current.model}` &&
      input.effort === input.current.effort) ||
    input.writer === 'default' ||
    input.models.some(
      (model) => `${model.provider}:${model.model}` === input.writer,
    )
  );
}
