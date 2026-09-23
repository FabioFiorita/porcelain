import { askHistory } from './run-history.ts';

const NOT_ANCESTOR = 1;
const FATAL = 128;
const UNKNOWN_REVISION =
  /(?:not a valid (?:commit name|object name)|unknown revision|bad revision|ambiguous argument)/iu;

export function isAncestorOfHead(
  checkout: string,
  tip: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return askHistory(
    checkout,
    ['merge-base', '--is-ancestor', tip, 'HEAD'],
    signal,
    (failure) =>
      failure.exitCode === NOT_ANCESTOR ||
      (failure.exitCode === FATAL && UNKNOWN_REVISION.test(failure.stderr)),
  );
}
