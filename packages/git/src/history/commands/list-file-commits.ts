import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import type {
  FileCommits,
  FileCommitsRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';
import { decodeHistory } from '../parsers/decode-history.ts';
import { COMMIT_FORMAT } from '../parsers/parse-commit.ts';
import { parseFileCommits } from '../parsers/parse-file-commits.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { diffFlags } from './read-commit-files.ts';
import { readHistoryAnswer, runHistory } from './run-history.ts';

const MISSING = 1;

export const listFileCommits = Effect.fn('Git.listFileCommits')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: FileCommitsRequest,
  limits: GitLimits,
) {
  yield* inspectHistoryCheckout(checkout, gitVersion);
  const limit = request.limit ?? limits.history.defaultCommits;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > limits.history.maxCommits ||
    request.path === ''
  )
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const tip = yield* readHead(checkout, limits);
  const commits =
    tip === undefined
      ? []
      : yield* parseFileCommits(
          yield* runHistory(
            checkout.path,
            [
              'log',
              '-z',
              '--raw',
              ...diffFlags(limits),
              '--diff-merges=first-parent',
              '--follow',
              `--max-count=${limit + 1}`,
              '--decorate-refs=refs/*',
              `--format=${COMMIT_FORMAT}`,
              tip,
              '--',
              request.path,
            ],
            limits,
          ),
          request.path,
          limits,
        );
  yield* confirmHistoryCheckout(checkout);
  return {
    commits: commits.slice(0, limit),
    more: commits.length > limit,
  } satisfies FileCommits;
});

const readHead = Effect.fn('Git.readHead')(function* (
  checkout: HistoryCheckout,
  limits: GitLimits,
) {
  const output = yield* readHistoryAnswer(
    checkout.path,
    ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
    limits,
    (failure) => failure.exitCode === MISSING,
  );
  if (output === null) return undefined;
  const oid = (yield* decodeHistory(output)).trim();
  if (!isOid(oid)) return yield* Effect.fail(new UnsupportedHistoryDataError());
  return oid;
});
