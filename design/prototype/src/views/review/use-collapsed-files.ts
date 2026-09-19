import { useCallback, useMemo, useState } from 'react';

type StoredFolds = { folded: string[]; expanded: string[] };

const readFolds = (key: string | null): StoredFolds | null => {
  if (key == null) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as StoredFolds);
  } catch {
    return null;
  }
};

export type CollapsedFiles = ReturnType<typeof useCollapsedFiles>;

/**
 * Which files of a multi-file document are folded. Reviewed files fold on
 * their own (`expanded` overrides that); any file folds by hand (`folded`).
 * With `remember`, both sets survive closing the tab and reloading
 * (`porcelain.prototype.collapsed.<worktreeId>.<entry key>`).
 */
export function useCollapsedFiles(remember?: {
  worktreeId: string;
  documentKey: string;
}) {
  const storageKey =
    remember == null
      ? null
      : `porcelain.prototype.collapsed.${remember.worktreeId}.${remember.documentKey}`;
  const [folds, setFolds] = useState(() => {
    const stored = readFolds(storageKey);
    return {
      folded: new Set(stored?.folded ?? []),
      expanded: new Set(stored?.expanded ?? []),
    } as {
      folded: ReadonlySet<string>;
      expanded: ReadonlySet<string>;
    };
  });

  const setCollapsed = useCallback(
    (paths: readonly string[], collapsed: boolean) => {
      setFolds((current) => {
        const folded = new Set(current.folded);
        const expanded = new Set(current.expanded);
        for (const path of paths) {
          if (collapsed) {
            folded.add(path);
            expanded.delete(path);
          } else {
            folded.delete(path);
            expanded.add(path);
          }
        }
        if (storageKey != null) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ folded: [...folded], expanded: [...expanded] }),
          );
        }
        return { folded, expanded };
      });
    },
    [storageKey],
  );

  return useMemo(
    () => ({
      ...folds,
      /** `reviewed` only counts where the document folds reviewed files. */
      isCollapsed: (path: string, reviewed: boolean) =>
        folds.folded.has(path) || (reviewed && !folds.expanded.has(path)),
      setCollapsed,
    }),
    [folds, setCollapsed],
  );
}
