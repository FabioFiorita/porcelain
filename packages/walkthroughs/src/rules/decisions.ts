import type { WalkthroughContent } from '../models/walkthrough.ts';

type Stops = WalkthroughContent['stops'];

export function callOptions(
  stops: Stops,
  step: number,
  call: number,
): readonly string[] | undefined {
  const callout = stops[step - 1]?.blocks.filter(
    (block) => block.kind === 'callout',
  )[call];
  if (callout?.kind !== 'callout') return undefined;
  return callout.comparison?.columns ?? [];
}

export function isDecisionAllowed(
  stops: Stops,
  step: number,
  call: number,
  option: string | undefined,
): boolean {
  const options = callOptions(stops, step, call);
  if (options === undefined) return false;
  return option === undefined || options.includes(option);
}
