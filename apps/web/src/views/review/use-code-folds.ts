import { useEffect, useState } from 'react';

type Folds = { folded: string[]; expanded: string[] };
const empty: Folds = { folded: [], expanded: [] };
function readFolds(key: string | undefined): Folds {
  try {
    if (!key) return empty;
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('folded' in value) ||
      !('expanded' in value)
    )
      return empty;
    const strings = (items: unknown): items is string[] =>
      Array.isArray(items) && items.every((item) => typeof item === 'string');
    return strings(value.folded) && strings(value.expanded)
      ? { folded: value.folded, expanded: value.expanded }
      : empty;
  } catch {
    return empty;
  }
}

export function useCodeFolds(key?: string) {
  const [state, setState] = useState(() => ({ key, folds: readFolds(key) }));
  if (state.key !== key) setState({ key, folds: readFolds(key) });
  const folds = state.folds;
  useEffect(() => {
    if (!state.key) return;
    try {
      localStorage.setItem(state.key, JSON.stringify(folds));
    } catch {
      /* Reading works without browser storage. */
    }
  }, [folds, state.key]);
  return {
    isCollapsed: (id: string, reviewed = false) =>
      folds.folded.includes(id) || (reviewed && !folds.expanded.includes(id)),
    setCollapsed(ids: readonly string[], collapsed: boolean) {
      setState((currentState) => {
        const current = currentState.folds;
        const folded = new Set(current.folded);
        const expanded = new Set(current.expanded);
        for (const id of ids) {
          if (collapsed) {
            folded.add(id);
            expanded.delete(id);
          } else {
            folded.delete(id);
            expanded.add(id);
          }
        }
        return { key, folds: { folded: [...folded], expanded: [...expanded] } };
      });
    },
  };
}
