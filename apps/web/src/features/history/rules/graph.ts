import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import {
  HISTORY_GRAPH_INSET,
  HISTORY_LANE_WIDTH,
  HISTORY_ORDINAL_CENTURY,
  HISTORY_PANEL_LAST_LANE,
  HISTORY_PANEL_LANE_WIDTH,
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

export type GraphGutter = { laneWidth: number; lastLane: number };

export const FULL_GUTTER: GraphGutter = {
  laneWidth: HISTORY_LANE_WIDTH,
  lastLane: Number.POSITIVE_INFINITY,
};

export const PANEL_GUTTER: GraphGutter = {
  laneWidth: HISTORY_PANEL_LANE_WIDTH,
  lastLane: HISTORY_PANEL_LAST_LANE,
};

export function laneX(lane: number, gutter: GraphGutter = FULL_GUTTER) {
  return (
    HISTORY_GRAPH_INSET + Math.min(lane, gutter.lastLane) * gutter.laneWidth
  );
}

export function historyGraphWidth(
  rows: readonly GraphRow[],
  gutter: GraphGutter = FULL_GUTTER,
) {
  const occupiedLanes = rows.flatMap((row) => [
    row.lane,
    ...row.outgoing,
    ...row.lanesAfter.flatMap((waitingFor, lane) =>
      waitingFor === null || waitingFor === undefined ? [] : [lane],
    ),
  ]);
  return laneX(Math.max(0, ...occupiedLanes), gutter) + HISTORY_GRAPH_INSET;
}

export function ordinal(n: number) {
  const tens = n % HISTORY_ORDINAL_CENTURY;
  const suffix =
    tens >= HISTORY_ORDINAL_TEENS_START && tens <= HISTORY_ORDINAL_TEENS_END
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % HISTORY_ORDINAL_DECADE] ?? 'th');
  return `${n}${suffix}`;
}
