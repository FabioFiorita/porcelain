import { Effect } from 'effect';
import { readHeadFile } from '../../shared/commands/read-head-file.ts';

export const readHead = Effect.fn('Git.readHead')(function* (
  administrativeDirectory: string,
) {
  return yield* readHeadFile(administrativeDirectory).pipe(
    Effect.map((head) => (head?.kind === 'attached' ? head.ref : null)),
    Effect.orElseSucceed(() => null),
  );
});
