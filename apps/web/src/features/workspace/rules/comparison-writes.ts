export type ComparisonRead = 'current' | 'retained' | 'missing' | 'never-read';

const settled = (read: ComparisonRead) =>
  read === 'current' || read === 'never-read';

export function fileReviewable(file: readonly ComparisonRead[]) {
  return file.every(settled);
}

export function comparisonWrites(
  file: readonly ComparisonRead[],
  comparison: ComparisonRead,
) {
  return {
    discard: comparison === 'current',
    review: fileReviewable(file),
  };
}
