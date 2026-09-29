import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { isBranchRef } from '../../shared/parsers/refs.ts';
import { readHistoryAnswer, runHistory } from './run-history.ts';

const ABSENT = 1;
const REMOTE_HEAD = 'refs/remotes/origin/HEAD';
const REMOTE_PREFIX = 'refs/remotes/origin/';
const FALLBACKS = ['refs/heads/main', 'refs/heads/master'];

export async function readDefaultBase(
  path: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<{ ref: string; oid: string } | null> {
  const remoteHead = (
    await readHistoryAnswer(
      path,
      ['symbolic-ref', '--quiet', REMOTE_HEAD],
      limits,
      signal,
      (failure) => failure.exitCode === ABSENT,
    )
  )
    ?.toString('utf8')
    .trim();
  const candidates = [
    ...(remoteHead?.startsWith(REMOTE_PREFIX)
      ? [`refs/heads/${remoteHead.slice(REMOTE_PREFIX.length)}`, remoteHead]
      : []),
    ...FALLBACKS,
  ].filter(isBranchRef);
  const found = await lookupBranchRefs(path, candidates, limits, signal);
  for (const ref of candidates) {
    const oid = found.get(ref);
    if (oid !== undefined) return { ref, oid };
  }
  return null;
}

export async function lookupBranchRefs(
  path: string,
  refs: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const wanted = new Set(refs.filter(isBranchRef));
  if (wanted.size === 0) return new Map();
  const output = await runHistory(
    path,
    [
      'for-each-ref',
      '--format=%(refname)%00%(objecttype)%00%(objectname)',
      '--',
      ...wanted,
    ],
    limits,
    signal,
  );
  const found = new Map<string, string>();
  for (const line of output.toString('utf8').split('\n')) {
    const [ref = '', type = '', oid = ''] = line.split('\0');
    if (wanted.has(ref) && type === 'commit' && isOid(oid)) found.set(ref, oid);
  }
  return found;
}
