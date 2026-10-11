import type {
  Diagram,
  LayerDraft,
  ReviewDraft,
  ReviewDraftProblem,
} from '../models/review.ts';
import { proofTargetsKnown } from './review-proof.ts';

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
  return undefined;
}

function diagramProblem(
  diagram: Diagram,
  layers: readonly LayerDraft[],
): ReviewDraftProblem | undefined {
  const layerIds = new Set(layers.map((layer) => layer.id));
  if (
    diagram.boxes.some(
      (box) => box.layerId !== undefined && !layerIds.has(box.layerId),
    )
  )
    return { kind: 'unknown-box-layer' };
  const decisions = diagram.boxes.filter((box) => box.decision);
  if (
    decisions.some((box) => box.layerId === undefined) ||
    repeats(decisions.map((box) => box.layerId ?? ''))
  )
    return { kind: 'invalid-decision-box' };
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
  return (
    draft.layers.map(layerProblem).find((problem) => problem !== undefined) ??
    (draft.diagram
      ? diagramProblem(draft.diagram.after, draft.layers)
      : undefined) ??
    (proofTargetsKnown(draft.proof, draft.layers)
      ? undefined
      : { kind: 'unknown-proof-target' })
  );
}
