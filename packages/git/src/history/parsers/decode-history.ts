import { Effect } from 'effect';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';

export const decodeHistory = Effect.fn('Git.decodeHistory')((output: Buffer) =>
  Effect.try({
    try: () => new TextDecoder('utf8', { fatal: true }).decode(output),
    catch: (cause) => new UnsupportedHistoryDataError({ cause }),
  }),
);
