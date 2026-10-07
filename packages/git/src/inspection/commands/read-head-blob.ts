import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import type { HeadBlob, HeadBlobRequest } from '../dtos/head-blob.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';

const ABSENT = 1;

export const readHeadBlob = Effect.fn('Git.readHeadBlob')(function* (
  session: Pick<EffectCheckoutSession, 'path'>,
  request: HeadBlobRequest,
  limits: GitLimits,
) {
  const oid = yield* readBlobOid(session.path, request.path, limits);
  if (oid === undefined) return { kind: 'missing' } as const;
  return yield* gitRead(session.path, ['cat-file', 'blob', oid], limits, {
    maxBytes: request.maxBytes,
  }).pipe(
    Effect.map((bytes): HeadBlob => ({ kind: 'bytes', bytes })),
    Effect.catchTag('GitOutputLimitError', () =>
      Effect.succeed<HeadBlob>({ kind: 'too-large' }),
    ),
  );
});

const readBlobOid = Effect.fn('Git.readBlobOid')(
  (checkout: string, path: string, limits: GitLimits) =>
    gitRead(
      checkout,
      ['rev-parse', '--verify', '--quiet', `HEAD:${path}`],
      limits,
    ).pipe(
      Effect.map((output) => output.toString('utf8').trim()),
      Effect.catchTag('GitCommandError', (cause) =>
        cause.exitCode === ABSENT
          ? Effect.succeed(undefined)
          : Effect.fail(cause),
      ),
    ),
);
