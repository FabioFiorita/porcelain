import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { cn } from 'cn';
import {
  Bot,
  Boxes,
  Check,
  Database,
  Folder,
  GitBranch,
  Globe,
  ListOrdered,
  Route,
  SquareTerminal,
  Table2,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Empty, Method, Section, StatusMark } from '@/components/lab/bits';
import { CodeSnippet } from '@/components/lab/code';
import { DesignDiagram } from '@/components/lab/design';
import { openSource, SourceLink, useCodePane } from '@/components/lab/source';
import { Badge } from '@/components/ui/badge';
import { count, duration, ms, percentile, queueWait } from '@/lib/format';
import { type Trace, useLab } from '@/lib/lab';
import {
  areaById,
  areas,
  areaTests,
  tracesForFlow,
  verdictTone,
} from '@/lib/map';
import { href, navigate } from '@/lib/route';
import { planFor } from '@/map/plans';
import type { Area, Flow, Layer, Observation, SourceRef } from '@/map/types';

const layerIcon: Record<
  Layer | 'table' | 'git-command' | 'hook',
  typeof Globe
> = {
  web: Globe,
  hook: Globe,
  route: Route,
  application: Boxes,
  runner: ListOrdered,
  'use-case': Workflow,
  repository: Database,
  database: Database,
  git: GitBranch,
  'git-command': SquareTerminal,
  filesystem: Folder,
  'agent-cli': Bot,
  table: Table2,
};

type GraphNode = Node<{
  layer: keyof typeof layerIcon;
  label: string;
  lines?: string[];
  detail?: string;
  hot?: boolean;
  source?: SourceRef;
  direction: 'TB' | 'LR';
}>;

const NODE_WIDTH = 280;
const nodeHeight = (data: GraphNode['data']) =>
  44 + (data.lines?.length ?? 0) * 15;

function LayerNode({ data }: NodeProps<GraphNode>) {
  const Icon = layerIcon[data.layer] ?? Boxes;
  const vertical = data.direction === 'TB';
  return (
    <div
      title={data.detail}
      style={{ width: NODE_WIDTH }}
      className={cn(
        'rounded-lg border bg-card px-2.5 py-1.5 shadow-xs',
        data.hot && 'ring-2 ring-[var(--lab-git)]',
      )}
    >
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        className="!size-1.5 !border-0 !bg-border"
      />
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {data.layer.replace('-', ' ')}
      </div>
      <div className="truncate font-mono text-[12px]">{data.label}</div>
      {data.lines?.map((line) => (
        <div
          key={line}
          className="truncate font-mono text-[10px] leading-[15px] text-muted-foreground"
        >
          {line}
        </div>
      ))}
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        className="!size-1.5 !border-0 !bg-border"
      />
    </div>
  );
}
const nodeTypes = { layer: LayerNode };

function layout(nodes: GraphNode[], edges: Edge[], direction: 'TB' | 'LR') {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: direction,
    nodesep: 18,
    ranksep: direction === 'TB' ? 36 : 64,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes)
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: nodeHeight(node.data),
    });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  return nodes.map((node) => {
    const point = graph.node(node.id);
    return {
      ...node,
      position: {
        x: point.x - NODE_WIDTH / 2,
        y: point.y - nodeHeight(node.data) / 2,
      },
    };
  });
}

/**
 * One flow top to bottom, or an area's flows left to right where shared
 * use cases and adapters become shared nodes. Tables and Git commands are
 * grouped into single nodes so the chain stays readable.
 */
function buildGraph(flows: Flow[], direction: 'TB' | 'LR') {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Edge>();
  const add = (id: string, data: Omit<GraphNode['data'], 'direction'>) => {
    if (!nodes.has(id))
      nodes.set(id, {
        id,
        type: 'layer',
        position: { x: 0, y: 0 },
        data: { ...data, direction },
      });
    return id;
  };
  const link = (source: string, target: string) => {
    if (source !== target)
      edges.set(`${source}->${target}`, {
        id: `${source}->${target}`,
        source,
        target,
      });
  };
  const single = flows.length === 1;
  for (const flow of flows) {
    let previous: string[] = single
      ? flow.webTriggers.map((trigger) =>
          add(`hook:${trigger.hook}`, {
            layer: 'hook',
            label: trigger.hook,
            detail: trigger.when,
            source: trigger.source,
          }),
        )
      : [];
    const entry = flow.endpoint
      ? add(`route:${flow.endpoint.method} ${flow.endpoint.path}`, {
          layer: 'route',
          label: `${flow.endpoint.method} ${flow.endpoint.path.replace(/^\/projects\/:projectId\/worktrees\/:worktreeId|^\/worktrees\/:worktreeId/, '…')}`,
          detail: `${flow.endpoint.method} ${flow.endpoint.path}`,
          source: flow.endpoint.source,
        })
      : flow.mcpTool
        ? add(`mcp:${flow.mcpTool.name}`, {
            layer: 'agent-cli',
            label: `MCP ${flow.mcpTool.name}`,
          })
        : add(`flow:${flow.id}`, { layer: 'application', label: flow.title });
    for (const hook of previous) link(hook, entry);
    previous = [entry];
    for (const step of flow.steps) {
      if (step.layer === 'route' || step.layer === 'web') continue;
      if (!single && step.layer === 'application') continue;
      const id = add(`${step.layer}:${step.name}`, {
        layer: step.layer,
        label: step.name,
        detail: step.what,
        hot: step.layer === 'git',
        source: step.source,
      });
      for (const from of previous) link(from, id);
      previous = [id];
    }
    if (single && flow.gitCommands.length) {
      const id = add(`git-commands:${flow.id}`, {
        layer: 'git-command',
        label: `${flow.gitCommands.length} Git invocations`,
        lines: flow.gitCommands
          .slice(0, 14)
          .concat(flow.gitCommands.length > 14 ? ['…'] : []),
        hot: true,
      });
      for (const from of previous) link(from, id);
    }
    if (flow.tables.length) {
      const id = single
        ? add(`tables:${flow.id}`, {
            layer: 'table',
            label: `${flow.tables.length} table${flow.tables.length === 1 ? '' : 's'}`,
            lines: flow.tables.map(
              (table) => `${table.name} (${table.access})`,
            ),
          })
        : undefined;
      if (id) for (const from of previous) link(from, id);
      else
        for (const table of flow.tables)
          for (const from of previous)
            link(
              from,
              add(`table:${table.name}`, { layer: 'table', label: table.name }),
            );
    }
  }
  const list = [...nodes.values()];
  const edgeList = [...edges.values()];
  return { nodes: layout(list, edgeList, direction), edges: edgeList };
}

function Graph({
  flows,
  direction,
}: {
  flows: Flow[];
  direction: 'TB' | 'LR';
}) {
  const graph = useMemo(() => buildGraph(flows, direction), [flows, direction]);
  return (
    <ReactFlowProvider>
      <FitOnChange graph={graph} />
    </ReactFlowProvider>
  );
}

function FitOnChange({
  graph,
}: {
  graph: { nodes: GraphNode[]; edges: Edge[] };
}) {
  const flow = useReactFlow();
  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const frame = requestAnimationFrame(() =>
      flow.fitView({ padding: 0.1, maxZoom: 1, duration: 200 }),
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
      onNodeClick={(_, node) =>
        node.data.source && openSource(node.data.source)
      }
      fitView
      fitViewOptions={{ maxZoom: 1 }}
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} color="var(--lab-grid)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

/** One flow read top to bottom, each part with the code behind it. */
function FlowWalkthrough({ flow }: { flow: Flow }) {
  const parts: {
    key: string;
    layer: keyof typeof layerIcon;
    name: string;
    what?: string;
    source?: SourceRef;
  }[] = [
    ...flow.webTriggers.map((trigger) => ({
      key: `hook:${trigger.hook}`,
      layer: 'hook' as const,
      name: trigger.hook,
      what: trigger.when,
      source: trigger.source,
    })),
    ...(flow.endpoint && !flow.steps.some((step) => step.layer === 'route')
      ? [
          {
            key: 'endpoint',
            layer: 'route' as const,
            name: `${flow.endpoint.method} ${flow.endpoint.path}`,
            source: flow.endpoint.source,
          },
        ]
      : []),
    ...(flow.mcpTool
      ? [
          {
            key: 'mcp',
            layer: 'agent-cli' as const,
            name: `MCP tool ${flow.mcpTool.name}`,
            source: flow.mcpTool.source,
          },
        ]
      : []),
    ...flow.steps
      .filter((step) => step.layer !== 'web')
      .map((step, index) => ({
        key: `${index}:${step.layer}:${step.name}`,
        layer: step.layer,
        name: step.name,
        what: step.what,
        source: step.source,
      })),
  ];
  return (
    <div className="h-full overflow-auto px-4 pt-10 pb-8">
      <ol className="relative space-y-3">
        {parts.map((part, index) => {
          const Icon = layerIcon[part.layer] ?? Boxes;
          return (
            <li key={part.key} className="relative pl-7">
              {index < parts.length && (
                <span
                  className="absolute top-6 bottom-[-14px] left-[9px] w-px bg-border"
                  aria-hidden
                />
              )}
              <span className="absolute top-1 left-0 flex size-5 items-center justify-center rounded-full border bg-background">
                <Icon className="size-3 text-muted-foreground" />
              </span>
              <div className="mb-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {part.layer.replace('-', ' ')}
                </div>
                <div className="font-mono text-[13px]">{part.name}</div>
                {part.what && (
                  <p className="text-sm text-muted-foreground">{part.what}</p>
                )}
              </div>
              {part.source && (
                <CodeSnippet
                  source={part.source}
                  defaultOpen={part.layer !== 'hook'}
                />
              )}
            </li>
          );
        })}
        <li className="relative pl-7">
          <span className="absolute top-1 left-0 flex size-5 items-center justify-center rounded-full border bg-background">
            <SquareTerminal className="size-3 text-muted-foreground" />
          </span>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Resources
          </div>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-2.5">
              <div className="mb-1 text-xs font-medium">
                Git ({flow.gitCommands.length})
              </div>
              {flow.gitCommands.length === 0 ? (
                <p className="text-xs text-muted-foreground">No Git.</p>
              ) : (
                <ol className="list-decimal space-y-0.5 pl-4 font-mono text-[11px]">
                  {flow.gitCommands.map((command) => (
                    <li key={command}>{command}</li>
                  ))}
                </ol>
              )}
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="mb-1 text-xs font-medium">
                Tables ({flow.tables.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {flow.tables.length === 0 && (
                  <span className="text-xs text-muted-foreground">None.</span>
                )}
                {flow.tables.map((table) => (
                  <span
                    key={`${table.name}-${table.access}`}
                    className="rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {table.name} · {table.access}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

/** Flows as rows, layers as columns: shared parts line up and highlight together. */
function AreaLanes({ area, traces }: { area: Area; traces: Trace[] }) {
  const [hover, setHover] = useState<string>();
  const cell = (flow: Flow, layers: Layer[]) =>
    flow.steps
      .filter((step) => layers.includes(step.layer))
      .map((step) => step.name);
  const columns: [string, (flow: Flow) => string[]][] = [
    ['Queue', (flow) => [flow.runner]],
    ['Use cases', (flow) => cell(flow, ['use-case'])],
    [
      'Adapters',
      (flow) =>
        cell(flow, [
          'repository',
          'git',
          'filesystem',
          'database',
          'agent-cli',
        ]),
    ],
    [
      'Tables',
      (flow) => flow.tables.map((table) => `${table.name} (${table.access})`),
    ],
  ];
  return (
    <div className="h-full overflow-auto p-4 pt-10">
      <table className="w-full border-separate border-spacing-y-1 text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-2 font-normal">Flow</th>
            {columns.map(([title]) => (
              <th key={title} className="px-2 font-normal">
                {title}
              </th>
            ))}
            <th className="px-2 text-right font-normal">Git</th>
          </tr>
        </thead>
        <tbody>
          {area.flows.map((flow) => {
            const seen = tracesForFlow(flow, traces);
            const git = seen.length
              ? (
                  seen.reduce((sum, trace) => sum + trace.processes.length, 0) /
                  seen.length
                ).toFixed(0)
              : undefined;
            return (
              <tr key={flow.id} className="align-top">
                <td className="min-w-44 rounded-l-lg bg-muted/40 px-2 py-1.5">
                  <a
                    href={href('map', area.id, flow.id)}
                    className="flex items-center gap-1 hover:underline"
                  >
                    {flow.endpoint ? (
                      <Method
                        method={flow.endpoint.method}
                        className="w-10 text-[10px]"
                      />
                    ) : (
                      <span className="w-10 font-mono text-[10px]">
                        {flow.mcpTool ? 'MCP' : '—'}
                      </span>
                    )}
                    <span>{flow.title}</span>
                  </a>
                </td>
                {columns.map(([title, read]) => (
                  <td key={title} className="bg-muted/40 px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {read(flow).map((name) => (
                        <button
                          type="button"
                          key={name}
                          onMouseEnter={() => setHover(name)}
                          onMouseLeave={() => setHover(undefined)}
                          onFocus={() => setHover(name)}
                          onBlur={() => setHover(undefined)}
                          className={cn(
                            'rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px]',
                            hover === name && 'border-foreground bg-muted',
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </td>
                ))}
                <td className="rounded-r-lg bg-muted/40 px-2 py-1.5 text-right tabular-nums">
                  {git ?? (
                    <span className="text-muted-foreground">
                      {flow.gitCommands.length
                        ? `~${flow.gitCommands.length}`
                        : '0'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Hover a part to see every flow that shares it. Git shows live processes
        per call when the flow ran in this session, otherwise the number of
        documented invocations (~).
      </p>
    </div>
  );
}

export function MapPage({
  area: areaId,
  flow: flowId,
}: {
  area?: string;
  flow?: string;
}) {
  const { traces, runtime } = useLab();
  const [areaView, setAreaView] = useState<
    'lanes' | 'graph' | 'now' | 'planned'
  >('lanes');
  const [flowView, setFlowView] = useState<'code' | 'graph'>('code');
  // With the code pane open, the flow and its code share the width; details wait.
  const codeOpen = useCodePane().tabs.length > 0;
  const area = areaById(areaId) ?? areas[0];
  useEffect(() => {
    if (!areaId && areas[0]) navigate('map', areas[0].id);
  }, [areaId]);
  if (!area)
    return (
      <div className="p-6">
        <Empty>
          The curated architecture map isn't written yet
          (design/server-lab/src/map/areas.ts).
          {runtime.status === 'ready' &&
            ` The live server exposes ${runtime.routes.length} routes; see the Console.`}
        </Empty>
      </div>
    );
  const flow = area.flows.find((candidate) => candidate.id === flowId);
  const plan = planFor(area.id);
  const shownView =
    !plan && (areaView === 'now' || areaView === 'planned')
      ? 'lanes'
      : areaView;
  const designShown = !flow && (shownView === 'now' || shownView === 'planned');
  return (
    <div
      className={cn(
        'grid h-full',
        codeOpen || designShown
          ? 'grid-cols-[200px_minmax(0,1fr)]'
          : 'grid-cols-[240px_minmax(0,1.3fr)_minmax(380px,1fr)]',
      )}
    >
      <aside className="min-h-0 overflow-auto border-r p-2">
        {areas.map((candidate) => {
          const tests = areaTests(candidate.id);
          const selected = candidate.id === area.id;
          return (
            <div key={candidate.id} className="mb-0.5">
              <a
                href={href('map', candidate.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted',
                  selected && !flow && 'bg-muted font-medium',
                  selected && 'font-medium',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {candidate.title}
                </span>
                {planFor(candidate.id)?.reviewedOn && (
                  <span
                    title={`Reviewed ${planFor(candidate.id)?.reviewedOn}`}
                    className="text-[var(--lab-ok)]"
                  >
                    <Check className="size-3.5" />
                  </span>
                )}
                <span
                  className={cn(
                    'text-[10px]',
                    verdictTone[tests.verdict ?? ''],
                  )}
                >
                  {tests.verdict ?? ''}
                </span>
              </a>
              {selected && (
                <div className="mt-0.5 mb-2 ml-2 border-l pl-1.5">
                  {candidate.flows.map((item) => {
                    const seen = tracesForFlow(item, traces);
                    return (
                      <a
                        key={item.id}
                        href={href('map', candidate.id, item.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
                          item.id === flow?.id && 'bg-muted text-foreground',
                        )}
                      >
                        {item.endpoint ? (
                          <Method
                            method={item.endpoint.method}
                            className="w-9 text-[10px]"
                          />
                        ) : (
                          <span className="w-9 font-mono text-[10px]">MCP</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {item.title}
                        </span>
                        {seen.length > 0 && (
                          <span className="tabular-nums">{seen.length}</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </aside>
      <div className="relative min-h-0 border-r">
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          {flow ? (
            <>
              <span className="hidden 2xl:inline">
                Web hook → route → application → queue → use case → adapters
              </span>
              <span className="flex rounded-md border">
                {(['code', 'graph'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setFlowView(view)}
                    className={cn(
                      'px-2 py-0.5 capitalize',
                      flowView === view && 'bg-muted text-foreground',
                    )}
                  >
                    {view}
                  </button>
                ))}
              </span>
            </>
          ) : (
            <>
              <span>{area.flows.length} flows</span>
              <span className="flex rounded-md border">
                {(['lanes', 'graph'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setAreaView(view)}
                    className={cn(
                      'px-2 py-0.5 capitalize',
                      shownView === view && 'bg-muted text-foreground',
                    )}
                  >
                    {view}
                  </button>
                ))}
              </span>
              {plan && (
                <>
                  <span className="ml-1">Design</span>
                  <span className="flex rounded-md border">
                    {(
                      [
                        ['now', 'Now'],
                        ['planned', 'Planned'],
                      ] as const
                    ).map(([view, label]) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setAreaView(view)}
                        className={cn(
                          'px-2 py-0.5',
                          shownView === view && 'bg-muted text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        {flow ? (
          flowView === 'code' ? (
            <FlowWalkthrough key={flow.id} flow={flow} />
          ) : (
            <Graph key={flow.id} flows={[flow]} direction="TB" />
          )
        ) : plan && (shownView === 'now' || shownView === 'planned') ? (
          <div className="grid h-full grid-cols-[minmax(0,1fr)_300px] pt-9">
            <DesignDiagram
              key={`${area.id}-${shownView}`}
              diagram={shownView === 'now' ? plan.current : plan.planned}
            />
            <aside className="min-h-0 space-y-3 overflow-auto border-l p-4 text-sm">
              <div className="font-medium">{plan.title}</div>
              <p className="text-xs text-muted-foreground">
                {shownView === 'now'
                  ? 'How it works today. Red notes are the problems the plan fixes.'
                  : `Decided ${plan.decidedOn}, not built yet. Badges mark what is new or changed.`}
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-[13px]">
                {plan.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              {plan.notion && (
                <a
                  href={plan.notion}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs underline-offset-2 hover:underline"
                >
                  The written record in Notion →
                </a>
              )}
            </aside>
          </div>
        ) : shownView === 'graph' ? (
          <Graph key={area.id} flows={area.flows} direction="LR" />
        ) : (
          <AreaLanes area={area} traces={traces} />
        )}
      </div>
      <div
        className={cn(
          'min-h-0 overflow-auto p-4',
          (codeOpen || designShown) && 'hidden',
        )}
      >
        {flow ? (
          <FlowDetail area={area} flow={flow} traces={traces} />
        ) : (
          <AreaDetail area={area} traces={traces} />
        )}
      </div>
    </div>
  );
}

function LiveStats({ traces }: { traces: Trace[] }) {
  if (traces.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Not called since the lab started.
      </p>
    );
  const durations = traces.map(duration);
  const processes = traces.map((trace) => trace.processes.length);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-3">
      <span>
        <span className="text-muted-foreground">calls </span>
        {traces.length}
      </span>
      <span>
        <span className="text-muted-foreground">p50 </span>
        {ms(percentile(durations, 0.5))}
      </span>
      <span>
        <span className="text-muted-foreground">p95 </span>
        {ms(percentile(durations, 0.95))}
      </span>
      <span>
        <span className="text-muted-foreground">git/call </span>
        {(processes.reduce((a, b) => a + b, 0) / traces.length).toFixed(1)}
      </span>
      <span>
        <span className="text-muted-foreground">max git </span>
        {Math.max(...processes)}
      </span>
      <span>
        <span className="text-muted-foreground">max queue </span>
        {ms(Math.max(...traces.map(queueWait)))}
      </span>
    </div>
  );
}

function ObservationList({ observations }: { observations: Observation[] }) {
  if (observations.length === 0)
    return <p className="text-xs text-muted-foreground">None recorded.</p>;
  return (
    <div className="space-y-2">
      {observations.map((observation) => (
        <div key={observation.title} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusMark
              status={
                observation.kind === 'good'
                  ? 'ok'
                  : observation.kind === 'question' ||
                      observation.kind === 'complexity'
                    ? 'warn'
                    : 'danger'
              }
            >
              {observation.kind}
            </StatusMark>
            <span className="text-sm font-medium">{observation.title}</span>
            <Badge variant="outline" className="ml-auto">
              {observation.confidence}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {observation.detail}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3">
            {observation.sources.map((source) => (
              <SourceLink
                key={`${source.path}:${source.line}`}
                source={source}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaDetail({ area, traces }: { area: Area; traces: Trace[] }) {
  const tests = areaTests(area.id);
  const plan = planFor(area.id);
  const kinds = [
    'performance',
    'correctness',
    'risk',
    'complexity',
    'question',
    'good',
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{area.title}</h1>
        <p className="text-xs text-muted-foreground">{area.webSurface}</p>
        <p className="mt-2 text-sm">{area.summary}</p>
      </div>
      {plan && (
        <Section
          title={
            <span className="inline-flex items-center gap-2">
              Planned: {plan.title}
              <span className="rounded-full bg-[color-mix(in_oklch,var(--lab-ok)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--lab-ok)]">
                decided {plan.decidedOn}
              </span>
            </span>
          }
          description="Not built yet. Open Design → Planned for the picture."
        >
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
          {plan.notion && (
            <a
              href={plan.notion}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline-offset-2 hover:underline"
            >
              The written record in Notion →
            </a>
          )}
        </Section>
      )}
      <Section title="Flows">
        <div className="space-y-1">
          {area.flows.map((flow) => {
            const seen = tracesForFlow(flow, traces);
            const avg = seen.length
              ? seen.reduce((sum, trace) => sum + trace.processes.length, 0) /
                seen.length
              : undefined;
            return (
              <a
                key={flow.id}
                href={href('map', area.id, flow.id)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                {flow.endpoint ? (
                  <Method method={flow.endpoint.method} />
                ) : (
                  <span className="w-12 font-mono text-[11px]">MCP</span>
                )}
                <span className="min-w-0 flex-1 truncate">{flow.title}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {seen.length
                    ? `${seen.length}× · ${avg?.toFixed(0)} git`
                    : flow.runner}
                </span>
              </a>
            );
          })}
        </div>
      </Section>
      <Section
        title="Decisions"
        description="Why it is built this way, and what it costs."
      >
        <div className="space-y-2">
          {area.decisions.map((decision) => (
            <div key={decision.title} className="rounded-lg border p-3">
              <div className="text-sm font-medium">{decision.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {decision.summary}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3">
                {decision.doc && <SourceLink source={{ path: decision.doc }} />}
                {decision.source && <SourceLink source={decision.source} />}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Observations"
        description={kinds
          .map(
            (kind) =>
              `${area.observations.filter((item) => item.kind === kind).length} ${kind}`,
          )
          .join(' · ')}
      >
        <ObservationList observations={area.observations} />
      </Section>
      <Section
        title={
          <span>
            Tests{' '}
            <span
              className={cn('font-normal', verdictTone[tests.verdict ?? ''])}
            >
              {tests.verdict ?? 'not audited'}
            </span>
          </span>
        }
      >
        {tests.summaries.map((summary) => (
          <p key={summary.summary} className="text-sm text-muted-foreground">
            {summary.summary}
          </p>
        ))}
        {tests.missing.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium">Missing tests</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {tests.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <a
          href={href('tests', area.id)}
          className="text-xs underline-offset-2 hover:underline"
        >
          {tests.specs.length} specs audited →
        </a>
      </Section>
    </div>
  );
}

function FlowDetail({
  area,
  flow,
  traces,
}: {
  area: Area;
  flow: Flow;
  traces: Trace[];
}) {
  const seen = tracesForFlow(flow, traces);
  const recent = seen.slice(-6).reverse();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <a
          href={href('map', area.id)}
          className="text-xs text-muted-foreground hover:underline"
        >
          {area.title}
        </a>
        <h1 className="text-lg font-semibold">{flow.title}</h1>
        {flow.endpoint && (
          <div className="flex flex-wrap items-center gap-2">
            <Method method={flow.endpoint.method} className="w-auto" />
            <span className="font-mono text-sm">{flow.endpoint.path}</span>
            <SourceLink source={flow.endpoint.source}>route</SourceLink>
          </div>
        )}
        {flow.mcpTool && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">MCP tool</Badge>
            <span className="font-mono text-sm">{flow.mcpTool.name}</span>
            <SourceLink source={flow.mcpTool.source} />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <Badge variant="secondary">queue: {flow.runner}</Badge>
          {flow.endpoint && (
            <a
              href={href(
                'console',
                `${flow.endpoint.method} ${flow.endpoint.path}`,
              )}
              className="rounded-full border px-2 py-0.5 hover:bg-muted"
            >
              Try it in the console →
            </a>
          )}
        </div>
      </div>
      <Section title="How cost grows">
        <p className="text-sm">{flow.cost}</p>
        {flow.notes && (
          <p className="text-sm text-muted-foreground">{flow.notes}</p>
        )}
      </Section>
      <Section title="Live, from this lab session">
        <LiveStats traces={seen} />
        {recent.length > 0 && (
          <div className="space-y-0.5">
            {recent.map((trace) => (
              <a
                key={trace.id}
                href={href('traces', trace.id)}
                className="flex gap-3 rounded px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted"
              >
                <span className="w-20 text-muted-foreground">
                  {new Date(trace.start).toLocaleTimeString()}
                </span>
                <span className="w-10">{trace.status}</span>
                <span className="w-16">{ms(duration(trace))}</span>
                <span className="w-16">
                  {count(trace.processes.length)} git
                </span>
                <span className="text-muted-foreground">{trace.origin}</span>
              </a>
            ))}
          </div>
        )}
      </Section>
      <Section title="Who calls it from the web">
        {flow.webTriggers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No web caller.</p>
        ) : (
          <div className="space-y-2">
            {flow.webTriggers.map((trigger) => (
              <div key={trigger.hook} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{trigger.hook}</span>
                  <SourceLink source={trigger.source} />
                </div>
                <p className="text-muted-foreground">{trigger.when}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Steps">
        <ol className="space-y-2">
          {flow.steps.map((step) => (
            <li
              key={`${step.layer}-${step.name}-${step.source.path}:${step.source.line ?? ''}`}
              className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm"
            >
              <span className="pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {step.layer}
              </span>
              <span className="min-w-0">
                <span className="font-mono text-xs">{step.name}</span>
                <span className="block text-muted-foreground">{step.what}</span>
                <SourceLink source={step.source} />
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title={`Git (${flow.gitCommands.length})`}>
        {flow.gitCommands.length === 0 ? (
          <p className="text-xs text-muted-foreground">No Git.</p>
        ) : (
          <ol className="list-decimal space-y-0.5 pl-5 font-mono text-[11px]">
            {flow.gitCommands.map((command) => (
              <li key={command}>{command}</li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Tables">
        <div className="flex flex-wrap gap-1.5">
          {flow.tables.length === 0 && (
            <span className="text-xs text-muted-foreground">None.</span>
          )}
          {flow.tables.map((table) => (
            <Badge
              key={`${table.name}-${table.access}`}
              variant="outline"
              className="font-mono"
            >
              {table.name} · {table.access}
            </Badge>
          ))}
        </div>
      </Section>
    </div>
  );
}
