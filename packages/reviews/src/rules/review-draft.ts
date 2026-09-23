import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import type { Diagram, LayerDraft, ReviewDraft } from '../models/review.ts';

function repeats(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function assertUniqueStepIds(layer: LayerDraft): void {
  if (repeats(layer.steps.map((step) => step.id)))
    throw new DuplicateStepIdError();
}

export function assertStepLanesExist(layer: LayerDraft): void {
  if (layer.steps.some((step) => step.lane >= layer.lanes.length))
    throw new StepLaneOutOfRangeError();
}

export function assertLayerArrowsJoinSteps(layer: LayerDraft): void {
  const steps = new Set(layer.steps.map((step) => step.id));
  if (
    (layer.arrows ?? []).some(
      (arrow) => !steps.has(arrow.from) || !steps.has(arrow.to),
    )
  )
    throw new UnknownArrowStepError();
}

export function assertBoxLanesExist(diagram: Diagram): void {
  if (diagram.boxes.some((box) => box.lane >= diagram.lanes.length))
    throw new BoxLaneOutOfRangeError();
}

export function assertDiagramArrowsJoinBoxes(diagram: Diagram): void {
  const boxes = new Set(diagram.boxes.map((box) => box.id));
  if (
    diagram.arrows.some(
      (arrow) => !boxes.has(arrow.from) || !boxes.has(arrow.to),
    )
  )
    throw new UnknownArrowBoxError();
}

export function assertUniqueLayerIds(draft: ReviewDraft): void {
  if (repeats(draft.layers.map((layer) => layer.id)))
    throw new DuplicateLayerIdError();
}

export function assertReviewDraft(draft: ReviewDraft): void {
  assertUniqueLayerIds(draft);
  for (const layer of draft.layers) {
    assertUniqueStepIds(layer);
    assertStepLanesExist(layer);
    assertLayerArrowsJoinSteps(layer);
  }
  const diagrams = draft.diagram
    ? [
        draft.diagram.after,
        ...(draft.diagram.before ? [draft.diagram.before] : []),
      ]
    : [];
  for (const diagram of diagrams) {
    assertBoxLanesExist(diagram);
    assertDiagramArrowsJoinBoxes(diagram);
  }
}
