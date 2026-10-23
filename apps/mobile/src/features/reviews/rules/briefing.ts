import type {
  WalkthroughKey,
  WalkthroughStop,
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
