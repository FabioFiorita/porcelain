import {
  stopTitle,
  type WalkthroughKey,
  type WalkthroughStop,
} from '@porcelain/client/reviews/rules';

export function briefingContinuation(
  stops: readonly WalkthroughStop[],
  done: (stop: WalkthroughStop) => boolean,
): { key: WalkthroughKey; label: string } | undefined {
  const decisions = stops.filter((stop) => stop.kind === 'decision');
  const next = decisions.find((stop) => !done(stop)) ?? decisions[0];
  return next
    ? { key: next.key, label: `Continue at decision ${next.number}` }
    : undefined;
}

export function stopScreenTitle(
  stop: Exclude<WalkthroughStop, { kind: 'briefing' }>,
  stops: readonly WalkthroughStop[],
): string {
  if (stop.kind !== 'decision') return stopTitle(stop);
  return `Decision ${stop.number} of ${stops.filter((entry) => entry.kind === 'decision').length}`;
}
