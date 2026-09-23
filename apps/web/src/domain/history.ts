import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import { worktreeLabel } from './inventory';

export type CommitSummary = CommitPageResponse['commits'][number];

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

export function shortOid(oid: string) {
  return oid.slice(0, 7);
}

export function historyRefLabel(ref: string) {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//u, '');
}

export function ordinal(n: number) {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

export function historyFollows(
  snapshot: CommitPageResponse['snapshot'],
): string {
  if (!snapshot) return 'This branch';
  const head = snapshot.head;
  switch (head.kind) {
    case 'attached':
      return worktreeLabel(head.ref);
    case 'detached':
      return 'Detached HEAD';
    case 'unborn':
      return `No commits yet on ${worktreeLabel(head.ref)}`;
  }
}
