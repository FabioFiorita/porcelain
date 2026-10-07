import { Effect, FileSystem, Path } from 'effect';
import { createHash } from 'node:crypto';
import { isMissing } from '../../shared/errors/is-missing.ts';
import {
  readCommonDirectory,
  readGitDirectory,
} from '../../shared/commands/gitdir.ts';
import { identity } from '../../shared/commands/identity.ts';
import type {
  HistoryCheckout,
  HistorySnapshot,
} from '../dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from '../../shared/errors/history-worktree-unavailable-error.ts';

export const confirmHistoryCheckout = Effect.fn('Git.confirmHistoryCheckout')(
  function* (checkout: HistoryCheckout) {
    const gitDirectory = yield* readGitDirectory(checkout.path);
    if (gitDirectory === undefined)
      return yield* Effect.fail(new HistoryWorktreeUnavailableError());
    const common = yield* readCommonDirectory(gitDirectory);
    if (
      (yield* identity(gitDirectory)) !== checkout.metadataIdentity ||
      (yield* identity(common)) !== checkout.repositoryIdentity
    )
      return yield* Effect.fail(new HistoryWorktreeUnavailableError());
    return { common };
  },
  Effect.mapError((cause) =>
    cause instanceof HistoryWorktreeUnavailableError
      ? cause
      : new HistoryWorktreeUnavailableError({ cause }),
  ),
);

export const inspectHistoryCheckout = Effect.fn('Git.inspectHistoryCheckout')(
  function* (checkout: HistoryCheckout, gitVersion: Buffer) {
    const { common } = yield* confirmHistoryCheckout(checkout);
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const shallow = yield* fs.readFile(path.join(common, 'shallow')).pipe(
      Effect.catchIf(isMissing, () => Effect.succeed(new Uint8Array())),
      Effect.mapError(
        (cause) => new HistoryWorktreeUnavailableError({ cause }),
      ),
    );
    return {
      graph: createHash('sha256')
        .update(gitVersion)
        .update(shallow)
        .digest('hex'),
      shallow: shallow.length > 0,
    } satisfies HistorySnapshot;
  },
);
