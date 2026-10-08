import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import type { Diagram, ReviewLayer, ReviewResponse } from './review.ts';
import { layerReviewState } from './reviewed.ts';

export function reviewUnderstanding(
  layers: readonly ReviewLayer[],
  marks: ListReviewedLayersResponse | undefined,
) {
  const states = layers.map((layer) => {
    const stale = layer.steps.some((step) => step.location.state === 'changed');
    return {
      layer,
      reviewed: !stale && layerReviewState(marks, layer).reviewed,
      stale,
    };
  });
  const reviewed = states.filter((state) => state.reviewed).length;
  return {
    states,
    reviewed,
    remaining: states.length - reviewed,
    stale: states.filter((state) => state.stale).length,
  };
}

export function layerDiagram(layer: ReviewLayer): Diagram {
  return {
    lanes: layer.lanes,
    boxes: layer.steps.map((step) => ({
      id: step.id,
      lane: step.lane,
      label: step.title,
      kind: 'component',
      ...(step.kind === 'changed' ? { change: 'changed' as const } : {}),
    })),
    arrows: layer.arrows ?? [],
  };
}

export function componentRelationships(diagram: Diagram, id: string) {
  const boxes = new Map(diagram.boxes.map((box) => [box.id, box]));
  return diagram.arrows.flatMap((arrow) => {
    const outgoing = arrow.from === id;
    if (!outgoing && arrow.to !== id) return [];
    const other = boxes.get(outgoing ? arrow.to : arrow.from);
    return other
      ? [{ other, outgoing, label: arrow.label ?? 'Relationship unspecified' }]
      : [];
  });
}

export function componentNeighborhood(diagram: Diagram, id: string): Diagram {
  if (!diagram.boxes.some((box) => box.id === id)) return diagram;
  const ids = new Set([
    id,
    ...componentRelationships(diagram, id).map(({ other }) => other.id),
  ]);
  const boxes = diagram.boxes.filter((box) => ids.has(box.id));
  const lanes = [...new Set(boxes.map((box) => box.lane))].sort(
    (left, right) => left - right,
  );
  return {
    lanes: lanes.map((lane) => diagram.lanes[lane] ?? ''),
    boxes: boxes.map((box) => ({ ...box, lane: lanes.indexOf(box.lane) })),
    arrows: diagram.arrows.filter(
      (arrow) => ids.has(arrow.from) && ids.has(arrow.to),
    ),
  };
}

export function reviewCoverage(
  review: Pick<ReviewResponse, 'notExplained' | 'layers' | 'diagnostics'>,
) {
  return {
    gaps: review.notExplained.length,
    stale: review.layers.flatMap((layer) =>
      layer.steps.filter((step) => step.location.state === 'changed'),
    ).length,
    available: review.diagnostics === 'current',
  };
}
