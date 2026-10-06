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

export async function listFileCommits(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: FileCommitsRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<FileCommits> {
  await inspectHistoryCheckout(checkout, gitVersion, signal);
  const limit = request.limit ?? limits.history.defaultCommits;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > limits.history.maxCommits ||
    request.path === ''
  )
    throw new InvalidHistoryRequestError();
  const tip = await readHead(checkout, limits, signal);
  const commits =
    tip === undefined
      ? []
      : parseFileCommits(
          await runHistory(
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
            signal,
          ),
          request.path,
          limits,
        );
  await confirmHistoryCheckout(checkout, signal);
  return { commits: commits.slice(0, limit), more: commits.length > limit };
}

async function readHead(
  checkout: HistoryCheckout,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const output = await readHistoryAnswer(
    checkout.path,
    ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
    limits,
    signal,
    (failure) => failure.exitCode === MISSING,
  );
  if (output === null) return undefined;
  const oid = decodeHistory(output).trim();
  if (!isOid(oid)) throw new UnsupportedHistoryDataError();
  return oid;
}
