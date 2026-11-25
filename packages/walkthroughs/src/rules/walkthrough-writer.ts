import { Schema } from 'effect';
import {
  claudeEffortSchema,
  type WalkthroughModel,
  type WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
const isClaudeEffort = Schema.is(claudeEffortSchema);
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

export function codexModelFamily(slug: string) {
  const family = /^gpt-\d+(?:\.\d+)*-([a-z]+)$/.exec(slug)?.[1];
  return family && `${family.charAt(0).toUpperCase()}${family.slice(1)}`;
}

export function latestWalkthroughWriter(
  writer: WalkthroughWriterChoice,
  models: readonly WalkthroughModel[],
): WalkthroughWriterChoice {
  if (writer.latest === undefined) return writer;
  const newest = models.find(
    (model) =>
      model.provider === writer.provider && model.family === writer.latest,
  );
  if (!newest) return writer;
  const effort = newest.efforts.includes(writer.effort)
    ? writer.effort
    : newest.defaultEffort;
  return newest.provider === 'claude'
    ? {
        provider: 'claude',
        model: newest.model,
        effort: isClaudeEffort(effort) ? effort : 'high',
        latest: writer.latest,
      }
    : {
        provider: 'codex',
        model: newest.model,
        effort,
        latest: writer.latest,
      };
}
