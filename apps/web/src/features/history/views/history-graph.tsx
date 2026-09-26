import {
  HISTORY_GRAPH_DOT_RADIUS,
  HISTORY_GRAPH_DOT_STROKE_WIDTH,
  HISTORY_GRAPH_INSET,
  HISTORY_GRAPH_MERGE_RADIUS,
  HISTORY_GRAPH_STROKE_WIDTH,
  HISTORY_LANE_WIDTH,
  HISTORY_ROW_HEIGHT,
} from '@/config/limits';
import type { GraphRow } from '../rules/graph';

const LANE_CLASSES = [
  'text-graph-1',
  'text-graph-2',
  'text-graph-3',
  'text-graph-4',
  'text-graph-5',
  'text-graph-6',
];

const laneX = (lane: number) => HISTORY_GRAPH_INSET + lane * HISTORY_LANE_WIDTH;
const laneClass = (lane: number) =>
  LANE_CLASSES[lane % LANE_CLASSES.length] ?? LANE_CLASSES[0];

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
        const y = index * HISTORY_ROW_HEIGHT + HISTORY_ROW_HEIGHT * 0.5;
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
                    : `M ${startX} ${y} C ${startX} ${y + HISTORY_ROW_HEIGHT * 0.5}, ${endX} ${y + HISTORY_ROW_HEIGHT * 0.5}, ${endX} ${y + HISTORY_ROW_HEIGHT}`
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={HISTORY_GRAPH_STROKE_WIDTH}
                className={laneClass(lane)}
              />
            ))}
            <circle
              cx={laneX(row.lane)}
              cy={y}
              r={merge ? HISTORY_GRAPH_MERGE_RADIUS : HISTORY_GRAPH_DOT_RADIUS}
              fill={merge ? 'var(--card)' : 'currentColor'}
              stroke="currentColor"
              strokeWidth={HISTORY_GRAPH_DOT_STROKE_WIDTH}
              className={laneClass(row.lane)}
            />
          </g>
        );
      })}
    </svg>
  );
}
