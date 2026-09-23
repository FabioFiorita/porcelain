import { askHistory } from './run-history.ts';

const MISSING = 1;

export function hasHead(
  checkout: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return askHistory(
    checkout,
    ['rev-parse', '--verify', '--quiet', 'HEAD'],
    signal,
    (failure) => failure.exitCode === MISSING,
  );
}
