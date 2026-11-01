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
import { isHistoryAncestor } from './is-ancestor.ts';

const MISSING = 1;

export const listFileCommits = Effect.fn('Git.listFileCommits')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: FileCommitsRequest,
  limits: GitLimits,
) {
  const { shallowOids } = yield* inspectHistoryCheckout(checkout, gitVersion);
  const limit = request.limit ?? limits.history.defaultCommits;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > limits.history.maxCommits ||
    request.path === '' ||
    (request.after !== undefined &&
      (!isOid(request.after.tip) ||
        !Number.isSafeInteger(request.after.offset) ||
        request.after.offset < 1 ||
        request.after.offset > Number.MAX_SAFE_INTEGER - limit - 1))
  )
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const head = yield* readHead(checkout, limits);
  const restarted =
    request.after !== undefined &&
    (head === undefined ||
      !(yield* isHistoryAncestor(
        checkout.path,
        request.after.tip,
        'HEAD',
        limits,
      )));
  const tip = restarted ? head : (request.after?.tip ?? head);
  const offset = restarted ? 0 : (request.after?.offset ?? 0);
  const rawLimit = offset + limit + 1;
  const parsed =
    tip === undefined
      ? { commits: [], records: 0, reachedCreation: true }
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
              `--max-count=${rawLimit}`,
              '--decorate=full',
              '--decorate-refs=refs/*',
              '--decorate-refs=HEAD',
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
  const candidates = parsed.commits.filter((entry) => entry.position >= offset);
  const lookahead = candidates[limit];
  const nextOffset =
    lookahead?.position ??
    (!parsed.reachedCreation && parsed.records === rawLimit
      ? parsed.records
      : null);
  return {
    commits: candidates.slice(0, limit).map(({ entry }) => entry),
    nextAfter:
      nextOffset !== null && tip !== undefined
        ? { tip, offset: nextOffset }
        : null,
    tip: tip ?? null,
    boundary:
      nextOffset === null &&
      parsed.commits.some(({ entry }) => shallowOids.includes(entry.commit.oid))
        ? 'shallow'
        : null,
    restarted,
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
