import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type {
  CommitPage,
  CommitPageRequest,
  CommitSummary,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../../shared/errors/invalid-history-request-error.ts';
import { UnsupportedHistoryDataError } from '../../shared/errors/unsupported-history-data-error.ts';
import { decodeHistory } from '../parsers/decode-history.ts';
import { COMMIT_FORMAT, parseCommitRecords } from '../parsers/parse-commit.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { readHeadFile } from '../../shared/commands/read-head-file.ts';
import { hasHead } from './has-head.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { isHistoryAncestor } from './is-ancestor.ts';
import { runHistory } from './run-history.ts';

export const listCommits = Effect.fn('Git.listCommits')(function* (
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: CommitPageRequest,
  limits: GitLimits,
) {
  const { shallowOids } = yield* inspectHistoryCheckout(checkout, gitVersion);
  const { history } = limits;
  const limit = request.limit ?? history.defaultCommits;
  if (!Number.isInteger(limit) || limit < 1 || limit > history.maxCommits)
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const after = request.after ?? [];
  if (after.some((oid) => !isOid(oid)) || after.length > history.maxFrontier)
    return yield* Effect.fail(new InvalidHistoryRequestError());
  if (request.tip !== undefined && !isOid(request.tip))
    return yield* Effect.fail(new InvalidHistoryRequestError());
  const page =
    after.length === 0 || request.tip === undefined
      ? yield* readTop(checkout, limit, limits)
      : yield* continueFrom(checkout, request.tip, after, limit, limits);
  if (page.nextAfter === null && page.tip !== null && page.boundary === null)
    for (const shallow of shallowOids)
      if (yield* isHistoryAncestor(checkout.path, shallow, page.tip, limits)) {
        page.boundary = 'shallow';
        break;
      }
  yield* confirmHistoryCheckout(checkout);
  return page;
});

const continueFrom = Effect.fn('Git.continueFrom')(function* (
  checkout: HistoryCheckout,
  tip: string,
  frontier: readonly string[],
  limit: number,
  limits: GitLimits,
) {
  if (!(yield* isHistoryAncestor(checkout.path, tip, 'HEAD', limits)))
    return {
      ...(yield* readTop(checkout, limit, limits)),
      restarted: true,
    } satisfies CommitPage;
  const skipped = (yield* decodeHistory(
    yield* runHistory(
      checkout.path,
      ['rev-list', '--count', tip, '--not', ...frontier, '--'],
      limits,
    ),
  )).trim();
  const offset = Number(skipped);
  if (!/^\d+$/u.test(skipped) || !Number.isSafeInteger(offset))
    return yield* Effect.fail(new UnsupportedHistoryDataError());
  const parsed = yield* readLog(checkout, [tip], limit, limits, offset);
  return {
    snapshot: null,
    ...trim(parsed, limit, frontier, limits),
    tip,
    restarted: false,
  } satisfies CommitPage;
});

const readTop = Effect.fn('Git.readTop')(function* (
  checkout: HistoryCheckout,
  limit: number,
  limits: GitLimits,
) {
  const head = yield* readHeadFile(checkout.administrativeDirectory);
  if (head === undefined)
    return yield* Effect.fail(new UnsupportedHistoryDataError());
  const parsed = yield* readLog(checkout, ['HEAD'], limit, limits).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        if (yield* hasHead(checkout.path, limits))
          return yield* Effect.fail(error);
        return undefined;
      }),
    ),
  );
  if (parsed === undefined)
    return {
      snapshot:
        head.kind === 'attached'
          ? { tipOid: null, head: { kind: 'unborn', ref: head.ref } }
          : { tipOid: null, head: { kind: 'detached' } },
      commits: [],
      nextAfter: null,
      tip: null,
      boundary: null,
      restarted: false,
    } satisfies CommitPage;
  const [first] = parsed;
  if (!first) return yield* Effect.fail(new UnsupportedHistoryDataError());
  return {
    snapshot: { tipOid: first.oid, head },
    ...trim(parsed, limit, [], limits),
    restarted: false,
  } satisfies CommitPage;
});

function trim(
  parsed: readonly CommitSummary[],
  limit: number,
  previousFrontier: readonly string[],
  limits: GitLimits,
): Pick<CommitPage, 'commits' | 'nextAfter' | 'boundary'> & {
  tip: string | null;
} {
  const more = parsed.length > limit;
  const shown = parsed.slice(0, limit);
  const seen = new Set(shown.map((commit) => commit.oid));
  const frontier = previousFrontier.filter((oid) => !seen.has(oid));
  for (const commit of shown)
    for (const parent of commit.parentOids)
      if (!seen.has(parent) && !frontier.includes(parent))
        frontier.push(parent);
  const tooWide = more && frontier.length > limits.history.maxFrontier;
  const continues = more && frontier.length > 0 && !tooWide;
  return {
    commits: shown,
    nextAfter: continues ? frontier : null,
    tip: shown[0]?.oid ?? null,
    boundary: tooWide ? 'wide' : null,
  };
}

const readLog = Effect.fn('Git.readLog')(function* (
  checkout: HistoryCheckout,
  range: readonly string[],
  limit: number,
  limits: GitLimits,
  offset = 0,
) {
  const output = yield* runHistory(
    checkout.path,
    [
      'log',
      '--topo-order',
      '-z',
      `--max-count=${limit + 1}`,
      `--skip=${offset}`,
      '--decorate=full',
      '--decorate-refs=refs/*',
      '--decorate-refs=HEAD',
      `--format=${COMMIT_FORMAT}`,
      ...range,
      '--',
    ],
    limits,
  );
  return yield* parseCommitRecords(yield* decodeHistory(output), limits);
});
