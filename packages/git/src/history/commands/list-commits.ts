import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type {
  CommitPage,
  CommitPageRequest,
  CommitSummary,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { decodeHistory } from '../parsers/decode-history.ts';
import { COMMIT_FORMAT, parseCommitRecords } from '../parsers/parse-commit.ts';
import { isOid } from '../../shared/parsers/oid.ts';
import { readHeadFile } from '../../shared/commands/read-head-file.ts';
import { hasHead } from './has-head.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';
import { isAncestorOfHead } from './is-ancestor.ts';
import { runHistory } from './run-history.ts';

export async function listCommits(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  request: CommitPageRequest,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const { shallow } = await inspectHistoryCheckout(
    checkout,
    gitVersion,
    signal,
  );
  const { history } = limits;
  const limit = request.limit ?? history.defaultCommits;
  if (!Number.isInteger(limit) || limit < 1 || limit > history.maxCommits)
    throw new InvalidHistoryRequestError();
  const after = request.after ?? [];
  if (after.some((oid) => !isOid(oid)) || after.length > history.maxFrontier)
    throw new InvalidHistoryRequestError();
  if (request.tip !== undefined && !isOid(request.tip))
    throw new InvalidHistoryRequestError();
  const page =
    after.length === 0 || request.tip === undefined
      ? await readTop(checkout, limit, shallow, limits, signal)
      : await continueFrom(
          checkout,
          request.tip,
          after,
          limit,
          shallow,
          limits,
          signal,
        );
  await confirmHistoryCheckout(checkout, signal);
  return page;
}

async function continueFrom(
  checkout: HistoryCheckout,
  tip: string,
  frontier: string[],
  limit: number,
  shallow: boolean,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<CommitPage> {
  if (!(await isAncestorOfHead(checkout.path, tip, limits, signal)))
    return {
      ...(await readTop(checkout, limit, shallow, limits, signal)),
      restarted: true,
    };
  const parsed = await readLog(checkout, frontier, limit, limits, signal);
  return {
    snapshot: null,
    ...trim(parsed, limit, shallow, limits),
    tip,
    restarted: false,
  };
}

async function readTop(
  checkout: HistoryCheckout,
  limit: number,
  shallow: boolean,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const head = await readHeadFile(checkout.administrativeDirectory);
  if (head === undefined) throw new UnsupportedHistoryDataError();
  const parsed = await readLog(checkout, ['HEAD'], limit, limits, signal).catch(
    async (error: unknown) => {
      if (await hasHead(checkout.path, limits, signal)) throw error;
      return undefined;
    },
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
    };
  const [first] = parsed;
  if (!first) throw new UnsupportedHistoryDataError();
  return {
    snapshot: { tipOid: first.oid, head },
    ...trim(parsed, limit, shallow, limits),
    restarted: false,
  };
}

function trim(
  parsed: readonly CommitSummary[],
  limit: number,
  shallow: boolean,
  limits: GitLimits,
): Pick<CommitPage, 'commits' | 'nextAfter' | 'boundary'> & {
  tip: string | null;
} {
  const more = parsed.length > limit;
  const shown = parsed.slice(0, limit);
  const seen = new Set(shown.map((commit) => commit.oid));
  const frontier: string[] = [];
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
    boundary: tooWide ? 'wide' : !more && shallow ? 'shallow' : null,
  };
}

async function readLog(
  checkout: HistoryCheckout,
  range: readonly string[],
  limit: number,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<CommitSummary[]> {
  const output = await runHistory(
    checkout.path,
    [
      'log',
      '--topo-order',
      '-z',
      `--max-count=${limit + 1}`,
      '--decorate-refs=refs/*',
      `--format=${COMMIT_FORMAT}`,
      ...range,
      '--',
    ],
    limits,
    signal,
  );
  return parseCommitRecords(decodeHistory(output), limits);
}
