import type { CommitCursor, CommitCursorCodec } from '../commit-cursor.ts';
import type {
  CommitPage,
  CommitPageRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';
import { inspectHistoryCheckout } from './inspect-history-checkout.ts';
import { readCommit, readHead } from './read-commit.ts';

export async function listCommits(
  checkout: HistoryCheckout,
  codec: CommitCursorCodec,
  request: CommitPageRequest,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const graph = await inspectHistoryCheckout(checkout, signal);
  const cursor = request.cursor
    ? codec.decode(request.cursor, checkout.scope)
    : null;
  const limit = request.limit ?? cursor?.limit ?? 50;
  validatePage(limit, cursor, graph);
  const snapshot = cursor?.snapshot ?? (await readHead(checkout.path, signal));
  if (!snapshot.tipOid || snapshot.head.kind === 'unborn') {
    if ((await inspectHistoryCheckout(checkout, signal)) !== graph)
      throw new HistorySnapshotUnavailableError();
    return { snapshot, commits: [], nextCursor: null, boundary: null };
  }
  const offset = cursor?.offset ?? 0;
  const output = await executeHistoryCommand(
    checkout.path,
    [
      'rev-list',
      '--topo-order',
      `--skip=${offset}`,
      `--max-count=${limit + 1}`,
      snapshot.tipOid,
      '--',
    ],
    signal,
  );
  const oids = output.trim().split('\n').filter(Boolean);
  const commits = [];
  for (const oid of oids.slice(0, limit))
    commits.push(await readCommit(checkout.path, oid, signal));
  const more = oids.length > limit;
  const shallow =
    (
      await executeHistoryCommand(
        checkout.path,
        ['rev-parse', '--is-shallow-repository'],
        signal,
      )
    ).trim() === 'true';
  const result: CommitPage = {
    snapshot,
    commits,
    nextCursor: more
      ? codec.encode({
          version: 1,
          scope: checkout.scope,
          graph,
          offset: offset + commits.length,
          limit,
          snapshot: { tipOid: snapshot.tipOid, head: snapshot.head },
        })
      : null,
    boundary: !more && shallow ? 'shallow' : null,
  };
  if ((await inspectHistoryCheckout(checkout, signal)) !== graph)
    throw new HistorySnapshotUnavailableError();
  if (Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024)
    throw new ReadLimitExceededError();
  return result;
}

function validatePage(
  limit: number,
  cursor: CommitCursor | null,
  graph: string,
): void {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (cursor && limit !== cursor.limit)
  )
    throw new InvalidHistoryRequestError();
  if (cursor && cursor.graph !== graph)
    throw new HistorySnapshotUnavailableError();
}
