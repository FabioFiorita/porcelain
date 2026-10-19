import { Effect } from 'effect';
import { gitRead, gitWrite } from '../../shared/commands/run-git.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';

export const pinReviewRevision = Effect.fn('Git.pinReviewRevision')(function* (
  commonDirectory: string,
  input: { reviewId: string; revision: number; headOid: string },
  limits: GitLimits,
) {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.reviewId) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 1 ||
    !isOid(input.headOid)
  )
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const ref = `refs/porcelain/reviews/${input.reviewId}/${input.revision}`;
  const commit = (yield* gitRead(
    commonDirectory,
    ['rev-parse', '--verify', `${input.headOid}^{commit}`],
    limits,
  ))
    .toString('utf8')
    .trim();
  if (commit !== input.headOid)
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const existing = yield* gitRead(
    commonDirectory,
    ['rev-parse', '--verify', '--quiet', ref],
    limits,
  ).pipe(
    Effect.map((bytes) => bytes.toString('utf8').trim()),
    Effect.catchTag('GitCommandError', (error) =>
      error.exitCode === 1 ? Effect.succeed(undefined) : Effect.fail(error),
    ),
  );
  if (existing === input.headOid) return;
  if (existing !== undefined)
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const result = yield* gitWrite(
    commonDirectory,
    ['update-ref', ref, input.headOid, '0'.repeat(input.headOid.length)],
    limits,
  );
  if (result.exitCode !== 0) {
    const pinned = yield* gitRead(
      commonDirectory,
      ['rev-parse', '--verify', '--quiet', ref],
      limits,
    ).pipe(Effect.map((bytes) => bytes.toString('utf8').trim()));
    if (pinned !== input.headOid)
      return yield* Effect.fail(new InvalidHistoryRequestError());
  }
});
