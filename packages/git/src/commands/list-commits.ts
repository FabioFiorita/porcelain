import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CommitPage,
  CommitPageRequest,
  HeadSnapshot,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import {
  COMMIT_FORMAT,
  type ParsedCommit,
  parseCommitRecords,
} from '../mappers/parse-commit.ts';
import { askHistory, readHistory } from '../read-history.ts';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';

const OID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * How many commits a continuation may be anchored to at once.
 *
 * The anchor is the traversal frontier — the commits whose children have all
 * been shown — so its size is the number of branches open at that depth, which
 * is small in any history a person reads. A history wide enough to exceed this
 * restarts rather than quietly dropping the branches that do not fit.
 */
const MAX_FRONTIER = 100;

/**
 * A page of history in one `git log`.
 *
 * The page after this one continues from the traversal frontier: the commits
 * whose children have all been shown. One commit is not enough. In a history
 * with merges, the commit that happens to end a page is not an ancestor of the
 * branches running beside it, so walking from it alone drops them — page one
 * of `merge, main` would be followed by `root`, and `side` would never appear.
 * The frontier is exactly the queue the walk would have held, so continuing
 * from it reaches every commit that has not been shown and none that has.
 *
 * Nothing is signed or stored: the frontier is a handful of object ids, so a
 * list survives a restart, and a page already read cannot shift when commits
 * arrive at the top.
 */
export async function listCommits(
  checkout: HistoryCheckout,
  request: CommitPageRequest,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const { shallow } = await inspectHistoryCheckout(checkout, signal);
  const limit = request.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new InvalidHistoryRequestError();
  const after = request.after ?? [];
  if (after.some((oid) => !OID.test(oid)) || after.length > MAX_FRONTIER)
    throw new InvalidHistoryRequestError();
  if (request.tip !== undefined && !OID.test(request.tip))
    throw new InvalidHistoryRequestError();
  const page =
    after.length === 0 || request.tip === undefined
      ? await readTop(checkout, limit, shallow, signal)
      : await continueFrom(
          checkout,
          request.tip,
          after,
          limit,
          shallow,
          signal,
        );
  // The result does not leave until the checkout it came from is confirmed to
  // still be the one this request was authorised for.
  await confirmHistoryCheckout(checkout, signal);
  return page;
}

async function continueFrom(
  checkout: HistoryCheckout,
  tip: string,
  frontier: string[],
  limit: number,
  shallow: boolean,
  signal?: AbortSignal,
): Promise<CommitPage> {
  // Whether this is still the history the list started in. The question is
  // asked of the tip the reader began at, not of the frontier: commits added
  // since then are all this has to walk, rather than everything above a
  // progressively deeper anchor.
  //
  // A tip that has been pruned away answers the same question — the history
  // that held it is gone — and Git says so by failing to resolve it, which is
  // why an unknown revision counts as a rewrite rather than an error.
  if (
    !(await askHistory(checkout.path, ancestorArguments(tip), signal, {
      // A tip that has been pruned away says the same thing as a tip that is
      // no longer on the branch: the history the list started in is gone.
      missingRevisionIsNo: true,
    }))
  )
    return {
      ...(await readTop(checkout, limit, shallow, signal)),
      restarted: true,
    };
  const parsed = await readLog(checkout, frontier, limit, signal);
  return {
    snapshot: null,
    ...trim(parsed, limit, shallow),
    // The tip the list started at, carried forward: rewrite detection has to
    // keep asking about the same commit, not about this page's newest one.
    tip,
    restarted: false,
  };
}

const ancestorArguments = (tip: string) => [
  'merge-base',
  '--is-ancestor',
  tip,
  'HEAD',
];

async function readTop(
  checkout: HistoryCheckout,
  limit: number,
  shallow: boolean,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const head = await readHeadFile(checkout);
  if (head === null) throw new UnsupportedHistoryDataError();
  const parsed = await readLog(checkout, ['HEAD'], limit, signal).catch(
    async (error: unknown) => {
      // A branch with no commits yet is not a failed read. Confirming it costs
      // one process, and only on the failure path.
      if (
        await askHistory(
          checkout.path,
          ['rev-parse', '--verify', '--quiet', 'HEAD'],
          signal,
        )
      )
        throw error;
      return null;
    },
  );
  if (parsed === null)
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
  const first = parsed[0];
  if (!first) throw new UnsupportedHistoryDataError();
  return {
    snapshot: { tipOid: first.summary.oid, head },
    ...trim(parsed, limit, shallow),
    restarted: false,
  };
}

/**
 * What the page holds, and where the walk had got to when it stopped.
 *
 * One commit more than the page asked for is read, so whether a next page
 * exists is known without a second call. The frontier is every parent of a
 * shown commit that was not itself shown — exactly the commits the walk still
 * had queued — so a continuation resumes the same traversal rather than
 * starting a narrower one.
 */
function trim(
  parsed: readonly ParsedCommit[],
  limit: number,
  shallow: boolean,
): Pick<CommitPage, 'commits' | 'nextAfter' | 'boundary'> & {
  tip: string | null;
} {
  const more = parsed.length > limit;
  const shown = parsed.slice(0, limit).map((entry) => entry.summary);
  const seen = new Set(shown.map((commit) => commit.oid));
  const frontier: string[] = [];
  for (const commit of shown)
    for (const parent of commit.parentOids)
      if (!seen.has(parent) && !frontier.includes(parent))
        frontier.push(parent);
  // More branches are open here than a continuation can name. Reporting no
  // next page would be indistinguishable from reaching the first commit, so
  // the list says why it stops instead of pretending it has finished.
  const tooWide = more && frontier.length > MAX_FRONTIER;
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
  signal?: AbortSignal,
) {
  const output = await readHistory(
    checkout.path,
    [
      'log',
      '--topo-order',
      '-z',
      `--max-count=${limit + 1}`,
      // Decoration is otherwise filtered by repository or global configuration
      // (`log.excludeDecoration`), which would silently drop branch names.
      '--decorate-refs=refs/*',
      `--format=${COMMIT_FORMAT}`,
      ...range,
      '--',
    ],
    signal,
  );
  return parseCommitRecords(output);
}

/**
 * Where HEAD points, read from the administrative file rather than from the
 * commit's decoration: decoration is display configuration, and a repository
 * that excludes `refs/heads/*` from it would make an attached branch look
 * detached.
 */
async function readHeadFile(
  checkout: HistoryCheckout,
): Promise<HeadSnapshot['head'] | null> {
  const text = (
    await readFile(join(checkout.administrativeDirectory, 'HEAD'), 'utf8')
  ).trim();
  const ref = text.match(/^ref: (refs\/.+)$/u);
  if (ref?.[1]) return { kind: 'attached', ref: ref[1] };
  return OID.test(text) ? { kind: 'detached' } : null;
}
