export function unspecifiedExports(
  path: string,
  source: string,
  specSource: string | undefined,
): string[];

export function specGapProblems(
  current: readonly string[],
  baseline: readonly string[],
  allowed: readonly string[],
): string[];
