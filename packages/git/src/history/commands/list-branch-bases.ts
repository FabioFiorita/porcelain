import { Effect } from 'effect';
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

export const listBranchBases = Effect.fn('Git.listBranchBases')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  limits: GitLimits,
) {
  yield* inspectHistoryCheckout(checkout, gitVersion);
  const output = yield* runHistory(
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
  const found = yield* readDefaultBase(checkout.path, limits);
  yield* confirmHistoryCheckout(checkout);
  return { defaultRef: found?.ref ?? null, bases } satisfies BranchBases;
});
