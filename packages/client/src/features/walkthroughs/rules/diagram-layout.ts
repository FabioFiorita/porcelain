import type { DiagramEdge, DiagramNode, StepDiagram } from './blocks.ts';

export type DiagramPlacement = 'right' | 'down' | 'sequence';

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
const RANK_GAP = { right: 56, down: 48 };
const LABEL_ROOM = 24;
const ARROW = 6;
const PAIR_OFFSET = 8;
const LANE_GAP = 14;
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

function bowed(start: Point, end: Point, lane: number, horizontal: boolean) {
  const point = (along: number, across: number) =>
    horizontal ? { x: along, y: across } : { x: across, y: along };
  const a = (item: Point) => (horizontal ? item.x : item.y);
  const c = (item: Point) => (horizontal ? item.y : item.x);
  const middle = (a(start) + a(end)) / 2;
  const first = (middle - a(start)) / 2;
  const second = (a(end) - middle) / 2;
  const p1 = point(a(start) + first, c(start));
  const p2 = point(middle - first, lane);
  const p3 = point(middle, lane);
  const p4 = point(middle + second, lane);
  const p5 = point(a(end) - second, c(end));
  const text = (item: Point) => `${round(item.x)} ${round(item.y)}`;
  return {
    path: `M${text(start)} C${text(p1)} ${text(p2)} ${text(p3)} C${text(p4)} ${text(p5)} ${text(end)}`,
    arrow: arrowHead(end, p5),
    middle: { x: round(p3.x), y: round(p3.y) },
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
  const layers = orderRanks(ids, diagram.edges, rank);
  const along = (id: string) =>
    horizontal ? (size.get(id)?.width ?? 0) : (size.get(id)?.height ?? 0);
  const across = (id: string) =>
    horizontal ? (size.get(id)?.height ?? 0) : (size.get(id)?.width ?? 0);
  const depth = layers.map((layer) => Math.max(0, ...layer.map(along)));
  const breadth = layers.map(
    (layer) =>
      layer.reduce((sum, id) => sum + across(id), 0) +
      Math.max(0, layer.length - 1) * STACK_GAP[placement],
  );
  const gaps = layers.slice(1).map((_, index) => {
    const labels = diagram.edges.flatMap((edge) => {
      const low = Math.min(rank.get(edge.from) ?? 0, rank.get(edge.to) ?? 0);
      return low === index && edge.label ? [measure.label(edge.label)] : [];
    });
    return horizontal
      ? Math.max(RANK_GAP.right, Math.max(0, ...labels) + LABEL_ROOM)
      : RANK_GAP.down + (labels.length > 0 ? 8 : 0);
  });
  const widest = Math.max(...breadth);
  const box = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  let offset = PAD;
  layers.forEach((layer, index) => {
    let cursor = PAD + (widest - (breadth[index] ?? 0)) / 2;
    for (const id of layer) {
      const width = size.get(id)?.width ?? 0;
      const height = size.get(id)?.height ?? 0;
      const lead = offset + ((depth[index] ?? 0) - along(id)) / 2;
      box.set(
        id,
        horizontal
          ? { x: lead, y: cursor, width, height }
          : { x: cursor, y: lead, width, height },
      );
      cursor += across(id) + STACK_GAP[placement];
    }
    offset += (depth[index] ?? 0) + (gaps[index] ?? 0);
  });
  const pairs = new Map<string, number[]>();
  diagram.edges.forEach((edge, index) => {
    const key = [edge.from, edge.to].sort().join('\0');
    pairs.set(key, [...(pairs.get(key) ?? []), index]);
  });
  let reach = widest + PAD * 2;
  const edges = diagram.edges.flatMap((edge, index) => {
    const from = box.get(edge.from);
    const to = box.get(edge.to);
    if (from === undefined || to === undefined) return [];
    const siblings = pairs.get([edge.from, edge.to].sort().join('\0')) ?? [];
    const shift =
      (siblings.indexOf(index) - (siblings.length - 1) / 2) * 2 * PAIR_OFFSET;
    const ahead = (rank.get(edge.to) ?? 0) >= (rank.get(edge.from) ?? 0);
    const start = horizontal
      ? {
          x: ahead ? from.x + from.width : from.x,
          y: from.y + from.height / 2 + shift,
        }
      : {
          x: from.x + from.width / 2 + shift,
          y: ahead ? from.y + from.height : from.y,
        };
    const end = horizontal
      ? { x: ahead ? to.x : to.x + to.width, y: to.y + to.height / 2 + shift }
      : {
          x: to.x + to.width / 2 + shift,
          y: ahead ? to.y : to.y + to.height,
        };
    const low = Math.min(rank.get(edge.from) ?? 0, rank.get(edge.to) ?? 0);
    const high = Math.max(rank.get(edge.from) ?? 0, rank.get(edge.to) ?? 0);
    const between = layers
      .slice(low + 1, high)
      .flat()
      .flatMap((id) => {
        const placed = box.get(id);
        if (placed === undefined) return [];
        return horizontal
          ? [[placed.y, placed.y + placed.height] as const]
          : [[placed.x, placed.x + placed.width] as const];
      });
    let drawn = curve(start, end, horizontal);
    if (between.length > 0) {
      const mean = horizontal ? (start.y + end.y) / 2 : (start.x + end.x) / 2;
      const before = Math.min(...between.map(([first]) => first)) - LANE_GAP;
      const after = Math.max(...between.map(([, last]) => last)) + LANE_GAP;
      const lane =
        before >= PAD / 2 && Math.abs(before - mean) < Math.abs(after - mean)
          ? before
          : after;
      reach = Math.max(reach, lane + LANE_GAP);
      drawn = bowed(start, end, lane, horizontal);
    }
    return [
      {
        index,
        path: drawn.path,
        arrow: drawn.arrow,
        label: edge.label === undefined ? undefined : drawn.middle,
      },
    ];
  });
  const total = offset + PAD;
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
