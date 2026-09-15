import { cn } from '@/lib/utils';
import type { GraphRow } from '../../domain/history';

export const HISTORY_ROW_HEIGHT = 58;
const LANE_WIDTH = 16;
const GRAPH_INSET = 13;
const LANE_CLASSES = [
  'text-graph-1',
  'text-graph-2',
  'text-graph-3',
  'text-graph-4',
  'text-graph-5',
  'text-graph-6',
];

export function historyGraphWidth(rows: readonly GraphRow[]) {
  const occupiedLanes = rows.flatMap((row) => [
    row.lane,
    ...row.outgoing,
    ...row.lanesAfter.flatMap((waitingFor, lane) =>
      waitingFor == null ? [] : [lane],
    ),
  ]);

  return GRAPH_INSET * 2 + Math.max(0, ...occupiedLanes) * LANE_WIDTH;
}

const laneX = (lane: number) => GRAPH_INSET + lane * LANE_WIDTH;
const laneClass = (lane: number) =>
  LANE_CLASSES[lane % LANE_CLASSES.length] ?? LANE_CLASSES[0];

/** Render the rails and nodes for the currently loaded commit rows. */
export function HistoryGraph({
  rows,
  width,
}: {
  rows: readonly GraphRow[];
  width: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      data-testid="history-graph"
      width={width}
      height={rows.length * HISTORY_ROW_HEIGHT}
    >
      {rows.map((row, index) => {
        const y = index * HISTORY_ROW_HEIGHT + HISTORY_ROW_HEIGHT / 2;
        const next = rows[index + 1];
        const segments = row.lanesAfter.flatMap((waitingFor, lane) => {
          if (waitingFor == null || next == null) return [];
          const startX = row.outgoing.includes(lane)
            ? laneX(row.lane)
            : laneX(lane);
          const endX =
            waitingFor === next.commit.oid ? laneX(next.lane) : laneX(lane);
          return [{ lane, startX, endX }];
        });
        const merge = row.commit.parentOids.length > 1;

        return (
          <g key={row.commit.oid}>
            {segments.map(({ lane, startX, endX }) => (
              <path
                key={lane}
                d={
                  startX === endX
                    ? `M ${startX} ${y} L ${endX} ${y + HISTORY_ROW_HEIGHT}`
                    : `M ${startX} ${y} C ${startX} ${y + HISTORY_ROW_HEIGHT / 2}, ${endX} ${y + HISTORY_ROW_HEIGHT / 2}, ${endX} ${y + HISTORY_ROW_HEIGHT}`
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className={laneClass(lane)}
              />
            ))}
            <circle
              cx={laneX(row.lane)}
              cy={y}
              r={merge ? 5 : 4}
              fill={merge ? 'var(--card)' : 'currentColor'}
              stroke="currentColor"
              strokeWidth={2}
              className={cn(laneClass(row.lane))}
            />
          </g>
        );
      })}
    </svg>
  );
}
