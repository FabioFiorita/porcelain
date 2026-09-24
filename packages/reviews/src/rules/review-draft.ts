import type {
  Diagram,
  LayerDraft,
  ReviewDraft,
  ReviewDraftProblem,
} from '../models/review.ts';

function repeats(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function layerProblem(layer: LayerDraft): ReviewDraftProblem | undefined {
  if (repeats(layer.steps.map((step) => step.id)))
    return { kind: 'duplicate-step-id' };
  if (layer.steps.some((step) => step.pointer.endLine < step.pointer.startLine))
    return { kind: 'reversed-pointer' };
  if (layer.steps.some((step) => step.lane >= layer.lanes.length))
    return { kind: 'step-lane-out-of-range' };
  const steps = new Set(layer.steps.map((step) => step.id));
  if (
    (layer.arrows ?? []).some(
      (arrow) => !steps.has(arrow.from) || !steps.has(arrow.to),
    )
  )
    return { kind: 'unknown-arrow-step' };
  return undefined;
}

function diagramProblem(diagram: Diagram): ReviewDraftProblem | undefined {
  if (diagram.boxes.some((box) => box.lane >= diagram.lanes.length))
    return { kind: 'box-lane-out-of-range' };
  const boxes = new Set(diagram.boxes.map((box) => box.id));
  if (
    diagram.arrows.some(
      (arrow) => !boxes.has(arrow.from) || !boxes.has(arrow.to),
    )
  )
    return { kind: 'unknown-arrow-box' };
  return undefined;
}

export function reviewDraftProblem(
  draft: ReviewDraft,
): ReviewDraftProblem | undefined {
  if (repeats(draft.layers.map((layer) => layer.id)))
    return { kind: 'duplicate-layer-id' };
  const diagrams = draft.diagram
    ? [
        draft.diagram.after,
        ...(draft.diagram.before ? [draft.diagram.before] : []),
      ]
    : [];
  return (
    draft.layers.map(layerProblem).find((problem) => problem !== undefined) ??
    diagrams.map(diagramProblem).find((problem) => problem !== undefined)
  );
}
