import type { ReviewLayer, ReviewStep, DiagramBox } from './review.ts';

export function teachRequest(layer: Pick<ReviewLayer, 'title'>) {
  return `Decision: ${layer.title}\n\nTeach me this decision in plain words. Why choose this over the alternatives? What did it trade off? Reply on this thread.`;
}

export function optionRequest(
  part: Pick<DiagramBox, 'label' | 'problem'>,
  option: NonNullable<DiagramBox['options']>[number],
) {
  return `Question: ${part.label}\n\n${part.problem ?? ''}\n\nI choose “${option.label}”. ${option.consequence}`;
}

export function guardRequest(step: ReviewStep) {
  return `Add a guard for this past mistake at ${step.pointer.path}:${step.pointer.startLine}–${step.pointer.endLine} (${step.title}). Choose the strongest suitable layer: architecture, types, a lint rule, then a test; use words only as a last resort. Prove the guard fails on the past mistake, then passes with the fix. Open one pull request per guard and leave each waiting for the owner's approval. This request does not authorize merging.`;
}
