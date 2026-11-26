type Heading = { readonly level: number };

export function topHeadingLevel(headings: readonly Heading[]): number {
  return headings.reduce(
    (top, heading) => Math.min(top, heading.level),
    Number.POSITIVE_INFINITY,
  );
}

export function markdownOutline<Entry extends Heading>(
  all: readonly Entry[],
): readonly Entry[] {
  const titled =
    all[0]?.level === 1 &&
    all.filter((heading) => heading.level === 1).length === 1;
  const headings = titled ? all.slice(1) : all;
  const top = topHeadingLevel(headings);
  const shown = headings.filter((heading) => heading.level < top + 2);
  return shown.length >= 2 ? shown : [];
}
