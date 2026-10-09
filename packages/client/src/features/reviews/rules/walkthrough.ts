import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type {
  DiagramBox,
  ReviewLayer,
  ReviewResponse,
  ReviewStatus,
} from './review.ts';
import { layerReviewed } from './reviewed.ts';
import { isSpecPath } from './spec-paths.ts';

type Gap = ReviewResponse['notExplained'][number];

export type WalkthroughKey =
  | 'briefing'
  | 'unexplained'
  | 'specs'
  | `decision:${string}`;

type ElsewhereFile = { path: string; stop: WalkthroughKey };

export type WalkthroughStop =
  | { kind: 'briefing'; key: 'briefing'; paths: readonly string[] }
  | {
      kind: 'decision';
      key: `decision:${string}`;
      number: number;
      layer: ReviewLayer;
      paths: readonly string[];
      elsewhere: readonly ElsewhereFile[];
    }
  | {
      kind: 'unexplained';
      key: 'unexplained';
      paths: readonly string[];
      partial: readonly (Gap & { stop: WalkthroughKey })[];
    }
  | { kind: 'specs'; key: 'specs'; paths: readonly string[] };

export function decisionKey(layerId: string): `decision:${string}` {
  return `decision:${layerId}`;
}

export function walkthroughStops(
  review: Pick<ReviewResponse, 'layers' | 'notExplained'>,
  changedPaths: readonly string[],
  { specsApart }: { specsApart: boolean },
): WalkthroughStop[] {
  const changed = new Set(changedPaths);
  const apart = (path: string) => specsApart && isSpecPath(path);
  const owner = new Map<string, WalkthroughKey>();
  const decisions = review.layers.map((layer, index) => {
    const key = decisionKey(layer.id);
    const pointed = [
      ...new Set(
        layer.steps
          .filter((step) => step.kind === 'changed')
          .map((step) => step.pointer.path)
          .filter((path) => changed.has(path)),
      ),
    ];
    const paths: string[] = [];
    const elsewhere: ElsewhereFile[] = [];
    for (const path of pointed) {
      const claimed = apart(path) ? 'specs' : owner.get(path);
      if (claimed) {
        elsewhere.push({ path, stop: claimed });
        continue;
      }
      owner.set(path, key);
      paths.push(path);
    }
    return {
      kind: 'decision' as const,
      key,
      number: index + 1,
      layer,
      paths,
      elsewhere,
    };
  });
  const specs = changedPaths.filter(apart);
  const leftover = changedPaths.filter(
    (path) => !owner.has(path) && !apart(path),
  );
  const partial = review.notExplained.flatMap((gap) => {
    const stop =
      apart(gap.path) && changed.has(gap.path) ? 'specs' : owner.get(gap.path);
    return stop ? [{ ...gap, stop }] : [];
  });
  return [
    { kind: 'briefing', key: 'briefing', paths: [] },
    ...decisions,
    ...(leftover.length > 0 || partial.length > 0
      ? [
          {
            kind: 'unexplained' as const,
            key: 'unexplained' as const,
            paths: leftover,
            partial,
          },
        ]
      : []),
    ...(specs.length > 0
      ? [{ kind: 'specs' as const, key: 'specs' as const, paths: specs }]
      : []),
  ];
}

export function currentStop(
  stops: readonly WalkthroughStop[],
  key: string | undefined,
): WalkthroughStop {
  return (
    stops.find((stop) => stop.key === key) ??
    stops[0] ?? { kind: 'briefing', key: 'briefing', paths: [] }
  );
}

export function neighbourStop(
  stops: readonly WalkthroughStop[],
  key: WalkthroughKey,
  direction: 1 | -1,
): WalkthroughStop | undefined {
  const index = stops.findIndex((stop) => stop.key === key);
  return index === -1 ? undefined : stops[index + direction];
}

type Reviewable = { path: string; reviewStatus: ReviewStatus };

export function filesReviewed(
  paths: readonly string[],
  items: readonly Reviewable[],
) {
  const status = new Map(items.map((item) => [item.path, item.reviewStatus]));
  const reviewed = paths.filter(
    (path) => status.get(path) === 'reviewed',
  ).length;
  return { reviewed, total: paths.length, done: reviewed === paths.length };
}

export function stopName(stop: WalkthroughStop): string {
  switch (stop.kind) {
    case 'briefing':
      return 'Briefing';
    case 'decision':
      return stop.layer.title;
    case 'unexplained':
      return 'Not explained';
    case 'specs':
      return 'Specs';
  }
}

export function stopTitle(stop: WalkthroughStop): string {
  return stop.kind === 'decision'
    ? `${stop.number}. ${stopName(stop)}`
    : stopName(stop);
}

export type DecisionState = { reviewed: boolean; stale: boolean };

export function stopDone(
  stop: WalkthroughStop,
  items: readonly Reviewable[],
  decisions: ReadonlyMap<string, DecisionState>,
): boolean {
  if (stop.kind === 'briefing') return false;
  const files = filesReviewed(stop.paths, items).done;
  return stop.kind === 'decision'
    ? files && decisions.get(stop.layer.id)?.reviewed === true
    : files;
}

export function decisionStates(
  layers: readonly ReviewLayer[],
  marks: ListReviewedLayersResponse | undefined,
): Map<string, DecisionState> {
  return new Map(
    layers.map((layer) => {
      const stale = layer.steps.some(
        (step) => step.location.state === 'changed',
      );
      return [layer.id, { stale, reviewed: layerReviewed(marks, layer) }];
    }),
  );
}

export function decisionRoute(layer: ReviewLayer): string[] {
  const route: string[] = [];
  for (const step of layer.steps) {
    if (step.kind !== 'changed') continue;
    const lane = layer.lanes[step.lane];
    if (lane !== undefined && route.at(-1) !== lane) route.push(lane);
  }
  return route;
}

export type SystemPart = {
  id: string;
  label: string;
  detail: string | undefined;
  problem: string | undefined;
  decision: number | undefined;
};

function partOf(review: Pick<ReviewResponse, 'layers'>) {
  const numbers = new Map(
    review.layers.map((layer, index) => [layer.id, index + 1]),
  );
  return (box: DiagramBox): SystemPart => ({
    id: box.id,
    label: box.label,
    detail: box.detail,
    problem: box.problem,
    decision: box.layerId === undefined ? undefined : numbers.get(box.layerId),
  });
}

export function systemChanges(
  review: Pick<ReviewResponse, 'diagram' | 'layers'>,
) {
  const part = partOf(review);
  const boxes = review.diagram?.after.boxes ?? [];
  const titles = new Set(review.layers.map((layer) => layer.title));
  const owners = boxes.filter((box) => !titles.has(box.label));
  return {
    added: owners.filter((box) => box.change === 'new').map(part),
    changed: owners.filter((box) => box.change === 'changed').map(part),
    removed: owners.filter((box) => box.change === 'removed').map(part),
    questions: boxes.filter((box) => box.problem !== undefined).map(part),
  };
}

export type DecisionLink = {
  verb: string;
  outgoing: boolean;
  part: SystemPart;
  change: DiagramBox['change'];
};

export function decisionLinks(
  review: Pick<ReviewResponse, 'diagram' | 'layers'>,
  layerId: string,
): DecisionLink[] {
  const diagram = review.diagram?.after;
  if (!diagram) return [];
  const part = partOf(review);
  const boxes = new Map(diagram.boxes.map((box) => [box.id, box]));
  const own = new Set(
    diagram.boxes.filter((box) => box.layerId === layerId).map((box) => box.id),
  );
  const seen = new Set<string>();
  return diagram.arrows.flatMap((arrow) => {
    const outgoing = own.has(arrow.from);
    if (outgoing === own.has(arrow.to)) return [];
    const other = boxes.get(outgoing ? arrow.to : arrow.from);
    if (!other || seen.has(other.id)) return [];
    seen.add(other.id);
    return [
      {
        verb: arrow.label ?? 'relates to',
        outgoing,
        change: other.change,
        part: part(other),
      },
    ];
  });
}
