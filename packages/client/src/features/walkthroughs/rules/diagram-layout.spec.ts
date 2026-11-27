import { describe, expect, it } from 'vite-plus/test';
import type { DiagramNode, StepDiagram } from './blocks.ts';
import {
  diagramTextMeasure,
  layoutDiagram,
  type DiagramGeometry,
  type DiagramMeasure,
} from './diagram-layout.ts';

const web = diagramTextMeasure({
  label: 8.1,
  note: 5.6,
  edge: 5.4,
  padding: 24,
  sign: 12,
  chevron: 16,
  min: 88,
  max: 232,
});
const phone = diagramTextMeasure({
  label: 7.3,
  note: 6.2,
  edge: 6.2,
  padding: 22,
  sign: 12,
  chevron: 0,
  min: 72,
  max: 200,
});

const LABEL_HEIGHT = 14;
const EDGE_SAMPLES = 40;

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

const node = (
  id: string,
  label: string,
  extra: Partial<DiagramNode> = {},
): DiagramNode => ({
  id,
  label,
  kind: 'function',
  note: undefined,
  mark: undefined,
  anchor: undefined,
  ...extra,
});

const lines = (path: string) =>
  ({
    kind: 'lines',
    excerpt: {
      path,
      side: 'new',
      start: 1,
      end: 3,
      caption: '',
      position: 2,
      lines: 'New lines 1–3',
      span: { startLine: 1, endLine: 3 },
    },
  }) as const;

const emptyQuery: StepDiagram = {
  title: 'An empty query, end to end',
  layout: 'sequence',
  nodes: [
    node('view', 'renderSearch', {
      mark: 'added',
      anchor: lines('src/search-view.ts'),
    }),
    node('search', 'findNotes', {
      mark: 'added',
      anchor: lines('src/search.ts'),
    }),
    node('label', 'resultLabel', {
      mark: 'added',
      anchor: lines('src/results.ts'),
    }),
  ],
  edges: [
    { from: 'view', to: 'search', label: 'query ""' },
    { from: 'search', to: 'view', label: 'every note' },
    { from: 'view', to: 'label', label: 'matches.length' },
    { from: 'label', to: 'view', label: '"3 notes found"' },
  ],
};

const matchingApart: StepDiagram = {
  title: 'Matching and wording stay apart',
  layout: 'flow',
  nodes: [
    node('view', 'search-view.ts', {
      kind: 'file',
      note: 'Builds the heading and the list',
      mark: 'added',
      anchor: { kind: 'file', path: 'src/search-view.ts' },
    }),
    node('search', 'findNotes', {
      note: 'Case-insensitive title match',
      mark: 'added',
      anchor: lines('src/search.ts'),
    }),
    node('label', 'resultLabel', {
      note: 'Formats “N notes found”',
      mark: 'added',
      anchor: lines('src/results.ts'),
    }),
    node('notes', 'notes: readonly string[]', {
      kind: 'type',
      note: 'Passed in by the caller',
    }),
  ],
  edges: [
    { from: 'view', to: 'search', label: 'calls' },
    { from: 'view', to: 'label', label: 'passes count' },
    { from: 'search', to: 'notes', label: 'filters' },
  ],
};

const streamingImport: StepDiagram = {
  title:
    'Twelve parts of the streaming import and how a failed batch is retried',
  layout: 'flow',
  nodes: [
    node('import', 'importRepository', {
      mark: 'added',
      note: 'Splits the repository walk into batches',
      anchor: lines('src/import.ts'),
    }),
    node('legacy', 'LegacyImporter.readAll', {
      mark: 'removed',
      note: 'Retries twice',
    }),
    node('module', 'repository-import.ts', {
      kind: 'file',
      mark: 'changed',
      note: 'Splits the repository walk into batches',
    }),
    node('scheduler', 'BatchScheduler.enqueue', {
      mark: 'changed',
      note: 'Retries twice',
      anchor: lines('src/scheduler.ts'),
    }),
    node('read', 'readBatchFromDisk', { anchor: lines('src/read.ts') }),
    node('parse', 'parseManifestStreaming', {
      note: 'Splits the repository walk into batches',
    }),
    node('budget', 'RetryBudget.consume', {
      mark: 'added',
      note: 'Retries twice',
    }),
    node('cache', 'ManifestCache.lookupOrRead', { note: 'Retries twice' }),
    node('progress', 'emitProgressEvent', { mark: 'changed' }),
    node('errors', 'ImportErrorReporter', { mark: 'added' }),
    node('bridge', 'EditorBridge.yieldFrame', {
      note: 'Splits the repository walk into batches',
    }),
    node('telemetry', 'telemetry.recordBatch'),
  ],
  edges: [
    {
      from: 'import',
      to: 'legacy',
      label: 'falls back to legacy',
      mark: 'removed',
    },
    { from: 'import', to: 'module', label: 'defined in' },
    {
      from: 'import',
      to: 'scheduler',
      label: 'schedules batch',
      mark: 'added',
    },
    { from: 'module', to: 'scheduler', label: 'exports' },
    { from: 'legacy', to: 'scheduler' },
    { from: 'scheduler', to: 'read', label: 'reads 500 files' },
    { from: 'read', to: 'parse', label: 'streams manifest' },
    { from: 'parse', to: 'budget', label: 'retry on failure' },
    { from: 'parse', to: 'cache', label: 'caches manifest' },
    { from: 'parse', to: 'progress', label: 'emits parsed' },
    { from: 'read', to: 'progress', label: 'reports progress', mark: 'added' },
    { from: 'budget', to: 'errors', label: 'gives up' },
    { from: 'progress', to: 'bridge', label: 'yields frame' },
    { from: 'cache', to: 'bridge', label: 'records hit' },
    { from: 'errors', to: 'telemetry', label: 'records failure' },
    { from: 'bridge', to: 'telemetry' },
    { from: 'scheduler', to: 'errors', label: 'reports error' },
    { from: 'cache', to: 'read', label: 'reads on miss' },
  ],
};

function cubic(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x:
      u * u * u * a.x +
      3 * u * u * t * b.x +
      3 * u * t * t * c.x +
      t ** 3 * d.x,
    y:
      u * u * u * a.y +
      3 * u * u * t * b.y +
      3 * u * t * t * c.y +
      t ** 3 * d.y,
  };
}

function pathPoints(path: string): Point[] {
  const tokens = path.match(/[MCL]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  let index = 0;
  const point = () => {
    const x = Number(tokens[index]);
    const y = Number(tokens[index + 1]);
    index += 2;
    return { x, y };
  };
  while (index < tokens.length) {
    const command = tokens[index];
    index += 1;
    if (command === 'M') {
      at = point();
      points.push(at);
    } else if (command === 'L') {
      const end = point();
      for (let step = 1; step <= EDGE_SAMPLES; step += 1) {
        const t = step / EDGE_SAMPLES;
        points.push({
          x: at.x + (end.x - at.x) * t,
          y: at.y + (end.y - at.y) * t,
        });
      }
      at = end;
    } else if (command === 'C') {
      const first = point();
      const second = point();
      const end = point();
      for (let step = 1; step <= EDGE_SAMPLES; step += 1)
        points.push(cubic(at, first, second, end, step / EDGE_SAMPLES));
      at = end;
    }
  }
  return points;
}

const inside = (point: Point, box: Box, inset: number) =>
  point.x > box.x + inset &&
  point.x < box.x + box.width - inset &&
  point.y > box.y + inset &&
  point.y < box.y + box.height - inset;

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

function labelBoxes(
  diagram: StepDiagram,
  geometry: DiagramGeometry,
  measure: DiagramMeasure,
) {
  return geometry.edges.flatMap((placed) => {
    const text = diagram.edges[placed.index]?.label;
    if (!placed.label || text === undefined) return [];
    const width = measure.label(text);
    return [
      {
        index: placed.index,
        box: {
          x: placed.label.x - width / 2,
          y: placed.label.y - LABEL_HEIGHT / 2,
          width,
          height: LABEL_HEIGHT,
        },
      },
    ];
  });
}

function check(
  diagram: StepDiagram,
  geometry: DiagramGeometry,
  measure: DiagramMeasure,
): string[] {
  const found: string[] = [];
  const boxes = new Map(geometry.nodes.map((placed) => [placed.id, placed]));
  geometry.nodes.forEach((a, index) =>
    geometry.nodes.slice(index + 1).forEach((b) => {
      if (overlap(a, b)) found.push(`nodes ${a.id} and ${b.id} overlap`);
    }),
  );
  for (const placed of geometry.nodes) {
    const wanted = measure.node(
      diagram.nodes.find((item) => item.id === placed.id)!,
    );
    if (placed.width < wanted.width || placed.height < wanted.height)
      found.push(`node ${placed.id} is smaller than its label`);
  }
  for (const placed of geometry.edges) {
    const edge = diagram.edges[placed.index]!;
    for (const [id, box] of boxes) {
      if (id === edge.from || id === edge.to) continue;
      if (pathPoints(placed.path).some((point) => inside(point, box, 2)))
        found.push(`edge ${edge.from}→${edge.to} crosses ${id}`);
    }
  }
  const labels = labelBoxes(diagram, geometry, measure);
  labels.forEach(({ index, box }, position) => {
    const edge = diagram.edges[index]!;
    for (const placed of geometry.nodes)
      if (overlap(box, placed))
        found.push(`label of ${edge.from}→${edge.to} covers ${placed.id}`);
    for (const other of labels.slice(position + 1))
      if (overlap(box, other.box)) {
        const next = diagram.edges[other.index]!;
        found.push(
          `labels of ${edge.from}→${edge.to} and ${next.from}→${next.to} overlap`,
        );
      }
  });
  return found;
}

const problems = (
  diagram: StepDiagram,
  measure: DiagramMeasure,
  available: number,
) => check(diagram, layoutDiagram(diagram, measure, available), measure);

const size = (diagram: StepDiagram, measure: DiagramMeasure, width: number) => {
  const geometry = layoutDiagram(diagram, measure, width);
  return {
    placement: geometry.placement,
    width: geometry.width,
    height: geometry.height,
  };
};

it('names overlapping nodes, an edge through a node and a label over a node', () => {
  const crowded: StepDiagram = {
    title: undefined,
    layout: 'flow',
    nodes: [node('a', 'a'), node('b', 'b'), node('c', 'c')],
    edges: [{ from: 'a', to: 'c', label: 'through b' }],
  };
  const geometry: DiagramGeometry = {
    placement: 'down',
    width: 300,
    height: 300,
    nodes: [
      { id: 'a', x: 0, y: 0, width: 88, height: 30 },
      { id: 'b', x: 40, y: 20, width: 88, height: 30 },
      { id: 'c', x: 0, y: 200, width: 88, height: 30 },
    ],
    edges: [
      {
        index: 0,
        path: 'M44 30 L44 200',
        arrow: '44,200 41,194 47,194',
        label: { x: 60, y: 35 },
      },
    ],
    lifelines: [],
  };
  expect(check(crowded, geometry, web)).toEqual([
    'nodes a and b overlap',
    'edge a→c crosses b',
    'label of a→c covers a',
    'label of a→c covers b',
  ]);
});

describe('layoutDiagram on the shared sample', () => {
  it.each([
    ['web', web, 720],
    ['phone', phone, 360],
  ] as const)(
    'draws the sequence sample without overlaps on the %s',
    (_, measure, width) => {
      expect(problems(emptyQuery, measure, width)).toEqual([]);
    },
  );

  it.each([
    ['web', web, 720],
    ['phone', phone, 360],
    ['tablet', phone, 1100],
  ] as const)(
    'draws the flow sample without overlaps on the %s',
    (_, measure, width) => {
      expect(problems(matchingApart, measure, width)).toEqual([]);
    },
  );

  it.each([
    ['sequence sample, web', emptyQuery, web, 720, 'sequence', 511, 202],
    ['sequence sample, phone', emptyQuery, phone, 360, 'sequence', 432, 202],
    ['flow sample, web', matchingApart, web, 720, 'down', 414, 276],
    ['flow sample, phone', matchingApart, phone, 360, 'down', 433, 276],
    ['flow sample, tablet', matchingApart, phone, 1100, 'right', 810.8, 136],
  ] as const)(
    'keeps the %s in its direction and no larger than before',
    (_, diagram, measure, width, placement, most, tallest) => {
      const drawn = size(diagram, measure, width);
      expect(drawn.placement).toBe(placement);
      expect(drawn.width).toBeLessThanOrEqual(most);
      expect(drawn.height).toBeLessThanOrEqual(tallest);
    },
  );
});

describe('layoutDiagram at the node limit', () => {
  it.each([
    ['web', web, 720],
    ['phone', phone, 360],
  ] as const)(
    'keeps twelve nodes, their edges and labels apart on the %s',
    (_, measure, width) => {
      expect(problems(streamingImport, measure, width)).toEqual([]);
    },
  );
});
