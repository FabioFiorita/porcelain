export type ComparisonRead = {
  readonly shown: boolean;
  readonly current: boolean;
};

const retained = (read: ComparisonRead) => read.shown && !read.current;

export function comparisonRead(
  read: ComparisonRead & { readonly unsupported: boolean },
): ComparisonRead {
  return read.unsupported
    ? { shown: false, current: false }
    : { shown: read.shown, current: read.current };
}

export function fileReviewable(file: readonly ComparisonRead[]) {
  return !file.some(retained);
}

export function comparisonWrites(
  file: readonly ComparisonRead[],
  comparison: ComparisonRead,
) {
  return {
    discard: !retained(comparison),
    review: fileReviewable(file),
  };
}
