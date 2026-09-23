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

const MAX_FRONTIER = 100;

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
  if (
    !(await askHistory(checkout.path, ancestorArguments(tip), signal, {
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
      '--decorate-refs=refs/*',
      `--format=${COMMIT_FORMAT}`,
      ...range,
      '--',
    ],
    signal,
  );
  return parseCommitRecords(output);
}

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
