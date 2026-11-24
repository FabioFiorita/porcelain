import type {
  WalkthroughModel,
  WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
export const builtInWalkthroughWriter: WalkthroughWriterChoice = {
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
};

export function unsupportedWalkthroughEffortMessage(
  label: string,
  effort: string,
) {
  return `${label} doesn't support ${effort} effort.`;
}

export function walkthroughWriterAvailability(
  writer: WalkthroughWriterChoice,
  models: readonly WalkthroughModel[],
) {
  const model = models.find(
    (model) =>
      model.provider === writer.provider && model.model === writer.model,
  );
  if (!model) return { kind: 'missing-model' } as const;
  return {
    kind: model.efforts.includes(writer.effort)
      ? 'ready'
      : 'unsupported-effort',
    model,
  } as const;
}

export function unsupportedWalkthroughEffort(
  writer: WalkthroughWriterChoice,
  models: readonly WalkthroughModel[],
) {
  const availability = walkthroughWriterAvailability(writer, models);
  if (availability.kind === 'unsupported-effort')
    return {
      label: availability.model.label,
      effort: writer.effort,
    };
}
