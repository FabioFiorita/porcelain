import '@xyflow/react/dist/style.css';
import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { TriangleAlertIcon } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import { useTheme } from '@/features/preferences/index';
import { cn } from '@/shared/lib/utils';
import type { ReviewRevision } from '@porcelain/client/reviews/rules';
import {
  MAP_BOX_HEIGHT,
  MAP_BOX_WIDTH,
  layoutMap,
  type MapBox,
} from '../rules/system-map';

type Diagram = NonNullable<ReviewRevision['content']['diagram']>['after'];
type BoxData = { box: MapBox; lit: boolean };
type BoxNode = Node<BoxData, 'box'>;

const CHANGE_LABEL = {
  new: 'New',
  changed: 'Changed',
  removed: 'Removed',
} as const;

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box, lit } = data;
  return (
    <div
      title={box.detail ?? box.label}
      style={{ width: MAP_BOX_WIDTH, height: MAP_BOX_HEIGHT }}
      className={cn(
        'flex flex-col items-start gap-0.5 overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left transition-opacity',
        box.layerId && 'cursor-pointer hover:ring-2 hover:ring-ring/40',
        box.change === 'new' && 'border-add-fg/50 bg-add-bg',
        box.change === 'changed' && 'border-brand/40 bg-brand-soft',
        box.change === 'removed' && 'border-dashed border-del-fg/50 bg-del-bg',
        !box.change && 'border-dashed',
        box.problem && 'border-warn-border ring-2 ring-warn-border',
        !lit && 'opacity-55',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0"
        isConnectable={false}
      />
      <span className="flex w-full min-w-0 items-center gap-1.5">
        {box.problem && (
          <TriangleAlertIcon className="size-3 shrink-0 text-warn" />
        )}
        <span
          className={cn(
            'min-w-0 text-ui leading-4 font-semibold wrap-anywhere',
            box.change === 'removed' && 'line-through',
          )}
        >
          {box.label}
        </span>
      </span>
      <span className="text-3xs font-medium tracking-wide text-muted-foreground uppercase">
        {box.change ? CHANGE_LABEL[box.change] : 'Existing'}
      </span>
      {box.detail && (
        <span className="line-clamp-2 text-2xs leading-3.5 text-muted-foreground">
          {box.detail}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0"
        isConnectable={false}
      />
    </div>
  );
}

const nodeTypes = { box: BoxView };

function neighbourhood(diagram: Diagram, focus: string): Diagram {
  const own = new Set(
    diagram.boxes.filter((box) => box.layerId === focus).map((box) => box.id),
  );
  const near = new Set(own);
  for (const arrow of diagram.arrows) {
    if (own.has(arrow.from)) near.add(arrow.to);
    if (own.has(arrow.to)) near.add(arrow.from);
  }
  return {
    boxes: diagram.boxes.filter((box) => near.has(box.id)),
    arrows: diagram.arrows.filter(
      (arrow) => near.has(arrow.from) && near.has(arrow.to),
    ),
  };
}

function FitOnResize() {
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const ready = useNodesInitialized();
  useEffect(() => {
    if (ready) void fitView({ padding: 0.06, maxZoom: 1 });
  }, [ready, width, height, fitView]);
  return null;
}

const MAP_STYLE = {
  background: 'transparent',
  '--xy-edge-stroke': 'var(--muted-foreground)',
  '--xy-edge-label-color': 'var(--muted-foreground)',
  '--xy-edge-label-background-color': 'var(--card)',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
} as CSSProperties;

export function SystemMap({
  diagram,
  focus,
  onLayer,
  className,
}: {
  diagram: Diagram;
  focus?: string | undefined;
  onLayer: (layerId: string) => void;
  className?: string;
}) {
  const { dark } = useTheme();
  const shown = focus === undefined ? diagram : neighbourhood(diagram, focus);
  const layout = layoutMap(shown);
  const lit = (box: MapBox) => focus === undefined || box.layerId === focus;
  const litIds = new Set(layout.boxes.filter(lit).map((box) => box.id));
  const nodes: BoxNode[] = layout.boxes.map((box) => ({
    id: box.id,
    type: 'box',
    position: { x: box.x, y: box.y },
    data: { box, lit: lit(box) },
    draggable: false,
    selectable: false,
    connectable: false,
  }));
  const edges: Edge[] = shown.arrows.map((arrow, index) => {
    const bright =
      focus === undefined || litIds.has(arrow.from) || litIds.has(arrow.to);
    return {
      id: `${arrow.from}-${arrow.to}-${index}`,
      source: arrow.from,
      target: arrow.to,
      label: arrow.label ?? 'relates to',
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { opacity: bright ? 1 : 0.5 },
    };
  });
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border bg-muted/30',
        className,
      )}
      style={{
        height: Math.min(Math.max(layout.height * 0.82 + 40, 200), 560),
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={dark ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        style={MAP_STYLE}
        onNodeClick={(_event, node: BoxNode) => {
          if (node.data.box.layerId) onLayer(node.data.box.layerId);
        }}
      >
        <FitOnResize />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
