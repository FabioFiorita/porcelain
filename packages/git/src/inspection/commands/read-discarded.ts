import type { GitDiscardedChange } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import { parseDiscarded } from '../parsers/parse-discarded.ts';
import { parseObjectBatch } from '../parsers/parse-object-batch.ts';
import { isOid } from '../../shared/oid.ts';
import { DISCARDED_REF_PREFIX } from '../../shared/recovery-blob.ts';
import { runInspection } from './run-inspection.ts';

export async function readDiscarded(
  checkout: string,
  signal?: AbortSignal,
): Promise<GitDiscardedChange[]> {
  const oids = (
    await runInspection(
      checkout,
      [
        'for-each-ref',
        '--sort=-creatordate',
        '--count=50',
        '--format=%(objectname)%00%(refname)',
        DISCARDED_REF_PREFIX,
      ],
      signal,
      { maxBytes: 64 * 1024 },
    )
  )
    .toString('utf8')
    .split('\n')
    .flatMap((line) => {
      const [oid = '', ref = ''] = line.split('\0');
      return isOid(oid) && ref.startsWith(DISCARDED_REF_PREFIX) ? [oid] : [];
    });
  if (oids.length === 0) return [];
  let batch: Buffer;
  try {
    batch = await runInspection(checkout, ['cat-file', '--batch'], signal, {
      maxBytes: 4 * 1024 * 1024,
      input: Buffer.from(`${oids.join('\n')}\n`),
    });
  } catch (cause) {
    if (!(cause instanceof InspectionLimitError)) throw cause;
    return oids.map((oid) => ({ oid, path: 'discarded change', kind: 'hunk' }));
  }
  const bodies = parseObjectBatch(batch, oids);
  return oids.flatMap((oid) => {
    const body = bodies.get(oid);
    const described = body === undefined ? undefined : parseDiscarded(body);
    return described ? [{ oid, ...described }] : [];
  });
}
