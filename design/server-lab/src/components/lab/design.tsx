import {
  Background,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { cn } from 'cn';
import {
  HardDrive,
  KeyRound,
  Network,
  Server,
  TriangleAlert,
  User,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { DesignNode, Diagram } from '@/map/plans';

// Lanes are horizontal bands read top to bottom; boxes sit side by side in a band.
const BOX_WIDTH = 250;
const BOX_GAP = 28;
const BAND_GAP = 56;
const BAND_LABEL = 150;

const kindIcon = {
  actor: User,
  credential: KeyRound,
  component: Server,
  storage: HardDrive,
  transport: Network,
} as const;

const changeStyle = {
  new: {
    label: 'New',
    className:
      'bg-[color-mix(in_oklch,var(--lab-ok)_16%,transparent)] text-[var(--lab-ok)]',
  },
  changed: {
    label: 'Changed',
    className:
      'bg-[color-mix(in_oklch,var(--series-blue)_16%,transparent)] text-[var(--series-blue)]',
  },
  removed: {
    label: 'Removed',
    className:
      'bg-[color-mix(in_oklch,var(--lab-danger)_16%,transparent)] text-[var(--lab-danger)]',
  },
} as const;

/** Rough height so lanes stack without overlap; React Flow renders the real box. */
const estimateHeight = (node: DesignNode) =>
  46 +
  Math.ceil((node.detail?.length ?? 0) / 36) * 16 +
  (node.problem ? 22 + Math.ceil(node.problem.length / 34) * 15 : 0);

type BoxData = DesignNode & { width: number };
type LaneData = { label: string; height: number; width: number };

function Box({ data }: NodeProps<Node<BoxData>>) {
  const Icon = kindIcon[data.kind];
  const change = data.change ? changeStyle[data.change] : undefined;
  return (
    <div
      style={{ width: data.width }}
      className={cn(
        'rounded-xl border bg-card px-3 py-2 shadow-xs',
        data.problem &&
          'border-[color-mix(in_oklch,var(--lab-danger)_45%,var(--border))]',
        data.change === 'removed' && 'opacity-60',
      )}
    >
      {(['Left', 'Right', 'Top', 'Bottom'] as const).map((side) => (
        <span key={side}>
          <Handle
            id={`t-${side}`}
            type="target"
            position={Position[side]}
            className="!size-1 !border-0 !bg-transparent"
          />
          <Handle
            id={`s-${side}`}
            type="source"
            position={Position[side]}
            className="!size-1 !border-0 !bg-transparent"
          />
        </span>
      ))}
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="flex-1 text-[13px] leading-snug font-medium">
              {data.label}
            </span>
            {change && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  change.className,
                )}
              >
                {change.label}
              </span>
            )}
          </div>
          {data.detail && (
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              {data.detail}
            </p>
          )}
          {data.problem && (
            <p className="mt-1.5 flex gap-1 rounded-md bg-[color-mix(in_oklch,var(--lab-danger)_10%,transparent)] px-1.5 py-1 text-[11px] leading-[15px] text-[var(--lab-danger)]">
              <TriangleAlert className="mt-px size-3 shrink-0" />
              {data.problem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Lane({ data }: NodeProps<Node<LaneData>>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="flex rounded-2xl border border-dashed bg-muted/40"
    >
      <div className="w-[130px] shrink-0 px-3 pt-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { box: Box, lane: Lane };

function layout(diagram: Diagram) {
  const bands = diagram.lanes.map((_, lane) =>
    diagram.nodes.filter((node) => node.lane === lane),
  );
  const bandHeight = bands.map(
    (nodes) => Math.max(70, ...nodes.map(estimateHeight)) + 24,
  );
  const widest = Math.max(...bands.map((nodes) => nodes.length));
  const width = BAND_LABEL + widest * (BOX_WIDTH + BOX_GAP) + 16;
  const top = (lane: number) =>
    bandHeight
      .slice(0, lane)
      .reduce((sum, height) => sum + height + BAND_GAP, 0);
  const placed = new Map<string, { lane: number; y: number; index: number }>();
  const nodes: Node[] = [];
  bands.forEach((band, lane) => {
    nodes.push({
      id: `lane-${lane}`,
      type: 'lane',
      position: { x: 0, y: top(lane) },
      data: {
        label: diagram.lanes[lane] ?? '',
        height: bandHeight[lane] ?? 100,
        width,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    } satisfies Node<LaneData>);
    // Center a band's boxes under the widest band.
    const offset = ((widest - band.length) * (BOX_WIDTH + BOX_GAP)) / 2;
    band.forEach((node, index) => {
      const y = top(lane) + 12;
      placed.set(node.id, { lane, y, index });
      nodes.push({
        id: node.id,
        type: 'box',
        position: { x: BAND_LABEL + offset + index * (BOX_WIDTH + BOX_GAP), y },
        data: { ...node, width: BOX_WIDTH },
        draggable: false,
      } satisfies Node<BoxData>);
    });
  });
  const edges: Edge[] = diagram.edges.map((edge) => {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const [source, target] =
      !from || !to
        ? ['Bottom', 'Top']
        : from.lane < to.lane
          ? ['Bottom', 'Top']
          : from.lane > to.lane
            ? ['Top', 'Bottom']
            : from.index < to.index
              ? ['Right', 'Left']
              : ['Left', 'Right'];
    return {
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      sourceHandle: `s-${source}`,
      targetHandle: `t-${target}`,
      type: 'smoothstep',
      label: edge.label,
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
      labelBgStyle: { fill: 'var(--background)' },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: edge.dashed ? { strokeDasharray: '4 3' } : undefined,
    };
  });
  return { nodes, edges };
}

export function DesignDiagram({ diagram }: { diagram: Diagram }) {
  const graph = useMemo(() => layout(diagram), [diagram]);
  return (
    <ReactFlowProvider>
      <Canvas graph={graph} />
    </ReactFlowProvider>
  );
}

function Canvas({ graph }: { graph: { nodes: Node[]; edges: Edge[] } }) {
  const flow = useReactFlow();
  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const frame = requestAnimationFrame(() =>
      flow.fitView({ padding: 0.05, maxZoom: 1.1, duration: 200 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [graph, flow]);
  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.05, maxZoom: 1.1 }}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} color="var(--lab-grid)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
