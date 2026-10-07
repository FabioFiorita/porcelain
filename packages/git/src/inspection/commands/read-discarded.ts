import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';
import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitDiscardedChange } from '../dtos/git-status.ts';
import { parseDiscarded } from '../parsers/parse-discarded.ts';
import { parseObjectBatch } from '../parsers/parse-object-batch.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { DISCARDED_REF_PREFIX } from '../../shared/parsers/recovery-blob.ts';
import { runInspection } from './run-inspection.ts';

export const readDiscarded = Effect.fn('Git.readDiscarded')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const oids = (yield* runInspection(
    checkout,
    [
      'for-each-ref',
      '--sort=-creatordate',
      `--count=${limits.inspection.maxDiscarded}`,
      '--format=%(objectname)%00%(refname)',
      DISCARDED_REF_PREFIX,
    ],
    limits,
    { maxBytes: limits.inspection.discardedRefsBytes },
  ))
    .toString('utf8')
    .split('\n')
    .flatMap((line) => {
      const [oid = '', ref = ''] = line.split('\0');
      return isOid(oid) && ref.startsWith(DISCARDED_REF_PREFIX) ? [oid] : [];
    });
  if (oids.length === 0) return [];
  const batch = yield* runInspection(
    checkout,
    ['cat-file', '--batch'],
    limits,
    {
      maxBytes: limits.inspection.discardedBlobsBytes,
      input: Buffer.from(`${oids.join('\n')}\n`),
    },
  ).pipe(
    Effect.catchIf(
      (error): error is InspectionLimitError =>
        error instanceof InspectionLimitError,
      () => Effect.succeed(undefined),
    ),
  );
  if (batch === undefined)
    return oids.map((oid): GitDiscardedChange => ({
      oid,
      path: 'discarded change',
      kind: 'hunk',
    }));
  const bodies = parseObjectBatch(batch, oids);
  return oids.flatMap((oid) => {
    const body = bodies.get(oid);
    const described = body === undefined ? undefined : parseDiscarded(body);
    return described ? [{ oid, ...described }] : [];
  });
});
