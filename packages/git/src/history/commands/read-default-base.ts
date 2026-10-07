import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { isBranchRef } from '../../shared/parsers/refs.ts';
import { readHistoryAnswer, runHistory } from './run-history.ts';

const ABSENT = 1;
const REMOTE_HEAD = 'refs/remotes/origin/HEAD';
const REMOTE_PREFIX = 'refs/remotes/origin/';
const REMOTE_FALLBACKS = [
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
];
const LOCAL_FALLBACKS = ['refs/heads/main', 'refs/heads/master'];

export const readDefaultBase = Effect.fn('Git.readDefaultBase')(function* (
  path: string,
  limits: GitLimits,
) {
  const remoteHead = (yield* readHistoryAnswer(
    path,
    ['symbolic-ref', '--quiet', REMOTE_HEAD],
    limits,
    (failure) => failure.exitCode === ABSENT,
  ))
    ?.toString('utf8')
    .trim();
  const candidates = [
    ...(remoteHead?.startsWith(REMOTE_PREFIX) ? [remoteHead] : []),
    ...REMOTE_FALLBACKS,
    ...LOCAL_FALLBACKS,
  ].filter(isBranchRef);
  const found = yield* lookupBranchRefs(path, candidates, limits);
  for (const ref of candidates) {
    const oid = found.get(ref);
    if (oid !== undefined) return { ref, oid };
  }
  return null;
});

export const lookupBranchRefs = Effect.fn('Git.lookupBranchRefs')(function* (
  path: string,
  refs: readonly string[],
  limits: GitLimits,
) {
  const wanted = new Set(refs.filter(isBranchRef));
  if (wanted.size === 0) return new Map<string, string>();
  const output = yield* runHistory(
    path,
    [
      'for-each-ref',
      '--format=%(refname)%00%(objecttype)%00%(objectname)',
      '--',
      ...wanted,
    ],
    limits,
  );
  const found = new Map<string, string>();
  for (const line of output.toString('utf8').split('\n')) {
    const [ref = '', type = '', oid = ''] = line.split('\0');
    if (wanted.has(ref) && type === 'commit' && isOid(oid)) found.set(ref, oid);
  }
  return found;
});
