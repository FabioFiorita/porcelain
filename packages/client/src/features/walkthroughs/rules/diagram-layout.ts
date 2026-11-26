import type { DiagramEdge, DiagramNode, StepDiagram } from './blocks.ts';
import { growthSign } from './page.ts';

type DiagramPlacement = 'right' | 'down' | 'sequence';

export type DiagramMeasure = {
  readonly node: (node: DiagramNode) => {
    readonly width: number;
    readonly height: number;
  };
  readonly label: (text: string) => number;
};

type Point = { readonly x: number; readonly y: number };

export type DiagramGeometry = {
  readonly placement: DiagramPlacement;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly edges: readonly {
    readonly index: number;
    readonly path: string;
    readonly arrow: string;
    readonly label: Point | undefined;
  }[];
  readonly lifelines: readonly {
    readonly x: number;
    readonly top: number;
    readonly bottom: number;
  }[];
};

const PAD = 16;
const STACK_GAP = { right: 16, down: 24 };
const HALF_GAP = { right: 12, down: 20 };
const SPAN = { right: 32, down: 8 };
const LABEL_ROOM = 24;
const LABEL_HEIGHT = 16;
const WAYPOINT = 2;
const ARROW = 6;
const PAIR_OFFSET = 8;
const SEQUENCE_HEAD_GAP = 28;
const SEQUENCE_ROW = 32;
const SEQUENCE_SIDE_GAP = 32;

const round = (value: number) => Math.round(value * 10) / 10;

function arrowHead(tip: Point, from: Point): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const spread = Math.PI / 7;
  const left = {
    x: tip.x - ARROW * Math.cos(angle - spread),
    y: tip.y - ARROW * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - ARROW * Math.cos(angle + spread),
    y: tip.y - ARROW * Math.sin(angle + spread),
  };
  return [tip, left, right]
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(' ');
}

function curve(start: Point, end: Point, horizontal: boolean) {
  const bend = horizontal ? (end.x - start.x) / 2 : (end.y - start.y) / 2;
  const first = horizontal
    ? { x: start.x + bend, y: start.y }
    : { x: start.x, y: start.y + bend };
  const second = horizontal
    ? { x: end.x - bend, y: end.y }
    : { x: end.x, y: end.y - bend };
  return {
    path: `M${round(start.x)} ${round(start.y)} C${round(first.x)} ${round(first.y)} ${round(second.x)} ${round(second.y)} ${round(end.x)} ${round(end.y)}`,
    arrow: arrowHead(end, second),
    middle: {
      x: round((start.x + 3 * first.x + 3 * second.x + end.x) / 8),
      y: round((start.y + 3 * first.y + 3 * second.y + end.y) / 8),
    },
  };
}

function rankNodes(
  ids: readonly string[],
  edges: readonly DiagramEdge[],
): Map<string, number> {
  const outgoing = new Map<string, number[]>(ids.map((id) => [id, []]));
  edges.forEach((edge, index) => outgoing.get(edge.from)?.push(index));
  const state = new Map<string, 'open' | 'done'>();
  const reversed = new Set<number>();
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const index of outgoing.get(id) ?? []) {
      const target = edges[index]?.to;
      if (target === undefined) continue;
      const seen = state.get(target);
      if (seen === 'open') reversed.add(index);
      else if (seen === undefined) visit(target);
    }
    state.set(id, 'done');
  };
  const targets = new Set(edges.map((edge) => edge.to));
  for (const id of ids) if (!targets.has(id) && !state.has(id)) visit(id);
  for (const id of ids) if (!state.has(id)) visit(id);
  const forward = edges.map((edge, index) =>
    reversed.has(index) ? { from: edge.to, to: edge.from } : edge,
  );
  const rank = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass += 1)
    for (const edge of forward) {
      const next = (rank.get(edge.from) ?? 0) + 1;
      if ((rank.get(edge.to) ?? 0) < next) rank.set(edge.to, next);
    }
  for (const id of ids) {
    const below = forward
      .filter((edge) => edge.from === id)
      .map((edge) => rank.get(edge.to) ?? 0);
    const above = forward.some((edge) => edge.to === id);
    if (!above && below.length > 0) rank.set(id, Math.min(...below) - 1);
  }
  const used = [...new Set(rank.values())].sort((a, b) => a - b);
  return new Map(
    [...rank].map(([id, value]) => [id, used.indexOf(value)] as const),
  );
}

function orderRanks(
  ids: readonly string[],
  edges: readonly DiagramEdge[],
  rank: ReadonlyMap<string, number>,
): string[][] {
  const count = Math.max(...ids.map((id) => rank.get(id) ?? 0)) + 1;
  const layers: string[][] = Array.from({ length: count }, () => []);
  for (const id of ids) layers[rank.get(id) ?? 0]?.push(id);
  const position = () =>
    new Map(layers.flatMap((layer) => layer.map((id, index) => [id, index])));
  const neighbours = (id: string, before: boolean) =>
    edges.flatMap((edge) => {
      const other =
        edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
      if (other === undefined) return [];
      const otherRank = rank.get(other) ?? 0;
      const ownRank = rank.get(id) ?? 0;
      return (before ? otherRank < ownRank : otherRank > ownRank)
        ? [other]
        : [];
    });
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const down = sweep % 2 === 0;
    const at = position();
    const order = down ? layers : [...layers].reverse();
    for (const layer of order) {
      const weight = new Map(
        layer.map((id, index) => {
          const linked = neighbours(id, down);
          return [
            id,
            linked.length === 0
              ? index
              : linked.reduce((sum, other) => sum + (at.get(other) ?? 0), 0) /
                linked.length,
          ];
        }),
      );
      layer.sort((a, b) => (weight.get(a) ?? 0) - (weight.get(b) ?? 0));
    }
  }
  return layers;
}

type Placed = { x: number; y: number; width: number; height: number };

type Waypoint = {
  readonly id: string;
  readonly edge: number;
  readonly label: boolean;
};

function waypoints(
  edges: readonly DiagramEdge[],
  rank: ReadonlyMap<string, number>,
) {
  const points = new Map<string, Waypoint>();
  const chains = edges.map((edge, index) => {
    const from = (rank.get(edge.from) ?? 0) * 2;
    const to = (rank.get(edge.to) ?? 0) * 2;
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    const middle = low + 1 + 2 * Math.floor((high - low - 1) / 4);
    const between: string[] = [];
    for (let level = low + 1; level < high; level += 1) {
      const id = `\u0000${index}:${level}`;
      points.set(id, {
        id,
        edge: index,
        label: edge.label !== undefined && level === middle,
      });
      between.push(id);
    }
    return {
      levels: [low, ...between.map((_, at) => low + 1 + at), high],
      ids: from <= to ? between : [...between].reverse(),
      ahead: from <= to,
    };
  });
  return { points, chains };
}

function layered(
  diagram: StepDiagram,
  measure: DiagramMeasure,
  placement: 'right' | 'down',
): DiagramGeometry {
  const horizontal = placement === 'right';
  const ids = diagram.nodes.map((node) => node.id);
  const size = new Map(
    diagram.nodes.map((node) => [node.id, measure.node(node)]),
  );
  const rank = rankNodes(ids, diagram.edges);
  const { points, chains } = waypoints(diagram.edges, rank);
  for (const point of points.values()) {
    const text = diagram.edges[point.edge]?.label;
    const long =
      point.label && text !== undefined ? measure.label(text) : WAYPOINT;
    size.set(point.id, {
      width: long,
      height: point.label ? LABEL_HEIGHT : WAYPOINT,
    });
  }
  const level = new Map<string, number>([
    ...ids.map((id) => [id, (rank.get(id) ?? 0) * 2] as const),
    ...chains.flatMap((chain) =>
      chain.ids.map((id) => {
        const at = chain.ahead
          ? chain.levels[1 + chain.ids.indexOf(id)]
          : chain.levels[chain.ids.length - chain.ids.indexOf(id)];
        return [id, at ?? 0] as const;
      }),
    ),
  ]);
  const links = diagram.edges.flatMap((edge, index) => {
    const chain = chains[index];
    if (chain === undefined) return [];
    const path = [edge.from, ...chain.ids, edge.to];
    return path.slice(1).map((to, at) => ({ from: path[at] ?? to, to }));
  });
  const all = [...ids, ...points.keys()];
  const layers = orderRanks(all, links, level);
  const along = (id: string) =>
    horizontal ? (size.get(id)?.width ?? 0) : (size.get(id)?.height ?? 0);
  const across = (id: string) =>
    horizontal ? (size.get(id)?.height ?? 0) : (size.get(id)?.width ?? 0);
  const depth = layers.map((layer, index) =>
    Math.max(index % 2 === 1 ? SPAN[placement] : 0, ...layer.map(along)),
  );
  const breadth = layers.map(
    (layer) =>
      layer.reduce((sum, id) => sum + across(id), 0) +
      Math.max(0, layer.length - 1) * STACK_GAP[placement],
  );
  const widest = Math.max(...breadth);
  const box = new Map<string, Placed>();
  const bands: { start: number; end: number }[] = [];
  let offset = PAD;
  layers.forEach((layer, index) => {
    let cursor = PAD + (widest - (breadth[index] ?? 0)) / 2;
    const deep = depth[index] ?? 0;
    for (const id of layer) {
      const width = size.get(id)?.width ?? 0;
      const height = size.get(id)?.height ?? 0;
      const lead = offset + (deep - along(id)) / 2;
      box.set(
        id,
        horizontal
          ? { x: lead, y: cursor, width, height }
          : { x: cursor, y: lead, width, height },
      );
      cursor += across(id) + STACK_GAP[placement];
    }
    bands.push({ start: offset, end: offset + deep });
    offset += deep + (index < layers.length - 1 ? HALF_GAP[placement] : 0);
  });
  const pairs = new Map<string, number[]>();
  diagram.edges.forEach((edge, index) => {
    const key = [edge.from, edge.to].sort().join('\0');
    pairs.set(key, [...(pairs.get(key) ?? []), index]);
  });
  const point = (along: number, across: number): Point =>
    horizontal ? { x: along, y: across } : { x: across, y: along };
  const centre = (placed: Placed) =>
    horizontal ? placed.y + placed.height / 2 : placed.x + placed.width / 2;
  const edges = diagram.edges.flatMap((edge, index) => {
    const from = box.get(edge.from);
    const to = box.get(edge.to);
    const chain = chains[index];
    if (from === undefined || to === undefined || chain === undefined)
      return [];
    const siblings = pairs.get([edge.from, edge.to].sort().join('\0')) ?? [];
    const shift =
      (siblings.indexOf(index) - (siblings.length - 1) / 2) * 2 * PAIR_OFFSET;
    const sign = chain.ahead ? 1 : -1;
    const band = (id: string) => bands[level.get(id) ?? 0];
    const fromBand = band(edge.from);
    const toBand = band(edge.to);
    if (fromBand === undefined || toBand === undefined) return [];
    const near = (placed: Placed) =>
      horizontal
        ? chain.ahead
          ? placed.x + placed.width
          : placed.x
        : chain.ahead
          ? placed.y + placed.height
          : placed.y;
    const far = (placed: Placed) =>
      horizontal
        ? chain.ahead
          ? placed.x
          : placed.x + placed.width
        : chain.ahead
          ? placed.y
          : placed.y + placed.height;
    const route: Point[] = [
      point(near(from), centre(from) + shift),
      point(chain.ahead ? fromBand.end : fromBand.start, centre(from) + shift),
    ];
    let label: Point | undefined;
    for (const id of chain.ids) {
      const placed = box.get(id);
      const lane = band(id);
      if (placed === undefined || lane === undefined) continue;
      const line = centre(placed);
      route.push(
        point(chain.ahead ? lane.start : lane.end, line),
        point(chain.ahead ? lane.end : lane.start, line),
      );
      if (points.get(id)?.label)
        label = point((lane.start + lane.end) / 2, line);
    }
    route.push(
      point(chain.ahead ? toBand.start : toBand.end, centre(to) + shift),
      point(far(to), centre(to) + shift),
    );
    const segments: string[] = [];
    for (let at = 1; at < route.length; at += 1) {
      const start = route[at - 1]!;
      const end = route[at]!;
      const straight = horizontal ? start.y === end.y : start.x === end.x;
      segments.push(
        straight
          ? `L${round(end.x)} ${round(end.y)}`
          : curve(start, end, horizontal).path.replace(/^M\S+ \S+ /, ''),
      );
    }
    const first = route[0]!;
    const last = route.at(-1)!;
    const before = point(
      (horizontal ? last.x : last.y) - sign * ARROW,
      horizontal ? last.y : last.x,
    );
    const middle =
      label ?? route[Math.floor(route.length / 2) - 1] ?? point(0, 0);
    return [
      {
        index,
        path: `M${round(first.x)} ${round(first.y)} ${segments.join(' ')}`,
        arrow: arrowHead(last, before),
        label:
          edge.label === undefined
            ? undefined
            : { x: round(middle.x), y: round(middle.y) },
      },
    ];
  });
  const total = offset + PAD;
  const reach = widest + PAD * 2;
  return {
    placement,
    width: round(horizontal ? total : reach),
    height: round(horizontal ? reach : total),
    nodes: ids.flatMap((id) => {
      const placed = box.get(id);
      return placed === undefined
        ? []
        : [
            {
              id,
              x: round(placed.x),
              y: round(placed.y),
              width: placed.width,
              height: placed.height,
            },
          ];
    }),
    edges,
    lifelines: [],
  };
}

function sequence(
  diagram: StepDiagram,
  measure: DiagramMeasure,
): DiagramGeometry {
  const sizes = diagram.nodes.map((node) => measure.node(node));
  const column = new Map(diagram.nodes.map((node, index) => [node.id, index]));
  const gaps = sizes.slice(1).map((size, index) => {
    const before = sizes[index]?.width ?? 0;
    return before / 2 + size.width / 2 + SEQUENCE_SIDE_GAP;
  });
  const spans = diagram.edges
    .map((edge) => {
      const a = column.get(edge.from) ?? 0;
      const b = column.get(edge.to) ?? 0;
      return {
        low: Math.min(a, b),
        high: Math.max(a, b),
        need: edge.label ? measure.label(edge.label) + LABEL_ROOM : 0,
      };
    })
    .sort((a, b) => a.high - a.low - (b.high - b.low));
  for (const span of spans) {
    const have = gaps
      .slice(span.low, span.high)
      .reduce((sum, gap) => sum + gap, 0);
    if (have < span.need) {
      const extra = (span.need - have) / (span.high - span.low);
      for (let index = span.low; index < span.high; index += 1)
        gaps[index] = (gaps[index] ?? 0) + extra;
    }
  }
  const head = Math.max(...sizes.map((size) => size.height));
  const centres: number[] = [];
  sizes.forEach((size, index) => {
    centres.push(
      index === 0
        ? PAD + size.width / 2
        : (centres[index - 1] ?? 0) + (gaps[index - 1] ?? 0),
    );
  });
  const top = PAD + head;
  const rows = top + SEQUENCE_HEAD_GAP;
  const bottom = rows + Math.max(0, diagram.edges.length - 1) * SEQUENCE_ROW;
  const edges = diagram.edges.flatMap((edge, index) => {
    const a = centres[column.get(edge.from) ?? -1];
    const b = centres[column.get(edge.to) ?? -1];
    if (a === undefined || b === undefined) return [];
    const y = rows + index * SEQUENCE_ROW;
    const direction = Math.sign(b - a);
    const start = { x: a + direction * 2, y };
    const end = { x: b - direction * 2, y };
    return [
      {
        index,
        path: `M${round(start.x)} ${y} L${round(end.x)} ${y}`,
        arrow: arrowHead(end, start),
        label:
          edge.label === undefined
            ? undefined
            : { x: round((a + b) / 2), y: y - 9 },
      },
    ];
  });
  const last = sizes.at(-1)?.width ?? 0;
  return {
    placement: 'sequence',
    width: round((centres.at(-1) ?? 0) + last / 2 + PAD),
    height: round(bottom + 16 + PAD),
    nodes: diagram.nodes.map((node, index) => {
      const size = sizes[index] ?? { width: 0, height: 0 };
      return {
        id: node.id,
        x: round((centres[index] ?? 0) - size.width / 2),
        y: PAD + (head - size.height) / 2,
        width: size.width,
        height: size.height,
      };
    }),
    edges,
    lifelines: centres.map((x) => ({
      x: round(x),
      top,
      bottom: bottom + 16,
    })),
  };
}

export function layoutDiagram(
  diagram: StepDiagram,
  measure: DiagramMeasure,
  available: number,
): DiagramGeometry {
  if (diagram.layout === 'sequence') return sequence(diagram, measure);
  if (diagram.layout === 'layers') return layered(diagram, measure, 'down');
  const across = layered(diagram, measure, 'right');
  if (across.width <= available) return across;
  const down = layered(diagram, measure, 'down');
  return down.width < across.width ? down : across;
}

export function diagramNeighbours(diagram: StepDiagram, id: string) {
  const edges = new Set<number>();
  const nodes = new Set<string>([id]);
  diagram.edges.forEach((edge, index) => {
    if (edge.from !== id && edge.to !== id) return;
    edges.add(index);
    nodes.add(edge.from);
    nodes.add(edge.to);
  });
  return { nodes, edges };
}

export function diagramConnections(
  diagram: StepDiagram,
  id: string,
): readonly string[] {
  const label = (other: string) =>
    diagram.nodes.find((node) => node.id === other)?.label ?? other;
  const order = (index: number) =>
    diagram.layout === 'sequence' ? `${index + 1}. ` : '';
  const mark = (edge: DiagramEdge) =>
    edge.mark === 'added'
      ? ' (new)'
      : edge.mark === 'removed'
        ? ' (removed)'
        : '';
  return diagram.edges.flatMap((edge, index) => {
    const how = edge.label === undefined ? '' : ` (${edge.label})`;
    if (edge.from === id)
      return [`${order(index)}To ${label(edge.to)}${how}${mark(edge)}`];
    if (edge.to === id)
      return [`${order(index)}From ${label(edge.from)}${how}${mark(edge)}`];
    return [];
  });
}

export type DiagramKey = 'left' | 'right' | 'up' | 'down' | 'first' | 'last';

export function diagramStep(
  geometry: DiagramGeometry,
  current: string,
  key: DiagramKey,
): string {
  if (key === 'first') return geometry.nodes[0]?.id ?? current;
  if (key === 'last') return geometry.nodes.at(-1)?.id ?? current;
  const centre = (node: DiagramGeometry['nodes'][number]) => ({
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  });
  const here = geometry.nodes.find((node) => node.id === current);
  if (here === undefined) return geometry.nodes[0]?.id ?? current;
  const from = centre(here);
  const horizontal = key === 'left' || key === 'right';
  const sign = key === 'right' || key === 'down' ? 1 : -1;
  const ahead = geometry.nodes.flatMap((node) => {
    if (node.id === current) return [];
    const to = centre(node);
    const along = (horizontal ? to.x - from.x : to.y - from.y) * sign;
    const aside = Math.abs(horizontal ? to.y - from.y : to.x - from.x);
    const reach = horizontal
      ? (here.height + node.height) / 2
      : (here.width + node.width) / 2;
    return along > 1
      ? [{ id: node.id, along, aside, band: aside < reach }]
      : [];
  });
  const banded = ahead.filter((node) => node.band);
  const pool = banded.length > 0 ? banded : ahead;
  const nearest = Math.min(...pool.map((node) => node.along));
  const best = pool
    .filter((node) => node.along <= nearest + 8)
    .sort((a, b) => a.aside - b.aside)[0];
  return best?.id ?? current;
}

export type DiagramTextMetrics = {
  readonly label: number;
  readonly note: number;
  readonly edge: number;
  readonly padding: number;
  readonly sign: number;
  readonly chevron: number;
  readonly min: number;
  readonly max: number;
};

const NODE_HEIGHT = 30;
const NOTED_NODE_HEIGHT = 44;
const EDGE_LABEL_PAD = 8;

export function diagramTextMeasure(
  metrics: DiagramTextMetrics,
): DiagramMeasure {
  return {
    node: (node) => {
      const sign = node.mark && node.mark !== 'unchanged' ? metrics.sign : 0;
      const label =
        sign +
        node.label.length * metrics.label +
        (node.anchor ? metrics.chevron : 0);
      const note = node.note ? sign + node.note.length * metrics.note : 0;
      return {
        width: Math.round(
          Math.min(
            metrics.max,
            Math.max(metrics.min, Math.max(label, note) + metrics.padding),
          ),
        ),
        height: node.note ? NOTED_NODE_HEIGHT : NODE_HEIGHT,
      };
    },
    label: (text) => text.length * metrics.edge + EDGE_LABEL_PAD,
  };
}

const MARK_WORDS: Record<NonNullable<DiagramNode['mark']>, string> = {
  added: 'new',
  changed: 'changed',
  removed: 'removed',
  unchanged: 'unchanged',
};

export function diagramNodeSign(node: DiagramNode): string | undefined {
  return node.mark === undefined || node.mark === 'unchanged'
    ? undefined
    : growthSign({ change: node.mark, what: '', note: '' });
}

export function diagramNodeFacts(node: DiagramNode): string {
  return [
    node.kind,
    node.mark === undefined ? undefined : MARK_WORDS[node.mark],
  ]
    .filter(Boolean)
    .join(', ');
}

export function diagramNodeDescription(
  diagram: StepDiagram,
  node: DiagramNode,
): string {
  const facts = diagramNodeFacts(node);
  const connections = diagramConnections(diagram, node.id);
  let anchor = '';
  if (node.anchor?.kind === 'lines')
    anchor = `Shows ${node.anchor.excerpt.path}, ${node.anchor.excerpt.lines}.`;
  if (node.anchor?.kind === 'file') anchor = `Shows ${node.anchor.path}.`;
  return [
    facts ? `${facts}.` : '',
    connections.length > 0 ? `${connections.join('; ')}.` : '',
    anchor,
  ]
    .filter(Boolean)
    .join(' ');
}

export type DiagramEdgeTone = 'add' | 'del' | 'lit' | 'rest';

export function diagramEdgeTone(
  edge: DiagramEdge,
  lit: boolean,
): DiagramEdgeTone {
  if (edge.mark === 'added') return 'add';
  if (edge.mark === 'removed') return 'del';
  return lit ? 'lit' : 'rest';
}
