import '@xyflow/react/dist/style.css';
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import {
  HardDrive,
  KeyRound,
  type LucideIcon,
  Network,
  Server,
  TriangleAlert,
  User,
} from 'lucide-react';
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type { Diagram, DiagramBox } from '../../domain/review';
import { usePreferences } from '../workspace/preferences';


export type GraphBox = DiagramBox & {
  dimmed?: boolean;
  warning?: string;
  clickable?: boolean;
  icon?: LucideIcon;
};

export type Graph = {
  lanes: string[];
  boxes: GraphBox[];
  arrows: Diagram['arrows'];
};

const BOX_WIDTH = 240;
const BOX_GAP = 28;
const BAND_GAP = 44;
const BAND_LABEL = 140;

const KIND_ICON = {
  actor: User,
  credential: KeyRound,
  component: Server,
  storage: HardDrive,
  transport: Network,
} as const;

const CHANGE_BADGE = {
  new: {
    label: 'New',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  changed: {
    label: 'Changed',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  removed: {
    label: 'Removed',
    className: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
} as const;

const estimateHeight = (box: GraphBox) =>
  26 +
  Math.ceil(box.label.length / 26) * 18 +
  (box.change != null && box.label.length > 18 ? 20 : 0) +
  Math.ceil((box.detail?.length ?? 0) / 34) * 16 +
  (box.problem != null ? 22 + Math.ceil(box.problem.length / 32) * 15 : 0) +
  (box.warning != null ? 22 + Math.ceil(box.warning.length / 32) * 15 : 0);

type BoxData = GraphBox & { width: number };
type LaneData = { label: string; height: number; width: number };

function Note({ tone, text }: { tone: 'danger' | 'warn'; text: string }) {
  return (
    <p
      className={cn(
        'mt-1.5 flex gap-1 rounded-md px-1.5 py-1 text-[11px] leading-[15px]',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
      )}
    >
      <TriangleAlert className="mt-px size-3 shrink-0" />
      {text}
    </p>
  );
}

function Box({ data }: NodeProps<Node<BoxData>>) {
  const Icon = data.icon ?? KIND_ICON[data.kind];
  const change = data.change == null ? undefined : CHANGE_BADGE[data.change];
  const Surface = data.clickable ? 'button' : 'div';
  return (
    <Surface
      type={data.clickable ? 'button' : undefined}
      aria-label={data.clickable ? data.label : undefined}
      style={{ width: data.width }}
      className={cn(
        'text-left rounded-xl border bg-card px-3 py-2 text-card-foreground shadow-xs transition-[box-shadow,border-color]',
        data.problem != null && 'border-destructive/45',
        data.change === 'removed' && 'opacity-60',
        data.dimmed && 'opacity-45',
        data.clickable &&
          'cursor-pointer hover:border-foreground/30 hover:shadow-md',
      )}
    >
      {(['Left', 'Right', 'Top', 'Bottom'] as const).map((side) => (
        <span key={side}>
          <Handle
            id={`t-${side}`}
            type="target"
            position={Position[side]}
            className="size-1! border-0! bg-transparent!"
          />
          <Handle
            id={`s-${side}`}
            type="source"
            position={Position[side]}
            className="size-1! border-0! bg-transparent!"
          />
        </span>
      ))}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <span className="max-w-full min-w-0 text-[13px] leading-snug font-medium [overflow-wrap:anywhere]">
              {data.label}
            </span>
            {change != null && (
              <span
                className={cn(
                  'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  change.className,
                )}
              >
                {change.label}
              </span>
            )}
          </div>
          {data.detail != null && (
            <p className="mt-0.5 text-[11px] leading-4 break-words text-muted-foreground">
              {data.detail}
            </p>
          )}
          {data.problem != null && <Note tone="danger" text={data.problem} />}
          {data.warning != null && <Note tone="warn" text={data.warning} />}
        </div>
      </div>
    </Surface>
  );
}

function Lane({ data }: NodeProps<Node<LaneData>>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="flex rounded-2xl border border-dashed bg-muted/40"
    >
      <div className="w-[124px] shrink-0 px-3 pt-3 text-[10.5px] font-medium tracking-wide break-words text-muted-foreground uppercase">
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { box: Box, lane: Lane };

function place(graph: Graph, bands: GraphBox[][]): Map<string, number> {
  const step = BOX_WIDTH + BOX_GAP;
  const centre = new Map<string, number>();
  const joined = (id: string) =>
    graph.arrows.flatMap((arrow) =>
      arrow.from === id ? [arrow.to] : arrow.to === id ? [arrow.from] : [],
    );
  for (const band of bands) {
    const wanted = band.map((box, index) => {
      const above = joined(box.id).flatMap((other) => {
        const x = centre.get(other);
        return x == null ? [] : [x];
      });
      const fallback = (index - (band.length - 1) / 2) * step;
      return {
        box,
        index,
        want:
          above.length === 0
            ? fallback
            : above.reduce((sum, x) => sum + x, 0) / above.length,
      };
    });
    wanted.sort(
      (left, right) => left.want - right.want || left.index - right.index,
    );
    const at: number[] = [];
    wanted.forEach((entry, index) => {
      const previous = at[index - 1];
      at.push(
        previous == null ? entry.want : Math.max(entry.want, previous + step),
      );
    });
    const shift =
      wanted.reduce(
        (sum, entry, index) => sum + entry.want - (at[index] ?? 0),
        0,
      ) / Math.max(1, wanted.length);
    wanted.forEach((entry, index) => {
      centre.set(entry.box.id, (at[index] ?? 0) + shift);
    });
  }
  return centre;
}

function layout(graph: Graph, measured: ReadonlyMap<string, number>) {
  const bands = graph.lanes.map((_, lane) =>
    graph.boxes.filter((box) => box.lane === lane),
  );
  const height = (box: GraphBox) => measured.get(box.id) ?? estimateHeight(box);
  const bandHeight = bands.map(
    (boxes) => Math.max(64, ...boxes.map(height)) + 24,
  );
  const top = (lane: number) =>
    bandHeight
      .slice(0, lane)
      .reduce((sum, height) => sum + height + BAND_GAP, 0);
  const centres = place(graph, bands);
  const values = [...centres.values()];
  const left = Math.min(0, ...values) - BOX_WIDTH / 2;
  const right = Math.max(0, ...values) + BOX_WIDTH / 2;
  const x = (id: string) =>
    BAND_LABEL + (centres.get(id) ?? 0) - left - BOX_WIDTH / 2;
  const width = BAND_LABEL + (right - left) + 16;
  const middle = BAND_LABEL + (right - left) / 2;
  const nodes: Node[] = [];
  bands.forEach((band, lane) => {
    nodes.push({
      id: `lane-${lane}`,
      type: 'lane',
      position: { x: 0, y: top(lane) },
      data: {
        label: graph.lanes[lane] ?? '',
        height: bandHeight[lane] ?? 88,
        width,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    } satisfies Node<LaneData>);
    for (const box of band) {
      nodes.push({
        id: box.id,
        type: 'box',
        position: { x: x(box.id), y: top(lane) + 12 },
        data: { ...box, width: BOX_WIDTH },
        draggable: false,
        selectable: false,
        focusable: box.clickable === true,
      } satisfies Node<BoxData>);
    }
  });
  const laneOf = new Map(graph.boxes.map((box) => [box.id, box.lane]));
  const blocked = (from: string, to: string, low: number, high: number) => {
    const span = [
      Math.min(x(from), x(to)),
      Math.max(x(from), x(to)) + BOX_WIDTH,
    ];
    return graph.boxes.some(
      (box) =>
        box.lane > low &&
        box.lane < high &&
        x(box.id) < (span[1] ?? 0) &&
        x(box.id) + BOX_WIDTH > (span[0] ?? 0),
    );
  };
  const outermost = (id: string, side: 'Left' | 'Right') =>
    !graph.boxes.some(
      (box) =>
        box.id !== id &&
        box.lane === laneOf.get(id) &&
        (side === 'Left' ? x(box.id) < x(id) : x(box.id) > x(id)),
    );
  const edges: Edge[] = graph.arrows
    .filter((arrow) => laneOf.has(arrow.from) && laneOf.has(arrow.to))
    .map((arrow, index) => {
      const fromLane = laneOf.get(arrow.from) ?? 0;
      const toLane = laneOf.get(arrow.to) ?? 0;
      let source: string;
      let target: string;
      if (fromLane === toLane) {
        [source, target] =
          x(arrow.from) < x(arrow.to) ? ['Right', 'Left'] : ['Left', 'Right'];
      } else if (
        blocked(
          arrow.from,
          arrow.to,
          Math.min(fromLane, toLane),
          Math.max(fromLane, toLane),
        )
      ) {
        const outer =
          (x(arrow.from) + x(arrow.to)) / 2 + BOX_WIDTH / 2 < middle
            ? 'Left'
            : 'Right';
        const down = fromLane < toLane;
        source = outermost(arrow.from, outer) ? outer : down ? 'Bottom' : 'Top';
        target = outermost(arrow.to, outer) ? outer : down ? 'Top' : 'Bottom';
      } else {
        [source, target] =
          fromLane < toLane ? ['Bottom', 'Top'] : ['Top', 'Bottom'];
      }
      return {
        id: `${arrow.from}->${arrow.to}:${index}`,
        source: arrow.from,
        target: arrow.to,
        sourceHandle: `s-${source}`,
        targetHandle: `t-${target}`,
        type: 'smoothstep',
        label: arrow.label,
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
        labelBgStyle: { fill: 'var(--card)' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        ...(arrow.dashed ? { style: { strokeDasharray: '4 3' } } : {}),
        focusable: false,
      };
    });
  return { nodes, edges };
}

const FLOW_STYLE = {
  '--xy-background-color': 'transparent',
  '--xy-background-color-default': 'transparent',
  '--xy-edge-stroke': 'color-mix(in oklch, var(--foreground) 32%, transparent)',
  '--xy-edge-stroke-default':
    'color-mix(in oklch, var(--foreground) 32%, transparent)',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-background-color-hover': 'var(--accent)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
} as CSSProperties;

export function ReviewDiagram({
  graph,
  onBoxClick,
  className,
}: {
  graph: Graph;
  onBoxClick?: ((box: GraphBox) => void) | undefined;
  className?: string;
}) {
  const [measured, setMeasured] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const laidOut = useMemo(() => layout(graph, measured), [graph, measured]);
  const boxIds = useMemo(
    () => new Set(graph.boxes.map((box) => box.id)),
    [graph.boxes],
  );
  const onNodesChange = (changes: NodeChange[]) => {
    const next = new Map(measured);
    for (const change of changes) {
      if (
        change.type !== 'dimensions' ||
        change.dimensions == null ||
        !boxIds.has(change.id)
      )
        continue;
      if (Math.abs((next.get(change.id) ?? 0) - change.dimensions.height) > 1)
        next.set(change.id, change.dimensions.height);
    }
    if (
      next.size !== measured.size ||
      [...next].some(([id, value]) => measured.get(id) !== value)
    )
      setMeasured(next);
  };
  return (
    <div className={cn('relative min-h-0 flex-1', className)}>
      <ReactFlowProvider>
        <Canvas
          graph={laidOut}
          onBoxClick={onBoxClick}
          onNodesChange={onNodesChange}
        />
      </ReactFlowProvider>
    </div>
  );
}

function Canvas({
  graph,
  onBoxClick,
  onNodesChange,
}: {
  graph: { nodes: Node[]; edges: Edge[] };
  onBoxClick?: ((box: GraphBox) => void) | undefined;
  onNodesChange: (changes: NodeChange[]) => void;
}) {
  const flow = useReactFlow();
  const { resolvedTheme } = usePreferences();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const frame = requestAnimationFrame(
      () => void flow.fitView({ padding: 0.06, maxZoom: 1, duration: 200 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [graph, flow]);

  useEffect(() => {
    const element = host.current;
    if (element == null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void flow.fitView({ padding: 0.06, maxZoom: 1 }),
        120,
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [flow]);

  return (
    <div ref={host} className="absolute inset-0">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        colorMode={resolvedTheme}
        style={FLOW_STYLE}
        nodesFocusable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        onNodeClick={(_, node) => {
          if (node.type !== 'box') return;
          const box = node.data as BoxData;
          if (box.clickable) onBoxClick?.(box);
        }}
        fitView
        fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color="color-mix(in oklch, var(--foreground) 10%, transparent)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
