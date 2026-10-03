import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { branchRefName, isBranchRef } from '../../shared/parsers/refs.ts';
import type { BranchBases } from '../dtos/branch-range.ts';
import type { HistoryCheckout } from '../dtos/commit-history.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { readDefaultBase } from './read-default-base.ts';
import { runHistory } from './run-history.ts';

export async function listBranchBases(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchBases> {
  await inspectHistoryCheckout(checkout, gitVersion, signal);
  const output = await runHistory(
    checkout.path,
    [
      'for-each-ref',
      `--count=${limits.history.maxBranchBases}`,
      '--sort=-committerdate',
      '--format=%(refname)%00%(symref)',
      'refs/heads/',
      'refs/remotes/',
    ],
    limits,
    signal,
  );
  const bases = output
    .toString('utf8')
    .split('\n')
    .flatMap((line) => {
      const [ref = '', symbolic = ''] = line.split('\0');
      return symbolic === '' && isBranchRef(ref)
        ? [
            {
              ref,
              name: branchRefName(ref),
              remote: ref.startsWith('refs/remotes/'),
            },
          ]
        : [];
    });
  const found = await readDefaultBase(checkout.path, limits, signal);
  await confirmHistoryCheckout(checkout, signal);
  return { defaultRef: found?.ref ?? null, bases };
}
