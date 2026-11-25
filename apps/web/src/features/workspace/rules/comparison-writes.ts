export function comparisonWrites<C>(
  comparisons: readonly C[],
  comparison: C,
  current: (comparison: C) => boolean,
) {
  return {
    discard: current(comparison),
    review: comparisons.every(current),
  };
}
