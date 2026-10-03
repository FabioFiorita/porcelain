export type CodeFolds = { folded: string[]; expanded: string[] };

function strings(items: unknown): items is string[] {
  return (
    Array.isArray(items) && items.every((item) => typeof item === 'string')
  );
}

export function parseCodeFolds(value: unknown): CodeFolds {
  if (
    !value ||
    typeof value !== 'object' ||
    !('folded' in value) ||
    !('expanded' in value)
  )
    return { folded: [], expanded: [] };
  return strings(value.folded) && strings(value.expanded)
    ? { folded: value.folded, expanded: value.expanded }
    : { folded: [], expanded: [] };
}

export function isFolded(folds: CodeFolds, id: string, reviewed = false) {
  return (
    folds.folded.includes(id) || (reviewed && !folds.expanded.includes(id))
  );
}

export function withFolds(
  folds: CodeFolds,
  ids: readonly string[],
  collapsed: boolean,
): CodeFolds {
  const folded = new Set(folds.folded);
  const expanded = new Set(folds.expanded);
  for (const id of ids) {
    if (collapsed) {
      folded.add(id);
      expanded.delete(id);
    } else {
      folded.delete(id);
      expanded.add(id);
    }
  }
  return { folded: [...folded], expanded: [...expanded] };
}
