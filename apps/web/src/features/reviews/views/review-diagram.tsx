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
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { CssVariables } from '@/shared/lib/css-variables';
import { usePreferences } from '@/features/preferences/index';
import type { Diagram, DiagramBox } from '@porcelain/client/reviews/rules';
import { diagramGrid } from '../rules/diagram-grid';

type GraphBox = DiagramBox & {
  dimmed?: boolean;
  warning?: string;
  clickable?: boolean;
  selected?: boolean;
  icon?: LucideIcon;
};

export type Graph = {
  lanes: readonly string[];
  boxes: readonly GraphBox[];
  arrows: Diagram['arrows'];
  trace?: string;
};

const BOX_WIDTH = 240;

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
    className: 'bg-graph-2/15 text-graph-2 ',
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
  (box.change !== null && box.change !== undefined && box.label.length > 18
    ? 20
    : 0) +
  Math.ceil((box.detail?.length ?? 0) / 34) * 16 +
  (box.problem !== null && box.problem !== undefined
    ? 22 + Math.ceil(box.problem.length / 32) * 15
    : 0) +
  (box.warning !== null && box.warning !== undefined
    ? 22 + Math.ceil(box.warning.length / 32) * 15
    : 0);

type BoxData = GraphBox & { width: number };
type LaneData = { label: string; height: number; width: number };

function Note({ tone, text }: { tone: 'danger' | 'warn'; text: string }) {
  return (
    <p
      className={cn(
        'mt-1.5 flex gap-1 rounded-md px-1.5 py-1 text-2xs leading-4',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-graph-4/12 text-graph-4 ',
      )}
    >
      <TriangleAlert className="mt-px size-3 shrink-0" />
      {text}
    </p>
  );
}

function Box({ data }: NodeProps<Node<BoxData>>) {
  const Icon = data.icon ?? KIND_ICON[data.kind];
  const change =
    data.change === null || data.change === undefined
      ? undefined
      : CHANGE_BADGE[data.change];
  const Surface = data.clickable ? 'button' : 'div';
  return (
    <Surface
      type={data.clickable ? 'button' : undefined}
      aria-label={data.clickable ? data.label : undefined}
      aria-pressed={data.clickable ? data.selected === true : undefined}
      style={{ width: data.width }}
      className={cn(
        'text-left rounded-xl border bg-card px-3 py-2 text-card-foreground shadow-xs transition-[box-shadow,border-color]',
        data.problem !== null &&
          data.problem !== undefined &&
          'border-destructive/45',
        data.change === 'removed' && 'opacity-60',
        data.dimmed && 'opacity-45',
        data.selected && 'ring-2 ring-ring',
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
            <span className="max-w-full min-w-0 text-ui leading-snug font-medium [overflow-wrap:anywhere]">
              {data.label}
            </span>
            {change !== null && change !== undefined && (
              <span
                className={cn(
                  'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium',
                  change.className,
                )}
              >
                {change.label}
              </span>
            )}
          </div>
          {data.detail !== null && data.detail !== undefined && (
            <p className="mt-0.5 text-2xs leading-4 break-words text-muted-foreground">
              {data.detail}
            </p>
          )}
          {data.problem !== null && data.problem !== undefined && (
            <Note tone="danger" text={data.problem} />
          )}
          {data.warning !== null && data.warning !== undefined && (
            <Note tone="warn" text={data.warning} />
          )}
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
      <div className="shrink-0 px-4 pt-2 text-2xs font-medium tracking-wide break-words text-muted-foreground uppercase">
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { box: Box, lane: Lane };

function layout(
  graph: Graph,
  measured: ReadonlyMap<string, number>,
  availableWidth: number,
) {
  const grid = diagramGrid(
    graph.lanes,
    graph.boxes.map((box) => ({
      id: box.id,
      lane: box.lane,
      height: measured.get(box.id) ?? estimateHeight(box),
    })),
    availableWidth,
    graph.trace,
  );
  const nodes: Node[] = grid.bands.map(
    (band, lane) =>
      ({
        id: `lane-${lane}`,
        type: 'lane',
        position: { x: 0, y: band.y },
        data: { label: band.label, height: band.height, width: grid.width },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      }) satisfies Node<LaneData>,
  );
  for (const box of graph.boxes) {
    const position = grid.positions.get(box.id);
    if (!position) continue;
    nodes.push({
      id: box.id,
      type: 'box',
      position,
      data: { ...box, width: BOX_WIDTH },
      draggable: false,
      selectable: false,
      focusable: box.clickable === true,
    } satisfies Node<BoxData>);
  }
  const edges: Edge[] = graph.arrows
    .filter(
      (arrow) => grid.positions.has(arrow.from) && grid.positions.has(arrow.to),
    )
    .map((arrow, index) => {
      const from = grid.positions.get(arrow.from)!;
      const to = grid.positions.get(arrow.to)!;
      const [source, target] = graph.trace
        ? from.x === to.x
          ? ['Left', 'Left']
          : from.x < to.x
            ? ['Right', 'Left']
            : ['Left', 'Right']
        : from.y === to.y
          ? from.x < to.x
            ? ['Right', 'Left']
            : ['Left', 'Right']
          : from.y < to.y
            ? ['Bottom', 'Top']
            : ['Top', 'Bottom'];
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
  return { nodes, edges, width: grid.width, height: grid.height };
}

const FLOW_STYLE: CssVariables = {
  '--xy-background-color': 'transparent',
  '--xy-background-color-default': 'transparent',
  '--xy-edge-stroke': 'color-mix(in oklch, var(--foreground) 32%, transparent)',
  '--xy-edge-stroke-default':
    'color-mix(in oklch, var(--foreground) 32%, transparent)',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-background-color-hover': 'var(--accent)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
};

function ReviewDiagram({
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
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const laidOut = layout(graph, measured, width);
  const boxIds = new Set(graph.boxes.map((box) => box.id));
  const onNodesChange = (changes: NodeChange[]) => {
    const next = new Map(measured);
    for (const change of changes) {
      if (
        change.type !== 'dimensions' ||
        change.dimensions === null ||
        change.dimensions === undefined ||
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
    <div ref={host} className={cn('relative min-h-0 flex-1', className)}>
      <ReactFlowProvider>
        <Canvas
          graph={laidOut}
          availableWidth={width}
          boxes={graph.boxes}
          onBoxClick={onBoxClick}
          onNodesChange={onNodesChange}
        />
      </ReactFlowProvider>
    </div>
  );
}

function Canvas({
  graph,
  boxes,
  availableWidth,
  onBoxClick,
  onNodesChange,
}: {
  graph: { nodes: Node[]; edges: Edge[]; width: number; height: number };
  availableWidth: number;
  boxes: readonly GraphBox[];
  onBoxClick?: ((box: GraphBox) => void) | undefined;
  onNodesChange: (changes: NodeChange[]) => void;
}) {
  const flow = useReactFlow();
  const { resolvedTheme } = usePreferences();
  const geometry = graph.nodes
    .map((node) => `${node.id}:${node.position.x}:${node.position.y}`)
    .join('|');
  useEffect(() => {
    if (availableWidth <= 0 || graph.nodes.length === 0) return;
    const zoom = Math.min(
      1,
      Math.max(0.2, (availableWidth - 24) / graph.width),
    );
    const frame = requestAnimationFrame(
      () =>
        void flow.setViewport({
          x: Math.max(12, (availableWidth - graph.width * zoom) / 2),
          y: 16,
          zoom,
        }),
    );
    return () => cancelAnimationFrame(frame);
  }, [availableWidth, geometry, graph.width, flow]);

  return (
    <div className="absolute inset-0">
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
          const box = boxes.find((candidate) => candidate.id === node.id);
          if (box?.clickable) onBoxClick?.(box);
        }}
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
export default ReviewDiagram;
