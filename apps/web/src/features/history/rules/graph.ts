import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import {
  HISTORY_GRAPH_INSET,
  HISTORY_LANE_WIDTH,
  HISTORY_OID_LENGTH,
  HISTORY_ORDINAL_CENTURY,
  HISTORY_ORDINAL_DECADE,
  HISTORY_ORDINAL_TEENS_END,
  HISTORY_ORDINAL_TEENS_START,
} from '@/config/limits';
type CommitSummary = ListCommitsResponse['commits'][number];
export type GraphRow = {
  commit: CommitSummary;
  lane: number;
  outgoing: number[];
  lanesAfter: (string | null)[];
};

export function layoutGraph(commits: readonly CommitSummary[]): GraphRow[] {
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];

  const claim = () => {
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (const commit of commits) {
    const waiting = lanes.flatMap((oid, index) =>
      oid === commit.oid ? [index] : [],
    );
    for (const index of waiting) lanes[index] = null;
    const lane = waiting.length > 0 ? Math.min(...waiting) : claim();

    const outgoing = commit.parentOids.map((parent, index) => {
      const existing = lanes.indexOf(parent);
      const target = index === 0 ? lane : existing !== -1 ? existing : claim();
      lanes[target] = parent;
      return target;
    });

    rows.push({ commit, lane, outgoing, lanesAfter: [...lanes] });
  }

  return rows;
}

export function historyGraphWidth(rows: readonly GraphRow[]) {
  const occupiedLanes = rows.flatMap((row) => [
    row.lane,
    ...row.outgoing,
    ...row.lanesAfter.flatMap((waitingFor, lane) =>
      waitingFor == null ? [] : [lane],
    ),
  ]);
  return (
    HISTORY_GRAPH_INSET +
    HISTORY_GRAPH_INSET +
    Math.max(0, ...occupiedLanes) * HISTORY_LANE_WIDTH
  );
}

export function shortOid(oid: string) {
  return oid.slice(0, HISTORY_OID_LENGTH);
}

export function historyRefLabel(ref: string) {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//u, '');
}

export function ordinal(n: number) {
  const tens = n % HISTORY_ORDINAL_CENTURY;
  const suffix =
    tens >= HISTORY_ORDINAL_TEENS_START && tens <= HISTORY_ORDINAL_TEENS_END
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % HISTORY_ORDINAL_DECADE] ?? 'th');
  return `${n}${suffix}`;
}

export function historyFollows(
  snapshot: ListCommitsResponse['snapshot'],
  branchLabel: (ref: string) => string,
) {
  if (!snapshot) return 'This branch';
  const head = snapshot.head;
  switch (head.kind) {
    case 'attached':
      return branchLabel(head.ref);
    case 'detached':
      return 'Detached HEAD';
    case 'unborn':
      return `No commits yet on ${branchLabel(head.ref)}`;
  }
}
