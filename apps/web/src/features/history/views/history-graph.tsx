import {
  HISTORY_GRAPH_DOT_RADIUS,
  HISTORY_GRAPH_DOT_STROKE_WIDTH,
  HISTORY_GRAPH_MERGE_RADIUS,
  HISTORY_GRAPH_STROKE_WIDTH,
} from '@/config/limits';
import {
  laneX as gutterX,
  type GraphGutter,
  type GraphRow,
} from '../rules/graph';

const LANE_CLASSES = [
  'text-graph-1',
  'text-graph-2',
  'text-graph-3',
  'text-graph-4',
  'text-graph-5',
  'text-graph-6',
];

const laneClass = (lane: number) =>
  LANE_CLASSES[lane % LANE_CLASSES.length] ?? LANE_CLASSES[0];

export function HistoryGraph({
  rows,
  width,
  rowHeight,
  gutter,
}: {
  rows: readonly GraphRow[];
  width: number;
  rowHeight: number;
  gutter: GraphGutter;
}) {
  const laneX = (lane: number) => gutterX(lane, gutter);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-2 left-1.5"
      data-testid="history-graph"
      width={width}
      height={rows.length * rowHeight}
    >
      {rows.map((row, index) => {
        const y = index * rowHeight + rowHeight * 0.5;
        const next = rows[index + 1];
        const segments = row.lanesAfter.flatMap((waitingFor, lane) => {
          if (
            waitingFor === null ||
            waitingFor === undefined ||
            next === null ||
            next === undefined
          )
            return [];
          const startX = row.outgoing.includes(lane)
            ? laneX(row.lane)
            : laneX(lane);
          const endX =
            waitingFor === next.commit.oid ? laneX(next.lane) : laneX(lane);
          const starts = [startX];
          if (
            startX !== laneX(lane) &&
            rows[index - 1]?.lanesAfter[lane] === waitingFor
          )
            starts.push(laneX(lane));
          return starts.map((startX) => ({ lane, startX, endX }));
        });
        const merge = row.commit.parentOids.length > 1;

        return (
          <g key={row.commit.oid}>
            {segments.map(({ lane, startX, endX }) => (
              <path
                key={`${lane}-${startX}`}
                d={
                  startX === endX
                    ? `M ${startX} ${y} L ${endX} ${y + rowHeight}`
                    : `M ${startX} ${y} C ${startX} ${y + rowHeight * 0.5}, ${endX} ${y + rowHeight * 0.5}, ${endX} ${y + rowHeight}`
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={HISTORY_GRAPH_STROKE_WIDTH}
                className={laneClass(Math.min(lane, gutter.lastLane))}
              />
            ))}
            <circle
              cx={laneX(row.lane)}
              cy={y}
              r={merge ? HISTORY_GRAPH_MERGE_RADIUS : HISTORY_GRAPH_DOT_RADIUS}
              fill={merge ? 'var(--card)' : 'currentColor'}
              stroke="currentColor"
              strokeWidth={HISTORY_GRAPH_DOT_STROKE_WIDTH}
              className={laneClass(Math.min(row.lane, gutter.lastLane))}
            />
          </g>
        );
      })}
    </svg>
  );
}
