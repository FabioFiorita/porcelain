import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import { worktreeLabel } from './inventory';

export type CommitSummary = CommitPageResponse['commits'][number];

export type GraphRow = {
  commit: CommitSummary;
  /** Lane the commit's node occupies. */
  lane: number;
  /** Lanes carrying edges away from this row, one per parent. */
  outgoing: number[];
  /** Commit each lane is waiting for after this row. */
  lanesAfter: (string | null)[];
};

/**
 * Lay out the loaded commits like `git log --graph`: keep a lane for every
 * parent still waiting to appear and reuse lanes once a branch is consumed.
 * Parent OIDs are enough to show merges even though the API has no ref list.
 */
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

export function shortOid(oid: string) {
  return oid.slice(0, 7);
}

/** Remove transport-only ref prefixes while retaining remote ownership. */
export function historyRefLabel(ref: string) {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//u, '');
}

/** Format a one-based parent number for merge comparisons. */
export function ordinal(n: number) {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** The history endpoint follows the checked-out branch in its snapshot. */
export function historyFollows(
  head: CommitPageResponse['snapshot']['head'],
): string {
  switch (head.kind) {
    case 'attached':
      return worktreeLabel(head.ref);
    case 'detached':
      return 'Detached HEAD';
    case 'unborn':
      return `No commits yet on ${worktreeLabel(head.ref)}`;
  }
}
