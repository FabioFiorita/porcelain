import type {
  CommitPageResponse,
  CommitSummary,
} from '../contracts/commit-history';
import { worktreeLabel } from './inventory';

export type GraphRow = {
  commit: CommitSummary;
  /** Lane the commit's dot sits in. */
  lane: number;
  /** Lanes the edges leaving this row occupy, one per parent. */
  outgoing: number[];
  /** Which commit each lane is waiting for after this row. */
  lanesAfter: (string | null)[];
};

/**
 * Lane assignment the way `git log --graph` does it: walk newest to oldest,
 * keep a slot per branch still waiting for its next commit, reuse freed slots.
 */
export function layoutGraph(commits: readonly CommitSummary[]): GraphRow[] {
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];

  const claim = (): number => {
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

export const shortOid = (oid: string) => oid.slice(0, 7);

/** What History walks from. v1 only shows the checked-out branch. */
export function historyFollows(head: CommitPageResponse['head']): string {
  switch (head.kind) {
    case 'attached':
      return worktreeLabel(head.ref);
    case 'detached':
      return 'Detached HEAD';
    case 'unborn':
      return `No commits yet on ${worktreeLabel(head.ref)}`;
  }
}

/** 1 → "1st", 2 → "2nd", 11 → "11th": merge parents are numbered from 1. */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}
