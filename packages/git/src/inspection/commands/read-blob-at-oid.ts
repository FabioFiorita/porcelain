import { Effect } from 'effect';
import { isOid } from '../../shared/parsers/oid.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import type { BlobAtOid, BlobAtOidRequest } from '../dtos/blob-at-oid.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';

const ABSENT = 1;

export const readBlobAtOid = Effect.fn('Git.readBlobAtOid')(function* (
  session: Pick<EffectCheckoutSession, 'path'>,
  request: BlobAtOidRequest,
  limits: GitLimits,
) {
  if (
    (request.oid !== 'HEAD' && !isOid(request.oid)) ||
    request.path.includes('\0') ||
    request.path.startsWith('/') ||
    request.path.split('/').includes('..') ||
    !Number.isSafeInteger(request.maxBytes) ||
    request.maxBytes < 1
  )
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const oid = yield* readBlobOid(
    session.path,
    request.oid,
    request.path,
    limits,
  );
  if (oid === undefined) return { kind: 'missing' } as const;
  const type = (yield* gitRead(session.path, ['cat-file', '-t', oid], limits))
    .toString('utf8')
    .trim();
  if (type !== 'blob') return { kind: 'missing' } as const;
  return yield* gitRead(session.path, ['cat-file', 'blob', oid], limits, {
    maxBytes: request.maxBytes,
  }).pipe(
    Effect.map((bytes): BlobAtOid => ({ kind: 'bytes', bytes, blobOid: oid })),
    Effect.catchTag('GitOutputLimitError', () =>
      Effect.succeed<BlobAtOid>({ kind: 'too-large', blobOid: oid }),
    ),
  );
});

const readBlobOid = Effect.fn('Git.readBlobOid')(
  (checkout: string, oid: string, path: string, limits: GitLimits) =>
    gitRead(
      checkout,
      ['rev-parse', '--verify', '--quiet', `${oid}:${path}`],
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
